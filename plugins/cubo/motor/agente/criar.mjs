#!/usr/bin/env node
// Criar um agente:
//   modelos                                     integrações de IA da conta e os modelos de cada uma
//   previa --nome="…" --integracao=<id> --modelo=<id> --prompt=@arquivo [--config=@arquivo]
//   gravar                                      cria (ninguém usa ainda: não afeta conversa nenhuma)
import { api, desembrulhar, ErroApi, todos } from '../api.mjs'
import { AVISO } from '../aviso.mjs'
import { catalogo } from '../catalogo.mjs'
import { abrirNoSistema, argumentos, falha, gravarJson, gravarTexto, lerEntrada, lerJson, lerJsonEntrada, pasta } from '../lib.mjs'
import { contarProblemas, problemasEmTexto } from '../fluxo/comum.mjs'
import { fraseDoChip } from './chips.mjs'
import { contextoAgente, corpoGravavel, descreverAgente, juntarProblemasAgente, modeloSemFerramentas, paginaDoAgente, validarAgente } from './comum.mjs'

const arquivoTrabalho = () => pasta('trabalho', 'agente-novo.json')

async function modelos() {
  const cat = await catalogo('agentes')
  const tipos = new Set(cat.aiIntegrationTypes || ['openai', 'google_ai', 'openrouter'])
  const integracoes = (await todos('/api/integrations')).filter((i) => tipos.has(i.type))
  if (!integracoes.length) falha('a conta não tem integração de IA (OpenAI, Google AI ou OpenRouter). Crie uma no Cubo: Configurações → Integrações → Nova integração, com a chave do serviço.', 1)
  for (const i of integracoes) {
    console.log(`#${i.id} — ${i.name} (${i.type})${i.status && i.status !== 'active' ? ` [${i.status}]` : ''}`)
    try {
      const corpo = await api('GET', `/api/integrations/${i.id}/ai-models`)
      for (const m of corpo?.data ?? corpo ?? []) console.log(`    ${m.id} — ${m.label ?? m.id}${m.toolsUnsupported ? ' (NÃO usa ferramentas: chips não funcionam)' : ''}`)
    } catch (erro) {
      if (!(erro instanceof ErroApi)) throw erro
      console.log(`    (não consegui listar os modelos: ${erro.message})`)
    }
  }
}

async function previa(opcoes) {
  const anterior = lerJson(arquivoTrabalho(), null)
  if (anterior?.criadoId && !opcoes.outro) falha(`o agente desta prévia já foi criado (#${anterior.criadoId}). Para mudar, use editar.mjs ler ${anterior.criadoId}. Para começar outro, rode com --outro.`, 2)
  for (const campo of ['nome', 'integracao', 'modelo', 'prompt']) if (!opcoes[campo] || opcoes[campo] === true) falha(`falta --${campo}. Uso: criar.mjs previa --nome="…" --integracao=<id> --modelo=<id> --prompt=@arquivo [--config=@arquivo]`, 2)
  const config = opcoes.config ? lerJsonEntrada(opcoes.config, 'configuração') : {}
  const corpo = corpoGravavel({ enabledTools: [], ...config, name: opcoes.nome, integrationId: Number(opcoes.integracao), model: opcoes.modelo, systemPrompt: lerEntrada(opcoes.prompt, 'prompt') })
  corpo.enabledTools = [] // campo antigo: agente novo deixa vazio (as ferramentas vêm dos chips)
  const validacao = await validarAgente(corpo)
  const ctx = await contextoAgente({ ...corpo, refs: [] })
  const descricao = descreverAgente({ ...corpo, id: null }, ctx)
  const semFerramentas = await modeloSemFerramentas(corpo)
  const problemas = juntarProblemasAgente({ descricao, validacao, usos: null, semFerramentas, nomes: ctx.nomes })
  gravarJson(arquivoTrabalho(), { corpo, validacao, previaEm: new Date().toISOString(), criadoId: null })
  const html = paginaDoAgente({ dados: { descricao, problemas, usos: null, prompt: corpo.systemPrompt }, textoDoClaude: { resumo: `Prévia: ainda NÃO foi criado. ${AVISO}` }, titulo: `Prévia: ${corpo.name}`, subtitulo: 'Agente novo, antes de criar' })
  const arquivo = pasta('previas', 'agente-novo.html')
  gravarTexto(arquivo, html)
  abrirNoSistema(arquivo)
  const conta = contarProblemas(problemas)
  console.log(
    [
      `AGENTE NOVO “${corpo.name}” — modelo ${corpo.model}${descricao.integracao ? ` (${descricao.integracao})` : ''}`,
      '',
      'FERRAMENTAS:',
      descricao.chips.length ? descricao.chips.map((c) => `  - ${fraseDoChip(c)}`).join('\n') : '  nenhuma (o agente só conversa)',
      '',
      `FOLLOW-UP: ${descricao.followUp.texto}`,
      '',
      `PROBLEMAS: ${conta.erro} erro(s), ${conta.aviso} aviso(s), ${conta.nota} observação(ões)`,
      problemasEmTexto(problemas),
      '',
      `Prévia em página: ${arquivo}`,
      '',
      (validacao.errors || []).length ? 'RESULTADO: NÃO DÁ PARA CRIAR (o Cubo recusa chip com problema). Corrija e rode a prévia de novo.' : 'RESULTADO: pronto para criar. Mostre a prévia e pergunte à pessoa antes.',
      '',
      AVISO,
    ].join('\n'),
  )
  process.exit((validacao.errors || []).length ? 1 : 0)
}

async function gravar() {
  const t = lerJson(arquivoTrabalho(), null)
  if (!t) falha('faça a prévia antes: criar.mjs previa …', 2)
  if (t.criadoId) {
    console.log(`Este agente já foi criado: #${t.criadoId}. Nada a fazer.`)
    return
  }
  if ((t.validacao?.errors || []).length) falha('a prévia tem erro. Corrija e rode a prévia de novo.', 2)
  if (t.enviandoEm) falha(`uma tentativa anterior de criar caiu no meio (${t.enviandoEm}). Confira no Cubo (Agentes de IA) se “${t.corpo.name}” já existe; se não existir, apague o campo "enviandoEm" de ${arquivoTrabalho()}.`, 2)
  gravarJson(arquivoTrabalho(), { ...t, enviandoEm: new Date().toISOString() })
  let corpo
  try {
    ;({ corpo } = await api('POST', '/api/agents', t.corpo, { completo: true }))
  } catch (erro) {
    if (erro instanceof ErroApi && erro.codigo) gravarJson(arquivoTrabalho(), { ...t, enviandoEm: null })
    throw erro
  }
  const criado = desembrulhar(corpo)
  gravarJson(arquivoTrabalho(), { ...t, enviandoEm: null, criadoId: criado.id, criadoEm: new Date().toISOString() })
  console.log(`Criado: agente #${criado.id} “${criado.name}”. Ninguém usa ainda: ele não atende nenhuma conversa até ser ligado a um canal ou automação.`)
  for (const aviso of corpo?.warnings || []) console.log(`  aviso do Cubo: ${aviso.message}`)
  console.log('Para ligar a um canal: no Cubo, Canais → o canal → Agente padrão. Para usar num fluxo: o passo “Chamar agente”.')
  console.log('A API não apaga agente: se a pessoa desistir, é no Cubo, Agentes de IA → o agente → Excluir.')
  console.log(`\n${AVISO}`)
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2))
const [comando] = posicionais
if (comando === 'modelos') await modelos()
else if (comando === 'previa') await previa(opcoes)
else if (comando === 'gravar') await gravar()
else falha('uso:\n  criar.mjs modelos\n  criar.mjs previa --nome="…" --integracao=<id> --modelo=<id> --prompt=@arquivo [--config=@arquivo] [--outro]\n  criar.mjs gravar', 2)
