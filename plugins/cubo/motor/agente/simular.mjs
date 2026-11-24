#!/usr/bin/env node
// Conversas de exemplo com o agente, pelo `POST /api/agents/:id/simulate`. GASTA TOKENS da
// integração de IA da conta: a skill pergunta antes. Roda o agente como está GRAVADO; ferramenta de
// escrita só simula (nada muda na conta), a de leitura lê de verdade.
//
//   simular.mjs <id> @situacoes.json
//   situacoes.json: [{ "titulo": "…", "objetivo": "…", "mensagens": ["fala 1 do cliente", "fala 2"] }]
//
// Opcionais por situação, para a conversa ser igual à de um fluxo: "negociacao" (id da negociação
// ligada à conversa, que preenche as variáveis {{deal.*}} da instrução), "contato" (id do contato;
// sem ele, vale o da negociação) e "instrucao" (o texto do passo Chamar agente, com as mesmas
// variáveis). Negociação ou contato de outra conta: o Cubo recusa antes de rodar o agente.
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
const idOpcional = (valor, nome) => {
  if (valor === undefined || valor === null || valor === '') return undefined
  if (!/^\d+$/.test(String(valor))) falha(`"${nome}" precisa ser o número (id) do Cubo, veio: ${valor}`, 2)
  return Number(valor)
}
function contextoDe(situacao) {
  const contexto = {
    dealId: idOpcional(situacao.negociacao, 'negociacao'),
    personId: idOpcional(situacao.contato, 'contato'),
    callerInstruction: typeof situacao.instrucao === 'string' && situacao.instrucao.trim() ? situacao.instrucao : undefined,
  }
  return Object.fromEntries(Object.entries(contexto).filter(([, valor]) => valor !== undefined))
}

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
  const contexto = contextoDe(situacao)
  for (const fala of situacao.mensagens) {
    historico.push({ role: 'user', content: String(fala) })
    await respeitarTeto()
    try {
      const r = await api('POST', `/api/agents/${id}/simulate`, { messages: historico, ...contexto }, { aviso: `o Cubo aceita ${POR_MINUTO} simulações por minuto` })
      if (r?.status === 'error' || (!r?.reply && r?.error)) {
        erros++
        turnos.push({ cliente: String(fala), erro: `o agente deu erro: ${r?.error ?? 'sem resposta'}` })
        console.log(`  cliente: ${fala}\n  ✘ o agente deu erro no Cubo: ${r?.error ?? 'sem resposta'}${/key|auth|401|incorrect/i.test(String(r?.error)) ? ' (a chave da integração de IA parece inválida: confira em Configurações → Integrações)' : ''}`)
        break
      }
      const custo = Number(r?.usage?.costCents ?? 0)
      custoTotal += custo
      turnos.push({ cliente: String(fala), resposta: r?.reply ?? '', status: r?.status ?? null, fallback: r?.status === 'fallback_used', toolCalls: (r?.toolCalls || []).map((t) => ({ name: t.name, args: t.args, simulated: t.simulated, error: t.error ?? null })), custoCentavos: custo, executionId: r?.executionId ?? null })
      historico.push({ role: 'assistant', content: r?.reply ?? '' })
      console.log(`  cliente: ${fala}\n  agente:  ${r?.reply ?? ''}${(r?.toolCalls || []).length ? `\n  ferramentas: ${r.toolCalls.map((t) => `${t.name}${t.simulated ? ' (simulado)' : ''}`).join(', ')}` : ''}`)
    } catch (erro) {
      erros++
      turnos.push({ cliente: String(fala), erro: erro.message })
      console.log(`  cliente: ${fala}\n  ✘ ${erro.message}`)
      break
    }
  }
  const guardarContexto = Object.keys(contexto).length
    ? { negociacao: contexto.dealId ?? null, contato: contexto.personId ?? null, instrucao: contexto.callerInstruction ?? null }
    : null
  guardado.exemplos.push({ titulo: situacao.titulo, objetivo: situacao.objetivo ?? null, contexto: guardarContexto, turnos, rodadoEm: new Date().toISOString() })
  gravarJson(arquivo, guardado)
}
console.log(`\nCusto total: ${custoTotal.toFixed(2).replace('.', ',')} centavos. Exemplos em ${arquivo}.`)
console.log('Escrever foi simulado (nada mudou na conta); ler foi de verdade. Chips de conversa e lembretes não aparecem na simulação.')
if (erros) process.exit(4)
