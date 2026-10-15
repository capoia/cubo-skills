#!/usr/bin/env node
// Editar um fluxo, passo a passo (cada comando é um passo da skill; o estado fica em
// `cubo/trabalho/fluxo-<id>.json`):
//   ler <id|nome>                 lê o RASCUNHO com o ETag, guarda a cópia de segurança, mostra o roteiro
//   previa <id> @mudancas.json    aplica a lista de mudanças numa cópia, valida e mostra o antes → depois
//   gravar <id>                   grava o rascunho com If-Match (412: relê, reaplica e pede para conferir de novo)
//   publicar <id>                 publica o rascunho (o que está ligado passa a rodar a versão nova)
//   ligar <id> · desligar <id>
//   desfazer <id> [--copia=<arquivo>]   volta rascunho, publicado e ligado/desligado ao da cópia
import { api, desembrulhar, ErroApi } from '../api.mjs'
import { AVISO } from '../aviso.mjs'
import { guardarCopia, pegarCopia } from '../copias.mjs'
import { abrirNoSistema, argumentos, falha, gravarJson, gravarTexto, lerJson, lerJsonEntrada, pasta } from '../lib.mjs'
import { contarProblemas, contexto, juntarProblemas, lerFluxo, paginaDoFluxo, problemasEmTexto, validar, acharFluxo } from './comum.mjs'
import { descrever, diferencas, refsLocais, roteiro } from './descrever.mjs'
import { ErroMudanca, aplicarMudancas, conferirLimites } from './mudancas.mjs'
import { nosDoFluxo } from './modelo.mjs'
import { IMPEDEM_GRAVAR } from './regras.mjs'
import { esc } from '../pagina.mjs'

const USO = `uso:
  editar.mjs ler <id|nome>
  editar.mjs previa <id> @mudancas.json
  editar.mjs gravar <id>
  editar.mjs publicar <id>
  editar.mjs ligar <id> | desligar <id>
  editar.mjs desfazer <id> [--copia=<arquivo>]`


const arquivoTrabalho = (id) => pasta('trabalho', `fluxo-${id}.json`)
function trabalho(id) {
  const t = lerJson(arquivoTrabalho(id), null)
  if (!t) falha(`rode antes: editar.mjs ler ${id}`, 2)
  return t
}

// O que vai no PUT: o fluxo inteiro (o PUT substitui o rascunho) e o nome.
const corpoDoPut = (fluxo) => ({ name: fluxo.name, flowData: { nodes: nosDoFluxo(fluxo), edges: fluxo.flowData?.edges ?? [] } })

async function ler(alvo) {
  const id = await acharFluxo(alvo)
  const { fluxo: rascunho, etag } = await lerFluxo(id, { versao: 'draft' })
  const publicado = rascunho.publishedVersion === null || rascunho.publishedVersion === undefined ? null : (await lerFluxo(id, { versao: 'published', refs: false })).fluxo
  const copia = guardarCopia('fluxo', id, { nome: rascunho.name, status: rascunho.status, rascunho: corpoDoPut(rascunho), publicado: publicado ? corpoDoPut(publicado) : null, publishedVersion: rascunho.publishedVersion ?? null })
  gravarJson(arquivoTrabalho(id), { id, etag, lidoEm: new Date().toISOString(), copia, rascunho, mudancas: null, novo: null })
  const ctx = await contexto(rascunho.refs || [])
  console.log(roteiro(descrever(rascunho, ctx)))
  console.log('')
  console.log(`Cópia de segurança guardada: ${copia}`)
  if (rascunho.status === 'active') console.log('ATENÇÃO: este fluxo está LIGADO. Gravar mexe só no rascunho; a mudança só vai ao ar quando publicar.')
  if (publicado && rascunho.hasUnpublishedChanges) {
    const dif = diferencas(publicado, rascunho)
    if (!dif.igual) console.log(`ATENÇÃO: já há mudanças salvas e NÃO PUBLICADAS no rascunho (${[...dif.adicionados.map((n) => `entra “${n.titulo || n.tipo}”`), ...dif.removidos.map((n) => `sai “${n.titulo || n.tipo}”`), ...dif.alterados.map((n) => `muda “${n.titulo || n.tipo}”`)].join('; ') || 'ligações'}). A edição vai em cima delas, e publicar leva tudo junto. Diga isso à pessoa.`)
  }
  if (!publicado) console.log('Este fluxo nunca foi publicado.')
}

// Aplica e valida; grava a prévia no trabalho. Usado também pelo 412 (reaplicar).
async function montarPrevia(t, mudancas) {
  const ctx = await contexto(t.rascunho.refs || [])
  const { fluxo: novo, feito } = aplicarMudancas(t.rascunho, mudancas, ctx)
  const limites = conferirLimites(novo, ctx.cat.limits)
  if (limites.length) throw new ErroMudanca(limites.join(' '))
  novo.refs = refsLocais(novo, ctx.defs, ctx.gatilhos)
  await ctx.nomes.carregar(novo.refs.map((r) => r.kind))
  const validacao = await validar(corpoDoPut(novo), t.id)
  const descricao = descrever(novo, ctx)
  const problemas = juntarProblemas({ fluxo: novo, validacao, defs: ctx.defs, descricao, nomes: ctx.nomes })
  const dif = diferencas(t.rascunho, novo)
  return { novo, feito, validacao, descricao, problemas, dif }
}

function mostrarPrevia(id, p, titulo) {
  const conta = contarProblemas(p.problemas)
  const travam = (p.validacao.errors || []).filter((e) => IMPEDEM_GRAVAR.includes(e.code))
  const naoPublica = (p.validacao.errors || []).filter((e) => !IMPEDEM_GRAVAR.includes(e.code))
  const html = paginaDoFluxo({
    dados: { descricao: p.descricao, problemas: p.problemas, caminhos: [], usos: null, nosOriginais: nosDoFluxo(p.novo) },
    textoDoClaude: { resumo: `Prévia: ainda NÃO foi gravado. ${AVISO}` },
    titulo,
    subtitulo: 'Prévia antes de gravar',
    extra: [{ id: 'mudancas', titulo: 'O que muda', html: `<ul>${p.feito.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` }],
  })
  const arquivo = pasta('previas', `fluxo-${id}.html`)
  gravarTexto(arquivo, html)
  abrirNoSistema(arquivo)
  console.log(['O QUE MUDA:', ...p.feito.map((f) => `  - ${f}`), '', roteiro(p.descricao), '', `PROBLEMAS: ${conta.erro} erro(s), ${conta.aviso} aviso(s), ${conta.nota} observação(ões)`, problemasEmTexto(p.problemas), '', `Prévia em página: ${arquivo}`].join('\n'))
  if (travam.length) console.log('\nRESULTADO: NÃO DÁ PARA GRAVAR assim (o Cubo recusa). Corrija a lista de mudanças e rode a prévia de novo.')
  else if (naoPublica.length) console.log('\nRESULTADO: dá para GRAVAR, mas NÃO para PUBLICAR enquanto houver erro. Confirme com a pessoa antes de gravar.')
  else console.log('\nRESULTADO: pronto para gravar. Mostre o que muda e pergunte à pessoa antes de gravar.')
  console.log(`\n${AVISO}`)
  return travam.length ? 1 : 0
}

async function previa(id, entrada) {
  const t = trabalho(id)
  const mudancas = lerJsonEntrada(entrada, 'lista de mudanças')
  let p
  try {
    p = await montarPrevia(t, mudancas)
  } catch (erro) {
    if (erro instanceof ErroMudanca) falha(erro.message, 1)
    throw erro
  }
  gravarJson(arquivoTrabalho(id), { ...t, mudancas, novo: p.novo, validacao: p.validacao, previaEm: new Date().toISOString() })
  process.exit(mostrarPrevia(id, p, `Prévia: ${p.novo.name}`))
}

async function gravar(id) {
  const t = trabalho(id)
  if (!t.novo) falha(`faça a prévia antes: editar.mjs previa ${id} @mudancas.json`, 2)
  if (t.gravadoEm && t.gravadoEm > (t.previaEm ?? '')) falha('esta prévia já foi gravada. Para mudar mais, rode ler e previa de novo.', 2)
  if ((t.validacao?.errors || []).some((e) => IMPEDEM_GRAVAR.includes(e.code))) falha('a prévia tem erro que impede gravar. Corrija e rode a prévia de novo.', 2)
  try {
    const { corpo, etag } = await api('PUT', `/api/automations/${id}`, corpoDoPut(t.novo), { completo: true, cabecalhos: { 'If-Match': t.etag } })
    const gravado = desembrulhar(corpo)
    gravarJson(arquivoTrabalho(id), { ...t, etag, rascunho: { ...gravado, refs: t.novo.refs }, gravadoEm: new Date().toISOString() })
    console.log(`Gravado no rascunho do fluxo #${id}. O que está no ar NÃO mudou: para isso, publique.`)
    for (const aviso of corpo?.warnings || []) console.log(`  aviso do Cubo: ${aviso.message}`)
    console.log(`Para voltar atrás: editar.mjs desfazer ${id}`)
  } catch (erro) {
    if (!(erro instanceof ErroApi) || erro.codigo !== 412) throw erro
    // Alguém mudou no meio: relê, reaplica a MESMA lista e mostra de novo. Não grava sozinho.
    const { fluxo: rascunho, etag } = await lerFluxo(id, { versao: 'draft' })
    const novoT = { ...t, etag, rascunho, novo: null }
    let p
    try {
      p = await montarPrevia(novoT, t.mudancas)
    } catch (e) {
      gravarJson(arquivoTrabalho(id), novoT)
      if (e instanceof ErroMudanca) falha(`alguém mudou este fluxo no Cubo enquanto eu trabalhava, e a lista de mudanças não se aplica mais: ${e.message}\nMostre isso à pessoa e refaça a lista.`, 1)
      throw e
    }
    gravarJson(arquivoTrabalho(id), { ...novoT, novo: p.novo, validacao: p.validacao, previaEm: new Date().toISOString() })
    console.log('ATENÇÃO: alguém mudou este fluxo no Cubo enquanto eu trabalhava (412). NADA foi gravado.')
    console.log('Reli o fluxo e reapliquei a mesma lista. Mostre a prévia nova à pessoa e, com o ok dela, rode gravar de novo.\n')
    mostrarPrevia(id, p, `Prévia (refeita): ${p.novo.name}`)
    process.exit(5)
  }
}

async function publicar(id) {
  try {
    await api('POST', `/api/automations/${id}/publish`)
  } catch (erro) {
    if (erro instanceof ErroApi && erro.codigo === 422) falha(`o Cubo não publicou: o rascunho tem erros.\n  - ${(erro.corpo?.errors || []).map((e) => e.message).join('\n  - ') || erro.message}`, 1)
    throw erro
  }
  const t = lerJson(arquivoTrabalho(id), null)
  if (t) gravarJson(arquivoTrabalho(id), { ...t, publicadoEm: new Date().toISOString() })
  const { fluxo } = await lerFluxo(id, { versao: 'published', refs: false })
  console.log(`Publicado: o fluxo #${id} “${fluxo.name}” agora roda a versão nova${fluxo.status === 'active' ? ' (ele está LIGADO: já vale para os próximos contatos)' : ' (ele está desligado: nada roda até ligar)'}.`)
}

async function mudarStatus(id, status) {
  try {
    await api('POST', `/api/automations/${id}/toggle-status`, { status })
  } catch (erro) {
    if (erro instanceof ErroApi && erro.codigo === 422) falha(`o Cubo não ${status === 'active' ? 'ligou' : 'desligou'}: ${erro.message}`, 1)
    throw erro
  }
  console.log(status === 'active' ? `Ligado: o fluxo #${id} começa a rodar nos próximos gatilhos.` : `Desligado: o fluxo #${id} não começa mais para ninguém.`)
}

async function desfazer(id, opcoes) {
  const { conteudo: copia, arquivo, quando } = pegarCopia('fluxo', id, opcoes.copia)
  const { fluxo: atual, etag } = await lerFluxo(id, { versao: 'draft', refs: false })
  console.log(`Voltando o fluxo #${id} à cópia de ${quando.replace('T', ' ')} (${arquivo}).`)
  let marca = etag
  const put = async (corpo) => {
    try {
      const r = await api('PUT', `/api/automations/${id}`, corpo, { completo: true, cabecalhos: { 'If-Match': marca } })
      marca = r.etag
    } catch (erro) {
      if (erro instanceof ErroApi && erro.codigo === 422) falha(`o Cubo não aceita gravar a cópia de volta: ela aponta para algo que não existe mais nesta conta (apagado depois da cópia).\n  ${erro.message}\nO fluxo ficou como estava antes do desfazer${marca !== etag ? ' (menos a versão publicada, que já voltou)' : ''}. Para voltar mesmo assim, recrie o item que falta (itens.mjs) ou ajuste a cópia com a pessoa.`, 1)
      throw erro
    }
  }
  // Publicado primeiro (PUT + publish), depois o rascunho volta ao que era: assim os dois ficam iguais aos da cópia.
  const publicadoAgora = atual.publishedVersion === null || atual.publishedVersion === undefined ? null : (await lerFluxo(id, { versao: 'published', refs: false })).fluxo
  const mesmoFluxo = (a, b) => JSON.stringify(a?.flowData ?? null) === JSON.stringify(b?.flowData ?? null)
  if (copia.publicado && publicadoAgora && !mesmoFluxo(copia.publicado, corpoDoPut(publicadoAgora))) {
    await put(copia.publicado)
    await api('POST', `/api/automations/${id}/publish`)
    marca = (await lerFluxo(id, { versao: 'draft', refs: false })).etag
    console.log('  ✔ versão publicada de volta à da cópia')
  } else if (!copia.publicado && publicadoAgora) {
    console.log('  ! a cópia é de antes da primeira publicação, e o Cubo não "despublica": a versão publicada fica. Se não quiser que rode, desligue o fluxo.')
  }
  await put(copia.rascunho)
  console.log('  ✔ rascunho de volta ao da cópia')
  const statusAgora = (await lerFluxo(id, { versao: 'draft', refs: false })).fluxo.status
  const eraLigado = copia.status === 'active'
  if (eraLigado !== (statusAgora === 'active') && (copia.publicado || !eraLigado)) {
    await api('POST', `/api/automations/${id}/toggle-status`, { status: eraLigado ? 'active' : 'inactive' })
    console.log(`  ✔ ${eraLigado ? 'ligado' : 'desligado'} de novo, como estava`)
  }
  const t = lerJson(arquivoTrabalho(id), null)
  if (t) gravarJson(arquivoTrabalho(id), { ...t, novo: null, desfeitoEm: new Date().toISOString() })
  console.log('Pronto: desfeito. Os itens criados para este fluxo (tags, etapas…) continuam na conta: veja itens.mjs listar-criados.')
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2))
const [comando, alvo, entrada] = posicionais
if (comando === 'ler') await ler(posicionais.slice(1).join(' '))
else if (!/^\d+$/.test(String(alvo ?? ''))) falha(USO, 2)
else if (comando === 'previa') await previa(Number(alvo), entrada)
else if (comando === 'gravar') await gravar(Number(alvo))
else if (comando === 'publicar') await publicar(Number(alvo))
else if (comando === 'ligar') await mudarStatus(Number(alvo), 'active')
else if (comando === 'desligar') await mudarStatus(Number(alvo), 'inactive')
else if (comando === 'desfazer') await desfazer(Number(alvo), opcoes)
else falha(USO, 2)
