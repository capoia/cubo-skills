#!/usr/bin/env node
// O catálogo de nós (automações) e de chips (agentes) vem do Cubo a cada uso, guardado em
// `cubo/cache/`: manda `If-None-Match` e, com 304, usa o arquivo. Nó ou chip novo funciona no dia em
// que entra no Cubo, sem versão nova do plugin.

import { api } from './api.mjs'
import { argumentos, ehPrincipal, falha, gravarJson, lerJson, pasta } from './lib.mjs'

const ROTA = { automacoes: '/api/automations/catalog', agentes: '/api/agents/catalog' }

// O de agentes muda por conta (intents e MCP da conta): o arquivo leva a conta no nome.
function arquivoDoCache(tipo) {
  if (tipo === 'agentes') {
    const conta = lerJson(pasta('conta.json'), {})
    return pasta('cache', `catalogo-agentes-${conta.companyId ?? 'conta'}.json`)
  }
  return pasta('cache', 'catalogo-automacoes.json')
}

export async function catalogo(tipo) {
  if (!ROTA[tipo]) throw new Error(`catálogo desconhecido: ${tipo}`)
  const arquivo = arquivoDoCache(tipo)
  const guardado = lerJson(arquivo, null)
  const cabecalhos = guardado?.etag ? { 'If-None-Match': guardado.etag } : {}
  const { status, corpo, etag } = await api('GET', ROTA[tipo], undefined, { completo: true, cabecalhos })
  if (status === 304 && guardado) return guardado.corpo
  const versao = corpo?.version
  gravarJson(arquivo, { etag: etag || (versao ? `"${versao}"` : null), corpo })
  return corpo
}

// Índices prontos.
export function nosPorTipo(cat) {
  return Object.fromEntries((cat?.nodes || []).map((no) => [no.type, no]))
}
export function gatilhosPorTipo(cat) {
  return Object.fromEntries((cat?.triggers || []).map((gatilho) => [gatilho.type, gatilho]))
}
export function chipsPorNome(cat) {
  const mapa = Object.fromEntries((cat?.chips || []).map((chip) => [chip.name, chip]))
  for (const intent of cat?.dynamicChips?.intents || []) mapa[intent.chip] = { ...intent, dinamico: 'intent', label: intent.name }
  for (const ferramenta of cat?.dynamicChips?.mcp || []) mapa[ferramenta.chip] = { ...ferramenta, dinamico: 'mcp', label: `${ferramenta.connectionName} — ${ferramenta.chip.replace(/^mcp_\d+_/, '')}` }
  return mapa
}

// ---------------------------------------------------------------------------------------------
// CLI: o Claude lê o catálogo aos poucos, só o que vai usar.

function resumoAutomacoes(cat) {
  const linhas = [`Catálogo de automações (versão ${cat.version})`, '', 'GATILHOS (vão no nó start, em data.triggers):']
  for (const g of cat.triggers || []) linhas.push(`  ${g.type} — ${g.label}`)
  const porCategoria = new Map()
  for (const no of cat.nodes || []) {
    if (no.deprecated || no.inPalette === false) continue
    const chave = no.categoryLabel || no.category
    if (!porCategoria.has(chave)) porCategoria.set(chave, [])
    porCategoria.get(chave).push(no)
  }
  linhas.push('', 'NÓS (detalhe de um: catalogo.mjs no <tipo>):')
  for (const [categoria, nos] of porCategoria) {
    linhas.push(`  ${categoria}:`)
    for (const no of nos) linhas.push(`    ${no.type} — ${no.label}: ${no.description}`)
  }
  return linhas.join('\n')
}

function resumoAgentes(cat) {
  const linhas = [`Catálogo de agentes (versão ${cat.version})`, '', `Sintaxe do chip: ${cat.chipSyntax?.format}`, `Aspas: ${cat.chipSyntax?.quoting}`, '', 'CHIPS (detalhe de um: catalogo.mjs chip <nome>):']
  for (const chip of cat.chips || []) {
    const params = (chip.params || []).filter((p) => p.key !== 'useWhen').map((p) => `${p.key}${p.required ? '*' : ''}`)
    linhas.push(`  ${chip.name}${params.length ? `(${params.join(',')})` : ''} — ${chip.label}: ${chip.description}`)
  }
  const intents = cat.dynamicChips?.intents || []
  if (intents.length) {
    linhas.push('', 'INTENTS DA CONTA:')
    for (const i of intents) linhas.push(`  ${i.chip} — ${i.name}${i.enabled ? '' : ' (DESLIGADA)'}: ${i.description || ''}`)
  }
  const mcp = cat.dynamicChips?.mcp || []
  if (mcp.length) {
    linhas.push('', 'FERRAMENTAS MCP DA CONTA (só leitura pela chave):')
    for (const m of mcp) linhas.push(`  ${m.chip} — ${m.connectionName}${m.status !== 'connected' ? ` (${m.status})` : ''}${m.enabled ? '' : ' (ferramenta desligada)'}`)
  }
  linhas.push('', `Follow-up: chaves ${cat.followUp?.fieldKeys}; ao esgotar: ${(cat.followUp?.exhaustedActions || []).join(', ')}`)
  return linhas.join('\n')
}

async function principal() {
  const [comando, alvo] = process.argv.slice(2)
  const { opcoes } = argumentos(process.argv.slice(3))
  if (comando === 'resumo') {
    const tipo = alvo === 'agentes' ? 'agentes' : 'automacoes'
    const cat = await catalogo(tipo)
    console.log(tipo === 'agentes' ? resumoAgentes(cat) : resumoAutomacoes(cat))
  } else if (comando === 'no') {
    const cat = await catalogo('automacoes')
    const no = nosPorTipo(cat)[alvo]
    if (!no) falha(`não existe nó "${alvo}" no catálogo. Veja a lista: catalogo.mjs resumo`, 2)
    console.log(JSON.stringify(no, null, 2))
  } else if (comando === 'gatilho') {
    const cat = await catalogo('automacoes')
    const gatilho = gatilhosPorTipo(cat)[alvo]
    if (!gatilho) falha(`não existe gatilho "${alvo}" no catálogo. Veja a lista: catalogo.mjs resumo`, 2)
    console.log(JSON.stringify(gatilho, null, 2))
  } else if (comando === 'chip') {
    const cat = await catalogo('agentes')
    const chip = chipsPorNome(cat)[alvo]
    if (!chip) falha(`não existe chip "${alvo}" no catálogo desta conta. Veja a lista: catalogo.mjs resumo agentes`, 2)
    console.log(JSON.stringify(chip, null, 2))
  } else if (comando === 'regras') {
    const cat = await catalogo('automacoes')
    console.log(JSON.stringify(opcoes.so ? cat[opcoes.so] : { edges: cat.edges, variables: cat.variables, conventions: cat.conventions, limits: cat.limits }, null, 2))
  } else {
    falha(`uso:
  catalogo.mjs resumo [automacoes|agentes]   a lista curta
  catalogo.mjs no <tipo>                     um nó: schema, padrões, saídas, exemplo
  catalogo.mjs gatilho <tipo>                um gatilho: schema do triggerConfig, exemplo
  catalogo.mjs chip <nome>                   um chip de agente: parâmetros e de onde vêm os valores
  catalogo.mjs regras [--so=edges|variables|conventions|limits]`, 2)
  }
}

if (ehPrincipal(import.meta.url)) await principal()
