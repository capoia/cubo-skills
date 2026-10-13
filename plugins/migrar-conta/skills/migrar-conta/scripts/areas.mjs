// Catálogo do que se migra. É o ÚNICO lugar com rota, escopo, ordem e regra de cada área: quando o
// CRM mudar uma rota, muda aqui. A ordem do array é a ordem de criação na conta nova (quem não
// depende de nada primeiro). Cada área tem um `kind`, o mesmo nome que o CRM usa nos `refs`.

const nome = (registro) => String(registro.name ?? '').trim().toLowerCase()

export const AREAS = [
  { kind: 'tag', rotulo: 'Tags', rota: '/api/tags', escopo: 'tags' },
  { kind: 'category', rotulo: 'Categorias', rota: '/api/categories', escopo: 'categories' },
  { kind: 'lost_reason', rotulo: 'Motivos de perda', rota: '/api/lostreasons', escopo: 'lostReasons', nome: (r) => String(r.reason ?? '').trim().toLowerCase() },
  { kind: 'resolution_reason', rotulo: 'Motivos de resolução', rota: '/api/resolution-reasons', escopo: 'resolutionReasons', nome: (r) => String(r.reason ?? '').trim().toLowerCase() },
  { kind: 'transfer_reason', rotulo: 'Motivos de transferência', rota: '/api/transfer-reasons', escopo: 'transferReasons', nome: (r) => String(r.reason ?? '').trim().toLowerCase() },
  { kind: 'pause_reason', rotulo: 'Motivos de pausa', rota: '/api/pause-reasons', escopo: 'pauseReasons', nome: (r) => String(r.reason ?? '').trim().toLowerCase() },
  { kind: 'department', rotulo: 'Departamentos', rota: '/api/departments', escopo: 'departments' },
  { kind: 'customfield', rotulo: 'Campos personalizados', rota: '/api/customfields', escopo: 'customfields', nome: (r) => `${r.context}|${nome(r)}` },
  { kind: 'product', rotulo: 'Produtos', rota: '/api/products', escopo: 'products' },
  { kind: 'pipe', rotulo: 'Funis', rota: '/api/pipes', escopo: 'pipes', remover: ['stages'] },
  { kind: 'stage', rotulo: 'Estágios', rota: '/api/stages', escopo: 'stages', nome: (r) => `${r.pipeId}|${nome(r)}` },
  {
    kind: 'oauth_credential', rotulo: 'Credenciais OAuth', rota: '/api/oauth-credentials', escopo: 'oauthCredentials',
    remover: ['status', 'lastError', 'lastRefreshAt', 'tokenExpiresAt', 'hasClientSecret'],
    pendencia: (r) => `Credencial OAuth “${r.name}”: digitar o client secret e, se pedir login, clicar em Conectar (Configurações → Credenciais OAuth).`,
  },
  {
    kind: 'integration', rotulo: 'Integrações', rota: '/api/integrations', escopo: 'integrations',
    remover: ['status'],
    pendencia: (r) => `Integração “${r.name}” (${r.type}): reconectar na conta nova (Configurações → Integrações). As chaves e logins não são copiados.`,
  },
  // MCP não se cria por API (nasce de login no navegador): só casa pelo nome com o que já existe.
  { kind: 'mcp_connection', rotulo: 'Conexões MCP', rota: '/api/mcp-connections', escopo: 'mcpConnections', somenteCasar: true },
  {
    kind: 'template', rotulo: 'Templates', rota: '/api/templates', escopo: 'templates',
    remover: ['integrations', 'metaStatus'],
    pendencia: (r) => (r.type === 'whatsapp' ? `Template “${r.name}”: depois de conectar o WhatsApp, sincronizar com a Meta (Templates → sincronizar).` : null),
  },
  { kind: 'activity_trail', rotulo: 'Trilhas de atividade', rota: '/api/activity-trails', escopo: 'activityTrails' },
  { kind: 'knowledge_base_folder', rotulo: 'Pastas da base de conhecimento', rota: '/api/knowledge-base-folders', escopo: 'knowledgeBases', nome: (r) => `${r.parentId ?? ''}|${nome(r)}` },
  {
    kind: 'knowledge_base', rotulo: 'Bases de conhecimento', rota: '/api/knowledge-bases', escopo: 'knowledgeBases',
    remover: ['indexStatus', 'indexedChunksCount', 'lastIndexedAt', 'tokenEstimate'], textoGrande: ['content'],
  },
  {
    kind: 'custom_intent', rotulo: 'Intents de agente', rota: '/api/intents', escopo: 'intents',
    remover: ['promptChip', 'headerNames', 'hasSecrets', 'usesOauthCredential'], nascer: { enabled: false },
    pendencia: (r) => (r.hasSecrets || r.headerNames?.length ? `Intent “${r.name}”: preencher os segredos e cabeçalhos e ligar (Agentes → Intents).` : `Intent “${r.name}”: revisar e ligar.`),
  },
  { kind: 'agent_folder', rotulo: 'Pastas de agentes', rota: '/api/agent-folders', escopo: 'agents', nome: (r) => `${r.parentId ?? ''}|${nome(r)}` },
  { kind: 'agent', rotulo: 'Agentes de IA', rota: '/api/agents', escopo: 'agents', textoGrande: ['systemPrompt'] },
  {
    kind: 'domain', rotulo: 'Domínios', rota: '/api/domains', escopo: 'domains',
    nome: (r) => String(r.domain ?? '').trim().toLowerCase(),
    so: ['domain'],
  },
  { kind: 'form', rotulo: 'Formulários', rota: '/api/forms', escopo: 'forms', remover: ['publicId'] },
  {
    kind: 'landing', rotulo: 'Landing pages', rota: '/api/landings', escopo: 'landings',
    nome: (r) => `${r.domainId}|${String(r.url ?? '').replace(/^\/+/, '') || '/'}`,
    remover: ['publicUrl', 'domain'], nascer: { status: 'deactivated' }, textoGrande: ['html'],
    pendencia: (r) => `Landing “${r.title}”: revisar e ativar (Landing pages → ${r.title} → ativar).`,
  },
  { kind: 'automation_folder', rotulo: 'Pastas de automações', rota: '/api/automation-folders', escopo: 'automations', nome: (r) => `${r.parentId ?? ''}|${nome(r)}` },
  {
    kind: 'automation', rotulo: 'Automações', rota: '/api/automations', escopo: 'automations',
    nascer: { status: 'draft' },
    pendencia: (r) => (r.status === 'active' ? `Automação “${r.name}”: estava ligada na conta antiga. Revisar, publicar e ligar.` : null),
  },
  {
    kind: 'channel', rotulo: 'Canais', rota: '/api/channels', escopo: 'channels',
    remover: ['connectionState', 'connectedPhone', 'connectionError', 'connectionChangedAt', 'lastEventAt', 'suspendedAt'],
    aguardaConexao: true,
  },
  { kind: 'filter', rotulo: 'Filtros', rota: '/api/filters', escopo: 'filters', nome: (r) => `${r.userId}|${r.context}|${nome(r)}` },
]

for (const area of AREAS) area.nome ||= nome

export const AREA = Object.fromEntries(AREAS.map((area, indice) => [area.kind, { ...area, ordem: indice }]))
for (const area of AREAS) Object.assign(area, AREA[area.kind])

// Kinds que aparecem em refs mas não são áreas que se criam.
export const KIND_USUARIO = 'user'
export const KIND_ARQUIVO = 'file'
export const KIND_PUBLIC_ID = 'form_public_id'
export const KIND_CHAVE = 'apikey'
export const KINDS_DE_DADO = new Set(['deal', 'people', 'organization'])

// O que a pessoa escolhe (a lista dela, em pt-BR) e as áreas que cada escolha leva.
export const GRUPOS = [
  { chave: 'funis', rotulo: 'Funis', areas: ['pipe'] },
  { chave: 'estagios', rotulo: 'Estágios', areas: ['stage'] },
  { chave: 'filtros', rotulo: 'Filtros', areas: ['filter'] },
  { chave: 'categorias', rotulo: 'Categorias', areas: ['category'] },
  { chave: 'produtos', rotulo: 'Produtos', areas: ['product'] },
  { chave: 'landing-pages', rotulo: 'Landing pages', areas: ['landing'] },
  { chave: 'formularios', rotulo: 'Formulários', areas: ['form'] },
  { chave: 'templates', rotulo: 'Templates', areas: ['template'] },
  { chave: 'campos', rotulo: 'Campos personalizados', areas: ['customfield'] },
  { chave: 'departamentos', rotulo: 'Departamentos', areas: ['department'] },
  { chave: 'credenciais-oauth', rotulo: 'Credenciais OAuth', areas: ['oauth_credential'] },
  { chave: 'tags', rotulo: 'Tags', areas: ['tag'] },
  { chave: 'motivos', rotulo: 'Motivos (perda, resolução, transferência e pausa)', areas: ['lost_reason', 'resolution_reason', 'transfer_reason', 'pause_reason'] },
  { chave: 'canais', rotulo: 'Canais', areas: ['channel'] },
  { chave: 'trilhas', rotulo: 'Trilhas de atividade', areas: ['activity_trail'] },
  { chave: 'automacoes', rotulo: 'Automações', areas: ['automation_folder', 'automation'] },
  { chave: 'agentes', rotulo: 'Agentes de IA', areas: ['agent_folder', 'agent'] },
  { chave: 'base-de-conhecimento', rotulo: 'Base de conhecimento', areas: ['knowledge_base_folder', 'knowledge_base'] },
  { chave: 'mcps', rotulo: 'MCPs', areas: ['mcp_connection'] },
  { chave: 'integracoes', rotulo: 'Integrações', areas: ['integration'] },
]

export function areasDaEscolha(texto) {
  const chaves = String(texto || '').split(',').map((parte) => parte.trim()).filter(Boolean)
  if (chaves.includes('todos')) return AREAS.map((area) => area.kind)
  const kinds = new Set()
  for (const chave of chaves) {
    const grupo = GRUPOS.find((g) => g.chave === chave)
    if (!grupo) throw new Error(`não conheço "${chave}". Opções: todos, ${GRUPOS.map((g) => g.chave).join(', ')}`)
    grupo.areas.forEach((kind) => kinds.add(kind))
  }
  return AREAS.map((area) => area.kind).filter((kind) => kinds.has(kind))
}

const CAMPOS_DE_SISTEMA = ['id', 'companyId', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy', 'updatedBy', 'createdByUserId', 'refs']

// Corpo para criar na conta nova: o registro lido, sem campos de sistema, contadores e o que a área
// manda tirar, mais o estado de nascimento seguro (desligado).
export function corpoParaCriar(area, registro) {
  const corpo = {}
  for (const [campo, valor] of Object.entries(registro)) {
    if (CAMPOS_DE_SISTEMA.includes(campo) || /Count$/.test(campo)) continue
    if (area.remover?.includes(campo)) continue
    if (area.so && !area.so.includes(campo)) continue
    corpo[campo] = valor
  }
  return { ...corpo, ...(area.nascer || {}) }
}

// Como chamar um item para a pessoa: cada área usa um campo diferente para o nome.
export const rotuloDe = (registro) => String(registro.name ?? registro.title ?? registro.reason ?? registro.domain ?? `nº ${registro.id}`)
