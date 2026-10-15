// Como o Cubo lê um fluxo: nós, arestas e as saídas que cada nó tem com o `data` que ele tem. Tudo
// sai do catálogo (`outputs` com `when` e `handlesFrom`); nada de tabela de nó copiada aqui.

export const TERMINAIS = new Set(['goto_node', 'start_flow']) // aresta saindo deles nunca é seguida

export function valorEm(objeto, caminho) {
  return String(caminho)
    .split('.')
    .reduce((atual, parte) => (atual === null || atual === undefined ? undefined : atual[parte]), objeto)
}

// `when`: { field, equals } · { field, notEquals } · { field, greaterThan } · { all: [...] }.
export function condicaoVale(quando, data) {
  if (!quando) return true
  if (Array.isArray(quando.all)) return quando.all.every((parte) => condicaoVale(parte, data))
  const valor = valorEm(data, quando.field)
  if ('equals' in quando) return valor === quando.equals
  if ('notEquals' in quando) return valor !== quando.notEquals
  if ('greaterThan' in quando) return Number(valor) > quando.greaterThan
  return true
}

// O texto de uma opção do menu ou caso do switch, para a saída ter nome.
function rotuloDoItem(item, handle) {
  return item?.label ?? item?.text ?? item?.title ?? item?.value ?? item?.name ?? handle
}

// [{ handle, rotulo, motor }]: `handle: null` é a aresta sem sourceHandle. `motor: true` é a
// `ocupada` (conversa assumida por humano), que existe em todo passo.
export function saidasDoNo(no, definicao) {
  const data = no?.data || {}
  const saidas = []
  for (const saida of definicao?.outputs || []) {
    if (saida.handlesFrom) {
      const lista = valorEm(data, saida.handlesFrom.list)
      for (const item of Array.isArray(lista) ? lista : []) {
        const handle = item?.[saida.handlesFrom.key]
        if (handle !== undefined && handle !== null && handle !== '') saidas.push({ handle: String(handle), rotulo: `${saida.label}: ${rotuloDoItem(item, handle)}`, motor: false })
      }
      continue
    }
    if (!condicaoVale(saida.when, data)) continue
    saidas.push({ handle: saida.handle ?? null, rotulo: saida.label, motor: Boolean(saida.engine) })
  }
  return saidas
}

const mesmoHandle = (a, b) => (a ?? null) === (b ?? null) || ((a === '' || a === null || a === undefined) && (b === '' || b === null || b === undefined))

// Aresta → handle normalizado (null para sem sourceHandle).
export function handleDaAresta(aresta) {
  return aresta.sourceHandle === undefined || aresta.sourceHandle === '' ? null : aresta.sourceHandle
}

export function arestasQueSaem(fluxo, noId) {
  return (fluxo.flowData?.edges || fluxo.edges || []).filter((aresta) => aresta.source === noId)
}

export function nosDoFluxo(fluxo) {
  return fluxo.flowData?.nodes || fluxo.nodes || []
}

export function arestasDoFluxo(fluxo) {
  return fluxo.flowData?.edges || fluxo.edges || []
}

// Para cada saída do nó, os destinos ligados nela. Arestas que não casam com nenhuma saída voltam
// em `soltas` (o nó nunca segue por elas).
export function ligacoes(fluxo, no, definicao) {
  const saidas = saidasDoNo(no, definicao)
  const arestas = arestasQueSaem(fluxo, no.id)
  const usadas = new Set()
  const resultado = saidas.map((saida) => {
    const destinos = arestas.filter((aresta) => mesmoHandle(handleDaAresta(aresta), saida.handle)).map((aresta) => {
      usadas.add(aresta)
      return aresta.target
    })
    return { ...saida, destinos }
  })
  const soltas = arestas.filter((aresta) => !usadas.has(aresta))
  return { saidas: resultado, soltas }
}

// Ordem de leitura: a partir do `start`, em largura, seguindo as saídas na ordem do catálogo. O
// `goto_node` conta como ligação para o nó de destino. O que sobra (órfão) vai no fim.
export function ordemDosNos(fluxo, defs) {
  const nos = nosDoFluxo(fluxo)
  const porId = new Map(nos.map((no) => [no.id, no]))
  const inicio = nos.filter((no) => no.type === 'start' || no.type === 'trigger')
  const vistos = new Set()
  const ordem = []
  const fila = [...inicio.map((no) => no.id)]
  while (fila.length) {
    const id = fila.shift()
    if (vistos.has(id) || !porId.has(id)) continue
    vistos.add(id)
    const no = porId.get(id)
    ordem.push(no)
    if (TERMINAIS.has(no.type)) {
      if (no.type === 'goto_node' && no.data?.targetNodeId) fila.push(no.data.targetNodeId)
      continue
    }
    const { saidas } = ligacoes(fluxo, no, defs[no.type])
    for (const saida of saidas) fila.push(...saida.destinos)
  }
  const alcancados = new Set(ordem.map((no) => no.id))
  const orfaos = nos.filter((no) => !alcancados.has(no.id))
  return { ordem, orfaos }
}
