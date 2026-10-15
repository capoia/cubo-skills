#!/usr/bin/env node
// Os itens da conta que um fluxo ou agente usa (tag, funil, etapa, campo…): achar pelo nome e, o que
// faltar, criar pela API. O que a API não cria, a skill ensina a fazer na tela.
//
//   itens.mjs tipos                                   o que dá para criar e o que é na tela
//   itens.mjs buscar <tipo> [texto] [--funil=<id|nome>]
//   itens.mjs criar @itens.json [--so-plano] [--criar-mesmo=1,3]
//      itens.json: [{ "tipo": "etapa", "nome": "Proposta", "funil": "Vendas" }, { "tipo": "tag", "nome": "Lead quente" }]
//   itens.mjs listar-criados
//
// A tabela daqui é a única com rota e regra de cada item. Os campos exigidos são os do validador do
// cubo-crm (app/validators/*.ts) em 2026-10-15.
import { api, ErroApi, todos } from './api.mjs'
import { argumentos, ehPrincipal, falha, gravarJson, lerJson, lerJsonEntrada, normalizar, pasta } from './lib.mjs'
import { nomeDoItem } from './nomes.mjs'

const MOTIVO = (rota, rotulo) => ({ rota, rotulo, kind: null, campoNome: 'reason', unico: true, corpo: (i) => ({ reason: i.nome, ...i.campos }) })

export const ITENS = {
  tag: { rota: '/api/tags', rotulo: 'tag', kind: 'tag', corpo: (i) => ({ name: i.nome, color: i.campos?.color ?? '#6366F1', ...i.campos }) },
  funil: { rota: '/api/pipes', rotulo: 'funil', kind: 'pipe', admin: true, corpo: (i) => ({ name: i.nome, ...i.campos }) },
  etapa: { rota: '/api/stages', rotulo: 'etapa', kind: 'stage', admin: true, unico: true, precisaFunil: true, corpo: (i) => ({ name: i.nome, pipeId: i.funilId, ...i.campos }) },
  campo: {
    rota: '/api/customfields', rotulo: 'campo personalizado', kind: 'customfield', unico: true,
    corpo: (i) => ({ name: i.nome, context: i.campos?.context ?? 'deal', type: i.campos?.type ?? 'text', ...i.campos }),
    confere: (i) => ((i.campos?.type ?? 'text') === 'selectbox' && !(i.campos?.options || []).length ? 'campo do tipo lista (selectbox) precisa de "options".' : null),
    escopo: (i) => i.campos?.context ?? 'deal',
  },
  produto: { rota: '/api/products', rotulo: 'produto', kind: 'product', unico: true, corpo: (i) => ({ name: i.nome, ...i.campos }) },
  categoria: { rota: '/api/categories', rotulo: 'categoria', kind: 'category', unico: true, corpo: (i) => ({ name: i.nome, ...i.campos }) },
  departamento: { rota: '/api/departments', rotulo: 'departamento', kind: 'department', corpo: (i) => ({ name: i.nome, ...i.campos }) },
  'motivo-perda': { ...MOTIVO('/api/lostreasons', 'motivo de perda'), kind: 'lost_reason' },
  'motivo-resolucao': { ...MOTIVO('/api/resolution-reasons', 'motivo de resolução'), kind: 'resolution_reason' },
  'motivo-transferencia': { ...MOTIVO('/api/transfer-reasons', 'motivo de transferência'), kind: 'transfer_reason' },
  'motivo-pausa': { ...MOTIVO('/api/pause-reasons', 'motivo de pausa'), kind: 'pause_reason' },
  template: {
    rota: '/api/templates', rotulo: 'template', kind: 'template', unico: true,
    corpo: (i) => ({ name: i.nome, type: i.campos?.type ?? 'whatsapp', ...i.campos }),
    confere: (i) => {
      const tipo = i.campos?.type ?? 'whatsapp'
      if (!['whatsapp', 'email'].includes(tipo)) return 'template é "whatsapp" ou "email".'
      if (tipo === 'whatsapp' && !/^[a-z0-9_]+$/.test(i.nome)) return 'nome de template de WhatsApp só tem minúsculas, números e _ (regra da Meta).'
      if (tipo === 'whatsapp' && !i.campos?.components?.body?.text) return 'template de WhatsApp precisa de components: { header: { type: "none" }, body: { text } , footer: {} }.'
      if (tipo === 'email' && (!i.campos?.subject || !i.campos?.body)) return 'template de e-mail precisa de "subject" e "body".'
      return null
    },
    pendencia: (i) => ((i.campos?.type ?? 'whatsapp') === 'whatsapp' ? `o template “${i.nome}” só pode ser usado depois que a Meta aprovar: no Cubo, Templates → sincronizar, e aguarde a aprovação.` : null),
  },
  trilha: { rota: '/api/activity-trails', rotulo: 'trilha de atividade', kind: 'activity_trail', corpo: (i) => ({ name: i.nome, ...i.campos }), confere: (i) => (!(i.campos?.items || []).length ? 'trilha precisa de "items" (cada um com title, type, delayMinutes e order).' : null) },
  base: { rota: '/api/knowledge-bases', rotulo: 'base de conhecimento', kind: 'knowledge_base', admin: true, unico: true, corpo: (i) => ({ name: i.nome, content: i.campos?.content ?? '', ...i.campos }), confere: (i) => (!i.campos?.content ? 'base de conhecimento precisa de "content" (o texto da base).' : null) },
  intent: {
    rota: '/api/intents', rotulo: 'intent', kind: 'custom_intent', unico: true, campoNome: 'displayName',
    corpo: (i) => ({ displayName: i.nome, ...i.campos }),
    confere: (i) => {
      const faltam = ['name', 'description', 'whenToUse', 'method', 'url', 'inputSchema'].filter((c) => !i.campos?.[c])
      if (faltam.length) return `intent precisa de ${faltam.join(', ')} em "campos".`
      if (!/^[a-z][a-z0-9_]*$/.test(i.campos.name)) return 'o "name" da intent é minúsculas, números e _ (começando por letra).'
      return null
    },
    pendencia: (i) => `a intent “${i.nome}” nasce DESLIGADA: revise, preencha segredos se precisar e ligue em Agentes → Intents.`,
  },
  'pasta-automacoes': { rota: '/api/automation-folders', rotulo: 'pasta de automações', kind: 'automation_folder', unico: true, corpo: (i) => ({ name: i.nome, ...i.campos }) },
  'pasta-agentes': { rota: '/api/agent-folders', rotulo: 'pasta de agentes', kind: 'agent_folder', unico: true, corpo: (i) => ({ name: i.nome, ...i.campos }) },
}

// Só para achar (não se cria por aqui).
const SO_BUSCA = {
  usuario: { rota: '/api/users', rotulo: 'usuário', kind: 'user' },
  agente: { rota: '/api/agents', rotulo: 'agente', kind: 'agent' },
  fluxo: { rota: '/api/automations', rotulo: 'automação', kind: 'automation' },
  canal: { rota: '/api/channels', rotulo: 'canal', kind: 'channel' },
  integracao: { rota: '/api/integrations', rotulo: 'integração', kind: 'integration' },
  mcp: { rota: '/api/mcp-connections', rotulo: 'conexão MCP', kind: 'mcp_connection' },
}

// O que não tem API: o passo a passo pronto para a pessoa.
export const NA_TELA = {
  usuario: 'Usuário novo: no Cubo, Configurações → Usuários → Convidar. Depois que a pessoa aceitar o convite, rode a skill de novo.',
  canal: 'Conectar canal (WhatsApp, Instagram…): no Cubo, Canais → Novo canal, e siga a conexão (o login é na tela).',
  integracao: 'Integração que nasce de login (WhatsApp, Google…) ou que pede a chave de um serviço: no Cubo, Configurações → Integrações → Nova integração.',
  'credencial-oauth': 'Credencial OAuth: no Cubo, Configurações → Credenciais OAuth → Nova, e clique em Conectar para fazer o login.',
  mcp: 'Conexão MCP: no Cubo, Configurações → MCP → Nova conexão (o login é no navegador).',
  'aprovacao-meta': 'Aprovação de template de WhatsApp: é a Meta que aprova. No Cubo, Templates → sincronizar, e aguarde.',
  agente: 'Agente novo é grande demais para nascer no meio de um fluxo: rode /cubo:criar-agente e volte depois.',
  fluxo: 'Fluxo novo é grande demais para nascer no meio de outro: rode /cubo:criar-fluxo e volte depois.',
}

const TODOS = { ...ITENS, ...SO_BUSCA }

function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0]
    linha[0] = i
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j]
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = guardado
    }
  }
  return linha[b.length]
}

const cacheListas = new Map()
async function listaDe(tipo) {
  if (!cacheListas.has(tipo)) cacheListas.set(tipo, await todos(TODOS[tipo].rota))
  return cacheListas.get(tipo)
}

const nomeDe = (tipo, item) => item?.[TODOS[tipo].campoNome ?? 'name'] ?? nomeDoItem(item)

// { iguais, parecidos } — igual: mesmo nome sem acento/maiúscula; parecido: um contém o outro, ou até 2 letras de diferença.
export async function procurar(tipo, nome, { funilId = null, escopo = null } = {}) {
  let itens = await listaDe(tipo)
  if (funilId) itens = itens.filter((x) => String(x.pipeId) === String(funilId))
  if (escopo && tipo === 'campo') itens = itens.filter((x) => (x.context ?? 'deal') === escopo)
  const alvo = normalizar(nome)
  const iguais = itens.filter((x) => normalizar(nomeDe(tipo, x)) === alvo)
  const parecidos = iguais.length ? [] : itens.filter((x) => {
    const n = normalizar(nomeDe(tipo, x))
    return n && alvo && (n.includes(alvo) || alvo.includes(n) || distancia(n, alvo) <= 2)
  })
  return { iguais, parecidos }
}

async function resolverFunil(funil, criadosNoLote) {
  if (funil === undefined || funil === null || funil === '') return null
  if (/^\d+$/.test(String(funil))) return Number(funil)
  if (criadosNoLote.has(`funil|${normalizar(funil)}`)) return criadosNoLote.get(`funil|${normalizar(funil)}`)
  const { iguais } = await procurar('funil', funil)
  if (iguais.length === 1) return iguais[0].id
  return { pendente: `o funil “${funil}” não existe${iguais.length > 1 ? ' uma vez só' : ''}: ponha o funil antes, na mesma lista, ou diga o número.` }
}

const arquivoCriados = () => pasta('criados.json')
const chaveDo = (item, funilId) => `${item.tipo}|${funilId ?? ITENS[item.tipo]?.escopo?.(item) ?? ''}|${normalizar(item.nome)}`

export async function criarItens(lista, { soPlano = false, criarMesmo = new Set() } = {}) {
  if (!Array.isArray(lista) || !lista.length) throw new Error('a lista de itens está vazia.')
  const criados = lerJson(arquivoCriados(), { itens: [] })
  const plano = []
  const doLote = new Map()
  for (const [indice, item] of lista.entries()) {
    const n = indice + 1
    const def = ITENS[item.tipo]
    if (!def) {
      plano.push({ n, item, acao: 'tela', texto: NA_TELA[item.tipo] ?? `“${item.tipo}” não é um tipo que se crie pela API. Tipos: ${Object.keys(ITENS).join(', ')}.` })
      continue
    }
    if (!item.nome) {
      plano.push({ n, item, acao: 'erro', texto: 'falta o "nome".' })
      continue
    }
    const problema = def.confere?.(item)
    if (problema) {
      plano.push({ n, item, acao: 'erro', texto: problema })
      continue
    }
    let funilId = null
    if (def.precisaFunil) {
      funilId = await resolverFunil(item.funil, doLote)
      if (funilId?.pendente) {
        // O funil pode vir antes, no mesmo lote, ainda não criado: aceita se estiver na lista.
        const noLote = lista.slice(0, indice).find((x) => x.tipo === 'funil' && normalizar(x.nome) === normalizar(item.funil))
        if (!noLote) {
          plano.push({ n, item, acao: 'erro', texto: funilId.pendente })
          continue
        }
        funilId = { doLote: normalizar(item.funil) }
      }
    }
    const chave = chaveDo(item, typeof funilId === 'number' ? funilId : funilId?.doLote)
    const registrado = criados.itens.find((c) => c.chave === chave)
    if (registrado && (await listaDe(item.tipo)).some((x) => String(x.id) === String(registrado.id))) {
      plano.push({ n, item, acao: 'usar', id: registrado.id, texto: `já criado antes pela skill (#${registrado.id})` })
      doLote.set(`${item.tipo}|${normalizar(item.nome)}`, registrado.id)
      continue
    }
    const { iguais, parecidos } = typeof funilId === 'object' && funilId?.doLote ? { iguais: [], parecidos: [] } : await procurar(item.tipo, item.nome, { funilId, escopo: def.escopo?.(item) })
    if (iguais.length) {
      plano.push({ n, item, acao: 'usar', id: iguais[0].id, texto: `já existe (#${iguais[0].id})` })
      doLote.set(`${item.tipo}|${normalizar(item.nome)}`, iguais[0].id)
      continue
    }
    if (parecidos.length && !criarMesmo.has(n)) {
      plano.push({ n, item, acao: 'pergunta', parecidos: parecidos.map((x) => ({ id: x.id, nome: nomeDe(item.tipo, x) })), texto: `há parecido: ${parecidos.map((x) => `“${nomeDe(item.tipo, x)}” (#${x.id})`).join(', ')}` })
      continue
    }
    plano.push({ n, item, acao: 'criar', funilId, texto: `vou criar${def.admin ? ' (precisa de chave de administrador)' : ''}` })
    doLote.set(`${item.tipo}|${normalizar(item.nome)}`, { pendente: true })
  }

  const travas = plano.filter((p) => p.acao === 'erro' || p.acao === 'pergunta')
  if (soPlano || travas.length) return { plano, feito: false }

  for (const p of plano.filter((x) => x.acao === 'criar')) {
    const def = ITENS[p.item.tipo]
    let funilId = p.funilId
    if (funilId && typeof funilId === 'object') funilId = doLote.get(`funil|${funilId.doLote}`)
    try {
      const criado = await api('POST', def.rota, def.corpo({ ...p.item, funilId }))
      const item = criado?.data ?? criado
      p.id = item.id
      p.acao = 'criado'
      p.texto = `criado (#${item.id})`
      p.pendencia = def.pendencia?.(p.item) ?? null
      doLote.set(`${p.item.tipo}|${normalizar(p.item.nome)}`, item.id)
      criados.itens.push({ chave: chaveDo(p.item, funilId ?? undefined), tipo: p.item.tipo, nome: p.item.nome, id: item.id, criadoEm: new Date().toISOString() })
      gravarJson(arquivoCriados(), criados)
      cacheListas.delete(p.item.tipo)
    } catch (erro) {
      if (!(erro instanceof ErroApi)) throw erro
      p.acao = 'falhou'
      p.texto = erro.message
      break // o resto pode depender deste (etapa depende do funil)
    }
  }
  return { plano, feito: true }
}

const ROTULO_ACAO = { usar: 'USAR', criar: 'CRIAR', criado: 'CRIADO', pergunta: 'PERGUNTAR', erro: 'ERRO', tela: 'NA TELA', falhou: 'FALHOU' }

function imprimirPlano(plano) {
  for (const p of plano) console.log(`  ${p.n}. [${ROTULO_ACAO[p.acao]}] ${ITENS[p.item.tipo]?.rotulo ?? p.item.tipo} “${p.item.nome ?? '?'}”${p.item.funil ? ` (funil ${p.item.funil})` : ''}: ${p.texto}${p.pendencia ? `\n       pendência: ${p.pendencia}` : ''}`)
}

async function principal() {
  const { opcoes, posicionais } = argumentos(process.argv.slice(2))
  const [comando, tipo, ...resto] = posicionais
  if (comando === 'tipos') {
    console.log('PELA API (a skill cria, com a confirmação da pessoa):')
    for (const [chave, def] of Object.entries(ITENS)) console.log(`  ${chave} — ${def.rotulo}${def.admin ? ' (chave de administrador)' : ''}`)
    console.log('\nNA TELA (a skill ensina; diga com estas palavras):')
    for (const [chave, texto] of Object.entries(NA_TELA)) console.log(`  ${chave}: ${texto}`)
  } else if (comando === 'buscar') {
    if (!TODOS[tipo]) falha(`tipo desconhecido “${tipo ?? ''}”. Tipos: ${Object.keys(TODOS).join(', ')}`, 2)
    let itens = await listaDe(tipo)
    if (opcoes.funil) {
      const funilId = /^\d+$/.test(opcoes.funil) ? Number(opcoes.funil) : (await procurar('funil', opcoes.funil)).iguais[0]?.id
      itens = itens.filter((x) => String(x.pipeId) === String(funilId))
    }
    const texto = resto.length ? normalizar(resto.join(' ')) : ''
    const achados = texto ? itens.filter((x) => normalizar(nomeDe(tipo, x)).includes(texto) || distancia(normalizar(nomeDe(tipo, x)), texto) <= 2) : itens
    const funis = tipo === 'etapa' ? new Map((await listaDe('funil')).map((f) => [String(f.id), f.name])) : null
    if (!achados.length) console.log(`Nenhum ${TODOS[tipo].rotulo} ${texto ? `com “${resto.join(' ')}”` : 'na conta'}.`)
    for (const x of achados.slice(0, 50)) console.log(`  #${x.id} — ${nomeDe(tipo, x)}${funis ? ` (funil ${funis.get(String(x.pipeId)) ?? x.pipeId})` : ''}${x.context ? ` [${x.context}]` : ''}${x.type && tipo !== 'fluxo' ? ` [${x.type}]` : ''}${x.enabled === false ? ' (desligada)' : ''}${x.status && tipo === 'fluxo' ? ` (${x.status})` : ''}`)
    if (achados.length > 50) console.log(`  … e mais ${achados.length - 50}. Refine a busca.`)
  } else if (comando === 'criar') {
    const lista = lerJsonEntrada(tipo, 'lista de itens')
    const criarMesmo = new Set(String(opcoes['criar-mesmo'] ?? '').split(',').filter(Boolean).map(Number))
    const { plano, feito } = await criarItens(lista, { soPlano: Boolean(opcoes['so-plano']), criarMesmo })
    console.log(feito ? 'ITENS:' : 'PLANO (nada foi criado ainda):')
    imprimirPlano(plano)
    if (plano.some((p) => p.acao === 'pergunta')) {
      console.log('\nHá itens parecidos com o que já existe. Pergunte à pessoa: usar o que existe (troque o nome na lista pelo nome exato) ou criar outro (rode com --criar-mesmo=<nºs>).')
      process.exit(3)
    }
    if (plano.some((p) => p.acao === 'erro' || p.acao === 'falhou')) process.exit(1)
    if (plano.some((p) => p.acao === 'tela')) process.exit(4)
  } else if (comando === 'listar-criados') {
    const { itens } = lerJson(arquivoCriados(), { itens: [] })
    if (!itens.length) console.log('A skill não criou nenhum item nesta pasta.')
    for (const c of itens) console.log(`  ${ITENS[c.tipo]?.rotulo ?? c.tipo} “${c.nome}” #${c.id} — criado em ${c.criadoEm.slice(0, 16).replace('T', ' ')}`)
    if (itens.length) console.log('\nA API não apaga esses itens. Para apagar, é na tela do Cubo (cada um na sua área).')
  } else {
    falha(`uso:
  itens.mjs tipos
  itens.mjs buscar <tipo> [texto] [--funil=<id|nome>]
  itens.mjs criar @itens.json [--so-plano] [--criar-mesmo=1,3]
  itens.mjs listar-criados`, 2)
  }
}

if (ehPrincipal(import.meta.url)) await principal()
