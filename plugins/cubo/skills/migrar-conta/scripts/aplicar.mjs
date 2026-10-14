#!/usr/bin/env node
// Cria na conta nova o que o plano decidiu, trocando os IDs pelos `refs`. Grava o ledger a cada
// item: se cair no meio, rodar de novo continua de onde parou e não cria nada duas vezes.
//
// Regras:
//   - nunca escreve na conta de origem;
//   - item que já existe na conta nova (mesmo nome) só segue com a decisão da pessoa;
//   - ID que aponta para algo ainda não criado (ciclo: automação que chama automação) vai nulo e
//     volta na 2ª passada;
//   - erro num item não para os outros; quem depende dele espera.
import { createHash } from 'node:crypto'
import { AREA, AREAS, KINDS_DE_DADO, KIND_ARQUIVO, KIND_CHAVE, KIND_PUBLIC_ID, KIND_USUARIO, corpoParaCriar, rotuloDe } from './areas.mjs'
import { aviso, carregar, chaveItem, etapa, mapear, noMapa, pendencia, proximoPasso, registrar, salvar } from './ledger.mjs'
import { ErroApi, acesso, api, falha, lerJson, pasta, todos } from './lib.mjs'
import { aplicarRefs, campoRaiz, semRepetidos } from './refs.mjs'

const ledger = carregar()
if (ledger.etapas.plano.status !== 'feito') falha('o plano ainda não foi feito. Rode antes: node "<scripts>/plano.mjs" --areas=…', 2)
if (ledger.perguntas.length) {
  console.log(`Há ${ledger.perguntas.length} perguntas esperando resposta antes de aplicar:`)
  for (const pergunta of ledger.perguntas) console.log(`  [${pergunta.id}] ${pergunta.texto}`)
  console.log('\nResponda com o decidir.mjs e rode o aplicar de novo.')
  process.exit(3)
}

etapa(ledger, 'aplicar', 'andamento')
salvar(ledger)

const donoDaChave = ledger.destino?.usuario?.id
const origem = {}
const destino = {}

function tirarPendencias(item, filtro = () => true) {
  ledger.pendencias = ledger.pendencias.filter((p) => !(p.kind === item.kind && String(p.origemId) === String(item.origemId) && filtro(p)))
}

// As integrações que dão número a um canal (as mesmas que o Cubo aceita na criação do canal).
const TIPOS_DE_CANAL = ['whatsapp_business', 'zapi', 'instagram']

function registroDeOrigem(kind, id) {
  origem[kind] ||= lerJson(pasta('origem', `${kind}.json`), [])
  return origem[kind].find((registro) => String(registro.id) === String(id))
}

async function listaDoDestino(kind) {
  destino[kind] ||= await todos('destino', AREA[kind].rota)
  return destino[kind]
}

const idDe = (resposta) => resposta?.data?.id ?? resposta?.id

// Impressão digital dos textos grandes enviados: o `conferir` compara com o que a conta nova devolve.
function digitais(area, corpo, anteriores = {}) {
  const resultado = { ...anteriores }
  for (const campo of area.textoGrande || []) {
    if (typeof corpo[campo] !== 'string') continue
    // O Cubo tira os espaços das pontas de todo texto que recebe: a impressão é do texto já aparado.
    const texto = corpo[campo].trim()
    resultado[campo] = { tamanho: texto.length, hash: createHash('sha256').update(texto).digest('hex') }
  }
  return Object.keys(resultado).length ? resultado : undefined
}

// ---------------------------------------------------------------------------------------------
// Arquivos: cada URL da conta antiga é copiada para o storage da conta nova, na pasta da finalidade
// (imagem de produto só vale na pasta de produto). O Cubo NÃO deduplica — cada chamada é uma cópia
// nova que conta na cota —, então o par fica no ledger e o ledger é gravado na hora.

const chaveArquivo = (item, url) => `${AREA[item.kind].proposito}|${url}`

async function copiarArquivos(refs, item) {
  for (const ref of refs) {
    const chave = chaveArquivo(item, ref.id)
    if (ref.kind !== KIND_ARQUIVO || noMapa(ledger, KIND_ARQUIVO, chave) !== undefined) continue
    try {
      const resposta = await api('destino', 'POST', '/api/files/import-url', { url: ref.id, purpose: AREA[item.kind].proposito })
      mapear(ledger, KIND_ARQUIVO, chave, resposta?.data?.url ?? resposta?.url)
    } catch (erro) {
      if (erro instanceof ErroApi && [401, 403, undefined].includes(erro.codigo)) throw erro
      // O Cubo responde 422 com `code: E_STORAGE_QUOTA_EXCEEDED` para chave de API (413 na tela). Parar
      // é o certo: seguir criaria tudo sem as imagens.
      if (erro instanceof ErroApi && (erro.codigo === 413 || erro.corpo?.code === 'E_STORAGE_QUOTA_EXCEEDED')) throw new ErroApi('o espaço de arquivos da conta nova acabou (Armazenamento esgotado). Libere espaço ou aumente o plano da conta nova e rode o aplicar de novo.', { codigo: 413 })
      // Nome com acento, extensão que a pasta não aceita, arquivo apagado, acima de 20 MB: sai da
      // cópia, porque o Cubo recusa arquivo de outra conta.
      mapear(ledger, KIND_ARQUIVO, chave, null)
      pendencia(ledger, `${AREA[item.kind].rotulo} “${item.nome}”: o arquivo ${ref.id} não pôde ser copiado (${erro.message}) e ficou de fora. Suba de novo na conta nova.`, { kind: item.kind, origemId: item.origemId })
    }
    salvar(ledger)
  }
}

// ---------------------------------------------------------------------------------------------
// O destino de cada ref.

function decisorPara(item) {
  const areaAtual = AREA[item.kind]
  const esperando = []
  const decidir = (ref) => {
    const id = String(ref.id)
    if (ref.kind === KIND_USUARIO) {
      const escolha = ledger.decisoes.usuarios[id]
      if (escolha === undefined || escolha === 'dono') return { novo: donoDaChave }
      return { novo: escolha }
    }
    if (KINDS_DE_DADO.has(ref.kind)) return { remover: true }
    if (ref.kind === KIND_ARQUIVO) {
      const novo = noMapa(ledger, KIND_ARQUIVO, chaveArquivo(item, id))
      if (novo === null) return { remover: true }
      return novo === undefined ? { faltando: true } : { novo }
    }
    // A chave de API publicada no formulário do construtor: o Cubo só aceita uma da conta nova, e a
    // da migração (com escrita) não pode ir para uma página. Vai a chave do formulário, que a pessoa
    // criou só para negócios e o `conta.mjs conferir-formulario` conferiu.
    if (ref.kind === KIND_CHAVE) {
      const chave = ledger.chaveFormulario ? acesso('formulario').chave : ''
      return chave ? { novo: chave } : { faltando: true }
    }
    if (ref.kind === KIND_PUBLIC_ID) {
      const novo = noMapa(ledger, KIND_PUBLIC_ID, id)
      if (novo !== undefined) return { novo }
      // O formulário ainda não ficou pronto (esperando campo, funil…): a página espera junto.
      origem.form ||= lerJson(pasta('origem', 'form.json'), [])
      const formulario = origem.form.find((registro) => String(registro.publicId) === id)
      const alvo = formulario && ledger.itens[chaveItem('form', formulario.id)]
      if (alvo && alvo.status !== 'pulado') esperando.push(`formulários “${alvo.nome}”`)
      return { faltando: true }
    }
    if (ref.kind === 'mcp_connection') {
      const escolha = ledger.decisoes.mcp[id]
      if (escolha === 'remover') return { remover: true }
      return escolha !== undefined ? { novo: escolha } : { faltando: true }
    }
    const area = AREA[ref.kind]
    if (!area) return { faltando: true }
    const novo = noMapa(ledger, ref.kind, id)
    if (novo !== undefined) return { novo }
    const alvo = ledger.itens[chaveItem(ref.kind, id)]
    if (!alvo || alvo.status === 'pulado') {
      aviso(ledger, `${areaAtual.rotulo} “${item.nome}” usava ${area.rotulo.toLowerCase()} nº ${id}, que ${alvo ? 'foi pulado' : 'não existe mais na conta antiga'}. Essa ligação foi retirada.`)
      return { remover: true }
    }
    // Ainda vai ser criado (vem depois na ordem, ou é do mesmo tipo e forma ciclo): 2ª passada.
    if (area.ordem > areaAtual.ordem || ref.kind === item.kind) return { adiar: true }
    // Vem antes na ordem e não ficou pronto (erro, esperando decisão): este espera também.
    esperando.push(`${area.rotulo.toLowerCase()} “${alvo.nome}”`)
    return { faltando: true }
  }
  return { decidir, esperando }
}

// ---------------------------------------------------------------------------------------------
// Itens do mesmo tipo que dependem uns dos outros (pasta dentro de pasta): pais primeiro.

function emOrdem(kind, chaves) {
  const pendentes = new Set(chaves)
  const ordem = []
  const visitando = new Set()
  const visita = (chave) => {
    if (!pendentes.has(chave) || visitando.has(chave)) return
    visitando.add(chave)
    const item = ledger.itens[chave]
    const registro = registroDeOrigem(kind, item.origemId)
    for (const ref of registro?.refs || []) if (ref.kind === kind) visita(chaveItem(kind, ref.id))
    pendentes.delete(chave)
    ordem.push(chave)
  }
  for (const chave of chaves) visita(chave)
  return ordem
}

// ---------------------------------------------------------------------------------------------

async function procurarNoDestino(area, corpo) {
  const chave = area.nome(corpo)
  return (await listaDoDestino(area.kind)).find((registro) => area.nome(registro) === chave)
}

// Acha um nome que ainda não existe na conta nova ("X (migrado)", "X (migrado 2)"…) e guarda no item,
// para a retomada procurar pelo nome que nós demos. Só onde o Cubo recusa nome repetido.
async function nomeLivre(area, corpo, item) {
  if (!area.nomeUnico || typeof corpo[area.campoNome] !== 'string') return
  if (item.nomeNoDestino) {
    corpo[area.campoNome] = item.nomeNoDestino
    return
  }
  const original = corpo[area.campoNome]
  for (let n = 1; n < 100; n++) {
    corpo[area.campoNome] = `${original}${area.sufixo(n)}`
    if (!(await procurarNoDestino(area, corpo))) break
  }
  item.nomeNoDestino = corpo[area.campoNome]
  if (item.kind === 'landing') pendencia(ledger, `Landing “${item.nome}”: o endereço /${original.replace(/^\/+/, '')} já estava em uso na conta nova, então a cópia ficou em /${item.nomeNoDestino.replace(/^\/+/, '')}. Troque o endereço na landing, se precisar.`, { kind: item.kind, origemId: item.origemId })
}

async function processar(chave) {
  const item = ledger.itens[chave]
  const area = AREA[item.kind]
  const registro = registroDeOrigem(item.kind, item.origemId)
  if (!registro) {
    item.status = 'erro'
    item.erro = 'o item sumiu da foto da conta antiga; rode o plano de novo'
    return
  }

  // Domínio: o que a pessoa escolheu.
  let base = registro
  if (item.kind === 'domain') {
    const escolha = ledger.decisoes.dominios[item.origemId]
    if (escolha === 'pular') {
      item.status = 'pulado'
      return
    }
    if (escolha?.startsWith('outro:')) base = { ...registro, domain: escolha.slice(6) }
  }

  await copiarArquivos(registro.refs || [], item)
  const { decidir, esperando } = decisorPara(item)
  const trocado = aplicarRefs(base, registro.refs || [], decidir)
  semRepetidos(trocado.registro, registro.refs)
  if (esperando.length) {
    item.status = 'aguardando'
    item.erro = `espera ${[...new Set(esperando)].join(', ')} ficar pronto`
    return
  }
  if (trocado.faltando.length) {
    item.status = 'erro'
    // A chave de API nunca vai para o ledger nem para a tela.
    item.erro = `sem par na conta nova para: ${trocado.faltando.map((ref) => (ref.kind === KIND_CHAVE ? 'a chave do formulário (rode o conferir-formulario)' : `${ref.kind} nº ${ref.id}`)).join(', ')}`
    return
  }
  const corpo = corpoParaCriar(area, trocado.registro, { destino: ledger.destino?.base })
  for (const [campo, limite] of Object.entries(area.limites || {})) {
    const tamanho = typeof corpo[campo] === 'string' ? corpo[campo].trim().length : 0
    if (tamanho > limite) {
      item.status = 'erro'
      item.erro = `tem ${tamanho.toLocaleString('pt-BR')} caracteres, e a conta nova aceita até ${limite.toLocaleString('pt-BR')}. Divida em duas na conta antiga e rode o plano de novo.`
      return
    }
  }

  // Tipo que só pode existir uma vez na conta (campo de cidade, de estado): se a conta nova já tem, é
  // esse que vale, qualquer que tenha sido a escolha — criar outro o Cubo recusa.
  const unico = area.unicoNaConta?.(corpo)
  if (unico && item.status !== 'enviando') {
    const jaTem = (await listaDoDestino(item.kind)).find((registro) => area.unicoNaConta(registro) === unico)
    if (jaTem) {
      tirarPendencias(item)
      item.status = 'usado'
      item.destinoId = jaTem.id
      mapear(ledger, item.kind, item.origemId, jaTem.id)
      aviso(ledger, `${area.rotulo} “${item.nome}”: a conta nova já tem um campo do tipo ${unico === 'city' ? 'cidade' : 'estado'} (“${rotuloDe(jaTem)}”), e só pode haver um. A cópia usa esse.`)
      return
    }
  }

  // "Criar outro igual" onde o Cubo não aceita nome repetido: o novo ganha um sufixo. Antes da busca
  // abaixo, para a retomada achar o que nós criamos, e não o que já existia.
  if (ledger.decisoes.existentes[chave] === 'criar' || item.nomeNoDestino) await nomeLivre(area, corpo, item)

  // Já existe na conta nova? Se caiu no meio de um envio, o que existe é o que nós criamos.
  if (item.status === 'enviando' || ledger.decisoes.existentes[chave] !== 'criar') {
    const par = await procurarNoDestino(area, corpo)
    if (par && item.status === 'enviando') {
      item.status = 'criado'
      item.destinoId = par.id
      mapear(ledger, item.kind, item.origemId, par.id)
      if (trocado.adiados.length) item.segundaPassada = [...new Set(trocado.adiados.map(campoRaiz))]
      return
    }
    if (par) {
      // Domínio não se repete no Cubo: o que a pessoa escolheu e já está na conta nova é o que vale.
      const escolha = item.kind === 'domain' ? 'usar' : ledger.decisoes.existentes[chave] || ledger.decisoes.existentesTodos
      if (!escolha) {
        const id = `existente:${chave}`
        if (!ledger.perguntas.some((pergunta) => pergunta.id === id)) {
          // O nome do que vai ser criado (o domínio escolhido, não o antigo), e se o que existe é uma
          // cópia que esta migração acabou de fazer de outro item da conta antiga com o mesmo nome.
          const copia = Object.values(ledger.mapa[item.kind] || {}).some((id) => String(id) === String(par.id))
          const texto = `${area.rotulo}: “${rotuloDe(corpo)}” já existe na conta nova${copia ? ' (é a cópia de outro item da conta antiga com o mesmo nome, criada agora pela migração)' : ''}. Usar o que já existe, criar outro igual, ou pular?`
          ledger.perguntas.push({ id, tipo: 'existente', chave, destinoId: par.id, texto })
        }
        item.status = 'pendente'
        return
      }
      if (escolha === 'usar') {
        // O que já existia é da pessoa: as tarefas de "ligar, reconectar, revisar" não são desta cópia.
        tirarPendencias(item)
        item.status = 'usado'
        item.destinoId = par.id
        mapear(ledger, item.kind, item.origemId, par.id)
        // A landing em HTML aponta para o formulário pelo código público (`frm_…`), não pelo número.
        if (item.kind === 'form' && registro.publicId && par.publicId) mapear(ledger, KIND_PUBLIC_ID, registro.publicId, par.publicId)
        return
      }
      if (escolha === 'pular') {
        item.status = 'pulado'
        return
      }
      // "Criar" valendo para todos: este só se descobriu repetido agora.
      await nomeLivre(area, corpo, item)
    }
  }

  item.status = 'enviando'
  salvar(ledger)
  try {
    const resposta = await api('destino', 'POST', area.rota, corpo)
    const novoId = idDe(resposta)
    if (novoId === undefined) throw new Error('a conta nova não devolveu o número do item criado')
    item.status = 'criado'
    item.destinoId = novoId
    item.trocas = trocado.trocas
    item.textos = digitais(area, corpo)
    mapear(ledger, item.kind, item.origemId, novoId)
    if (item.kind === 'form' && registro.publicId) mapear(ledger, KIND_PUBLIC_ID, registro.publicId, resposta?.data?.publicId ?? resposta?.publicId)
    if (trocado.adiados.length) item.segundaPassada = [...new Set(trocado.adiados.map(campoRaiz))]
    delete item.erro
    // O canal que esperava a conexão saiu: o "conecte e rode de novo" das rodadas anteriores já foi feito.
    if (area.aguardaConexao) tirarPendencias(item, (p) => p.texto.includes(': conecte a integração dele'))
    destino[item.kind]?.push({ ...corpo, id: novoId })
  } catch (erro) {
    if (erro instanceof ErroApi && (erro.codigo === 401 || erro.codigo === 403 || erro.codigo === undefined)) throw erro
    if (area.aguardaConexao && erro.codigo === 422) {
      // Canal preso, na conta antiga, a uma integração que não é de canal (dado antigo): conectar não
      // resolve, e esperar seria para sempre.
      const integracao = registroDeOrigem('integration', registro.integrationId)
      if (integracao && !TIPOS_DE_CANAL.includes(integracao.type)) {
        tirarPendencias(item)
        item.status = 'pulado'
        item.erro = `na conta antiga, está ligado à integração “${integracao.name}” (${integracao.type}), que não é de WhatsApp, Z-API nem Instagram`
        pendencia(ledger, `Canal “${item.nome}”: não foi copiado, porque na conta antiga ele está ligado à integração “${integracao.name}” (${integracao.type}), que não é de canal. Se ele ainda for usado, crie o canal na tela da conta nova (Canais → novo).`, { kind: item.kind, origemId: item.origemId })
        return
      }
      item.status = 'aguardando'
      item.erro = erro.message
      pendencia(ledger, `Canal “${item.nome}”: conecte a integração dele na conta nova e rode a migração de novo para criar o canal.`, { kind: item.kind, origemId: item.origemId })
      return
    }
    if (item.kind === 'domain' && erro.codigo === 422) {
      item.status = 'aguardando'
      item.erro = erro.message
      pendencia(ledger, `Domínio ${corpo.domain}: ainda está em outra conta. Na conta antiga, mova ou exclua as páginas e formulários que usam esse domínio (inclusive os da lixeira: esvazie a lixeira), exclua o domínio (Configurações → Domínios → excluir) e rode a migração de novo. As páginas dele ficam fora do ar até a conta nova verificar o domínio.`, { kind: item.kind, origemId: item.origemId })
      return
    }
    item.status = 'erro'
    item.erro = erro.message
  }
}

// 2ª passada: com tudo criado, manda de novo só os campos que tinham ligação adiada.
async function segundaPassada() {
  const itens = Object.entries(ledger.itens).filter(([, item]) => item.status === 'criado' && item.segundaPassada?.length)
  if (!itens.length) {
    // Numa nova rodada, não apaga o que a anterior ligou.
    if (ledger.etapas['segunda-passada'].status !== 'feito') etapa(ledger, 'segunda-passada', 'feito', 'nada a ligar')
    return
  }
  etapa(ledger, 'segunda-passada', 'andamento')
  let faltam = 0
  for (const [, item] of itens) {
    const area = AREA[item.kind]
    const registro = registroDeOrigem(item.kind, item.origemId)
    const { decidir } = decisorPara(item)
    const trocado = aplicarRefs(registro, registro.refs || [], decidir)
    semRepetidos(trocado.registro, registro.refs)
    if (trocado.adiados.length || trocado.faltando.length) {
      faltam++
      continue
    }
    const corpo = {}
    for (const campo of item.segundaPassada) corpo[campo] = trocado.registro[campo]
    try {
      await api('destino', 'PUT', `${area.rota}/${item.destinoId}`, corpo)
      delete item.segundaPassada
      item.trocas = (item.trocas || 0) + trocado.trocas
      item.textos = digitais(area, corpo, item.textos)
    } catch (erro) {
      if (erro instanceof ErroApi && [401, 403, undefined].includes(erro.codigo)) throw erro
      faltam++
      item.erro = `2ª passada: ${erro.message}`
    }
    salvar(ledger)
  }
  etapa(ledger, 'segunda-passada', faltam ? 'bloqueado' : 'feito', faltam ? `${faltam} itens ainda sem todas as ligações` : `${itens.length} itens ligados`)
}

// Funil nasce sem etapas e cada etapa nova vai para o fim: com todas criadas, a ordem da conta antiga
// vai de uma vez (o Cubo exige a lista inteira das etapas do funil).
async function ordenarEtapas() {
  for (const funil of Object.values(ledger.itens)) {
    if (funil.kind !== 'pipe' || funil.status !== 'criado' || funil.etapasOrdenadas) continue
    const etapas = Object.values(ledger.itens).filter((item) => item.kind === 'stage' && String(registroDeOrigem('stage', item.origemId)?.pipeId) === String(funil.origemId))
    if (!etapas.length || etapas.some((item) => !['criado', 'usado', 'pulado'].includes(item.status))) continue
    const ordemNaOrigem = (item) => Number(registroDeOrigem('stage', item.origemId)?.orderNr ?? 0)
    const nossas = etapas.filter((item) => item.destinoId).sort((a, b) => ordemNaOrigem(a) - ordemNaOrigem(b)).map((item) => item.destinoId)
    try {
      const doFunil = await todos('destino', `/api/stages?pipe=${funil.destinoId}`)
      const outras = doFunil.map((etapa) => etapa.id).filter((id) => !nossas.includes(id))
      await api('destino', 'PUT', `/api/pipes/${funil.destinoId}/stages-order`, { stageIds: [...nossas, ...outras] })
      funil.etapasOrdenadas = true
    } catch (erro) {
      if (erro instanceof ErroApi && [401, 403, undefined].includes(erro.codigo)) throw erro
      aviso(ledger, `Funil “${funil.nome}”: não consegui pôr as etapas na ordem da conta antiga (${erro.message}). Arraste na tela do funil.`)
      funil.etapasOrdenadas = true
    }
    salvar(ledger)
  }
}

// Automação que estava publicada na conta antiga é publicada também na nova, depois de todas as
// ligações (o PUT da 2ª passada troca o rascunho). Publicar não liga: ela continua desligada.
async function publicarAutomacoes() {
  for (const item of Object.values(ledger.itens)) {
    if (item.kind !== 'automation' || item.status !== 'criado' || item.publicada || item.segundaPassada?.length) continue
    if (registroDeOrigem('automation', item.origemId)?.publishedVersion == null) continue
    try {
      await api('destino', 'POST', `/api/automations/${item.destinoId}/publish`, {})
      item.publicada = true
      delete item.erro
    } catch (erro) {
      if (erro instanceof ErroApi && [401, 403, undefined].includes(erro.codigo)) throw erro
      item.erro = `publicar: ${erro.message}`
      aviso(ledger, `Automação “${item.nome}”: foi criada, mas não consegui publicar (${erro.message}). Abra, confira e publique na tela.`)
      item.publicada = false
    }
    salvar(ledger)
  }
}

// ---------------------------------------------------------------------------------------------

try {
  for (const area of AREAS) {
    const chaves = Object.keys(ledger.itens).filter((chave) => {
      const item = ledger.itens[chave]
      return item.kind === area.kind && ['pendente', 'enviando', 'erro', 'aguardando'].includes(item.status)
    })
    if (!chaves.length) continue
    for (const chave of emOrdem(area.kind, chaves)) {
      await processar(chave)
      salvar(ledger)
    }
    const doTipo = Object.values(ledger.itens).filter((item) => item.kind === area.kind)
    const prontos = doTipo.filter((item) => ['criado', 'usado', 'pulado'].includes(item.status)).length
    console.log(`  ${prontos === doTipo.length ? '✔' : '…'} ${area.rotulo}: ${prontos}/${doTipo.length} prontos`)
    if (area.kind === 'stage') await ordenarEtapas()
  }
  await ordenarEtapas()
  await segundaPassada()
  await publicarAutomacoes()
} catch (erro) {
  etapa(ledger, 'aplicar', 'erro', erro.message)
  registrar(ledger, `Aplicar parou: ${erro.message}`)
  salvar(ledger)
  falha(`${erro.message}\nNada se perdeu: corrija e rode o aplicar de novo, ele continua de onde parou.`)
}

const todosItens = Object.values(ledger.itens)
const conta = (status) => todosItens.filter((item) => item.status === status).length
const resumo = `${conta('criado')} criados, ${conta('usado')} já existiam (usados), ${conta('pulado')} pulados, ${conta('aguardando')} aguardando, ${conta('erro')} com erro`
const terminou = !ledger.perguntas.length && !conta('erro') && !conta('aguardando') && !conta('pendente') && !conta('enviando')
etapa(ledger, 'aplicar', terminou ? 'feito' : 'bloqueado', resumo)
registrar(ledger, `Aplicar: ${resumo}`)
salvar(ledger)

console.log(`\n${resumo}.`)
for (const item of todosItens.filter((i) => i.status === 'erro' || i.status === 'aguardando')) {
  console.log(`  ${item.status === 'erro' ? '✘' : '⏳'} ${AREA[item.kind].rotulo} “${item.nome}”: ${item.erro}`)
}
if (ledger.perguntas.length) {
  console.log(ledger.perguntas.length === 1 ? '\nApareceu 1 pergunta nova:' : `\nApareceram ${ledger.perguntas.length} perguntas novas:`)
  for (const pergunta of ledger.perguntas) console.log(`  [${pergunta.id}] ${pergunta.texto}`)
  console.log('Responda com o decidir.mjs e rode o aplicar de novo.')
  process.exit(3)
}
console.log(`\nPróximo passo: ${proximoPasso(ledger)}`)
if (!terminou) process.exit(4)
