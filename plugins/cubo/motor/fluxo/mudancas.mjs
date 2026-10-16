// A lista de mudanças: o Claude nunca escreve o JSON inteiro do fluxo. Ele diz o que mudar, o motor
// aplica numa cópia, preserva o resto, arruma a posição dos nós novos e devolve o que fez em pt-BR.
//
// Operações (um array, aplicado em ordem):
//   { "op": "por", "id"?, "tipo", "titulo"?, "dados"? }                       nó novo (com os padrões do catálogo)
//   { "op": "inserir", "id"?, "tipo", "titulo"?, "dados"?, "depoisDe": "<nó>", "saida"? }
//                                    nó novo no meio: <nó> —saída→ novo —Seguir→ (quem vinha depois)
//   { "op": "tirar", "no", "religar"? }       tira o nó e as ligações; religar: quem chegava nele passa a ir para o seguinte
//   { "op": "configurar", "no", "dados"?, "titulo"? }    junta no data (null apaga a chave)
//   { "op": "ligar", "de", "saida"?, "para" }            saída: o handle ("yes", "timeout"…) ou o rótulo ("Sim"); vazio = a comum
//   { "op": "desligar", "de", "saida"?, "para"? }
//   { "op": "gatilho", "acao": "por"|"tirar"|"configurar", "id"?, "tipo"?, "config"? }
//   { "op": "renomear", "nome" }
import { normalizar } from '../lib.mjs'
import { TERMINAIS, arestasDoFluxo, nosDoFluxo, saidasDoNo } from './modelo.mjs'

export class ErroMudanca extends Error {}

const ALTURA_PASSO = 130
const LARGURA_PASSO = 280

function novoId(fluxo, tipo) {
  const usados = new Set(nosDoFluxo(fluxo).map((no) => no.id))
  for (let i = 1; ; i++) {
    const id = `${tipo}-${i}`.slice(0, 50)
    if (!usados.has(id)) return id
  }
}

function acharNo(fluxo, ref, operacao) {
  const no = nosDoFluxo(fluxo).find((n) => n.id === ref) ?? nosDoFluxo(fluxo).find((n) => n.data?.label && normalizar(n.data.label) === normalizar(ref))
  if (!no) throw new ErroMudanca(`${operacao}: não existe o nó “${ref}” (use o id do nó ou o título exato).`)
  return no
}

// "Sim", "yes", null, "seguir" → o handle de verdade daquele nó.
export function resolverSaida(no, def, saida) {
  const saidas = saidasDoNo(no, def).filter((s) => !s.motor || s.handle === 'ocupada')
  if (saida === undefined || saida === null || saida === '' || normalizar(saida) === 'seguir') {
    if (saidas.some((s) => s.handle === null)) return null
    if (saida === undefined || saida === null || saida === '') throw new ErroMudanca(`o nó “${no.data?.label ?? no.id}” (${no.type}) não tem saída comum; diga qual: ${saidas.map((s) => `“${s.rotulo}” (${s.handle})`).join(', ')}.`)
  }
  const porHandle = saidas.find((s) => s.handle !== null && String(s.handle) === String(saida))
  if (porHandle) return porHandle.handle
  const alvo = normalizar(saida)
  const porRotulo = saidas.find((s) => normalizar(s.rotulo) === alvo || normalizar(s.rotulo).endsWith(`: ${alvo}`))
  if (porRotulo) return porRotulo.handle
  throw new ErroMudanca(`o nó “${no.data?.label ?? no.id}” (${no.type}) não tem a saída “${saida}”. Saídas que ele tem agora: ${saidas.map((s) => `“${s.rotulo}” (${s.handle ?? 'comum'})`).join(', ') || 'nenhuma'}.`)
}

const mesmo = (a, b) => (a ?? null) === (b ?? null)

function juntar(destino, origem) {
  for (const [chave, valor] of Object.entries(origem || {})) {
    if (valor === null) delete destino[chave]
    else destino[chave] = valor
  }
  return destino
}

// Posição: abaixo do nó de origem; se já houver alguém ali, um passo para o lado.
function posicaoPerto(fluxo, origem, deslocamento = 0) {
  const base = origem?.position ?? { x: 0, y: 0 }
  const ocupadas = nosDoFluxo(fluxo).filter((n) => n.position)
  let x = base.x + deslocamento * LARGURA_PASSO
  const y = base.y + ALTURA_PASSO
  while (ocupadas.some((n) => Math.abs(n.position.x - x) < LARGURA_PASSO * 0.8 && Math.abs(n.position.y - y) < ALTURA_PASSO * 0.6)) x += LARGURA_PASSO
  return { x, y }
}

// Quem não tem posição ganha uma, em camadas a partir do início (fluxo novo, ou nó solto).
export function arrumarPosicoes(fluxo) {
  const nos = nosDoFluxo(fluxo)
  if (nos.every((n) => n.position)) return
  const arestas = arestasDoFluxo(fluxo)
  const camada = new Map()
  const fila = nos.filter((n) => n.type === 'start').map((n) => [n.id, 0])
  while (fila.length) {
    const [id, c] = fila.shift()
    if (camada.has(id)) continue
    camada.set(id, c)
    const no = nos.find((n) => n.id === id)
    if (TERMINAIS.has(no?.type)) continue
    for (const a of arestas) if (a.source === id) fila.push([a.target, c + 1])
  }
  // Fluxo novo: tudo em camadas a partir de x = 0. Fluxo que já tem desenho: os nós sem posição vão
  // para a direita de tudo, para não cair em cima do que a pessoa arrumou no editor.
  const posicionados = nos.filter((n) => n.position)
  const baseX = posicionados.length ? Math.max(...posicionados.map((n) => n.position.x)) + LARGURA_PASSO : 0
  const ultima = Math.max(0, ...camada.values()) + 1
  const porCamada = new Map()
  for (const no of nos) {
    if (no.position) continue
    const c = camada.get(no.id) ?? ultima
    const i = porCamada.get(c) ?? 0
    porCamada.set(c, i + 1)
    no.position = { x: baseX + i * LARGURA_PASSO, y: Math.round(c * ALTURA_PASSO * 1.3) }
  }
}

export function aplicarMudancas(original, mudancas, { defs, gatilhos }) {
  if (!Array.isArray(mudancas)) throw new ErroMudanca('a lista de mudanças tem que ser um array.')
  const fluxo = structuredClone(original)
  fluxo.flowData = fluxo.flowData || { nodes: [], edges: [] }
  fluxo.flowData.nodes = fluxo.flowData.nodes || []
  fluxo.flowData.edges = fluxo.flowData.edges || []
  const nos = () => fluxo.flowData.nodes
  const feito = []
  const titulo = (no) => (no.data?.label ? `“${no.data.label}”` : `${defs[no.type]?.label ?? no.type} (${no.id})`)
  const ligarAresta = (de, handle, para) => {
    if (fluxo.flowData.edges.some((e) => e.source === de.id && mesmo(e.sourceHandle ?? null, handle) && e.target === para.id)) return false
    const aresta = { id: `e-${de.id}-${handle ?? 'seguir'}-${para.id}`.slice(0, 120), source: de.id, target: para.id }
    if (handle !== null) aresta.sourceHandle = handle
    fluxo.flowData.edges.push(aresta)
    return true
  }
  const criarNo = (m, perto) => {
    const def = defs[m.tipo]
    if (!def) throw new ErroMudanca(`não existe o tipo de nó “${m.tipo}” no catálogo. Veja: catalogo.mjs resumo`)
    if (def.deprecated) throw new ErroMudanca(`o nó “${m.tipo}” é antigo; use “${def.deprecated.replacedBy}”.`)
    if (m.tipo === 'start' && nos().some((n) => n.type === 'start')) throw new ErroMudanca('o fluxo já tem início; para gatilhos, use a operação "gatilho".')
    const id = m.id ? String(m.id) : novoId(fluxo, m.tipo)
    if (id.length > 50) throw new ErroMudanca(`o id “${id}” passa de 50 caracteres.`)
    if (nos().some((n) => n.id === id)) throw new ErroMudanca(`já existe um nó com o id “${id}”.`)
    // Os padrões do catálogo, menos o texto vazio: o Cubo já usa "" quando o campo falta, e um "" gravado
    // vira null se alguém salvar pelo editor, o que faz o passo parar.
    const padroes = Object.fromEntries(Object.entries(def.defaults || {}).filter(([, valor]) => valor !== ''))
    const data = juntar(structuredClone(padroes), m.dados)
    if (m.titulo) data.label = m.titulo
    const no = { id, type: m.tipo, data }
    if (perto) no.position = posicaoPerto(fluxo, perto)
    nos().push(no)
    return no
  }

  for (const [i, m] of mudancas.entries()) {
    const n = `mudança ${i + 1} (${m?.op ?? '?'})`
    try {
      if (m.op === 'por') {
        const no = criarNo(m, null)
        feito.push(`entra o passo ${titulo(no)} (${defs[no.type].label})`)
      } else if (m.op === 'inserir') {
        const antes = acharNo(fluxo, m.depoisDe, n)
        const handle = resolverSaida(antes, defs[antes.type], m.saida)
        const seguintes = fluxo.flowData.edges.filter((e) => e.source === antes.id && mesmo(e.sourceHandle ?? null, handle))
        const no = criarNo(m, antes)
        fluxo.flowData.edges = fluxo.flowData.edges.filter((e) => !seguintes.includes(e))
        ligarAresta(antes, handle, no)
        const handleNovo = saidasDoNo(no, defs[no.type]).some((s) => s.handle === null) ? null : undefined
        for (const e of seguintes) {
          if (handleNovo === undefined) throw new ErroMudanca(`o nó “${m.tipo}” não tem saída comum para continuar o caminho; use "por" + "ligar".`)
          ligarAresta(no, null, nos().find((x) => x.id === e.target))
        }
        // Quem estava logo abaixo desce um passo, para não ficar por cima do novo.
        for (const e of seguintes) {
          const alvo = nos().find((x) => x.id === e.target)
          if (alvo?.position && no.position && Math.abs(alvo.position.y - no.position.y) < ALTURA_PASSO) {
            const delta = no.position.y + ALTURA_PASSO - alvo.position.y
            for (const outro of nos()) if (outro.position && outro.position.y >= alvo.position.y && outro !== no) outro.position.y += delta
          }
        }
        feito.push(`entra o passo ${titulo(no)} depois de ${titulo(antes)}`)
      } else if (m.op === 'tirar') {
        const no = acharNo(fluxo, m.no, n)
        if (no.type === 'start') throw new ErroMudanca('o início não sai; para mudar gatilhos, use a operação "gatilho".')
        const chegam = fluxo.flowData.edges.filter((e) => e.target === no.id)
        const saem = fluxo.flowData.edges.filter((e) => e.source === no.id && (e.sourceHandle ?? null) === null)
        fluxo.flowData.edges = fluxo.flowData.edges.filter((e) => e.source !== no.id && e.target !== no.id)
        fluxo.flowData.nodes = nos().filter((x) => x !== no)
        for (const outro of nos()) if (outro.type === 'goto_node' && outro.data?.targetNodeId === no.id) feito.push(`ATENÇÃO: ${titulo(outro)} ia para o passo tirado; ajuste o destino dele`)
        if (m.religar) for (const c of chegam) for (const s of saem) ligarAresta(nos().find((x) => x.id === c.source), c.sourceHandle ?? null, nos().find((x) => x.id === s.target))
        feito.push(`sai o passo ${titulo(no)}${m.religar && chegam.length && saem.length ? ' (quem chegava nele vai direto para o seguinte)' : ''}`)
      } else if (m.op === 'configurar') {
        const no = acharNo(fluxo, m.no, n)
        no.data = juntar(no.data || {}, m.dados)
        if (m.titulo !== undefined) no.data.label = m.titulo
        feito.push(`muda a configuração de ${titulo(no)}: ${Object.keys(m.dados || {}).concat(m.titulo !== undefined ? ['título'] : []).join(', ')}`)
      } else if (m.op === 'ligar') {
        const de = acharNo(fluxo, m.de, n)
        const para = acharNo(fluxo, m.para, n)
        if (TERMINAIS.has(de.type)) throw new ErroMudanca(`${titulo(de)} termina o fluxo: ligação saindo dele nunca é seguida.`)
        if (para.type === 'start') throw new ErroMudanca('não dá para ligar no início do fluxo; para voltar, use um nó "goto_node".')
        const handle = resolverSaida(de, defs[de.type], m.saida)
        if (ligarAresta(de, handle, para)) feito.push(`liga ${titulo(de)}${handle === null ? '' : ` (saída ${handle})`} → ${titulo(para)}`)
      } else if (m.op === 'desligar') {
        const de = acharNo(fluxo, m.de, n)
        const handle = m.saida === undefined ? undefined : resolverSaida(de, defs[de.type], m.saida)
        const para = m.para ? acharNo(fluxo, m.para, n) : null
        const antes = fluxo.flowData.edges.length
        fluxo.flowData.edges = fluxo.flowData.edges.filter((e) => !(e.source === de.id && (handle === undefined || mesmo(e.sourceHandle ?? null, handle)) && (!para || e.target === para.id)))
        if (antes === fluxo.flowData.edges.length) throw new ErroMudanca(`não há ligação saindo de ${titulo(de)}${para ? ` para ${titulo(para)}` : ''} para desligar.`)
        feito.push(`desliga ${titulo(de)}${para ? ` → ${titulo(para)}` : ''}`)
      } else if (m.op === 'gatilho') {
        let inicio = nos().find((x) => x.type === 'start')
        if (!inicio) {
          inicio = { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { triggers: [] } }
          fluxo.flowData.nodes.unshift(inicio)
        }
        inicio.data = inicio.data || {}
        inicio.data.triggers = inicio.data.triggers || []
        const lista = inicio.data.triggers
        if (m.acao === 'por') {
          if (!gatilhos[m.tipo]) throw new ErroMudanca(`não existe o gatilho “${m.tipo}”. Veja: catalogo.mjs resumo`)
          const id = m.id ?? `t${lista.length + 1}`
          lista.push({ id, triggerType: m.tipo, triggerConfig: m.config ?? {} })
          feito.push(`entra o gatilho “${gatilhos[m.tipo].label}”`)
        } else {
          const g = lista.find((x) => x.id === m.id) ?? (m.tipo ? lista.find((x) => x.triggerType === m.tipo) : null)
          if (!g) throw new ErroMudanca(`não achei o gatilho ${m.id ?? m.tipo}.`)
          if (m.acao === 'tirar') {
            inicio.data.triggers = lista.filter((x) => x !== g)
            feito.push(`sai o gatilho “${gatilhos[g.triggerType]?.label ?? g.triggerType}”`)
          } else if (m.acao === 'configurar') {
            g.triggerConfig = juntar(g.triggerConfig || {}, m.config)
            feito.push(`muda o gatilho “${gatilhos[g.triggerType]?.label ?? g.triggerType}”`)
          } else throw new ErroMudanca('gatilho: a ação é "por", "tirar" ou "configurar".')
        }
      } else if (m.op === 'renomear') {
        if (!m.nome) throw new ErroMudanca('renomear: falta o nome.')
        fluxo.name = m.nome
        feito.push(`o fluxo passa a se chamar “${m.nome}”`)
      } else throw new ErroMudanca(`operação desconhecida “${m?.op}”. Use: por, inserir, tirar, configurar, ligar, desligar, gatilho, renomear.`)
    } catch (erro) {
      if (erro instanceof ErroMudanca) throw new ErroMudanca(`${n}: ${erro.message}`)
      throw erro
    }
  }
  arrumarPosicoes(fluxo)
  return { fluxo, feito }
}

// Tamanho e limites do catálogo, antes de mandar.
export function conferirLimites(fluxo, limites = {}) {
  const problemas = []
  const bytes = Buffer.byteLength(JSON.stringify(fluxo.flowData ?? {}))
  if (limites.flowDataBytes && bytes > limites.flowDataBytes) problemas.push(`o fluxo tem ${Math.round(bytes / 1024)} KB; o Cubo aceita até ${Math.round(limites.flowDataBytes / 1024)} KB.`)
  for (const no of nosDoFluxo(fluxo)) {
    if (limites.nodeIdMaxLength && String(no.id).length > limites.nodeIdMaxLength) problemas.push(`o id do nó “${no.id}” passa de ${limites.nodeIdMaxLength} caracteres.`)
    for (const g of no.type === 'start' ? no.data?.triggers || [] : []) {
      const tamanho = Buffer.byteLength(JSON.stringify(g.triggerConfig ?? {}))
      if (limites.triggerConfigBytes && tamanho > limites.triggerConfigBytes) problemas.push(`a configuração do gatilho ${g.id} passa de ${Math.round(limites.triggerConfigBytes / 1024)} KB.`)
    }
  }
  return problemas
}
