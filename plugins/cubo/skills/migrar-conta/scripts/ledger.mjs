// O ledger da migração: o estado de tudo, num arquivo só (migracao/ledger.json), e a versão para gente
// ler (migracao/LEDGER.md). Todo script lê e grava aqui; é o que deixa continuar de onde parou.
import { writeFileSync } from 'node:fs'
import { AREA } from './areas.mjs'
import { gravarJson, lerJson, pasta } from './lib.mjs'

export const ETAPAS = [
  { chave: 'acesso', titulo: 'Acesso às duas contas' },
  { chave: 'escolha', titulo: 'Escolha do que migrar' },
  { chave: 'plano', titulo: 'Leitura da conta antiga e plano' },
  { chave: 'decisoes', titulo: 'Decisões (usuários, itens que já existem, domínio)' },
  { chave: 'aplicar', titulo: 'Criação na conta nova' },
  { chave: 'segunda-passada', titulo: 'Ligações entre itens (2ª passada)' },
  { chave: 'conferencia', titulo: 'Conferência: nenhum ID da conta antiga sobrou' },
  { chave: 'relatorio', titulo: 'Relatório' },
]

const ICONE = { pendente: '⬜', andamento: '⏳', aguardando: '⏳', feito: '✅', erro: '❌', bloqueado: '⛔' }

export function novoLedger() {
  return {
    versao: 1,
    criadoEm: new Date().toISOString(),
    atualizadoEm: null,
    origem: null,
    destino: null,
    escolha: [],
    areas: [],
    etapas: Object.fromEntries(ETAPAS.map((etapa) => [etapa.chave, { status: 'pendente' }])),
    itens: {},
    mapa: {},
    decisoes: { usuarios: {}, existentes: {}, existentesTodos: null, dominios: {}, mcp: {} },
    perguntas: [],
    pendencias: [],
    avisos: [],
    conferencia: null,
    historico: [],
  }
}

export function carregar() {
  return lerJson(pasta('ledger.json'), null) || novoLedger()
}

export function salvar(ledger) {
  ledger.atualizadoEm = new Date().toISOString()
  gravarJson(pasta('ledger.json'), ledger)
  writeFileSync(pasta('LEDGER.md'), paraLer(ledger))
}

export function registrar(ledger, texto) {
  ledger.historico.push({ quando: new Date().toISOString(), texto })
  if (ledger.historico.length > 500) ledger.historico.splice(0, ledger.historico.length - 500)
}

export function etapa(ledger, chave, status, detalhe) {
  const atual = ledger.etapas[chave]
  if (status === 'andamento' && !atual.inicio) atual.inicio = new Date().toISOString()
  if (status === 'feito') atual.fim = new Date().toISOString()
  atual.status = status
  if (detalhe !== undefined) atual.detalhe = detalhe
}

export const chaveItem = (kind, origemId) => `${kind}:${origemId}`

export function mapear(ledger, kind, origemId, destinoId) {
  ledger.mapa[kind] ||= {}
  ledger.mapa[kind][String(origemId)] = destinoId
}

export function noMapa(ledger, kind, origemId) {
  return ledger.mapa[kind]?.[String(origemId)]
}

export function pendencia(ledger, texto, origem = {}) {
  if (!texto || ledger.pendencias.some((p) => p.texto === texto)) return
  ledger.pendencias.push({ texto, ...origem })
}

export function aviso(ledger, texto) {
  if (texto && !ledger.avisos.includes(texto)) ledger.avisos.push(texto)
}

export function contagem(ledger) {
  const porArea = {}
  for (const item of Object.values(ledger.itens)) {
    porArea[item.kind] ||= { total: 0, criado: 0, usado: 0, pulado: 0, erro: 0, pendente: 0, aguardando: 0 }
    const linha = porArea[item.kind]
    linha.total++
    linha[item.status] = (linha[item.status] || 0) + 1
  }
  return porArea
}

// Próximo passo, em linguagem de gente, para o Claude repassar e para quem abrir o LEDGER.md.
export function proximoPasso(ledger) {
  let esperando = null
  for (const { chave, titulo } of ETAPAS) {
    const { status, detalhe } = ledger.etapas[chave]
    if (status === 'feito') continue
    // Itens esperando a pessoa (um canal sem WhatsApp conectado) não seguram as etapas seguintes.
    if (status === 'aguardando') {
      esperando = detalhe
      continue
    }
    if (status === 'bloqueado' || status === 'erro') return `${titulo}: ${detalhe || status}`
    return titulo
  }
  return esperando ? `Migração concluída, com itens esperando você (ver o relatório): ${esperando}` : 'Migração concluída.'
}

function paraLer(ledger) {
  const linhas = []
  linhas.push('# Migração de conta do Cubo', '')
  if (ledger.origem && ledger.destino) {
    linhas.push(`De **${ledger.origem.nome}** (conta ${ledger.origem.companyId}) para **${ledger.destino.nome}** (conta ${ledger.destino.companyId}).`, '')
  }
  linhas.push(`Atualizado em ${ledger.atualizadoEm}. **Próximo passo:** ${proximoPasso(ledger)}`, '')

  linhas.push('## Etapas', '')
  for (const { chave, titulo } of ETAPAS) {
    const { status, detalhe } = ledger.etapas[chave]
    linhas.push(`- ${ICONE[status] || '⬜'} ${titulo}${detalhe ? ` — ${detalhe}` : ''}`)
  }

  const porArea = contagem(ledger)
  if (Object.keys(porArea).length) {
    linhas.push('', '## Por área', '', '| Área | Total | Criados | Já existiam (usados) | Pulados | Aguardando | Erros | Falta |', '| --- | --- | --- | --- | --- | --- | --- | --- |')
    for (const kind of Object.keys(porArea).sort((a, b) => AREA[a].ordem - AREA[b].ordem)) {
      const l = porArea[kind]
      linhas.push(`| ${AREA[kind].rotulo} | ${l.total} | ${l.criado || 0} | ${l.usado || 0} | ${l.pulado || 0} | ${l.aguardando || 0} | ${l.erro || 0} | ${l.pendente || 0} |`)
    }
  }

  if (ledger.perguntas.length) {
    linhas.push('', '## Esperando a sua decisão', '')
    for (const pergunta of ledger.perguntas) linhas.push(`- ${pergunta.texto}`)
  }
  const erros = Object.values(ledger.itens).filter((item) => item.status === 'erro')
  if (erros.length) {
    linhas.push('', '## Erros', '')
    for (const item of erros) linhas.push(`- ${AREA[item.kind].rotulo} “${item.nome}”: ${item.erro}`)
  }
  if (ledger.pendencias.length) {
    linhas.push('', '## O que fazer à mão na conta nova', '')
    for (const p of ledger.pendencias) linhas.push(`- [ ] ${p.texto}`)
  }
  if (ledger.avisos.length) {
    linhas.push('', '## Avisos', '')
    for (const texto of ledger.avisos) linhas.push(`- ${texto}`)
  }
  linhas.push('', '## Histórico (mais recente por último)', '')
  for (const { quando, texto } of ledger.historico.slice(-30)) linhas.push(`- ${quando.slice(0, 19).replace('T', ' ')} — ${texto}`)
  return `${linhas.join('\n')}\n`
}
