#!/usr/bin/env node
// Explicar um agente, em duas partes:
//   preparar <id|nome>  lê o agente, descreve os chips, valida, varre onde é usado e imprime o roteiro;
//   pagina <id>         junta o texto do Claude (e os exemplos, se a simulação rodou) e gera a página.
// Não muda nada na conta. A simulação (que gasta tokens) é outro comando: simular.mjs.
import { existsSync } from 'node:fs'
import { abrirNoSistema, argumentos, falha, gravarJson, gravarTexto, lerJson, pasta } from '../lib.mjs'
import { quemUsaAgente, varrer } from '../usos.mjs'
import { contarProblemas, problemasEmTexto } from '../fluxo/comum.mjs'
import { blocoDaResposta, contagem } from '../resposta.mjs'
import { promptAnotado } from './chips.mjs'
import { acharAgente, contextoAgente, descreverAgente, juntarProblemasAgente, lerAgente, modeloSemFerramentas, paginaDoAgente, roteiroAgente, validarAgente } from './comum.mjs'

const USO = `uso:
  explicar.mjs preparar <id|nome> [--sem-usos]
  explicar.mjs pagina <id>`

const PROMPT_NA_TELA = 12_000

async function preparar(alvo, opcoes) {
  const id = await acharAgente(alvo)
  const { agente } = await lerAgente(id)
  const ctx = await contextoAgente(agente)
  const descricao = descreverAgente(agente, ctx)
  const validacao = await validarAgente({}, id)
  const usos = opcoes['sem-usos'] ? null : quemUsaAgente(await varrer(), id)
  const semFerramentas = await modeloSemFerramentas(agente)
  const problemas = juntarProblemasAgente({ descricao, validacao, usos, semFerramentas, nomes: ctx.nomes })
  const anotado = promptAnotado(agente.systemPrompt, descricao.chips)
  gravarJson(pasta('explicacoes', `agente-${id}.dados.json`), { tipo: 'agente', id, preparadoEm: new Date().toISOString(), descricao, problemas, usos, prompt: agente.systemPrompt ?? '' })
  const arquivoPrompt = pasta('explicacoes', `agente-${id}.prompt.txt`)
  gravarTexto(arquivoPrompt, anotado)

  const conta = contarProblemas(problemas)
  console.log(
    [
      roteiroAgente(descricao, { usos, prompt: anotado.length <= PROMPT_NA_TELA ? anotado : null }),
      anotado.length > PROMPT_NA_TELA ? `\nPROMPT: ${anotado.length} caracteres, longo demais para a tela. Leia o arquivo inteiro: ${arquivoPrompt}` : '',
      '',
      `PROBLEMAS: ${conta.erro} erro(s), ${conta.aviso} aviso(s), ${conta.nota} observação(ões)`,
      problemasEmTexto(problemas),
      '',
      `PRÓXIMO: escreva ${pasta('explicacoes', `agente-${id}.texto.json`)} com`,
      '  { "resumo": "…", "explicacao": "como ele age, em parágrafos", "chips": { "<chip>": "o que faz, em palavras simples" } }',
      `  e rode: explicar.mjs pagina ${id}. Para conversas de exemplo (gasta tokens, pergunte antes): simular.mjs ${id} @situacoes.json`,
    ].join('\n'),
  )
}

function paginaCli(id) {
  if (!/^\d+$/.test(String(id ?? ''))) falha(USO, 2)
  const dados = lerJson(pasta('explicacoes', `agente-${id}.dados.json`), null)
  if (!dados) falha(`rode antes: explicar.mjs preparar ${id}`, 2)
  const arquivoTexto = pasta('explicacoes', `agente-${id}.texto.json`)
  if (!existsSync(arquivoTexto)) falha(`falta o texto: escreva ${arquivoTexto} (veja o fim do "preparar").`, 2)
  const textoDoClaude = lerJson(arquivoTexto, {})
  if (!textoDoClaude.resumo) falha(`o texto não tem "resumo". Escreva o resumo em ${arquivoTexto} e rode de novo.`, 2)
  const exemplos = lerJson(pasta('explicacoes', `agente-${id}.exemplos.json`), { exemplos: [] }).exemplos
  const { descricao } = dados
  const html = paginaDoAgente({ dados, textoDoClaude, exemplos, titulo: descricao.nome, subtitulo: `Explicação do agente nº ${id}` })
  const arquivo = pasta('explicacoes', `agente-${id}.html`)
  gravarTexto(arquivo, html)
  abrirNoSistema(arquivo)
  console.log(`Página pronta: ${arquivo}`)
  const usos = dados.usos === null || dados.usos === undefined ? 'não conferi' : dados.usos.length ? dados.usos.map((u) => u.nome).join(', ') : 'em lugar nenhum'
  console.log('\n' + blocoDaResposta({
    titulo: `🤖 ${descricao.nome} · agente nº ${id}`,
    fatos: {
      cabecalho: ['Modelo', 'Ferramentas', 'Lembretes', 'Onde é usado', 'Exemplos', 'Problemas'],
      valores: [descricao.modelo ?? '?', descricao.chips.length || 'só conversa', descricao.followUp.ligado ? 'ligados' : 'desligados', usos, exemplos.length ? `${exemplos.length} conversa(s)` : 'não rodou', contagem(contarProblemas(dados.problemas))],
    },
    problemas: dados.problemas,
    arquivo,
    proximo: `⟨se houver o que corrigir: “Posso ajustar com /cubo:editar-agente ${id}: …”; senão, apague esta linha⟩`,
  }))
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2))
const [comando, alvo] = posicionais
if (comando === 'preparar') await preparar(posicionais.slice(1).join(' ') || alvo, opcoes)
else if (comando === 'pagina') paginaCli(alvo)
else falha(USO, 2)
