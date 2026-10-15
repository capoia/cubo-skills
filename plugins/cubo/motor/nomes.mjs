// Troca o número (ID) pelo nome que a pessoa conhece: "etapa 27" vira "Proposta (funil Vendas)".
// Lê cada lista da conta uma vez só, e só as que aparecem nos refs. Sem permissão de leitura de uma
// área, o nome fica "#27" e a área entra na lista `semPermissao`, para a skill avisar.
import { ErroApi, todos } from './api.mjs'

// A rota de leitura de cada tipo de ref (os `kind` do Cubo) e o rótulo em pt-BR.
export const TIPOS = {
  pipe: { rota: '/api/pipes', rotulo: 'funil' },
  stage: { rota: '/api/stages', rotulo: 'etapa' },
  customfield: { rota: '/api/customfields', rotulo: 'campo' },
  tag: { rota: '/api/tags', rotulo: 'tag' },
  product: { rota: '/api/products', rotulo: 'produto' },
  category: { rota: '/api/categories', rotulo: 'categoria' },
  department: { rota: '/api/departments', rotulo: 'departamento' },
  lost_reason: { rota: '/api/lostreasons', rotulo: 'motivo de perda' },
  resolution_reason: { rota: '/api/resolution-reasons', rotulo: 'motivo de resolução' },
  transfer_reason: { rota: '/api/transfer-reasons', rotulo: 'motivo de transferência' },
  pause_reason: { rota: '/api/pause-reasons', rotulo: 'motivo de pausa' },
  template: { rota: '/api/templates', rotulo: 'template' },
  activity_trail: { rota: '/api/activity-trails', rotulo: 'trilha de atividade' },
  channel: { rota: '/api/channels', rotulo: 'canal' },
  integration: { rota: '/api/integrations', rotulo: 'integração' },
  oauth_credential: { rota: '/api/oauth-credentials', rotulo: 'credencial OAuth' },
  mcp_connection: { rota: '/api/mcp-connections', rotulo: 'conexão MCP' },
  custom_intent: { rota: '/api/intents', rotulo: 'intent' },
  agent: { rota: '/api/agents', rotulo: 'agente' },
  agent_folder: { rota: '/api/agent-folders', rotulo: 'pasta de agentes' },
  knowledge_base: { rota: '/api/knowledge-bases', rotulo: 'base de conhecimento' },
  knowledge_base_folder: { rota: '/api/knowledge-base-folders', rotulo: 'pasta da base' },
  automation: { rota: '/api/automations', rotulo: 'automação' },
  automation_folder: { rota: '/api/automation-folders', rotulo: 'pasta de automações' },
  form: { rota: '/api/forms', rotulo: 'formulário' },
  landing: { rota: '/api/landings', rotulo: 'landing page' },
  domain: { rota: '/api/domains', rotulo: 'domínio' },
  filter: { rota: '/api/filters', rotulo: 'filtro' },
  user: { rota: '/api/users', rotulo: 'usuário' },
}

export function nomeDoItem(item) {
  return item?.name ?? item?.displayName ?? item?.reason ?? item?.title ?? item?.domain ?? item?.label ?? null
}

export class Nomes {
  constructor() {
    this.listas = new Map() // kind → Map(id → item)
    this.semPermissao = new Set()
  }

  async carregar(kinds) {
    for (const kind of new Set(kinds)) {
      if (this.listas.has(kind) || !TIPOS[kind]) continue
      try {
        const itens = await todos(TIPOS[kind].rota)
        this.listas.set(kind, new Map(itens.map((item) => [String(item.id), item])))
      } catch (erro) {
        if (erro instanceof ErroApi && (erro.codigo === 403 || erro.codigo === 404)) {
          this.semPermissao.add(kind)
          this.listas.set(kind, new Map())
        } else throw erro
      }
    }
    // A etapa diz o funil: carrega os funis junto.
    if (this.listas.has('stage') && !this.listas.has('pipe')) await this.carregar(['pipe'])
  }

  item(kind, id) {
    return this.listas.get(kind)?.get(String(id)) ?? null
  }

  // "Proposta (funil Vendas)"; sem achar, "#27" — e quem chama decide se é problema.
  nome(kind, id) {
    const item = this.item(kind, id)
    if (!item) return `#${id}`
    const nome = nomeDoItem(item) ?? `#${id}`
    if (kind === 'stage' && item.pipeId) {
      const funil = nomeDoItem(this.item('pipe', item.pipeId))
      return funil ? `${nome} (funil ${funil})` : nome
    }
    if (kind === 'customfield' && item.context) return `${nome} (${item.context === 'people' ? 'pessoa' : item.context === 'deal' ? 'negociação' : item.context})`
    return nome
  }

  existe(kind, id) {
    if (this.semPermissao.has(kind)) return null // não dá para saber
    return Boolean(this.item(kind, id))
  }

  // "etapa Proposta (funil Vendas)"
  descrever(kind, id) {
    return `${TIPOS[kind]?.rotulo ?? kind} ${this.nome(kind, id)}`
  }

  avisos() {
    return [...this.semPermissao].map((kind) => `Sem leitura de ${TIPOS[kind]?.rotulo ?? kind} na chave: aparece só o número (#id). Marque a leitura dessa área na chave para ver os nomes.`)
  }
}
