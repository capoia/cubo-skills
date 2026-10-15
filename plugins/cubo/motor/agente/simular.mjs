#!/usr/bin/env node
// Conversas de exemplo com o agente, pelo `POST /api/agents/:id/simulate`. GASTA TOKENS da
// integração de IA da conta: a skill pergunta antes. Roda o agente como está GRAVADO; ferramenta de
// escrita só simula (nada muda na conta), a de leitura lê de verdade.
//
//   simular.mjs <id> @situacoes.json
//   situacoes.json: [{ "titulo": "…", "objetivo": "…", "mensagens": ["fala 1 do cliente", "fala 2"] }]
//
// Cada fala do cliente é uma chamada (com a conversa até ali). O Cubo aceita 10 por minuto por
// chave: o script espera sozinho quando chega no teto.
import { api } from '../api.mjs'
import { argumentos, espera, falha, gravarJson, lerJson, lerJsonEntrada, pasta } from '../lib.mjs'

const POR_MINUTO = Number(process.env.CUBO_SIMULAR_POR_MINUTO || 10)
const JANELA_MS = Number(process.env.CUBO_SIMULAR_JANELA_MS || 60_000)
const MAXIMO_DE_SITUACOES = 5
const MAXIMO_DE_FALAS = 6

const chamadas = []
async function respeitarTeto() {
  for (;;) {
    const agora = Date.now()
    while (chamadas.length && agora - chamadas[0] >= JANELA_MS) chamadas.shift()
    if (chamadas.length < POR_MINUTO) break
    const falta = JANELA_MS - (agora - chamadas[0]) + 50
    if (falta >= 2000) console.log(`  (o Cubo aceita ${POR_MINUTO} simulações por minuto. Esperando ${Math.ceil(falta / 1000)} s…)`)
    await espera(falta)
  }
  chamadas.push(Date.now())
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2))
const [id, entrada] = posicionais
if (!/^\d+$/.test(String(id ?? '')) || !entrada) falha('uso: simular.mjs <id> @situacoes.json', 2)
const situacoes = lerJsonEntrada(entrada, 'lista de situações')
if (!Array.isArray(situacoes) || !situacoes.length) falha('a lista de situações está vazia.', 2)
if (situacoes.length > MAXIMO_DE_SITUACOES) falha(`no máximo ${MAXIMO_DE_SITUACOES} situações por vez (cada uma gasta tokens).`, 2)
for (const s of situacoes) {
  if (!s.titulo || !Array.isArray(s.mensagens) || !s.mensagens.length) falha('cada situação precisa de "titulo" e "mensagens" (as falas do cliente).', 2)
  if (s.mensagens.length > MAXIMO_DE_FALAS) falha(`no máximo ${MAXIMO_DE_FALAS} falas do cliente por situação.`, 2)
}

const arquivo = pasta('explicacoes', `agente-${id}.exemplos.json`)
const guardado = opcoes.juntar ? lerJson(arquivo, { exemplos: [] }) : { exemplos: [] }
let custoTotal = 0
let erros = 0
for (const [i, situacao] of situacoes.entries()) {
  console.log(`\n${i + 1}/${situacoes.length} — ${situacao.titulo}`)
  const historico = []
  const turnos = []
  for (const fala of situacao.mensagens) {
    historico.push({ role: 'user', content: String(fala) })
    await respeitarTeto()
    try {
      const r = await api('POST', `/api/agents/${id}/simulate`, { messages: historico }, { aviso: `o Cubo aceita ${POR_MINUTO} simulações por minuto` })
      const custo = Number(r?.usage?.costCents ?? 0)
      custoTotal += custo
      turnos.push({ cliente: String(fala), resposta: r?.reply ?? '', status: r?.status ?? null, toolCalls: (r?.toolCalls || []).map((t) => ({ name: t.name, args: t.args, simulated: t.simulated, error: t.error ?? null })), custoCentavos: custo, executionId: r?.executionId ?? null })
      historico.push({ role: 'assistant', content: r?.reply ?? '' })
      console.log(`  cliente: ${fala}\n  agente:  ${r?.reply ?? ''}${(r?.toolCalls || []).length ? `\n  ferramentas: ${r.toolCalls.map((t) => `${t.name}${t.simulated ? ' (simulado)' : ''}`).join(', ')}` : ''}`)
    } catch (erro) {
      erros++
      turnos.push({ cliente: String(fala), erro: erro.message })
      console.log(`  cliente: ${fala}\n  ✘ ${erro.message}`)
      break
    }
  }
  guardado.exemplos.push({ titulo: situacao.titulo, objetivo: situacao.objetivo ?? null, turnos, rodadoEm: new Date().toISOString() })
  gravarJson(arquivo, guardado)
}
console.log(`\nCusto total: ${custoTotal.toFixed(2).replace('.', ',')} centavos. Exemplos em ${arquivo}.`)
console.log('Escrever foi simulado (nada mudou na conta); ler foi de verdade. Chips de conversa e lembretes não aparecem na simulação.')
if (erros) process.exit(4)
