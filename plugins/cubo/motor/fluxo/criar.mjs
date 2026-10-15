#!/usr/bin/env node
// Criar um fluxo do zero:
//   previa @mudancas.json --nome="…"   monta a partir do vazio, valida e mostra a página
//   gravar                             cria no Cubo (nasce RASCUNHO e DESLIGADO); rodar de novo não duplica
// Depois, publicar e ligar são os mesmos do editar: editar.mjs publicar <id> · editar.mjs ligar <id>.
import { api, desembrulhar, ErroApi } from '../api.mjs'
import { AVISO } from '../aviso.mjs'
import { abrirNoSistema, argumentos, falha, gravarJson, gravarTexto, lerJson, lerJsonEntrada, pasta } from '../lib.mjs'
import { esc } from '../pagina.mjs'
import { contarProblemas, contexto, juntarProblemas, paginaDoFluxo, problemasEmTexto, validar } from './comum.mjs'
import { descrever, refsLocais, roteiro } from './descrever.mjs'
import { IMPEDEM_GRAVAR } from './regras.mjs'
import { ErroMudanca, aplicarMudancas, conferirLimites } from './mudancas.mjs'
import { nosDoFluxo } from './modelo.mjs'

const arquivoTrabalho = () => pasta('trabalho', 'fluxo-novo.json')

async function previa(entrada, opcoes) {
  const anterior = lerJson(arquivoTrabalho(), null)
  if (anterior?.criadoId && !opcoes.outro) falha(`o fluxo desta prévia já foi criado (#${anterior.criadoId}). Para mudar, use editar.mjs ler ${anterior.criadoId}. Para começar outro fluxo do zero, rode com --outro.`, 2)
  const nome = opcoes.nome
  if (!nome || nome === true) falha('diga o nome do fluxo: --nome="Boas-vindas do WhatsApp"', 2)
  const mudancas = lerJsonEntrada(entrada, 'lista de mudanças')
  const ctx = await contexto([])
  const vazio = { id: null, name: nome, status: 'draft', publishedVersion: null, flowData: { nodes: [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { triggers: [] } }], edges: [] } }
  let novo
  let feito
  try {
    ;({ fluxo: novo, feito } = aplicarMudancas(vazio, mudancas, ctx))
    const limites = conferirLimites(novo, ctx.cat.limits)
    if (limites.length) throw new ErroMudanca(limites.join(' '))
  } catch (erro) {
    if (erro instanceof ErroMudanca) falha(erro.message, 1)
    throw erro
  }
  novo.refs = refsLocais(novo, ctx.defs, ctx.gatilhos)
  await ctx.nomes.carregar(novo.refs.map((r) => r.kind))
  const corpo = { name: novo.name, flowData: novo.flowData, ...(opcoes.pasta ? { folderId: Number(opcoes.pasta) } : {}) }
  const validacao = await validar(corpo)
  const descricao = descrever(novo, ctx)
  const problemas = juntarProblemas({ fluxo: novo, validacao, defs: ctx.defs, descricao, nomes: ctx.nomes })
  gravarJson(arquivoTrabalho(), { corpo, mudancas, validacao, previaEm: new Date().toISOString(), criadoId: null })

  const html = paginaDoFluxo({
    dados: { descricao, problemas, caminhos: [], usos: null, nosOriginais: nosDoFluxo(novo) },
    textoDoClaude: { resumo: `Prévia: ainda NÃO foi criado. ${AVISO}` },
    titulo: `Prévia: ${nome}`,
    subtitulo: 'Fluxo novo, antes de criar',
    extra: [{ id: 'mudancas', titulo: 'O que vai ser criado', html: `<ul>${feito.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` }],
  })
  const arquivo = pasta('previas', 'fluxo-novo.html')
  gravarTexto(arquivo, html)
  abrirNoSistema(arquivo)
  const conta = contarProblemas(problemas)
  console.log([roteiro(descricao), '', `PROBLEMAS: ${conta.erro} erro(s), ${conta.aviso} aviso(s), ${conta.nota} observação(ões)`, problemasEmTexto(problemas), '', `Prévia em página: ${arquivo}`].join('\n'))
  const travam = (validacao.errors || []).filter((e) => IMPEDEM_GRAVAR.includes(e.code))
  if (travam.length) console.log('\nRESULTADO: NÃO DÁ PARA CRIAR assim (o Cubo recusa). Corrija a lista e rode a prévia de novo.')
  else if ((validacao.errors || []).length) console.log('\nRESULTADO: dá para CRIAR, mas NÃO para PUBLICAR enquanto houver erro. Confirme com a pessoa.')
  else console.log('\nRESULTADO: pronto para criar. Mostre a prévia e pergunte à pessoa antes.')
  console.log(`\n${AVISO}`)
  process.exit(travam.length ? 1 : 0)
}

async function gravar() {
  const t = lerJson(arquivoTrabalho(), null)
  if (!t) falha('faça a prévia antes: criar.mjs previa @mudancas.json --nome="…"', 2)
  if (t.criadoId) {
    console.log(`Este fluxo já foi criado: #${t.criadoId}. Nada a fazer.`)
    return
  }
  if ((t.validacao?.errors || []).some((e) => IMPEDEM_GRAVAR.includes(e.code))) falha('a prévia tem erro que impede criar. Corrija e rode a prévia de novo.', 2)
  // Marca antes de mandar: se a rede cair depois do POST, rodar de novo não duplica às cegas.
  gravarJson(arquivoTrabalho(), { ...t, enviandoEm: new Date().toISOString() })
  if (t.enviandoEm) falha(`uma tentativa anterior de criar caiu no meio (${t.enviandoEm}). Confira no Cubo (Automações) se “${t.corpo.name}” já existe antes de tentar de novo; se não existir, apague o campo "enviandoEm" de ${arquivoTrabalho()}.`, 2)
  let corpo
  try {
    ;({ corpo } = await api('POST', '/api/automations', t.corpo, { completo: true }))
  } catch (erro) {
    // O Cubo respondeu com erro: não criou nada, pode tentar de novo.
    if (erro instanceof ErroApi && erro.codigo) gravarJson(arquivoTrabalho(), { ...t, enviandoEm: null })
    throw erro
  }
  const criado = desembrulhar(corpo)
  gravarJson(arquivoTrabalho(), { ...t, enviandoEm: null, criadoId: criado.id, criadoEm: new Date().toISOString() })
  console.log(`Criado: fluxo #${criado.id} “${criado.name}”, como RASCUNHO e DESLIGADO. Nada roda ainda.`)
  for (const aviso of corpo?.warnings || []) console.log(`  aviso do Cubo: ${aviso.message}`)
  console.log(`Para publicar: editar.mjs publicar ${criado.id}  ·  para ligar: editar.mjs ligar ${criado.id}`)
  console.log(`\n${AVISO}`)
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2))
const [comando, entrada] = posicionais
if (comando === 'previa') await previa(entrada, opcoes)
else if (comando === 'gravar') await gravar()
else falha('uso:\n  criar.mjs previa @mudancas.json --nome="…" [--pasta=<id>] [--outro]\n  criar.mjs gravar', 2)
