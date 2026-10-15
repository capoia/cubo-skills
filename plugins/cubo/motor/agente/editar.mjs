#!/usr/bin/env node
// Editar um agente. Agente NÃO TEM RASCUNHO: gravar vale na hora, para conversas de verdade. Por isso:
// cópia de segurança antes, antes → depois, onde é usado, e desfazer.
//   ler <id|nome>                              lê com o ETag, guarda a cópia, separa prompt e configuração em arquivos
//   previa <id> [--prompt=@arq] [--config=@arq] monta a versão nova, valida, mostra antes → depois e onde é usado
//   gravar <id>                                grava com If-Match (412: relê, mostra o que mudou e NÃO regrava)
//   desfazer <id> [--copia=<arquivo>]          grava de volta a cópia e confere
import { desembrulhar, ErroApi } from '../api.mjs'
import { AVISO } from '../aviso.mjs'
import { guardarCopia, pegarCopia } from '../copias.mjs'
import { abrirNoSistema, argumentos, falha, gravarJson, gravarTexto, lerEntrada, lerJson, lerJsonEntrada, pasta } from '../lib.mjs'
import { esc } from '../pagina.mjs'
import { quemUsaAgente, varrer } from '../usos.mjs'
import { contarProblemas, problemasEmTexto } from '../fluxo/comum.mjs'
import { fraseDoChip } from './chips.mjs'
import { acharAgente, contextoAgente, corpoGravavel, descreverAgente, gravarAgente, juntarProblemasAgente, lerAgente, modeloSemFerramentas, paginaDoAgente, roteiroAgente, validarAgente } from './comum.mjs'
import { diferencaDeConfig, diferencaEmTexto } from './diferenca.mjs'

const arquivoTrabalho = (id) => pasta('trabalho', `agente-${id}.json`)
const arquivoPrompt = (id) => pasta('trabalho', `agente-${id}.prompt.md`)
const arquivoConfig = (id) => pasta('trabalho', `agente-${id}.config.json`)
function trabalho(id) {
  const t = lerJson(arquivoTrabalho(id), null)
  if (!t) falha(`rode antes: editar.mjs ler ${id}`, 2)
  return t
}

const usosEmTexto = (usos) => (usos.length ? usos.map((u) => `  - ${u.onde} “${u.nome}” (#${u.id}): ${u.detalhe}`).join('\n') : '  em lugar nenhum (a mudança não afeta nenhuma conversa até alguém usar o agente)')

async function ler(alvo) {
  const id = await acharAgente(alvo)
  const { agente, etag } = await lerAgente(id)
  const corpo = corpoGravavel(agente)
  const copia = guardarCopia('agente', id, { nome: agente.name, corpo })
  const { systemPrompt, ...config } = corpo
  gravarTexto(arquivoPrompt(id), systemPrompt ?? '')
  gravarJson(arquivoConfig(id), config)
  const usos = quemUsaAgente(await varrer(), id)
  gravarJson(arquivoTrabalho(id), { id, etag, agente: corpo, lidoEm: new Date().toISOString(), copia, usos, novo: null })
  const ctx = await contextoAgente(agente)
  console.log(roteiroAgente(descreverAgente(agente, ctx), { usos }))
  console.log(`\nCópia de segurança guardada: ${copia}`)
  console.log(`Para mudar, edite os arquivos (mude só o que foi pedido) e rode a prévia:\n  prompt:        ${arquivoPrompt(id)}\n  configuração:  ${arquivoConfig(id)}`)
  console.log(`  editar.mjs previa ${id} --prompt=@"${arquivoPrompt(id)}" --config=@"${arquivoConfig(id)}"`)
  if (usos.length) console.log(`\nATENÇÃO: agente não tem rascunho. Este agente está em uso, e o que for gravado vale para as próximas mensagens:\n${usosEmTexto(usos)}`)
}

async function previa(id, opcoes) {
  const t = trabalho(id)
  const prompt = opcoes.prompt ? lerEntrada(opcoes.prompt, 'prompt') : t.agente.systemPrompt
  const config = opcoes.config ? lerJsonEntrada(opcoes.config, 'configuração') : (({ systemPrompt, ...resto }) => resto)(t.agente)
  if (config.systemPrompt !== undefined) falha('o prompt vai no arquivo do prompt, não na configuração.', 2)
  const novo = corpoGravavel({ ...config, systemPrompt: prompt })
  const validacao = await validarAgente(novo, id)
  const ctx = await contextoAgente({ ...novo, refs: [] })
  const descricao = descreverAgente({ ...novo, id, name: novo.name ?? t.agente.name }, ctx)
  const semFerramentas = await modeloSemFerramentas(novo)
  const usos = t.usos ?? []
  const problemas = juntarProblemasAgente({ descricao, validacao, usos: null, semFerramentas, nomes: ctx.nomes })
  const dif = diferencaEmTexto(t.agente.systemPrompt, prompt)
  const config2 = diferencaDeConfig(t.agente, novo)
  gravarJson(arquivoTrabalho(id), { ...t, novo, validacao, previaEm: new Date().toISOString() })

  const html = paginaDoAgente({
    dados: { descricao, problemas, usos, prompt },
    textoDoClaude: { resumo: `Prévia: ainda NÃO foi gravado. Agente não tem rascunho: ao gravar, a mudança vale na hora. ${AVISO}` },
    titulo: `Prévia: ${descricao.nome}`,
    subtitulo: 'Antes de gravar',
    extra: [{ id: 'mudancas', titulo: 'O que muda', html: `${config2.length ? `<ul>${config2.map((c) => `<li><code>${esc(c.chave)}</code>: ${esc(JSON.stringify(c.antes))} → ${esc(JSON.stringify(c.depois))}</li>`).join('')}</ul>` : ''}<pre>${esc(dif)}</pre>` }],
  })
  const arquivo = pasta('previas', `agente-${id}.html`)
  gravarTexto(arquivo, html)
  abrirNoSistema(arquivo)
  const conta = contarProblemas(problemas)
  const travam = (validacao.errors || []).length
  console.log(
    [
      'O QUE MUDA NO PROMPT (- sai, + entra):',
      dif,
      '',
      'O QUE MUDA NA CONFIGURAÇÃO:',
      config2.length ? config2.map((c) => `  - ${c.chave}: ${JSON.stringify(c.antes)} → ${JSON.stringify(c.depois)}`).join('\n') : '  nada',
      '',
      'FERRAMENTAS DEPOIS:',
      descricao.chips.length ? descricao.chips.map((c) => `  - ${fraseDoChip(c)}`).join('\n') : '  nenhuma',
      '',
      'ONDE É USADO (a mudança vale na hora para):',
      usosEmTexto(usos),
      '',
      `PROBLEMAS: ${conta.erro} erro(s), ${conta.aviso} aviso(s), ${conta.nota} observação(ões)`,
      problemasEmTexto(problemas),
      '',
      `Prévia em página: ${arquivo}`,
      '',
      travam ? 'RESULTADO: NÃO DÁ PARA GRAVAR (o Cubo recusa chip novo com problema). Corrija e rode a prévia de novo.' : 'RESULTADO: pronto para gravar. Mostre o que muda e onde é usado, e pergunte à pessoa antes.',
      '',
      AVISO,
    ].join('\n'),
  )
  process.exit(travam ? 1 : 0)
}

async function gravar(id) {
  const t = trabalho(id)
  if (!t.novo) falha(`faça a prévia antes: editar.mjs previa ${id} …`, 2)
  if (t.gravadoEm && t.gravadoEm > (t.previaEm ?? '')) falha('esta prévia já foi gravada. Para mudar mais, rode ler e previa de novo.', 2)
  if ((t.validacao?.errors || []).length) falha('a prévia tem erro. Corrija e rode a prévia de novo.', 2)
  try {
    const { corpo, etag } = await gravarAgente(id, t.novo, t.etag, t.agente)
    const gravado = desembrulhar(corpo)
    gravarJson(arquivoTrabalho(id), { ...t, etag, agente: corpoGravavel(gravado), gravadoEm: new Date().toISOString() })
    console.log(`Gravado: o agente #${id} já está com a versão nova (agente não tem rascunho).`)
    for (const aviso of corpo?.warnings || []) console.log(`  aviso do Cubo: ${aviso.message}`)
    console.log(`Para voltar atrás: editar.mjs desfazer ${id}`)
    console.log(`\n${AVISO}`)
  } catch (erro) {
    if (!(erro instanceof ErroApi) || erro.codigo !== 412) throw erro
    const { agente: atual, etag } = await lerAgente(id)
    const corpoAtual = corpoGravavel(atual)
    gravarJson(arquivoTrabalho(id), { ...t, etag, agente: corpoAtual, novo: null })
    console.log('ATENÇÃO: alguém mudou este agente no Cubo enquanto eu trabalhava (412). NADA foi gravado.')
    console.log('O que a outra pessoa mudou (- antes, + agora):')
    console.log(diferencaEmTexto(t.agente.systemPrompt, corpoAtual.systemPrompt))
    for (const c of diferencaDeConfig(t.agente, corpoAtual)) console.log(`  - ${c.chave}: ${JSON.stringify(c.antes)} → ${JSON.stringify(c.depois)}`)
    console.log(`\nMostre isso à pessoa. Para seguir, refaça a mudança em cima da versão nova (rode ler ${id} de novo) e a prévia.`)
    process.exit(5)
  }
}

async function desfazer(id, opcoes) {
  const { conteudo: copia, arquivo, quando } = pegarCopia('agente', id, opcoes.copia)
  const { agente: atual, etag } = await lerAgente(id)
  console.log(`Voltando o agente #${id} à cópia de ${quando.replace('T', ' ')} (${arquivo}).`)
  await gravarAgente(id, corpoGravavel(copia.corpo), etag, corpoGravavel(atual))
  const { agente } = await lerAgente(id)
  const diferencas = diferencaDeConfig(corpoGravavel(copia.corpo), corpoGravavel(agente), [])
  if (diferencas.length) falha(`gravei, mas o agente ficou diferente da cópia em: ${diferencas.map((d) => d.chave).join(', ')}. Confira no Cubo.`, 1)
  const t = lerJson(arquivoTrabalho(id), null)
  if (t) gravarJson(arquivoTrabalho(id), { ...t, novo: null, desfeitoEm: new Date().toISOString() })
  console.log('Pronto: desfeito e conferido. O agente está igual à cópia.')
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2))
const [comando, alvo] = posicionais
if (comando === 'ler') await ler(posicionais.slice(1).join(' '))
else if (!/^\d+$/.test(String(alvo ?? ''))) falha('uso:\n  editar.mjs ler <id|nome>\n  editar.mjs previa <id> [--prompt=@arquivo] [--config=@arquivo]\n  editar.mjs gravar <id>\n  editar.mjs desfazer <id> [--copia=<arquivo>]', 2)
else if (comando === 'previa') await previa(Number(alvo), opcoes)
else if (comando === 'gravar') await gravar(Number(alvo))
else if (comando === 'desfazer') await desfazer(Number(alvo), opcoes)
else falha('comando desconhecido.', 2)
