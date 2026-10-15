// O fluxo em forma de leitura: gatilhos, passos em ordem, cada saída com o destino, e os IDs já
// trocados pelos nomes da conta. É esse texto pronto (o "roteiro") que o Claude explica, com menos
// chance de errar do que lendo o JSON cru.
import { TERMINAIS, ligacoes, nosDoFluxo, ordemDosNos } from './modelo.mjs'

// `flowData.nodes[3].data["x y"][0]` → ['flowData', 'nodes', 3, 'data', 'x y', 0]
export function partesDoCaminho(caminho) {
  const partes = []
  const re = /([^.[\]]+)|\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]/g
  for (const m of String(caminho).matchAll(re)) {
    if (m[1] !== undefined) partes.push(m[1])
    else if (m[2] !== undefined) partes.push(Number(m[2]))
    else partes.push(JSON.parse(`"${m[3]}"`))
  }
  return partes
}

function pegar(objeto, partes) {
  return partes.reduce((atual, parte) => (atual === null || atual === undefined ? undefined : atual[parte]), objeto)
}

function por(objeto, partes, valor) {
  const pai = pegar(objeto, partes.slice(0, -1))
  if (pai && typeof pai === 'object') pai[partes.at(-1)] = valor
}

// Troca, numa cópia do fluxo, cada ID dos refs por "Nome (#id)" (ou, dentro de texto, acrescenta
// " [Nome]" depois do trecho). Devolve a cópia e a lista de refs que não existem na conta.
export function comNomes(fluxo, nomes) {
  const copia = structuredClone(fluxo)
  const quebrados = []
  for (const ref of fluxo.refs || []) {
    const partes = partesDoCaminho(ref.path)
    const atual = pegar(copia, partes)
    const nome = nomes.nome(ref.kind, ref.id)
    if (nomes.existe(ref.kind, ref.id) === false) quebrados.push(ref)
    const pai = pegar(copia, partes.slice(0, -1))
    if (ref.token && String(partes.at(-1)) === String(ref.token) && pai && typeof pai === 'object' && ref.token in pai) {
      // Chave de objeto (customfieldValues: { "201": "site" }): a chave ganha o nome ao lado.
      pai[`${ref.token} [${nome}]`] = pai[ref.token]
      delete pai[ref.token]
    } else if (ref.token && typeof atual === 'string') por(copia, partes, atual.split(ref.token).join(`${ref.token} [${nome}]`))
    else if (atual !== undefined && typeof atual !== 'object') por(copia, partes, nome.startsWith('#') ? `#${ref.id} (não achei na conta)` : `${nome} (#${ref.id})`)
  }
  return { copia, quebrados }
}

export function descrever(fluxo, { defs, gatilhos, nomes }) {
  const { copia, quebrados } = comNomes(fluxo, nomes)
  const nosOriginais = nosDoFluxo(fluxo)
  const nosComNome = new Map(nosDoFluxo(copia).map((no) => [no.id, no]))
  const { ordem, orfaos } = ordemDosNos(fluxo, defs)
  const numero = new Map([...ordem, ...orfaos].map((no, i) => [no.id, i + 1]))

  const passos = [...ordem, ...orfaos].map((no) => {
    const def = defs[no.type]
    const { saidas, soltas } = ligacoes(fluxo, no, def)
    const { label, triggers, ...dados } = nosComNome.get(no.id)?.data || {}
    return {
      n: numero.get(no.id),
      id: no.id,
      tipo: no.type,
      rotuloTipo: def?.label ?? no.type,
      categoria: def?.categoryLabel ?? def?.category ?? null,
      titulo: label ?? null,
      descricaoTipo: def?.description ?? null,
      dados: no.type === 'start' ? {} : dados,
      saidas: TERMINAIS.has(no.type)
        ? []
        : saidas.map((saida) => ({ handle: saida.handle, rotulo: saida.rotulo, motor: saida.motor, destinos: saida.destinos.map((id) => numero.get(id) ?? id) })),
      soltas: soltas.map((aresta) => ({ handle: aresta.sourceHandle ?? null, destino: numero.get(aresta.target) ?? aresta.target })),
      terminal: TERMINAIS.has(no.type),
      irPara: no.type === 'goto_node' ? numero.get(no.data?.targetNodeId) ?? no.data?.targetNodeId ?? null : null,
      orfao: orfaos.includes(no),
      desconhecido: !def,
    }
  })

  const start = nosOriginais.find((no) => no.type === 'start' || no.type === 'trigger')
  const startComNome = start ? nosComNome.get(start.id) : null
  const listaGatilhos = (startComNome?.data?.triggers || []).map((gatilho) => ({
    id: gatilho.id,
    tipo: gatilho.triggerType,
    rotulo: gatilhos[gatilho.triggerType]?.label ?? gatilho.triggerType,
    config: gatilho.triggerConfig ?? {},
  }))

  return {
    id: fluxo.id,
    nome: fluxo.name,
    status: fluxo.status,
    ligado: fluxo.status === 'active',
    versao: fluxo.flowDataVersion ?? null,
    publicadaUmaVez: fluxo.publishedVersion !== null && fluxo.publishedVersion !== undefined,
    gatilhos: listaGatilhos,
    passos,
    quebrados,
  }
}

const curto = (valor) => {
  const texto = JSON.stringify(valor)
  return texto.length > 400 ? `${texto.slice(0, 400)}…` : texto
}

// O texto que o Claude lê para explicar. Uma linha por passo, as saídas embaixo.
export function roteiro(descricao) {
  const linhas = [`FLUXO #${descricao.id} “${descricao.nome}” — ${descricao.ligado ? 'LIGADO' : 'desligado'}${descricao.versao ? `, versão ${descricao.versao === 'draft' ? 'RASCUNHO' : 'publicada'}` : ''}`, '']
  linhas.push('GATILHOS (o que faz o fluxo começar):')
  if (!descricao.gatilhos.length) linhas.push('  (nenhum)')
  for (const g of descricao.gatilhos) linhas.push(`  - ${g.rotulo} [${g.tipo}] ${Object.keys(g.config).length ? curto(g.config) : ''}`)
  linhas.push('', 'PASSOS:')
  for (const p of descricao.passos) {
    if (p.tipo === 'start') continue
    const marca = p.orfao ? ' (SOLTO: nenhum caminho chega aqui)' : ''
    linhas.push(`  ${p.n}. [${p.tipo}] ${p.rotuloTipo}${p.titulo ? ` — “${p.titulo}”` : ''}${marca}`)
    if (Object.keys(p.dados).length) linhas.push(`      config: ${curto(p.dados)}`)
    if (p.irPara) linhas.push(`      → volta para o passo ${p.irPara}`)
    if (p.tipo === 'start_flow') linhas.push('      → inicia o outro fluxo e este termina aqui')
    for (const s of p.saidas) {
      if (s.motor && !s.destinos.length) continue
      linhas.push(`      saída “${s.rotulo}” → ${s.destinos.length ? s.destinos.map((d) => `passo ${d}`).join(', ') : 'fim'}`)
    }
  }
  const inicio = descricao.passos.find((p) => p.tipo === 'start')
  if (inicio) {
    const primeiro = inicio.saidas.flatMap((s) => s.destinos)
    linhas.splice(linhas.indexOf('PASSOS:') + 1, 0, `  (o fluxo começa no passo ${primeiro.join(', ') || '— nenhum: o início não está ligado a nada'})`)
  }
  return linhas.join('\n')
}

// O que muda do publicado para o rascunho, em nós.
export function diferencas(antes, depois) {
  const mapa = (fluxo) => new Map(nosDoFluxo(fluxo).map((no) => [no.id, no]))
  const a = mapa(antes)
  const b = mapa(depois)
  const resumo = (no) => ({ id: no.id, tipo: no.type, titulo: no.data?.label ?? null })
  const adicionados = [...b.values()].filter((no) => !a.has(no.id)).map(resumo)
  const removidos = [...a.values()].filter((no) => !b.has(no.id)).map(resumo)
  const alterados = [...b.values()].filter((no) => a.has(no.id) && JSON.stringify(a.get(no.id).data ?? {}) !== JSON.stringify(no.data ?? {})).map(resumo)
  const chaveAresta = (e) => `${e.source}|${e.sourceHandle ?? ''}|${e.target}`
  const arestasA = new Set((antes.flowData?.edges || []).map(chaveAresta))
  const arestasB = new Set((depois.flowData?.edges || []).map(chaveAresta))
  const ligacoesMudaram = arestasA.size !== arestasB.size || [...arestasA].some((k) => !arestasB.has(k))
  return { adicionados, removidos, alterados, ligacoesMudaram, igual: !adicionados.length && !removidos.length && !alterados.length && !ligacoesMudaram }
}

// Refs de um fluxo que ainda não foi gravado (a prévia): o catálogo diz, em cada tipo de nó e de
// gatilho, que chave guarda ID de quê (`refs: [{ path: "stageId", kind: "stage" }]`). Cada nó usa só
// os refs do PRÓPRIO tipo: o `value` da condição não é o `value` de outro nó. IDs dentro de texto
// (chips, {{cf.deal.N}}) ficam de fora — só aparecem depois de gravar.
export function refsLocais(fluxo, defs, gatilhos) {
  const ultimaChave = (caminho) => String(caminho).replace(/\[\d+\]/g, '').split('.').filter((p) => !/^\d+$/.test(p)).at(-1)
  const chavesDe = (def) => new Map((def?.refs || []).filter((r) => ultimaChave(r.path)).map((r) => [ultimaChave(r.path), r.kind]))
  const refs = []
  const anda = (valor, caminho, chave, chaves) => {
    if (Array.isArray(valor)) return valor.forEach((v, i) => anda(v, `${caminho}[${i}]`, chave, chaves))
    if (valor && typeof valor === 'object') {
      for (const [k, v] of Object.entries(valor)) anda(v, /^[A-Za-z_$][\w$]*$/.test(k) ? `${caminho}.${k}` : `${caminho}["${k}"]`, k, chaves)
      return
    }
    if (chaves.has(chave) && (typeof valor === 'number' || /^\d+$/.test(String(valor ?? '')))) refs.push({ path: caminho, kind: chaves.get(chave), id: Number(valor) })
  }
  nosDoFluxo(fluxo).forEach((no, i) => {
    if (no.type === 'start' || no.type === 'trigger') {
      ;(no.data?.triggers || []).forEach((g, k) => anda(g.triggerConfig ?? {}, `flowData.nodes[${i}].data.triggers[${k}].triggerConfig`, null, chavesDe(gatilhos[g.triggerType])))
      return
    }
    anda(no.data ?? {}, `flowData.nodes[${i}].data`, null, chavesDe(defs[no.type]))
  })
  return refs
}
