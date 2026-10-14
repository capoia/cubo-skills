// Catálogo do que se migra. É o ÚNICO lugar com rota, escopo, ordem e regra de cada área: quando o
// CRM mudar uma rota, muda aqui. A ordem do array é a ordem de criação na conta nova (quem não
// depende de nada primeiro). Cada área tem um `kind`, o mesmo nome que o CRM usa nos `refs`.

const nome = (registro) => String(registro.name ?? '').trim().toLowerCase()
const motivo = (registro) => String(registro.reason ?? '').trim().toLowerCase()

// O SDK do formulário na página (`<script src=".../sdk/form.js">`): o Cubo só aceita o SDK do
// endereço da própria conta, então o endereço da conta antiga vira o da nova.
const SDK = /https?:\/\/[^\s"'<>()]+?\/sdk\/form\.js/g
const CAMPOS_DA_PAGINA = ['html', 'head', 'codeHead', 'codeBody']

export const AREAS = [
  { kind: 'tag', rotulo: 'Tags', rota: '/api/tags', escopo: 'tags' },
  { kind: 'category', rotulo: 'Categorias', rota: '/api/categories', escopo: 'categories', nomeUnico: true },
  { kind: 'lost_reason', rotulo: 'Motivos de perda', rota: '/api/lostreasons', escopo: 'lostReasons', escopoTambem: 'pipes', nome: motivo, campoNome: 'reason', nomeUnico: true },
  { kind: 'resolution_reason', rotulo: 'Motivos de resolução', rota: '/api/resolution-reasons', escopo: 'resolutionReasons', nome: motivo, campoNome: 'reason', nomeUnico: true },
  { kind: 'transfer_reason', rotulo: 'Motivos de transferência', rota: '/api/transfer-reasons', escopo: 'transferReasons', nome: motivo, campoNome: 'reason', nomeUnico: true },
  { kind: 'pause_reason', rotulo: 'Motivos de pausa', rota: '/api/pause-reasons', escopo: 'pauseReasons', nome: motivo, campoNome: 'reason', nomeUnico: true },
  { kind: 'department', rotulo: 'Departamentos', rota: '/api/departments', escopo: 'departments' },
  {
    kind: 'customfield', rotulo: 'Campos personalizados', rota: '/api/customfields', escopo: 'customfields', nome: (r) => `${r.context}|${nome(r)}`,
    // A leitura dá `options: [{ value }]`; a criação recebe a lista de textos.
    preparar: (corpo) => (Array.isArray(corpo.options) ? { ...corpo, options: corpo.options.map((opcao) => (opcao && typeof opcao === 'object' ? opcao.value : opcao)) } : corpo),
  },
  { kind: 'product', rotulo: 'Produtos', rota: '/api/products', escopo: 'products', nomeUnico: true, proposito: 'product' },
  // `users` traz só os ativos e não gera ref; quem vale é `members`, inclusive os desativados.
  // Nasce sem etapas: elas vêm na área seguinte e a ordem se acerta no fim (`stages-order`).
  { kind: 'pipe', rotulo: 'Funis', rota: '/api/pipes', escopo: 'pipes', remover: ['stages', 'users'], proposito: 'proposal' },
  { kind: 'stage', rotulo: 'Estágios', rota: '/api/stages', escopo: 'stages', escopoTambem: 'pipes', nomeUnico: true, nome: (r) => `${r.pipeId}|${nome(r)}` },
  {
    kind: 'oauth_credential', rotulo: 'Credenciais OAuth', rota: '/api/oauth-credentials', escopo: 'oauthCredentials',
    // Pela chave nasce `disconnected`, sem o segredo: a pessoa digita e conecta na tela.
    remover: ['status', 'lastError', 'lastRefreshAt', 'tokenExpiresAt', 'hasClientSecret', 'hasRefreshToken'],
    pendencia: (r) => `Credencial OAuth “${r.name}”: digitar o client secret e, se pedir login, clicar em Conectar (Configurações → Credenciais OAuth).`,
  },
  {
    kind: 'integration', rotulo: 'Integrações', rota: '/api/integrations', escopo: 'integrations',
    // Nasce desligada, como casca: o segredo não sai da conta antiga.
    remover: ['status'],
    pendencia: (r) => {
      const cabecalhos = r.config?.webhook?.headerNames?.length ? ` Preencher também os cabeçalhos do webhook (${r.config.webhook.headerNames.join(', ')}).` : ''
      return `Integração “${r.name}” (${r.type}): reconectar e ligar na conta nova (Configurações → Integrações). As chaves e logins não são copiados.${cabecalhos}`
    },
  },
  // MCP não se cria por API (nasce de login no navegador): só casa pelo nome com o que já existe.
  { kind: 'mcp_connection', rotulo: 'Conexões MCP', rota: '/api/mcp-connections', escopo: 'mcpConnections', somenteCasar: true, acoes: ['read'] },
  {
    kind: 'template', rotulo: 'Templates', rota: '/api/templates', escopo: 'templates',
    remover: ['integrations', 'metaStatus'], proposito: 'template',
    pendencia: (r) => (r.type === 'whatsapp' ? `Template “${r.name}”: depois de conectar o WhatsApp, sincronizar com a Meta (Templates → sincronizar).` : null),
  },
  { kind: 'activity_trail', rotulo: 'Trilhas de atividade', rota: '/api/activity-trails', escopo: 'activityTrails' },
  { kind: 'knowledge_base_folder', rotulo: 'Pastas da base de conhecimento', rota: '/api/knowledge-base-folders', escopo: 'knowledgeBases', nome: (r) => `${r.parentId ?? ''}|${nome(r)}`, nomeUnico: true },
  {
    kind: 'knowledge_base', rotulo: 'Bases de conhecimento', rota: '/api/knowledge-bases', escopo: 'knowledgeBases',
    remover: ['indexStatus', 'indexedChunksCount', 'lastIndexedAt', 'tokenEstimate'], textoGrande: ['content'],
    detalhe: true, // o `content` só vem no detalhe
    nome: (r) => `${r.folderId ?? ''}|${nome(r)}`, nomeUnico: true,
    // A conta antiga guarda até 500 mil caracteres; a criação recusa acima de ~200 mil.
    limites: { content: 200_000 },
  },
  {
    kind: 'custom_intent', rotulo: 'Intents de agente', rota: '/api/intents', escopo: 'intents',
    remover: ['promptChip', 'headerNames', 'hasSecrets', 'usesOauthCredential'], nascer: { enabled: false },
    pendencia: (r) => (r.hasSecrets || r.headerNames?.length ? `Intent “${r.name}”: preencher os segredos e cabeçalhos${r.headerNames?.length ? ` (${r.headerNames.join(', ')})` : ''} e ligar (Agentes → Intents).` : `Intent “${r.name}”: revisar e ligar (Agentes → Intents).`),
  },
  { kind: 'agent_folder', rotulo: 'Pastas de agentes', rota: '/api/agent-folders', escopo: 'agents', nome: (r) => `${r.parentId ?? ''}|${nome(r)}`, nomeUnico: true },
  { kind: 'agent', rotulo: 'Agentes de IA', rota: '/api/agents', escopo: 'agents', textoGrande: ['systemPrompt'], nomeUnico: true },
  {
    kind: 'domain', rotulo: 'Domínios', rota: '/api/domains', escopo: 'domains',
    nome: (r) => String(r.domain ?? '').trim().toLowerCase(),
    so: ['domain'], acoes: ['read', 'create'], // domínio não tem edição
  },
  { kind: 'form', rotulo: 'Formulários', rota: '/api/forms', escopo: 'forms', remover: ['publicId'], proposito: 'landing' },
  {
    kind: 'landing', rotulo: 'Landing pages', rota: '/api/landings', escopo: 'landings',
    nome: (r) => `${r.domainId}|${String(r.url ?? '').replace(/^\/+/, '') || '/'}`,
    remover: ['publicUrl', 'domain'], nascer: { status: 'deactivated' }, textoGrande: ['html'],
    detalhe: true, // a listagem não traz o construtor e recusa `include=refs`
    proposito: 'landing',
    preparar: (corpo, { destino }) => {
      const pronto = { ...corpo }
      for (const campo of CAMPOS_DA_PAGINA) if (typeof pronto[campo] === 'string' && destino) pronto[campo] = pronto[campo].replace(SDK, `${destino}/sdk/form.js`)
      return pronto
    },
    pendencia: (r) => `Landing “${r.title}”: revisar e ativar (Landing pages → ${r.title} → ativar).`,
  },
  { kind: 'automation_folder', rotulo: 'Pastas de automações', rota: '/api/automation-folders', escopo: 'automations', nome: (r) => `${r.parentId ?? ''}|${nome(r)}`, nomeUnico: true },
  {
    kind: 'automation', rotulo: 'Automações', rota: '/api/automations', escopo: 'automations',
    // Nasce rascunho e desligada; se estava publicada na conta antiga, a skill publica no fim (a
    // versão publicada não liga nada sozinha) e a pessoa só liga.
    remover: ['publishedVersion', 'hasUnpublishedChanges', 'status'], proposito: 'automation',
    detalhe: true, // a listagem é leve (sem `flowData`) e recusa `include=refs`
    pendencia: (r) => {
      const partes = []
      // O nó HTTP sai sem o valor dos cabeçalhos (`headerNames`): a pessoa digita de novo.
      const http = (r.flowData?.nodes || []).filter((no) => no?.data?.headerNames?.length)
      for (const no of http) partes.push(`preencher os cabeçalhos do nó HTTP “${no.data.label || no.id}” (${no.data.headerNames.join(', ')})`)
      if (r.status === 'active') partes.push('estava ligada na conta antiga: revisar e ligar')
      return partes.length ? `Automação “${r.name}”: ${partes.join('; ')}.` : null
    },
  },
  {
    kind: 'channel', rotulo: 'Canais', rota: '/api/channels', escopo: 'channels',
    remover: ['connectionState', 'connectedPhone', 'connectionError', 'connectionChangedAt', 'lastEventAt', 'suspendedAt', 'status'],
    aguardaConexao: true, // a integração do canal precisa estar conectada na conta nova
    pendencia: (r) => `Canal “${r.name}”: nasce desligado na conta nova. Conferir e ligar (Canais → ${r.name}).`,
  },
  // Por último: o `link` precisa já ter os IDs da conta nova.
  { kind: 'filter', rotulo: 'Filtros', rota: '/api/filters', escopo: 'filters', nome: (r) => `${r.userId}|${r.context}|${nome(r)}`, nomeUnico: true },
]

for (const area of AREAS) {
  area.nome ||= nome
  area.campoNome ||= 'name'
  area.acoes ||= ['read', 'create', 'update']
  area.proposito ||= 'automation' // a pasta que aceita mais tipos de arquivo
}

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
  { chave: 'funis', rotulo: 'Funis', areas: ['pipe', 'stage'] }, // funil nasce sem etapas: elas vêm junto
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
export function corpoParaCriar(area, registro, contexto = {}) {
  const corpo = {}
  for (const [campo, valor] of Object.entries(registro)) {
    if (CAMPOS_DE_SISTEMA.includes(campo) || /Count$/.test(campo)) continue
    if (area.remover?.includes(campo)) continue
    if (area.so && !area.so.includes(campo)) continue
    corpo[campo] = valor
  }
  const pronto = area.preparar ? area.preparar(corpo, contexto) : corpo
  return { ...pronto, ...(area.nascer || {}) }
}

// Como chamar um item para a pessoa: cada área usa um campo diferente para o nome.
export const rotuloDe = (registro) => String(registro.name ?? registro.title ?? registro.reason ?? registro.domain ?? `nº ${registro.id}`)
