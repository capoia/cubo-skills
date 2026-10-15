#!/usr/bin/env node
// Fumaça das skills de fluxo e agente (explicar, criar, editar). Sobe um Cubo de mentira que segue o
// contrato que o CRM entregou (catálogos com ETag/304, `include=refs`, validate, rascunho, If-Match/412,
// publish, toggle-status, simulate com teto por minuto) e roda os scripts do motor como a skill roda.
// Roda no CI em Windows, macOS e Linux.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MOTOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'cubo', 'motor')
const PASTA = mkdtempSync(join(tmpdir(), 'cubo-fluxo-agente-'))
const resultados = []

function roda(script, args = [], { pasta = PASTA, env = {} } = {}) {
  return new Promise((pronto) => {
    const filho = spawn(process.execPath, [join(MOTOR, script), ...args], { cwd: pasta, env: { ...process.env, CUBO_PASTA: join(pasta, 'cubo'), CUBO_NAO_ABRIR: '1', ...env } })
    let saida = ''
    filho.stdout.on('data', (parte) => (saida += parte))
    filho.stderr.on('data', (parte) => (saida += parte))
    const limite = setTimeout(() => filho.kill(), 120_000)
    filho.on('close', (codigo) => {
      clearTimeout(limite)
      pronto({ codigo, saida })
    })
  })
}

async function caso(nome, funcao) {
  try {
    await funcao()
    resultados.push(`  ok     ${nome}`)
  } catch (erro) {
    resultados.push(`  FALHOU ${nome}\n         ${String(erro.message).replace(/\n/g, '\n         ')}`)
    process.exitCode = 1
  }
}

function confere(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem)
}

const escreve = (relativo, conteudo, pasta = PASTA) => {
  const arquivo = join(pasta, relativo)
  mkdirSync(dirname(arquivo), { recursive: true })
  writeFileSync(arquivo, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2))
  return arquivo
}
const le = (relativo, pasta = PASTA) => readFileSync(join(pasta, relativo), 'utf8')

// ---------------------------------------------------------------------------------------------
// Catálogos (um recorte do de verdade, com os mesmos campos).

const ocupada = { handle: 'ocupada', label: 'Conversa ocupada', engine: true }
const no = (type, label, category, outputs, extra = {}) => ({ type, label, category, categoryLabel: { messages: 'Mensagens', deals: 'Negociações', flow: 'Fluxo', conversations: 'Conversas', ai: 'IA' }[category], description: `${label} (descrição do catálogo).`, whenToUse: [], step: type !== 'start', requires: [], provides: [], configSchema: { type: 'object' }, defaults: {}, outputs, exposes: [], refs: [], example: {}, inPalette: true, ...extra })
const CATALOGO_AUTOMACOES = {
  version: 'cat-v1',
  nodes: [
    no('start', 'Início', 'flow', [{ handle: null, label: 'Seguir' }]),
    no('send_message', 'Enviar mensagem', 'messages', [{ handle: null, label: 'Seguir' }, ocupada]),
    no('ask_question', 'Fazer pergunta', 'messages', [{ handle: null, label: 'Seguir' }, { handle: 'timeout', label: 'Sem resposta', when: { field: 'timeoutMinutes', greaterThan: 0 } }, { handle: 'exhausted', label: 'Lembretes esgotados', when: { all: [{ field: 'followUp.enabled', equals: true }, { field: 'followUp.exhaustedAction.type', equals: 'handle_node' }] } }, ocupada]),
    no('menu_options', 'Menu de opções', 'messages', [{ handlesFrom: { list: 'options', key: 'targetHandle' }, label: 'Opção' }, ocupada]),
    no('condition', 'Condição', 'flow', [{ handle: 'yes', label: 'Sim' }, { handle: 'no', label: 'Não' }]),
    no('move_stage', 'Mover etapa', 'deals', [{ handle: null, label: 'Seguir' }], { refs: [{ path: 'pipeId', kind: 'pipe' }, { path: 'stageId', kind: 'stage' }], defaults: { pipeId: null, stageId: null } }),
    no('update_deal', 'Atualizar negociação', 'deals', [{ handle: null, label: 'Seguir' }]),
    no('change_status', 'Mudar status', 'conversations', [{ handle: null, label: 'Seguir' }, ocupada]),
    no('end_flow', 'Encerrar conversa', 'conversations', [{ handle: null, label: 'Seguir' }, ocupada]),
    no('handoff_to_human', 'Transferir para humano', 'conversations', [{ handle: null, label: 'Seguir' }, ocupada]),
    no('agent_call', 'Chamar agente', 'ai', [{ handle: null, label: 'Seguir' }, ocupada], { refs: [{ path: 'agentId', kind: 'agent' }] }),
    no('tag_conversation', 'Pôr tag', 'conversations', [{ handle: null, label: 'Seguir' }], { refs: [{ path: 'tagIds[0]', kind: 'tag' }] }),
    no('goto_node', 'Ir para o passo', 'flow', [ocupada]),
    no('start_flow', 'Iniciar outro fluxo', 'flow', [ocupada]),
    no('create_deal_from_chat', 'Criar negociação (antigo)', 'deals', [{ handle: null, label: 'Seguir' }], { deprecated: { replacedBy: 'create_deal' }, inPalette: false }),
  ],
  triggers: [
    { type: 'deal_created', label: 'Negociação criada', entities: ['deal'], configSchema: { type: 'object' }, refs: [{ path: 'pipeIds[0]', kind: 'pipe' }], example: {} },
    { type: 'message_received', label: 'Mensagem recebida', entities: ['conversation'], configSchema: { type: 'object' }, refs: [], example: {} },
  ],
  edges: { entrada: 'target' },
  variables: { sintaxe: '{{chave}}' },
  conventions: {},
  limits: { flowDataBytes: 2_000_000, triggerConfigBytes: 65_536, nodeIdMaxLength: 50 },
}

const CATALOGO_AGENTES_BASE = {
  chipSyntax: { regex: '\\{\\{tool:([a-zA-Z0-9_]+)(?:\\(([^)]*)\\))?\\}\\}', format: '{{tool:<nome>}} ou {{tool:<nome>(chave=valor)}}', quoting: 'aspas duplas', renderedName: '<nome>_<ids>' },
  chips: [
    { name: 'move_deal_stage', category: 'deals', kind: 'write', label: 'Mover etapa', description: 'Move a negociação de etapa.', supportsFollowUp: false, followUpKey: null, params: [{ key: 'pipeId', label: 'Funil', required: true, source: 'pipes', dependsOn: null, refKind: 'pipe', listFrom: '/api/pipes' }, { key: 'stageId', label: 'Etapa', required: true, source: 'stagesByPipe', dependsOn: 'pipeId', refKind: 'stage', listFrom: '/api/stages?pipe={pipeId}' }, { key: 'useWhen', label: 'Quando usar', required: false, source: 'text', dependsOn: null, refKind: null, listFrom: null }] },
    { name: 'add_tag', category: 'deals', kind: 'write', label: 'Pôr tag', description: 'Põe uma tag.', supportsFollowUp: false, followUpKey: null, params: [{ key: 'tagId', label: 'Tag', required: true, source: 'tags:deal', dependsOn: null, refKind: 'tag', listFrom: '/api/tags' }] },
    { name: 'answer_from_kb', category: 'knowledge', kind: 'read', label: 'Responder pela base', description: 'Consulta a base de conhecimento.', supportsFollowUp: false, followUpKey: null, params: [{ key: 'knowledgeBaseId', label: 'Base', required: true, source: 'knowledgeBases', dependsOn: null, refKind: 'knowledge_base', listFrom: '/api/knowledge-bases' }] },
    { name: 'transfer_to_human', category: 'conversation', kind: 'conversation', label: 'Passar para humano', description: 'Transfere a conversa.', supportsFollowUp: false, followUpKey: null, params: [] },
  ],
  followUp: { fieldKeys: 'name | phone', exhaustedActions: ['handoff_to_human', 'call_agent', 'start_flow', 'end_conversation'], schema: {} },
  fields: { inert: ['handoffTargets'], legacy: { enabledTools: 'não define ferramenta' } },
}

// ---------------------------------------------------------------------------------------------
// Banco do Cubo de mentira (uma conta só, a 7).

const CHAVES = {
  sk_tudo: { admin: true, escopos: { '*': ['*'] }, modulos: ['automations', 'ai-agents', 'channels'] },
  sk_leitura: { admin: true, escopos: { automations: ['read'], agents: ['read'], channels: ['read'] }, modulos: ['automations', 'ai-agents'] },
  sk_sem_modulo: { admin: true, escopos: { '*': ['*'] }, modulos: ['automations'] },
  sk_comum: { admin: false, escopos: { '*': ['*'] }, modulos: ['automations', 'ai-agents'] },
}
let proximoId = 9000
const banco = {
  pipes: [{ id: 30, name: 'Vendas' }],
  stages: [{ id: 27, name: 'Proposta', pipeId: 30 }, { id: 28, name: 'Fechado', pipeId: 30 }],
  tags: [{ id: 40, name: 'Lead quente' }],
  users: [{ id: 1, name: 'Dona', email: 'dona@x.com' }],
  customfields: [{ id: 50, name: 'Origem', context: 'deal' }],
  templates: [],
  departments: [{ id: 60, name: 'Comercial' }],
  'knowledge-bases': [{ id: 70, name: 'Perguntas frequentes' }],
  intents: [{ id: 80, displayName: 'Segunda via', enabled: false }],
  integrations: [{ id: 90, name: 'OpenAI', type: 'openai' }],
  channels: [{ id: 100, name: 'WhatsApp Vendas', defaultAgentId: 600, defaultAutomationId: null }],
  agents: [],
  automations: [],
  products: [],
  categories: [],
  lostreasons: [],
}
const chamadas = { catalogoAutomacoes: [], catalogoAgentes: [], simulacoes: 0, puts: [], posts: [] }
const falhas = { simulate429: 0, putMudaNoMeio: false }

const etagDe = (objeto) => `"${createHash('sha1').update(JSON.stringify(objeto)).digest('hex').slice(0, 16)}"`
const proximo = () => ++proximoId

banco.agents.push({
  id: 600,
  name: 'SDR',
  integrationId: 90,
  model: 'gpt-4o',
  systemPrompt: 'Você é o SDR da loja. Quando o cliente pedir proposta, use {{tool:move_deal_stage(pipeId=30,stageId=27)}}. Dúvidas: {{tool:answer_from_kb(knowledgeBaseId=70)}}. Segunda via: {{tool:intent_80}}. Se pedir humano, {{tool:transfer_to_human}}. Antigo: {{tool:chip_que_sumiu}}.',
  followUpConfig: { enabled: true, exhaustedAction: { type: 'start_flow', automationId: 701 } },
  handoffTargets: [],
  enabledTools: [],
  temperature: 0.3,
  updatedAt: '2026-10-01T00:00:00.000Z',
})
banco.agents.push({ id: 601, name: 'Suporte', integrationId: 90, model: 'gpt-4o', systemPrompt: 'Atenda o suporte.', followUpConfig: { enabled: true, exhaustedAction: { type: 'call_agent', agentId: 600 } }, handoffTargets: [], enabledTools: [], updatedAt: '2026-10-01T00:00:00.000Z' })

const fluxo701 = {
  nodes: [
    { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { triggers: [{ id: 't1', triggerType: 'deal_created', triggerConfig: { pipeIds: [30] } }] } },
    { id: 'msg-1', type: 'send_message', position: { x: 0, y: 130 }, data: { label: 'Boas-vindas', message: 'Oi! Tudo bem?' } },
    { id: 'ask-1', type: 'ask_question', position: { x: 0, y: 260 }, data: { label: 'Pergunta interesse', question: 'Quer uma proposta?', variableName: 'interesse', followUp: { enabled: true, exhaustedAction: { type: 'handle_node' } } } },
    { id: 'cond-1', type: 'condition', position: { x: 0, y: 390 }, data: { label: 'Quer proposta?', field: 'var.interesse', operator: 'equals', value: 'sim' } },
    { id: 'move-1', type: 'move_stage', position: { x: -260, y: 520 }, data: { label: 'Vai para proposta', pipeId: 30, stageId: 27 } },
    { id: 'hand-1', type: 'handoff_to_human', position: { x: -260, y: 650 }, data: { label: 'Chama vendedor', message: 'Já te passo, {{people.name}}!' } },
    { id: 'end-1', type: 'end_flow', position: { x: 260, y: 520 }, data: { farewellMessage: 'Até mais!' } },
    { id: 'upd-1', type: 'update_deal', position: { x: 260, y: 650 }, data: { label: 'Data prevista', fieldName: 'expectClosingDate', fieldValue: '2026-12-01' } },
    { id: 'lem-1', type: 'send_message', position: { x: 520, y: 390 }, data: { label: 'Lembrete', message: 'Ainda está aí?' } },
    { id: 'solto-1', type: 'move_stage', position: { x: 800, y: 0 }, data: { label: 'Esquecido', pipeId: 30, stageId: 999 } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'msg-1' },
    { id: 'e2', source: 'msg-1', target: 'ask-1' },
    { id: 'e3', source: 'ask-1', sourceHandle: 'exhausted', target: 'lem-1' },
    { id: 'e4', source: 'ask-1', target: 'cond-1' },
    { id: 'e5', source: 'cond-1', sourceHandle: 'yes', target: 'move-1' },
    { id: 'e6', source: 'move-1', target: 'hand-1' },
    { id: 'e7', source: 'cond-1', sourceHandle: 'no', target: 'end-1' },
    { id: 'e8', source: 'end-1', target: 'upd-1' },
  ],
}
banco.automations.push({ id: 701, name: 'Boas-vindas', status: 'active', publishedVersion: 3, hasUnpublishedChanges: true, folderId: null, published: structuredClone(fluxo701), draft: (() => {
  const d = structuredClone(fluxo701)
  d.nodes.push({ id: 'msg-2', type: 'send_message', position: { x: 520, y: 520 }, data: { label: 'Novo passo', message: 'Novidade' } })
  return d
})(), updatedAt: '2026-10-01T00:00:00.000Z' })
banco.automations.push({ id: 702, name: 'Recontato', status: 'draft', publishedVersion: null, hasUnpublishedChanges: true, published: null, draft: { nodes: [{ id: 'start', type: 'start', data: { triggers: [] } }, { id: 'sf', type: 'start_flow', data: { automationId: 701 } }], edges: [{ id: 'a', source: 'start', target: 'sf' }] }, updatedAt: '2026-10-01T00:00:00.000Z' })
banco.automations.push({ id: 703, name: 'Boas-vindas antigas', status: 'draft', publishedVersion: null, hasUnpublishedChanges: true, published: null, draft: { nodes: [], edges: [] }, updatedAt: '2026-10-01T00:00:00.000Z' })

// Refs: o que o extrator do CRM faz, só para os campos usados aqui.
const CHAVE_PARA_KIND = { pipeId: 'pipe', pipeIds: 'pipe', stageId: 'stage', stageIds: 'stage', tagId: 'tag', tagIds: 'tag', agentId: 'agent', automationId: 'automation', channelIds: 'channel', knowledgeBaseId: 'knowledge_base', departmentId: 'department', customfieldId: 'customfield', templateId: 'template', userId: 'user' }
const PARAM_PARA_KIND = { pipeId: 'pipe', stageId: 'stage', knowledgeBaseId: 'knowledge_base', tagId: 'tag' }
function extrairRefs(objeto) {
  const refs = []
  const anda = (valor, caminho, chave) => {
    if (Array.isArray(valor)) return valor.forEach((v, i) => anda(v, `${caminho}[${i}]`, chave))
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) if (k !== 'refs') anda(v, caminho ? `${caminho}.${k}` : k, k)
      return
    }
    if ((typeof valor === 'number' || /^\d+$/.test(String(valor))) && CHAVE_PARA_KIND[chave]) refs.push({ path: caminho, kind: CHAVE_PARA_KIND[chave], id: Number(valor) })
    if (typeof valor === 'string') {
      for (const m of valor.matchAll(/\{\{tool:([a-z_0-9]+)\(([^)]*)\)\}\}/g)) for (const p of m[2].matchAll(/(\w+)=(\d+)/g)) if (PARAM_PARA_KIND[p[1]]) refs.push({ path: caminho, kind: PARAM_PARA_KIND[p[1]], id: Number(p[2]), token: m[0] })
      for (const m of valor.matchAll(/\{\{tool:intent_(\d+)\}\}/g)) refs.push({ path: caminho, kind: 'custom_intent', id: Number(m[1]), token: m[0] })
    }
  }
  anda(objeto, '', null)
  return refs
}

const KIND_ROTA = { pipe: 'pipes', stage: 'stages', tag: 'tags', agent: 'agents', automation: 'automations', channel: 'channels', knowledge_base: 'knowledge-bases', department: 'departments', customfield: 'customfields', template: 'templates', user: 'users', custom_intent: 'intents' }
const existe = (kind, id) => (banco[KIND_ROTA[kind]] || []).some((item) => String(item.id) === String(id))

function automacaoPublica(a, versao) {
  const flowData = versao === 'draft' ? a.draft : a.published ?? a.draft
  const { published, draft, ...resto } = a
  return { ...resto, flowDataVersion: versao === 'draft' || !a.published ? 'draft' : 'published', flowData: structuredClone(flowData) }
}
const etagAutomacao = (a) => etagDe({ d: a.draft, u: a.updatedAt, s: a.status })

function validarAutomacao(corpo) {
  const errors = []
  const warnings = []
  const fd = corpo.flowData || { nodes: [], edges: [] }
  const tipos = new Set(CATALOGO_AUTOMACOES.nodes.map((n) => n.type))
  ;(fd.nodes || []).forEach((n, i) => {
    if (!tipos.has(n.type)) errors.push({ path: `flowData.nodes[${i}].type`, code: 'unknown_node_type', message: `Tipo de bloco desconhecido: ${n.type}` })
  })
  for (const ref of extrairRefs({ flowData: fd })) if (!existe(ref.kind, ref.id)) errors.push({ path: ref.path, code: 'foreign_ref', message: `${ref.kind} ${ref.id} não pertence a esta conta` })
  const alvo = new Set((fd.edges || []).map((e) => e.target))
  ;(fd.nodes || []).forEach((n, i) => {
    if (n.type !== 'start' && !alvo.has(n.id)) warnings.push({ path: `flowData.nodes[${i}]`, code: 'orphan_node', message: 'Bloco sem nenhuma ligação chegando' })
  })
  if (!(fd.nodes || []).some((n) => n.type === 'start' && n.data?.triggers?.length)) errors.push({ path: 'flowData.nodes', code: 'no_trigger_or_action', message: 'O fluxo precisa de um gatilho e uma ação' })
  return { ok: !errors.length, errors, warnings }
}

function catalogoAgentes() {
  const corpo = {
    ...CATALOGO_AGENTES_BASE,
    dynamicChips: {
      intents: banco.intents.map((i) => ({ chip: `intent_${i.id}`, name: i.displayName, description: '', whenToUse: '', enabled: i.enabled, inputFields: [] })),
      mcp: [],
    },
  }
  const version = createHash('sha1').update(JSON.stringify(corpo)).digest('hex').slice(0, 12)
  return { version, ...corpo }
}

const CHIP_RE = /\{\{tool:([a-zA-Z0-9_]+)(?:\(([^)]*)\))?\}\}/g
function validarAgente(corpo, existente = null) {
  const errors = []
  const warnings = []
  const nomes = new Map(catalogoAgentes().chips.map((c) => [c.name, c]))
  const intents = new Map(banco.intents.map((i) => [`intent_${i.id}`, i]))
  const antigos = new Set([...(existente?.systemPrompt || '').matchAll(CHIP_RE)].map((m) => m[0]))
  for (const m of (corpo.systemPrompt ?? existente?.systemPrompt ?? '').matchAll(CHIP_RE)) {
    const problema = (code, message) => (antigos.has(m[0]) ? warnings.push({ path: 'systemPrompt', code, message: `Já estava gravado: ${message}`, token: m[0] }) : errors.push({ path: 'systemPrompt', code, message, token: m[0] }))
    if (intents.has(m[1])) {
      if (!intents.get(m[1]).enabled) warnings.push({ path: 'systemPrompt', code: 'intent_disabled', message: `A intent ${m[1]} está desligada`, token: m[0] })
      continue
    }
    const chip = nomes.get(m[1])
    if (!chip) {
      problema('unknown_chip', `Chip desconhecido: ${m[1]}`)
      continue
    }
    const params = Object.fromEntries([...(m[2] || '').matchAll(/(\w+)=("[^"]*"|[^,]*)/g)].map((p) => [p[1], p[2].replace(/^"|"$/g, '')]))
    for (const p of chip.params) {
      if (p.required && !params[p.key]) problema('missing_param', `Falta ${p.key} em ${m[1]}`)
      if (p.refKind && params[p.key] && !existe(p.refKind, params[p.key])) problema('foreign_ref', `${p.refKind} ${params[p.key]} não pertence a esta conta`)
    }
  }
  if (corpo.handoffTargets?.length) warnings.push({ path: 'handoffTargets', code: 'inert_field', message: 'handoffTargets não faz nada' })
  return { ok: !errors.length, errors, warnings }
}

function lista(itens, url) {
  const pagina = Number(url.searchParams.get('page') || 1)
  const porPagina = Number(url.searchParams.get('perPage') || 100)
  const fatia = itens.slice((pagina - 1) * porPagina, pagina * porPagina)
  return { data: fatia, metadata: { lastPage: Math.max(1, Math.ceil(itens.length / porPagina)) } }
}

const servidor = createServer(async (req, res) => {
  let texto = ''
  for await (const parte of req) texto += parte
  const corpo = texto ? JSON.parse(texto) : undefined
  const url = new URL(req.url, 'http://x')
  const caminho = url.pathname
  const responde = (status, dado, cabecalhos = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...cabecalhos })
    res.end(dado === undefined ? '' : JSON.stringify(dado))
  }
  const chave = CHAVES[req.headers['x-api-key']]
  if (!chave) return responde(401, { message: 'Unauthorized' })
  const pode = (recurso, acao) => (chave.escopos['*'] || []).includes('*') || (chave.escopos[recurso] || []).includes(acao)
  const exige = (recurso, acao) => {
    if (pode(recurso, acao)) return true
    responde(403, { message: `Missing scope: ${recurso}:${acao}` })
    return false
  }
  const m = (re) => caminho.match(re)

  if (caminho === '/api/whoami') {
    return responde(200, { data: { company: { id: 7, name: 'Loja Teste' }, user: { id: 1, name: chave.admin ? 'Dona' : 'Zé', isAdmin: chave.admin }, apiKey: { scopes: chave.escopos, fullAccess: (chave.escopos['*'] || []).includes('*') }, modules: { activeSlugs: chave.modulos } } })
  }

  // --- automações
  if (caminho === '/api/automations/catalog' && req.method === 'GET') {
    if (!exige('automations', 'read')) return
    chamadas.catalogoAutomacoes.push(req.headers['if-none-match'] ?? null)
    const etag = `"${CATALOGO_AUTOMACOES.version}"`
    if (req.headers['if-none-match'] === etag) return responde(304, undefined, { ETag: etag })
    return responde(200, CATALOGO_AUTOMACOES, { ETag: etag })
  }
  if (caminho === '/api/automations/validate' && req.method === 'POST') return exige('automations', 'read') && responde(200, validarAutomacao(corpo))
  let achado
  if ((achado = m(/^\/api\/automations\/(\d+)\/validate$/)) && req.method === 'POST') {
    if (!exige('automations', 'read')) return
    const a = banco.automations.find((x) => x.id === Number(achado[1]))
    return responde(200, validarAutomacao({ flowData: corpo?.flowData ?? a.draft }))
  }
  if (caminho === '/api/automations' && req.method === 'GET') {
    if (!exige('automations', 'read')) return
    const nome = url.searchParams.get('name')
    const itens = banco.automations.filter((a) => !nome || a.name.toLowerCase().includes(nome.toLowerCase())).map(({ published, draft, ...resto }) => resto)
    return responde(200, lista(itens, url))
  }
  if (caminho === '/api/automations' && req.method === 'POST') {
    if (!exige('automations', 'create')) return
    const v = validarAutomacao(corpo)
    if (v.errors.some((e) => ['invalid_shape', 'too_large', 'foreign_ref'].includes(e.code))) return responde(422, { message: v.errors[0].message })
    const a = { id: proximo(), name: corpo.name, status: 'draft', publishedVersion: null, hasUnpublishedChanges: true, folderId: corpo.folderId ?? null, published: null, draft: corpo.flowData, updatedAt: new Date().toISOString() }
    banco.automations.push(a)
    chamadas.posts.push({ rota: 'automations', corpo })
    return responde(201, { ...automacaoPublica(a, 'draft'), warnings: v.warnings }, { ETag: etagAutomacao(a) })
  }
  if ((achado = m(/^\/api\/automations\/(\d+)$/))) {
    const a = banco.automations.find((x) => x.id === Number(achado[1]))
    if (!a) return responde(404, { message: 'Not found' })
    if (req.method === 'GET') {
      if (!exige('automations', 'read')) return
      const objeto = automacaoPublica(a, url.searchParams.get('version') === 'draft' ? 'draft' : 'published')
      if (url.searchParams.get('include') === 'refs') objeto.refs = extrairRefs({ flowData: objeto.flowData })
      return responde(200, objeto, { ETag: etagAutomacao(a) })
    }
    if (req.method === 'PUT') {
      if (!exige('automations', 'update')) return
      if (falhas.putMudaNoMeio) {
        falhas.putMudaNoMeio = false
        a.draft.nodes.push({ id: 'de-outra-pessoa', type: 'send_message', data: { label: 'Mudança de outra pessoa', message: 'oi' } })
        a.updatedAt = new Date(Date.now() + 1000).toISOString()
      }
      if (req.headers['if-match'] && req.headers['if-match'] !== etagAutomacao(a)) return responde(412, { message: 'Precondition failed' })
      const v = validarAutomacao({ flowData: corpo.flowData ?? a.draft })
      if (v.errors.some((e) => ['invalid_shape', 'too_large', 'foreign_ref'].includes(e.code))) return responde(422, { message: v.errors[0].message })
      chamadas.puts.push({ id: a.id, corpo, ifMatch: req.headers['if-match'] ?? null })
      if (corpo.flowData) {
        a.draft = corpo.flowData
        a.hasUnpublishedChanges = true
      }
      if (corpo.name) a.name = corpo.name
      a.updatedAt = new Date(Date.parse(a.updatedAt) + 1000).toISOString()
      return responde(200, { ...automacaoPublica(a, 'draft'), warnings: v.warnings }, { ETag: etagAutomacao(a) })
    }
  }
  if ((achado = m(/^\/api\/automations\/(\d+)\/publish$/)) && req.method === 'POST') {
    if (!exige('automations', 'update')) return
    const a = banco.automations.find((x) => x.id === Number(achado[1]))
    const v = validarAutomacao({ flowData: a.draft })
    if (!v.ok) return responde(422, { message: 'Não dá para publicar', errors: v.errors })
    a.published = structuredClone(a.draft)
    a.publishedVersion = (a.publishedVersion ?? 0) + 1
    a.hasUnpublishedChanges = false
    a.updatedAt = new Date(Date.parse(a.updatedAt) + 1000).toISOString()
    return responde(200, automacaoPublica(a, 'published'), { ETag: etagAutomacao(a) })
  }
  if ((achado = m(/^\/api\/automations\/(\d+)\/toggle-status$/)) && req.method === 'POST') {
    if (!exige('automations', 'update')) return
    const a = banco.automations.find((x) => x.id === Number(achado[1]))
    if (corpo.status === 'active' && !a.published) return responde(422, { message: 'Publique antes de ligar' })
    a.status = corpo.status
    return responde(200, { id: a.id, status: a.status })
  }

  // --- agentes
  if (caminho === '/api/agents/catalog' && req.method === 'GET') {
    if (!exige('agents', 'read')) return
    const cat = catalogoAgentes()
    chamadas.catalogoAgentes.push(req.headers['if-none-match'] ?? null)
    const etag = `"${cat.version}"`
    if (req.headers['if-none-match'] === etag) return responde(304, undefined, { ETag: etag })
    return responde(200, cat, { ETag: etag })
  }
  if (caminho === '/api/agents/validate' && req.method === 'POST') return exige('agents', 'read') && responde(200, validarAgente(corpo))
  if ((achado = m(/^\/api\/agents\/(\d+)\/validate$/)) && req.method === 'POST') {
    if (!exige('agents', 'read')) return
    const ag = banco.agents.find((x) => x.id === Number(achado[1]))
    return responde(200, validarAgente({ ...ag, ...corpo }, ag))
  }
  if ((achado = m(/^\/api\/agents\/(\d+)\/simulate$/)) && req.method === 'POST') {
    if (!exige('agents', 'simulate')) return
    if (!chave.modulos.includes('ai-agents')) return responde(403, { message: 'Módulo ai-agents desligado' })
    if (falhas.simulate429 > 0) {
      falhas.simulate429--
      return responde(429, { message: 'Too many requests' }, { 'Retry-After': '0' })
    }
    chamadas.simulacoes++
    const ultima = corpo.messages.at(-1)?.content ?? ''
    const quer = /proposta/i.test(ultima)
    return responde(200, { executionId: `sim-${chamadas.simulacoes}`, status: 'success', reply: quer ? 'Claro! Já movi sua negociação para Proposta.' : 'Posso ajudar com mais alguma coisa?', isComplete: false, toolCalls: quer ? [{ name: 'move_deal_stage_27_30', args: {}, output: { ok: true }, simulated: true }] : [], usage: { inputTokens: 100, outputTokens: 20, costCents: 0.4, latencyMs: 900 } })
  }
  if ((achado = m(/^\/api\/integrations\/(\d+)\/ai-models$/)) && req.method === 'GET') {
    if (!exige('integrations', 'read')) return
    return responde(200, { data: [{ id: 'gpt-4o', label: 'GPT-4o', capabilities: ['tools'], toolsUnsupported: false }, { id: 'o1-mini', label: 'o1 mini', capabilities: [], toolsUnsupported: true }] })
  }
  if (caminho === '/api/agents' && req.method === 'POST') {
    if (!exige('agents', 'create')) return
    if (!chave.admin) return responde(403, { message: 'Só administrador' })
    const v = validarAgente(corpo)
    if (!v.ok) return responde(422, { message: 'Chip com problema', errors: v.errors })
    const ag = { ...corpo, id: proximo(), updatedAt: new Date().toISOString() }
    banco.agents.push(ag)
    chamadas.posts.push({ rota: 'agents', corpo })
    return responde(201, { ...ag, warnings: v.warnings }, { ETag: etagDe(ag) })
  }
  if ((achado = m(/^\/api\/agents\/(\d+)$/))) {
    const ag = banco.agents.find((x) => x.id === Number(achado[1]))
    if (!ag) return responde(404, { message: 'Not found' })
    if (req.method === 'GET') {
      if (!exige('agents', 'read')) return
      const objeto = structuredClone(ag)
      if (url.searchParams.get('include') === 'refs') objeto.refs = extrairRefs(objeto)
      return responde(200, objeto, { ETag: etagDe(ag) })
    }
    if (req.method === 'PUT') {
      if (!exige('agents', 'update')) return
      if (!chave.admin) return responde(403, { message: 'Só administrador' })
      if (falhas.putMudaNoMeio) {
        falhas.putMudaNoMeio = false
        ag.systemPrompt += ' (mudado por outra pessoa)'
        ag.updatedAt = new Date(Date.now() + 1000).toISOString()
      }
      if (req.headers['if-match'] && req.headers['if-match'] !== etagDe(ag)) return responde(412, { message: 'Precondition failed' })
      const v = validarAgente({ ...ag, ...corpo }, ag)
      if (!v.ok) return responde(422, { message: 'Chip com problema', errors: v.errors })
      chamadas.puts.push({ id: ag.id, corpo, ifMatch: req.headers['if-match'] ?? null })
      for (const removido of ['enabledMcpConnections', 'allowKnowledgeWriting']) delete corpo[removido]
      Object.assign(ag, corpo, { updatedAt: new Date(Date.parse(ag.updatedAt) + 1000).toISOString() })
      return responde(200, { ...structuredClone(ag), warnings: v.warnings }, { ETag: etagDe(ag) })
    }
  }

  // --- listas e criação genérica
  const rota = caminho.replace(/^\/api\//, '')
  if (banco[rota] && req.method === 'GET') {
    const recurso = { 'knowledge-bases': 'knowledgeBases', lostreasons: 'lostReasons' }[rota] || rota
    if (!pode(recurso, 'read') && !pode('*', '*')) return responde(403, { message: `Missing scope: ${recurso}:read` })
    let itens = banco[rota]
    if (rota === 'stages' && url.searchParams.get('pipe')) itens = itens.filter((s) => String(s.pipeId) === url.searchParams.get('pipe'))
    if (rota === 'agents' && url.searchParams.get('include') === 'refs') itens = itens.map((a) => ({ ...a, refs: extrairRefs(a) }))
    return responde(200, lista(itens, url))
  }
  if (banco[rota] && req.method === 'POST') {
    const recurso = { 'knowledge-bases': 'knowledgeBases', lostreasons: 'lostReasons' }[rota] || rota
    if (!pode(recurso, 'create')) return responde(403, { message: `Missing scope: ${recurso}:create` })
    if (rota === 'stages' && !banco.pipes.some((p) => p.id === Number(corpo.pipeId))) return responde(422, { message: 'Funil não existe' })
    const item = { ...corpo, id: proximo() }
    if (rota === 'intents') item.enabled = false
    banco[rota].push(item)
    chamadas.posts.push({ rota, corpo })
    return responde(201, item)
  }
  responde(404, { message: `rota desconhecida: ${req.method} ${caminho}` })
})
await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto))
const BASE = `http://127.0.0.1:${servidor.address().port}`
const acessoCom = (chave, pasta = PASTA) => escreve(join('cubo', '.cubo.env'), `CUBO_BASE_URL=${BASE}\nCUBO_API_KEY=${chave}\n`, pasta)

// ---------------------------------------------------------------------------------------------
// Casos.

await caso('acesso: sem arquivo, não deixa seguir e ensina a abrir; abrir cria o modelo', async () => {
  const r = await roda('acesso.mjs', ['conferir', '--para=explicar-fluxo'])
  confere(r.codigo === 1 && /acesso\.mjs" abrir/.test(r.saida), r.saida)
  const a = await roda('acesso.mjs', ['abrir'])
  confere(a.codigo === 0 && /CUBO_API_KEY=/.test(le('cubo/.cubo.env')), a.saida)
})

await caso('acesso: permissão e módulo que faltam aparecem com o que fazer', async () => {
  acessoCom('sk_leitura')
  const r = await roda('acesso.mjs', ['conferir', '--para=editar-fluxo'])
  confere(r.codigo === 1 && /"Automações: criação"/.test(r.saida) && /"Automações: edição"/.test(r.saida), r.saida)
  acessoCom('sk_sem_modulo')
  const s = await roda('acesso.mjs', ['conferir', '--para=explicar-agente', '--simular'])
  confere(s.codigo === 1 && /módulo “Agentes de IA”/.test(s.saida), s.saida)
  acessoCom('sk_comum')
  const t = await roda('acesso.mjs', ['conferir', '--para=editar-agente'])
  confere(t.codigo === 1 && /não é administrador/.test(t.saida), t.saida)
})

await caso('acesso: tudo certo grava a conta; sem leitura das outras áreas, avisa que vai mostrar número', async () => {
  acessoCom('sk_leitura')
  const r = await roda('acesso.mjs', ['conferir', '--para=explicar-fluxo'])
  confere(r.codigo === 0 && /TUDO CERTO/.test(r.saida) && /só o número/.test(r.saida), r.saida)
  acessoCom('sk_tudo')
  const s = await roda('acesso.mjs', ['conferir', '--para=explicar-fluxo'])
  confere(s.codigo === 0 && !/só o número/.test(s.saida) && JSON.parse(le('cubo/conta.json')).companyId === 7, s.saida)
})

await caso('catálogo: a 2ª leitura manda If-None-Match e usa o cache no 304', async () => {
  const antes = chamadas.catalogoAutomacoes.length
  const a = await roda('catalogo.mjs', ['resumo'])
  const b = await roda('catalogo.mjs', ['no', 'ask_question'])
  confere(a.codigo === 0 && /send_message — Enviar mensagem/.test(a.saida) && !/create_deal_from_chat/.test(a.saida), a.saida)
  confere(b.codigo === 0 && JSON.parse(b.saida).type === 'ask_question', b.saida)
  const novas = chamadas.catalogoAutomacoes.slice(antes)
  confere(novas[0] === null && novas[1] === '"cat-v1"', JSON.stringify(novas))
  const c = await roda('catalogo.mjs', ['no', 'nao_existe'])
  confere(c.codigo === 2 && /não existe nó/.test(c.saida), c.saida)
})

await caso('explicar-fluxo: por nome ambíguo sai 3 com a lista; nome que não existe sai 2', async () => {
  const r = await roda('fluxo/explicar.mjs', ['preparar', 'Boas-vindas'])
  confere(r.codigo === 0, `nome exato único deve achar: ${r.saida}`)
  const s = await roda('fluxo/explicar.mjs', ['preparar', 'boas'])
  confere(s.codigo === 3 && /#701/.test(s.saida) && /#703/.test(s.saida), s.saida)
  const t = await roda('fluxo/explicar.mjs', ['preparar', 'Nada disso'])
  confere(t.codigo === 2 && /não achei/.test(t.saida), t.saida)
})

await caso('explicar-fluxo: roteiro com nomes, saídas, armadilhas, validação, rascunho e quem chama', async () => {
  const r = await roda('fluxo/explicar.mjs', ['preparar', '701'])
  confere(r.codigo === 0, r.saida)
  const s = r.saida
  confere(/Proposta \(funil Vendas\) \(#27\)/.test(s), `etapa com nome e funil:\n${s}`)
  confere(/saída “Sim” → passo/.test(s) && /saída “Lembretes esgotados” → passo/.test(s), `saídas:\n${s}`)
  confere(/SOLTO/.test(s), `nó órfão marcado:\n${s}`)
  for (const codigo of ['exhausted_captura', 'end_flow_segue', 'handoff_literal', 'update_deal_ignora', 'orphan_node', 'foreign_ref']) confere(s.includes(`(${codigo})`), `faltou ${codigo}:\n${s}`)
  confere(/NÃO PUBLICADAS/.test(s) && /entra “Novo passo”/.test(s), `diferença do rascunho:\n${s}`)
  confere(/automação “Recontato” \(#702\)/.test(s) && /agente “SDR” \(#600\)/.test(s), `quem chama:\n${s}`)
  confere(/CAMINHOS LIDOS DO DESENHO/.test(s) && /⇒/.test(s), s)
})

await caso('explicar-fluxo: página sem nenhum endereço externo, com desenho, passos, aviso e problemas', async () => {
  const dados = JSON.parse(le('cubo/explicacoes/fluxo-701.dados.json'))
  const passos = Object.fromEntries(dados.descricao.passos.filter((p) => p.tipo !== 'start').map((p) => [p.n, `Frase do passo ${p.n} <script>alert(1)</script>`]))
  escreve('cubo/explicacoes/fluxo-701.texto.json', { resumo: 'Quando entra uma **negociação** no funil Vendas, o fluxo dá boas-vindas.', passos, caminhos: [{ titulo: 'Cliente quer proposta', historia: 'Ele responde sim e vai para Proposta.' }] })
  const r = await roda('fluxo/explicar.mjs', ['pagina', '701'])
  confere(r.codigo === 0, r.saida)
  const html = le('cubo/explicacoes/fluxo-701.html')
  confere(/<svg class="desenho"/.test(html) && /id="passo-2"/.test(html), 'desenho e passos')
  confere(!/(src|href)="https?:/.test(html) && !/@import/.test(html), 'nada externo')
  confere(!html.includes('<script>alert(1)</script>') && html.includes('&lt;script&gt;'), 'texto escapado')
  confere(/não se responsabiliza/.test(html) && /exhausted_captura/.test(html) && /<strong>negociação<\/strong>/.test(html), 'aviso e problemas')
})

await caso('explicar-fluxo: nunca publicado explica o rascunho e avisa', async () => {
  const r = await roda('fluxo/explicar.mjs', ['preparar', '702', '--sem-usos'])
  confere(r.codigo === 0 && /NUNCA FOI PUBLICADO/.test(r.saida) && /no_trigger_or_action/.test(r.saida), r.saida)
})

await caso('explicar-agente: chips viram frases com nomes, validação, intent desligada e onde é usado', async () => {
  const r = await roda('agente/explicar.mjs', ['preparar', 'sdr'])
  confere(r.codigo === 0, r.saida)
  const s = r.saida
  confere(/Mover etapa \(Funil: Vendas; Etapa: Proposta \(funil Vendas\)\)/.test(s), `chip com nomes:\n${s}`)
  confere(/Segunda via.*\[INTENT DESLIGADA\]/.test(s) && /\(intent_disabled\)/.test(s), `intent desligada:\n${s}`)
  confere(/\(unknown_chip\)/.test(s) && /Já estava gravado/.test(s), `chip que sumiu vira aviso de já gravado:\n${s}`)
  confere(/canal “WhatsApp Vendas” \(#100\)/.test(s) && /agente “Suporte” \(#601\)/.test(s), `onde é usado:\n${s}`)
  confere(/inicia o fluxo Boas-vindas/.test(s), `follow-up com nome do fluxo:\n${s}`)
  confere(/⟦Responder pela base \(Base: Perguntas frequentes\)⟧/.test(s), `prompt anotado:\n${s}`)
})

await caso('simular: uma fala por vez, espera no teto por minuto e no 429, guarda custo e conversa', async () => {
  escreve('situacoes.json', [
    { titulo: 'Pede proposta', mensagens: ['Oi', 'Quero uma proposta'] },
    { titulo: 'Fora do roteiro', mensagens: ['Vocês vendem pizza?'] },
  ])
  falhas.simulate429 = 1
  const antes = chamadas.simulacoes
  const inicio = Date.now()
  const r = await roda('agente/simular.mjs', ['600', `@${join(PASTA, 'situacoes.json')}`], { env: { CUBO_SIMULAR_POR_MINUTO: '2', CUBO_SIMULAR_JANELA_MS: '1500' } })
  confere(r.codigo === 0, r.saida)
  confere(chamadas.simulacoes - antes === 3 && Date.now() - inicio >= 1400, `3 falas, com espera na janela: ${chamadas.simulacoes - antes} em ${Date.now() - inicio} ms`)
  const ex = JSON.parse(le('cubo/explicacoes/agente-600.exemplos.json')).exemplos
  confere(ex.length === 2 && ex[0].turnos[1].toolCalls[0].simulated === true && ex[0].turnos[0].custoCentavos === 0.4, JSON.stringify(ex))
  confere(/Custo total: 1,20 centavos/.test(r.saida) && /nada mudou na conta/.test(r.saida), r.saida)
})

await caso('explicar-agente: página com conversas, ferramentas, onde é usado e o prompt escapado', async () => {
  escreve('cubo/explicacoes/agente-600.texto.json', { resumo: 'O SDR atende o WhatsApp de vendas.', explicacao: 'Ele responde dúvidas e move para Proposta.', chips: { '{{tool:transfer_to_human}}': 'Passa para uma pessoa.' } })
  const r = await roda('agente/explicar.mjs', ['pagina', '600'])
  confere(r.codigo === 0, r.saida)
  const html = le('cubo/explicacoes/agente-600.html')
  confere(/Quero uma proposta/.test(html) && /simulado: nada mudou/.test(html) && /WhatsApp Vendas/.test(html) && /Passa para uma pessoa/.test(html), 'conteúdo')
  confere(/&#123;|\{\{tool:move_deal_stage/.test(html) && !/(src|href)="https?:/.test(html) && /não se responsabiliza/.test(html), 'escapado, local e com aviso')
})

// --- itens que faltam

await caso('itens: plano sem criar; parecido vira pergunta; igual é usado; tipo sem API ensina a tela', async () => {
  escreve('itens.json', [
    { tipo: 'tag', nome: 'lead quente' },
    { tipo: 'etapa', nome: 'Negociação', funil: 'Vendas' },
    { tipo: 'tag', nome: 'Lead quentes' },
    { tipo: 'usuario', nome: 'Bia' },
  ])
  const antes = banco.tags.length + banco.stages.length
  const r = await roda('itens.mjs', ['criar', `@${join(PASTA, 'itens.json')}`, '--so-plano'])
  confere(r.codigo === 3, `parecido para a lista: ${r.saida}`)
  confere(/1\. \[USAR\] tag “lead quente”: já existe \(#40\)/.test(r.saida), r.saida)
  confere(/2\. \[CRIAR\] etapa/.test(r.saida) && /3\. \[PERGUNTAR\] tag “Lead quentes”: há parecido: “Lead quente” \(#40\)/.test(r.saida) && /4\. \[NA TELA\].*Convidar/.test(r.saida), r.saida)
  confere(banco.tags.length + banco.stages.length === antes, 'nada criado no plano')
})

await caso('itens: cria uma vez só (funil e etapa no mesmo lote), e rodar de novo reusa o criados.json', async () => {
  escreve('itens.json', [
    { tipo: 'funil', nome: 'Pós-venda' },
    { tipo: 'etapa', nome: 'Boas-vindas', funil: 'Pós-venda' },
    { tipo: 'tag', nome: 'Cliente novo' },
  ])
  const r = await roda('itens.mjs', ['criar', `@${join(PASTA, 'itens.json')}`])
  confere(r.codigo === 0 && /\[CRIADO\] funil/.test(r.saida) && /\[CRIADO\] etapa/.test(r.saida), r.saida)
  const funil = banco.pipes.find((p) => p.name === 'Pós-venda')
  const etapa = banco.stages.find((s) => s.name === 'Boas-vindas')
  confere(funil && etapa && etapa.pipeId === funil.id && banco.tags.find((t) => t.name === 'Cliente novo')?.color, `etapa no funil novo e tag com cor: ${JSON.stringify(etapa)}`)
  const quantos = banco.pipes.length + banco.stages.length + banco.tags.length
  const s = await roda('itens.mjs', ['criar', `@${join(PASTA, 'itens.json')}`])
  confere(s.codigo === 0 && banco.pipes.length + banco.stages.length + banco.tags.length === quantos && /\[USAR\]/.test(s.saida), s.saida)
  const l = await roda('itens.mjs', ['listar-criados'])
  confere(/funil “Pós-venda”/.test(l.saida) && /na tela do Cubo/.test(l.saida), l.saida)
  const b = await roda('itens.mjs', ['buscar', 'etapa', 'propos'])
  confere(/#27 — Proposta \(funil Vendas\)/.test(b.saida), b.saida)
})

// --- editar e criar fluxo

await caso('editar-fluxo: ler guarda cópia e avisa do rascunho não publicado; prévia aplica a lista e preserva o resto', async () => {
  const r = await roda('fluxo/editar.mjs', ['ler', '701'])
  confere(r.codigo === 0 && /Cópia de segurança/.test(r.saida) && /NÃO PUBLICADAS/.test(r.saida) && /LIGADO/.test(r.saida), r.saida)
  escreve('mudancas.json', [
    { op: 'inserir', tipo: 'tag_conversation', titulo: 'Marca quente', dados: { tagIds: [40] }, depoisDe: 'Quer proposta?', saida: 'Sim' },
    { op: 'configurar', no: 'msg-1', dados: { message: 'Olá! Tudo bem?' } },
    { op: 'tirar', no: 'solto-1' },
    { op: 'desligar', de: 'end-1' },
  ])
  const p = await roda('fluxo/editar.mjs', ['previa', '701', `@${join(PASTA, 'mudancas.json')}`])
  confere(p.codigo === 0 && /entra o passo “Marca quente” depois de “Quer proposta\?”/.test(p.saida) && /sai o passo “Esquecido”/.test(p.saida), p.saida)
  const t = JSON.parse(le('cubo/trabalho/fluxo-701.json'))
  const nos = t.novo.flowData.nodes
  const arestas = t.novo.flowData.edges
  confere(nos.find((n) => n.id === 'msg-1').data.message === 'Olá! Tudo bem?' && nos.some((n) => n.id === 'msg-2') && !nos.some((n) => n.id === 'solto-1'), 'preserva o rascunho (msg-2) e aplica')
  const novo = nos.find((n) => n.data?.label === 'Marca quente')
  confere(arestas.some((e) => e.source === 'cond-1' && e.sourceHandle === 'yes' && e.target === novo.id) && arestas.some((e) => e.source === novo.id && e.target === 'move-1') && !arestas.some((e) => e.source === 'cond-1' && e.target === 'move-1'), `inserido no meio: ${JSON.stringify(arestas)}`)
  confere(novo.position && Number.isFinite(novo.position.y), 'nó novo com posição')
  confere(/Lead quente \(#40\)/.test(p.saida), `nome da tag na prévia:\n${p.saida}`)
  confere(/não se responsabiliza/.test(p.saida) && existsSync(join(PASTA, 'cubo', 'previas', 'fluxo-701.html')), 'aviso e página')
})

await caso('editar-fluxo: mudança impossível explica e não grava nada', async () => {
  escreve('ruim.json', [{ op: 'ligar', de: 'cond-1', saida: 'Talvez', para: 'msg-1' }])
  const r = await roda('fluxo/editar.mjs', ['previa', '701', `@${join(PASTA, 'ruim.json')}`])
  confere(r.codigo === 1 && /não tem a saída “Talvez”/.test(r.saida) && /“Sim” \(yes\)/.test(r.saida), r.saida)
  escreve('ruim2.json', [{ op: 'por', tipo: 'nao_existe' }])
  const s = await roda('fluxo/editar.mjs', ['previa', '701', `@${join(PASTA, 'ruim2.json')}`])
  confere(s.codigo === 1 && /não existe o tipo de nó/.test(s.saida), s.saida)
  escreve('ref-ruim.json', [{ op: 'configurar', no: 'move-1', dados: { stageId: 31337 } }])
  const t = await roda('fluxo/editar.mjs', ['previa', '701', `@${join(PASTA, 'ref-ruim.json')}`])
  confere(t.codigo === 1 && /NÃO DÁ PARA GRAVAR/.test(t.saida), t.saida)
  const g = await roda('fluxo/editar.mjs', ['gravar', '701'])
  confere(g.codigo === 2 && /impede gravar/.test(g.saida), g.saida)
  // volta para a prévia boa
  await roda('fluxo/editar.mjs', ['previa', '701', `@${join(PASTA, 'mudancas.json')}`])
})

await caso('editar-fluxo: 412 no gravar relê, reaplica a mesma lista e pede para conferir, sem gravar', async () => {
  const puts = chamadas.puts.length
  falhas.putMudaNoMeio = true
  const r = await roda('fluxo/editar.mjs', ['gravar', '701'])
  confere(r.codigo === 5 && /412/.test(r.saida) && /NADA foi gravado/.test(r.saida) && /reapliquei/.test(r.saida), r.saida)
  confere(chamadas.puts.length === puts, 'não gravou')
  const t = JSON.parse(le('cubo/trabalho/fluxo-701.json'))
  confere(t.novo.flowData.nodes.some((n) => n.id === 'de-outra-pessoa') && t.novo.flowData.nodes.some((n) => n.data?.label === 'Marca quente'), 'a prévia nova tem a mudança da outra pessoa e a nossa')
})

await caso('editar-fluxo: grava com If-Match, publica, e desfazer volta rascunho e publicado ao da cópia', async () => {
  const a = banco.automations.find((x) => x.id === 701)
  const publicadoAntes = JSON.stringify(a.published)
  const r = await roda('fluxo/editar.mjs', ['gravar', '701'])
  confere(r.codigo === 0 && /O que está no ar NÃO mudou/.test(r.saida), r.saida)
  confere(chamadas.puts.at(-1).ifMatch && JSON.stringify(a.published) === publicadoAntes, 'If-Match mandado e publicado intacto')
  const p = await roda('fluxo/editar.mjs', ['publicar', '701'])
  confere(p.codigo === 0 && /LIGADO: já vale/.test(p.saida) && a.published.nodes.some((n) => n.data?.label === 'Marca quente'), p.saida)
  const d = await roda('fluxo/editar.mjs', ['desligar', '701'])
  confere(d.codigo === 0 && a.status === 'inactive', d.saida)
  const copia = JSON.parse(readFileSync(JSON.parse(le('cubo/trabalho/fluxo-701.json')).copia, 'utf8'))
  const semItem = await roda('fluxo/editar.mjs', ['desfazer', '701'])
  confere(semItem.codigo === 1 && /não aceita gravar a cópia de volta/.test(semItem.saida) && !/at api/.test(semItem.saida), semItem.saida)
  banco.stages.push({ id: 999, name: 'Recriada', pipeId: 30 })
  const u = await roda('fluxo/editar.mjs', ['desfazer', '701'])
  confere(u.codigo === 0 && /publicada de volta/.test(u.saida) && /rascunho de volta/.test(u.saida) && /ligado de novo/.test(u.saida), u.saida)
  confere(JSON.stringify(a.published.nodes) === JSON.stringify(copia.publicado.flowData.nodes) && JSON.stringify(a.draft.nodes) === JSON.stringify(copia.rascunho.flowData.nodes) && a.status === 'active', 'publicado, rascunho e status iguais aos da cópia')
})

await caso('editar-fluxo: publicar com erro lista as mensagens do Cubo', async () => {
  await roda('fluxo/editar.mjs', ['ler', '702'])
  escreve('m702.json', [{ op: 'por', tipo: 'send_message', titulo: 'Oi', dados: { message: 'oi' } }])
  const p = await roda('fluxo/editar.mjs', ['previa', '702', `@${join(PASTA, 'm702.json')}`])
  confere(p.codigo === 0 && /NÃO para PUBLICAR/.test(p.saida), p.saida)
  confere((await roda('fluxo/editar.mjs', ['gravar', '702'])).codigo === 0, 'gravou')
  const r = await roda('fluxo/editar.mjs', ['publicar', '702'])
  confere(r.codigo === 1 && /não publicou/.test(r.saida) && /gatilho/.test(r.saida), r.saida)
})

await caso('criar-fluxo: do zero, com gatilho e posições; nasce rascunho desligado; gravar de novo não duplica', async () => {
  escreve('novo.json', [
    { op: 'gatilho', acao: 'por', tipo: 'deal_created', config: { pipeIds: [30] } },
    { op: 'por', id: 'oi', tipo: 'send_message', titulo: 'Oi', dados: { message: 'Bem-vindo!' } },
    { op: 'por', id: 'mover', tipo: 'move_stage', titulo: 'Para proposta', dados: { pipeId: 30, stageId: 27 } },
    { op: 'ligar', de: 'start', para: 'oi' },
    { op: 'ligar', de: 'oi', para: 'mover' },
  ])
  const p = await roda('fluxo/criar.mjs', ['previa', `@${join(PASTA, 'novo.json')}`, '--nome=Entrada de lead'])
  confere(p.codigo === 0 && /pronto para criar/.test(p.saida) && /Proposta \(funil Vendas\) \(#27\)/.test(p.saida) && /Negociação criada/.test(p.saida), p.saida)
  const antes = banco.automations.length
  const g = await roda('fluxo/criar.mjs', ['gravar'])
  confere(g.codigo === 0 && /RASCUNHO e DESLIGADO/.test(g.saida) && banco.automations.length === antes + 1, g.saida)
  const criado = banco.automations.at(-1)
  confere(criado.status === 'draft' && criado.draft.nodes.every((n) => n.position) && criado.draft.nodes.find((n) => n.id === 'mover').position.y > criado.draft.nodes.find((n) => n.id === 'oi').position.y, JSON.stringify(criado.draft.nodes))
  const de = await roda('fluxo/criar.mjs', ['gravar'])
  confere(de.codigo === 0 && /já foi criado/.test(de.saida) && banco.automations.length === antes + 1, de.saida)
  const outra = await roda('fluxo/criar.mjs', ['previa', `@${join(PASTA, 'novo.json')}`, '--nome=X'])
  confere(outra.codigo === 2 && /--outro/.test(outra.saida), outra.saida)
})

servidor.close()
console.log(`fumaça fluxo-agente em ${process.platform} (Node ${process.versions.node})`)
console.log(resultados.join('\n'))
