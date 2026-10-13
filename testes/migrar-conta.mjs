#!/usr/bin/env node
// Fumaça da skill migrar-conta. Sobe um Cubo de mentira com duas contas, que segue o contrato do
// docs/migrar-conta/API-NECESSARIA.md (whoami, ?include=refs, recusa de ID de outra conta), e passa
// pela jornada inteira: acesso, plano, perguntas, aplicar (com queda no meio), 2ª passada,
// conferência e relatório. Roda no CI em Windows, macOS e Linux.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'migrar-conta', 'skills', 'migrar-conta', 'scripts')
const { AREAS } = await import(pathToFileURL(join(SCRIPTS, 'areas.mjs')).href)
const { aplicarRefs, trocarTrechos } = await import(pathToFileURL(join(SCRIPTS, 'refs.mjs')).href)

const PASTA = mkdtempSync(join(tmpdir(), 'cubo-migracao-'))
const resultados = []

function roda(script, args = []) {
  return new Promise((pronto) => {
    const filho = spawn(process.execPath, [join(SCRIPTS, script), ...args], { cwd: PASTA, env: { ...process.env, CUBO_MIGRACAO_PASTA: join(PASTA, 'migracao'), CUBO_MIGRACAO_NAO_ABRIR: '1' } })
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

// ---------------------------------------------------------------------------------------------
// Cubo de mentira.

const KIND_DA_ROTA = Object.fromEntries(AREAS.map((area) => [area.rota.replace('/api/', ''), area.kind]))
const PASTA_DO_KIND = { agent: 'agent_folder', automation: 'automation_folder', knowledge_base: 'knowledge_base_folder' }
const CHAVE_PARA_KIND = {
  pipeId: 'pipe', pipeIds: 'pipe', stageId: 'stage', stageIds: 'stage', customfieldId: 'customfield', customfieldIds: 'customfield',
  tagId: 'tag', tagIds: 'tag', agentId: 'agent', targetAgentId: 'agent', automationId: 'automation', flowIds: 'automation',
  knowledgeBaseId: 'knowledge_base', integrationId: 'integration', defaultAgentId: 'agent', defaultAutomationId: 'automation',
  userId: 'user', domainId: 'domain', connectionId: 'mcp_connection', primaryField: 'customfield',
}
const PARAMETRO_PARA_KIND = { pipeId: 'pipe', stageId: 'stage', knowledgeBaseId: 'knowledge_base', customfieldId: 'customfield', tagId: 'tag' }

// O extrator de refs do Cubo de mentira: o que o CRM de verdade vai fazer, só para os campos usados aqui.
function extrairRefs(kind, objeto) {
  const refs = []
  const anda = (valor, caminho, chave) => {
    if (Array.isArray(valor)) return valor.forEach((v, i) => anda(v, `${caminho}[${i}]`, chave))
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) {
        if (k === 'refs') continue
        const aqui = caminho ? `${caminho}.${k}` : k
        if (k === 'customfieldValues') {
          for (const cf of Object.keys(v)) refs.push({ path: `${aqui}.${cf}`, kind: 'customfield', id: Number(cf), token: cf })
          continue
        }
        anda(v, aqui, k)
      }
      return
    }
    const ehNumero = typeof valor === 'number' || (typeof valor === 'string' && /^\d+$/.test(valor))
    if (ehNumero) {
      let alvo = CHAVE_PARA_KIND[chave]
      if (chave === 'parentId') alvo = kind
      if (chave === 'folderId') alvo = PASTA_DO_KIND[kind]
      if (chave === 'id' && /^fields\[\d+\]\.id$/.test(caminho)) alvo = 'customfield'
      if (chave === 'id' && /^users\[\d+\]\.id$/.test(caminho)) alvo = 'user'
      if (alvo) refs.push({ path: caminho, kind: alvo, id: Number(valor) })
      return
    }
    if (typeof valor !== 'string') return
    for (const m of valor.matchAll(/\{\{cf\.deal\.(\d+)\}\}/g)) refs.push({ path: caminho, kind: 'customfield', id: Number(m[1]), token: m[0] })
    for (const m of valor.matchAll(/\{\{tool:([a-z_]+)\(([^)]*)\)\}\}/g)) {
      for (const p of m[2].matchAll(/(\w+)=(\d+)/g)) if (PARAMETRO_PARA_KIND[p[1]]) refs.push({ path: caminho, kind: PARAMETRO_PARA_KIND[p[1]], id: Number(p[2]), token: m[0] })
    }
    for (const m of valor.matchAll(/\{\{tool:mcp_(\d+)_[a-z_]+\}\}/g)) refs.push({ path: caminho, kind: 'mcp_connection', id: Number(m[1]), token: m[0] })
    if (chave !== 'publicId') for (const m of valor.matchAll(/frm_[a-z0-9]+/g)) refs.push({ path: caminho, kind: 'form_public_id', id: m[0], token: m[0] })
    for (const m of valor.matchAll(/https:\/\/cdn\.test\/companies\/\d+\/[\w./-]+/g)) {
      refs.push(m[0] === valor ? { path: caminho, kind: 'file', id: m[0] } : { path: caminho, kind: 'file', id: m[0], token: m[0] })
    }
    if (chave === 'link') {
      for (const m of valor.matchAll(/(pipe|stage|peoples)=(\d+)/g)) refs.push({ path: caminho, kind: { pipe: 'pipe', stage: 'stage', peoples: 'people' }[m[1]], id: Number(m[2]), token: m[0] })
    }
  }
  anda(objeto, '', null)
  return refs
}

let proximoId = 5000
const CONTAS = {
  sk_origem: { companyId: 1, nome: 'Clínica Antiga', admin: true, escopos: { '*': ['*'] } },
  sk_destino: { companyId: 2, nome: 'Clínica Nova', admin: true, escopos: { '*': ['*'] } },
  sk_comum: { companyId: 2, nome: 'Clínica Nova', admin: false, escopos: { '*': ['*'] } },
  sk_curta: { companyId: 2, nome: 'Clínica Nova', admin: true, escopos: { users: ['read'], pipes: ['read'] } },
}
const banco = { 1: {}, 2: {} }
const usuarios = {
  1: [{ id: 10, name: 'Ana', email: 'ana@clinica.com' }, { id: 11, name: 'Bia', email: 'bia@clinica.com' }],
  2: [{ id: 20, name: 'Ana', email: 'ANA@clinica.com' }, { id: 21, name: 'Dona', email: 'dona@nova.com' }],
}
const falhas = { agentUmaVez: false, cortarPrompt: false }

function semear(companyId, kind, registros) {
  banco[companyId][kind] = registros.map((r) => ({ ...r }))
}

semear(1, 'tag', [{ id: 101, name: 'VIP', color: '#ff0000' }, { id: 102, name: 'Frio', color: '#0000ff' }])
semear(1, 'customfield', [{ id: 201, name: 'Origem', context: 'deal', type: 'text' }, { id: 202, name: 'CPF', context: 'people', type: 'text' }])
semear(1, 'pipe', [{ id: 301, name: 'Vendas', primaryField: '201', users: [{ id: 10, splitter: 1 }, { id: 11, splitter: 1 }], stages: [] }])
semear(1, 'stage', [
  { id: 401, name: 'Novo', pipeId: 301, customfieldIds: [201] },
  { id: 402, name: 'Ganho', pipeId: 301, customfieldIds: [] },
])
semear(1, 'knowledge_base', [{ id: 501, name: 'FAQ', content: 'Perguntas frequentes', strategy: 'inline' }])
semear(1, 'mcp_connection', [{ id: 1201, name: 'Stripe', type: 'stripe' }])
semear(1, 'agent', [
  {
    id: 601,
    name: 'SDR',
    systemPrompt: `Você é o SDR. Mova com {{tool:move_deal_stage(pipeId=301,stageId=401)}} e responda com {{tool:answer_from_kb(knowledgeBaseId=501)}}. Cobre com {{tool:mcp_1201_list_invoices}}. Ligue 3010 vezes se preciso. Campo {{cf.deal.201}}. ${'Texto longo. '.repeat(4000)}`,
    followUpConfig: { exhaustedAction: { type: 'start_flow', automationId: 701 } },
    handoffTargets: [{ targetAgentId: 602, whenToUse: 'suporte' }],
  },
  { id: 602, name: 'Suporte', systemPrompt: 'Atende suporte.', followUpConfig: null, handoffTargets: [{ targetAgentId: 601, whenToUse: 'vendas' }] },
])
semear(1, 'automation', [
  {
    id: 701,
    name: 'Boas-vindas',
    status: 'active',
    flowData: {
      nodes: [
        { id: 'start', type: 'start', data: { triggers: [{ id: 'trigger-1', triggerType: 'deal_created', triggerConfig: { pipeIds: [301], tagIds: [101] } }] } },
        { id: 'move_stage-1', type: 'move_stage', data: { pipeId: 301, stageId: 402 } },
        { id: 'send_message-1', type: 'send_message', data: { message: 'Oi! Sua origem: {{cf.deal.201}}' } },
        { id: 'agent_call-1', type: 'agent_call', data: { agentId: 601 } },
        { id: 'start_flow-1', type: 'start_flow', data: { automationId: 702 } },
        { id: 'create_deal-1', type: 'create_deal', data: { customfieldValues: { 201: 'site' } } },
      ],
      edges: [{ id: 'e-start-move_stage-1', source: 'start', target: 'move_stage-1' }],
    },
  },
  { id: 702, name: 'Recontato', status: 'draft', flowData: { nodes: [{ id: 'start_flow-9', type: 'start_flow', data: { automationId: 701 } }], edges: [] } },
])
semear(1, 'form', [{ id: 801, name: 'Contato', publicId: 'frm_abc', settings: { destination: { pipeId: 301, stageId: 401 } }, fields: [{ id: 201, label: 'Origem' }, { id: 'name', label: 'Nome' }] }])
semear(1, 'domain', [{ id: 901, domain: 'lp.clinica.com', status: 'active' }])
semear(1, 'landing', [{ id: 951, title: 'Promo', url: 'promo', domainId: 901, status: 'active', html: '<img src="https://cdn.test/companies/1/landings/a.png"><div id="f"></div><script>new Form({ form: \'frm_abc\', target: \'#f\' })</script>' }])
semear(1, 'integration', [{ id: 1001, name: 'WhatsApp oficial', type: 'whatsapp_business' }])
semear(1, 'channel', [{ id: 1101, name: 'WhatsApp', integrationId: 1001, defaultAgentId: 601 }])
semear(1, 'filter', [{ id: 1301, name: 'Meus novos', context: 'deal', userId: 11, pipeId: 301, link: 'pipe=301&stage=401&peoples=5' }])
semear(2, 'tag', [{ id: 2101, name: 'vip', color: '#00ff00' }])
semear(2, 'mcp_connection', [{ id: 2201, name: 'Stripe', type: 'stripe' }])

const lista = (companyId, kind) => (banco[companyId][kind] ||= [])

function existe(companyId, kind, id) {
  if (kind === 'user') return usuarios[companyId].some((u) => String(u.id) === String(id))
  if (kind === 'form_public_id') return lista(companyId, 'form').some((f) => f.publicId === id)
  if (kind === 'file' || ['deal', 'people', 'organization'].includes(kind)) return true
  return lista(companyId, kind).some((r) => String(r.id) === String(id))
}

function responde(resposta, codigo, corpo) {
  resposta.writeHead(codigo, { 'Content-Type': 'application/json' })
  resposta.end(corpo === undefined ? '' : JSON.stringify(corpo))
}

const servidor = createServer((pedido, resposta) => {
  const partes = []
  pedido.on('data', (p) => partes.push(p))
  pedido.on('end', () => {
    const url = new URL(pedido.url, 'http://x')
    const conta = CONTAS[pedido.headers['x-api-key']]
    if (!conta) return responde(resposta, 401, { errors: [{ message: 'Invalid API key' }] })
    const { companyId } = conta
    const corpo = partes.length ? JSON.parse(Buffer.concat(partes).toString()) : undefined
    const comRefs = url.searchParams.get('include') === 'refs'
    const [, , recurso, id] = url.pathname.split('/')

    if (recurso === 'whoami') {
      return responde(resposta, 200, { data: { companyId, name: conta.nome, tenantId: 1, user: { id: companyId === 1 ? 10 : 21, name: companyId === 1 ? 'Ana' : 'Dona', email: 'x', isAdmin: conta.admin }, scopes: conta.escopos, modules: [] } })
    }
    if (recurso === 'users') return responde(resposta, 200, { data: usuarios[companyId], meta: { lastPage: 1 } })
    if (recurso === 'files' && id === 'import-url') {
      return responde(resposta, 200, { data: { url: corpo.url.replace(/companies\/\d+\//, `companies/${companyId}/importados/`) } })
    }

    const kind = KIND_DA_ROTA[recurso]
    if (!kind) return responde(resposta, 404, { errors: [{ message: 'Route not found' }] })
    const comoSai = (registro) => (comRefs ? { ...registro, refs: extrairRefs(kind, registro) } : registro)

    if (pedido.method === 'GET' && !id) {
      const todos = lista(companyId, kind)
      if (kind === 'tag') return responde(resposta, 200, todos.map(comoSai)) // como o Cubo de verdade: tags sem paginação
      const porPagina = Number(url.searchParams.get('perPage') || 10)
      const pagina = Number(url.searchParams.get('page') || 1)
      const fatia = todos.slice((pagina - 1) * porPagina, pagina * porPagina)
      return responde(resposta, 200, { data: fatia.map(comoSai), meta: { lastPage: Math.max(1, Math.ceil(todos.length / porPagina)), currentPage: pagina } })
    }
    if (pedido.method === 'GET' && id) {
      const registro = lista(companyId, kind).find((r) => String(r.id) === id)
      return registro ? responde(resposta, 200, comoSai(registro)) : responde(resposta, 404, { errors: [{ message: 'not found' }] })
    }

    if (pedido.method === 'POST' || pedido.method === 'PUT') {
      if (kind === 'agent' && pedido.method === 'POST' && falhas.agentUmaVez) {
        falhas.agentUmaVez = false
        return responde(resposta, 500, { errors: [{ message: 'Erro interno' }] })
      }
      if (kind === 'channel') return responde(resposta, 422, { errors: [{ message: 'A integração do canal não está conectada' }] })
      if (kind === 'domain' && Object.values(banco).some((b) => (b.domain || []).some((d) => d.domain === corpo.domain))) {
        return responde(resposta, 422, { errors: [{ message: 'Este domínio já está em uso.' }] })
      }
      // Como o CRM de verdade: recusa ID que não é desta conta.
      for (const ref of extrairRefs(kind, corpo)) {
        if (ref.id === null || ref.id === undefined) continue
        if (!existe(companyId, ref.kind, ref.id)) return responde(resposta, 422, { errors: [{ message: `${ref.kind} ${ref.id} não pertence a esta conta (${ref.path})` }] })
      }
      if (pedido.method === 'POST') {
        const novo = { ...corpo, id: proximoId++ }
        if (kind === 'form') novo.publicId = `frm_n${novo.id}`
        if (kind === 'agent' && falhas.cortarPrompt && novo.systemPrompt) novo.systemPrompt = novo.systemPrompt.slice(0, 40000)
        lista(companyId, kind).push(novo)
        return responde(resposta, 201, { data: novo })
      }
      const registro = lista(companyId, kind).find((r) => String(r.id) === id)
      if (!registro) return responde(resposta, 404, { errors: [{ message: 'not found' }] })
      Object.assign(registro, corpo)
      return responde(resposta, 200, { data: registro })
    }
    responde(resposta, 405, { errors: [{ message: 'Method not allowed' }] })
  })
})
await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto))
const BASE = `http://127.0.0.1:${servidor.address().port}`

const escreveAcesso = (conta, chave, base = BASE) => {
  writeFileSync(join(PASTA, 'migracao', `${conta}.env`), `# comentário\nCUBO_BASE_URL=${base}\nCUBO_API_KEY=${chave}\n`)
}
const ledger = () => JSON.parse(readFileSync(join(PASTA, 'migracao', 'ledger.json'), 'utf8'))
const doDestino = (kind) => lista(2, kind)

// ---------------------------------------------------------------------------------------------
// Troca de IDs (função pura).

await caso('refs: troca dentro do texto respeita a borda (301 não mexe em 3010) e troca vários IDs no mesmo trecho', async () => {
  const registro = { texto: 'A {{tool:move_deal_stage(pipeId=301,stageId=401)}} B 3010 C {{cf.deal.301}}' }
  const refs = [
    { path: 'texto', kind: 'pipe', id: 301, token: '{{tool:move_deal_stage(pipeId=301,stageId=401)}}' },
    { path: 'texto', kind: 'stage', id: 401, token: '{{tool:move_deal_stage(pipeId=301,stageId=401)}}' },
    { path: 'texto', kind: 'customfield', id: 301, token: '{{cf.deal.301}}' },
  ]
  const mapa = { pipe: { 301: 9 }, stage: { 401: 12 }, customfield: { 301: 77 } }
  const { registro: novo, trocas } = aplicarRefs(registro, refs, (ref) => ({ novo: mapa[ref.kind][ref.id] }))
  confere(novo.texto === 'A {{tool:move_deal_stage(pipeId=9,stageId=12)}} B 3010 C {{cf.deal.77}}', `texto ficou: ${novo.texto}`)
  confere(trocas === 3, `trocas: ${trocas}`)
  confere(registro.texto.includes('301,'), 'o original não pode ser alterado')
})

await caso('refs: troca em cadeia não acontece (12→120 e 120→7 numa passada só)', async () => {
  confere(trocarTrechos('id 12 e 120', { 12: '120', 120: '7' }) === 'id 120 e 7', 'a troca encadeou')
})

await caso('refs: renomeia chave de objeto, zera o adiado e tira o dado', async () => {
  const registro = { valores: { 201: 'x' }, alvo: 702, quem: 5, link: 'pipe=301&peoples=5' }
  const refs = [
    { path: 'valores.201', kind: 'customfield', id: 201, token: '201' },
    { path: 'alvo', kind: 'automation', id: 702 },
    { path: 'quem', kind: 'people', id: 5 },
    { path: 'link', kind: 'people', id: 5, token: 'peoples=5' },
  ]
  const r = aplicarRefs(registro, refs, (ref) => (ref.kind === 'customfield' ? { novo: 999 } : ref.kind === 'automation' ? { adiar: true } : { remover: true }))
  confere(r.registro.valores[999] === 'x' && !('201' in r.registro.valores), `valores: ${JSON.stringify(r.registro.valores)}`)
  confere(r.registro.alvo === null && r.adiados.length === 1, 'o adiado tinha que virar null')
  confere(r.registro.quem === null && r.registro.link === 'pipe=301&', `link: ${r.registro.link}`)
})

// ---------------------------------------------------------------------------------------------
// Acesso.

await caso('conta: sem arquivo de acesso, não deixa seguir e ensina a abrir', async () => {
  const { codigo, saida } = await roda('conta.mjs', ['conferir'])
  confere(codigo === 1 && /FALTA ACERTAR/.test(saida) && /conta\.mjs" abrir origem/.test(saida), saida)
})

await caso('conta: abrir cria o arquivo modelo com as instruções', async () => {
  const { saida } = await roda('conta.mjs', ['abrir', 'origem'])
  confere(/Abra este arquivo/.test(saida), 'no teste o editor não pode abrir')
  const texto = readFileSync(join(PASTA, 'migracao', 'origem.env'), 'utf8')
  confere(/CUBO_BASE_URL=\n/.test(texto) && /Configurações → Chaves de API/.test(texto), texto)
  confere(/origem\.env/.test(saida), saida)
})

await caso('conta: chave de usuário comum e chave sem permissão são barradas, com o que fazer', async () => {
  escreveAcesso('origem', 'sk_origem')
  escreveAcesso('destino', 'sk_comum')
  let r = await roda('conta.mjs', ['conferir', '--areas=todos'])
  confere(r.codigo === 1 && /não é administrador/.test(r.saida), r.saida)
  escreveAcesso('destino', 'sk_curta')
  r = await roda('conta.mjs', ['conferir', '--areas=automacoes'])
  confere(r.codigo === 1 && /faltam permissões na chave: .*automations:read/.test(r.saida) && /Chaves de API → editar/.test(r.saida), r.saida)
})

await caso('conta: a mesma conta dos dois lados é recusada', async () => {
  escreveAcesso('destino', 'sk_origem')
  const r = await roda('conta.mjs', ['conferir'])
  confere(r.codigo === 1 && /mesma chave/.test(r.saida), r.saida)
})

await caso('conta: com tudo certo, libera e grava as duas contas no ledger', async () => {
  escreveAcesso('destino', 'sk_destino')
  const r = await roda('conta.mjs', ['conferir', '--areas=todos'])
  confere(r.codigo === 0 && /TUDO CERTO/.test(r.saida), r.saida)
  const l = ledger()
  confere(l.origem.companyId === 1 && l.destino.companyId === 2 && l.etapas.acesso.status === 'feito', JSON.stringify(l.etapas.acesso))
  confere(existsSync(join(PASTA, 'migracao', 'LEDGER.md')), 'faltou o LEDGER.md')
})

// ---------------------------------------------------------------------------------------------
// Plano, perguntas e aplicação.

await caso('plano: puxa as dependências, casa usuário por e-mail e MCP por nome, e pergunta o resto', async () => {
  const r = await roda('plano.mjs', ['--areas=automacoes,agentes,canais,filtros,landing-pages'])
  confere(r.codigo === 0, r.saida)
  const l = ledger()
  const kinds = new Set(Object.values(l.itens).map((i) => i.kind))
  for (const kind of ['pipe', 'stage', 'tag', 'customfield', 'knowledge_base', 'form', 'domain', 'integration']) confere(kinds.has(kind), `faltou a dependência ${kind}`)
  confere(l.itens['tag:101'].motivo === 'dependencia' && !l.itens['tag:102'], 'só a tag usada entra')
  confere(l.decisoes.usuarios['10'] === 20, 'Ana tinha que casar pelo e-mail, sem diferenciar maiúscula')
  confere(l.decisoes.mcp['1201'] === 2201, 'o MCP Stripe tinha que casar pelo nome')
  const ids = l.perguntas.map((p) => p.id).sort()
  confere(JSON.stringify(ids) === JSON.stringify(['dominio:901', 'existente:tag:101', 'usuario:11']), `perguntas: ${ids}`)
  confere(/PLANO \(nada foi alterado ainda\)/.test(r.saida) && /Automações: 2 itens/.test(r.saida), r.saida)
  confere(Object.values(banco[2]).flat().length === 2, 'o plano não pode escrever na conta nova')
})

await caso('aplicar: não começa com pergunta em aberto', async () => {
  const r = await roda('aplicar.mjs')
  confere(r.codigo === 3 && /perguntas esperando resposta/.test(r.saida), r.saida)
})

await caso('decidir: grava as respostas e recusa usuário que não existe na conta nova', async () => {
  let r = await roda('decidir.mjs', ['usuario', '11', '999'])
  confere(r.codigo === 2 && /não existe na conta nova/.test(r.saida), r.saida)
  r = await roda('decidir.mjs', ['listar'])
  confere(/21=Dona/.test(r.saida), r.saida)
  for (const args of [['usuario', '11', 'dono'], ['existente', 'tag:101', 'usar'], ['dominio', '901', 'outro:lp.clinicanova.com']]) {
    r = await roda('decidir.mjs', args)
    confere(r.codigo === 0, r.saida)
  }
  confere(/Nada mais a decidir/.test(r.saida), r.saida)
})

await caso('aplicar: cai no meio (erro 500 num agente) e quem depende dele espera', async () => {
  falhas.agentUmaVez = true
  const r = await roda('aplicar.mjs')
  confere(r.codigo === 4, `código ${r.codigo}\n${r.saida}`)
  const l = ledger()
  const comErro = Object.values(l.itens).filter((i) => i.status === 'erro').map((i) => i.kind)
  confere(comErro.includes('agent'), `erros: ${comErro}`)
  confere(l.itens['tag:101'].status === 'usado' && l.mapa.tag['101'] === 2101, 'a tag VIP tinha que ser a que já existia')
})

await caso('aplicar: rodar de novo continua de onde parou, sem duplicar, e faz a 2ª passada', async () => {
  const antes = doDestino('pipe').length
  const r = await roda('aplicar.mjs')
  const l = ledger()
  confere(doDestino('pipe').length === antes, 'duplicou funil')
  confere(doDestino('agent').length === 2 && doDestino('automation').length === 2, `agentes ${doDestino('agent').length}, automações ${doDestino('automation').length}\n${r.saida}`)
  confere(l.itens['channel:1101'].status === 'aguardando', 'o canal sem integração conectada tem que aguardar')
  confere(l.pendencias.some((p) => /conecte a integração/.test(p.texto)), 'faltou a pendência do canal')
  confere(r.codigo === 4 && /aguardando/.test(r.saida), r.saida)

  const automacao = doDestino('automation').find((a) => a.name === 'Boas-vindas')
  const nos = Object.fromEntries(automacao.flowData.nodes.map((n) => [n.id, n.data]))
  const pipe = l.mapa.pipe['301']
  confere(automacao.status === 'draft', 'a automação tem que nascer desligada')
  confere(nos.start.triggers[0].triggerConfig.pipeIds[0] === pipe && nos.start.triggers[0].triggerConfig.tagIds[0] === 2101, JSON.stringify(nos.start))
  confere(nos['move_stage-1'].stageId === l.mapa.stage['402'], 'estágio do nó não trocado')
  confere(nos['send_message-1'].message === `Oi! Sua origem: {{cf.deal.${l.mapa.customfield['201']}}}`, nos['send_message-1'].message)
  confere(nos['agent_call-1'].agentId === l.mapa.agent['601'], 'agente do nó não trocado')
  confere(nos['start_flow-1'].automationId === l.mapa.automation['702'], '2ª passada não ligou a automação ciclica')
  confere(nos['create_deal-1'].customfieldValues[l.mapa.customfield['201']] === 'site', JSON.stringify(nos['create_deal-1']))

  const sdr = doDestino('agent').find((a) => a.name === 'SDR')
  confere(sdr.systemPrompt.includes(`{{tool:move_deal_stage(pipeId=${pipe},stageId=${l.mapa.stage['401']})}}`), 'chip do agente não trocado')
  confere(sdr.systemPrompt.includes('{{tool:mcp_2201_list_invoices}}') && sdr.systemPrompt.includes('Ligue 3010 vezes'), 'MCP não trocado ou número solto mexido')
  confere(sdr.followUpConfig.exhaustedAction.automationId === l.mapa.automation['701'], 'follow-up não ligado na 2ª passada')
  confere(sdr.handoffTargets[0].targetAgentId === l.mapa.agent['602'], 'handoff não ligado')

  const landing = doDestino('landing')[0]
  confere(landing.status === 'deactivated' && landing.html.includes(`frm_n${l.mapa.form['801']}`) && landing.html.includes('companies/2/importados/'), landing.html)
  const filtro = doDestino('filter')[0]
  confere(filtro.userId === 21 && filtro.link === `pipe=${pipe}&stage=${l.mapa.stage['401']}&`, JSON.stringify(filtro))
  confere(doDestino('domain')[0].domain === 'lp.clinicanova.com', 'domínio escolhido não usado')
})

await caso('conferir: relê tudo na conta nova e não acha ID da conta antiga', async () => {
  const r = await roda('conferir.mjs')
  confere(r.codigo === 0 && /Nenhum ID da conta antiga sobrou/.test(r.saida), r.saida)
})

await caso('conferir: acusa ID não trocado e texto cortado', async () => {
  const automacao = doDestino('automation').find((a) => a.name === 'Recontato')
  automacao.flowData.nodes[0].data.automationId = 701
  const sdr = doDestino('agent').find((a) => a.name === 'SDR')
  const prompt = sdr.systemPrompt
  sdr.systemPrompt = prompt.slice(0, 40000)
  const r = await roda('conferir.mjs')
  automacao.flowData.nodes[0].data.automationId = ledger().mapa.automation['701']
  sdr.systemPrompt = prompt
  confere(r.codigo === 1 && /número da CONTA ANTIGA/.test(r.saida) && /CORTADO: 40000 de/.test(r.saida), r.saida)
  await roda('conferir.mjs')
})

await caso('relatório e status: HTML com conferência e tarefas, e o próximo passo', async () => {
  const r = await roda('relatorio.mjs', ['--nao-abrir'])
  const html = readFileSync(join(PASTA, 'migracao', 'relatorio.html'), 'utf8')
  confere(r.codigo === 0 && /Nenhum número da conta antiga sobrou/.test(html) && /Reconectar|reconectar/.test(html) && /Boas-vindas/.test(html), r.saida)
  confere(!/<script src/.test(html) && !/https?:\/\/(?!cdn\.test)/.test(html.replace(/http:\/\/127\.0\.0\.1:\d+/g, '')), 'o relatório não pode depender de nada de fora')
  const s = await roda('status.mjs')
  confere(/Por área/.test(s.saida) && /Canais: 0\/1/.test(s.saida), s.saida)
})

servidor.close()
console.log(`fumaça migrar-conta em ${process.platform} (Node ${process.versions.node})`)
console.log(resultados.join('\n'))
