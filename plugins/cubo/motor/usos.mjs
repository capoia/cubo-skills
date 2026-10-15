// Onde um agente é usado e quem chama um fluxo. O Cubo não tem rota para isso: varre canais,
// automações (com `include=refs`) e agentes. Lê o fluxo publicado (ou o rascunho, se nunca foi
// publicado), porque é ele que roda.
import { detalhe, todos } from './api.mjs'

const AO_MESMO_TEMPO = 4

async function emParalelo(itens, funcao) {
  const saida = new Array(itens.length)
  let proximo = 0
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo++
      saida[i] = await funcao(itens[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(AO_MESMO_TEMPO, itens.length) }, trabalhador))
  return saida
}

// O índice do nó no caminho do ref (`flowData.nodes[3].data.agentId` → 3).
const indiceDoNo = (caminho) => Number(String(caminho).match(/^flowData\.nodes\[(\d+)\]/)?.[1] ?? NaN)

export async function varrer() {
  const [listaAutomacoes, agentes, canais] = await Promise.all([
    todos('/api/automations').catch(() => []),
    todos('/api/agents?include=refs').catch(() => []),
    todos('/api/channels').catch(() => []),
  ])
  const automacoes = await emParalelo(listaAutomacoes, async (resumo) => {
    const consulta = resumo.publishedVersion === null ? '?version=draft&include=refs' : '?include=refs'
    try {
      const item = await detalhe('/api/automations', resumo.id, consulta)
      const nos = item.flowData?.nodes || []
      const refs = (item.refs || []).map((ref) => {
        const no = nos[indiceDoNo(ref.path)]
        return { kind: ref.kind, id: ref.id, noId: no?.id ?? null, noTipo: no?.type ?? null, noTitulo: no?.data?.label ?? null }
      })
      return { id: item.id, name: item.name, status: item.status, refs }
    } catch {
      return { id: resumo.id, name: resumo.name, status: resumo.status, refs: [], ilegivel: true }
    }
  })
  return {
    automacoes,
    agentes: agentes.map((a) => ({ id: a.id, name: a.name, refs: (a.refs || []).map((r) => ({ kind: r.kind, id: r.id, path: r.path })) })),
    canais: canais.map((c) => ({ id: c.id, name: c.name, defaultAgentId: c.defaultAgentId ?? null, defaultAutomationId: c.defaultAutomationId ?? null, status: c.status ?? null })),
  }
}

const mesmo = (a, b) => String(a) === String(b)

// [{ onde: 'canal'|'automação'|'agente', id, nome, detalhe }]
export function quemUsaAgente(varredura, agenteId) {
  const usos = []
  for (const canal of varredura.canais) if (mesmo(canal.defaultAgentId, agenteId)) usos.push({ onde: 'canal', id: canal.id, nome: canal.name, detalhe: 'atende as conversas do canal' })
  for (const automacao of varredura.automacoes) {
    for (const ref of automacao.refs) {
      if (ref.kind !== 'agent' || !mesmo(ref.id, agenteId)) continue
      const como = ref.noTipo === 'analyze_deal' ? 'analisa a negociação' : 'é chamado no fluxo'
      usos.push({ onde: 'automação', id: automacao.id, nome: automacao.name, detalhe: `${como}${ref.noTitulo ? ` (passo “${ref.noTitulo}”)` : ''}${automacao.status === 'active' ? '' : ', automação desligada'}` })
    }
  }
  for (const agente of varredura.agentes) {
    if (mesmo(agente.id, agenteId)) continue
    if (agente.refs.some((ref) => ref.kind === 'agent' && mesmo(ref.id, agenteId))) usos.push({ onde: 'agente', id: agente.id, nome: agente.name, detalhe: 'passa a conversa para ele' })
  }
  return usos
}

export function quemChamaFluxo(varredura, fluxoId) {
  const usos = []
  for (const canal of varredura.canais) if (mesmo(canal.defaultAutomationId, fluxoId)) usos.push({ onde: 'canal', id: canal.id, nome: canal.name, detalhe: 'é o fluxo padrão do canal' })
  for (const automacao of varredura.automacoes) {
    if (mesmo(automacao.id, fluxoId)) continue
    for (const ref of automacao.refs) {
      if (ref.kind !== 'automation' || !mesmo(ref.id, fluxoId)) continue
      usos.push({ onde: 'automação', id: automacao.id, nome: automacao.name, detalhe: `inicia este fluxo${ref.noTitulo ? ` (passo “${ref.noTitulo}”)` : ''}${automacao.status === 'active' ? '' : ', automação desligada'}` })
    }
  }
  for (const agente of varredura.agentes) {
    if (agente.refs.some((ref) => ref.kind === 'automation' && mesmo(ref.id, fluxoId))) usos.push({ onde: 'agente', id: agente.id, nome: agente.name, detalhe: 'inicia este fluxo quando os lembretes acabam' })
  }
  return usos
}
