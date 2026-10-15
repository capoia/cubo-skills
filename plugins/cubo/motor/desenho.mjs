// O desenho do fluxo em SVG, dentro da página (sem biblioteca, sem internet). Usa as posições do
// editor do Cubo quando todos os nós têm; senão, arruma em camadas a partir do início.
const LARGURA = 220
const ALTURA = 58
const ESPACO_X = 50
const ESPACO_Y = 70

export const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const corta = (texto, max) => (String(texto).length > max ? `${String(texto).slice(0, max - 1)}…` : String(texto))

// Camadas: profundidade pelo caminho mais curto a partir do início; órfãos numa camada no fim.
export function posicoesEmCamadas(descricao) {
  const porNumero = new Map(descricao.passos.map((p) => [p.n, p]))
  const camada = new Map()
  const inicio = descricao.passos.find((p) => p.tipo === 'start')
  const fila = inicio ? [[inicio.n, 0]] : []
  while (fila.length) {
    const [n, c] = fila.shift()
    if (camada.has(n)) continue
    camada.set(n, c)
    const passo = porNumero.get(n)
    for (const s of passo?.saidas || []) for (const d of s.destinos) if (typeof d === 'number') fila.push([d, c + 1])
  }
  const ultima = Math.max(0, ...camada.values()) + 1
  for (const p of descricao.passos) if (!camada.has(p.n)) camada.set(p.n, ultima)
  const porCamada = new Map()
  for (const p of descricao.passos) {
    const c = camada.get(p.n)
    if (!porCamada.has(c)) porCamada.set(c, [])
    porCamada.get(c).push(p.n)
  }
  const largest = Math.max(...[...porCamada.values()].map((l) => l.length))
  const posicoes = new Map()
  for (const [c, lista] of porCamada) {
    const deslocamento = ((largest - lista.length) * (LARGURA + ESPACO_X)) / 2
    lista.forEach((n, i) => posicoes.set(n, { x: deslocamento + i * (LARGURA + ESPACO_X), y: c * (ALTURA + ESPACO_Y) }))
  }
  return posicoes
}

function posicoesDoEditor(descricao, nos) {
  const porId = new Map(nos.map((no) => [no.id, no]))
  const posicoes = new Map()
  for (const p of descricao.passos) {
    const pos = porId.get(p.id)?.position
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return null
    posicoes.set(p.n, { x: pos.x, y: pos.y })
  }
  // O editor pode encostar nós: se dois se sobrepõem muito, as camadas ficam mais legíveis.
  const lista = [...posicoes.values()]
  for (let i = 0; i < lista.length; i++) for (let j = i + 1; j < lista.length; j++) if (Math.abs(lista[i].x - lista[j].x) < LARGURA * 0.6 && Math.abs(lista[i].y - lista[j].y) < ALTURA * 0.6) return null
  return posicoes
}

// descricao: saída do `descrever`; nos: os nós originais (para a posição); problemas: Set de ids.
export function desenho(descricao, nos = [], problemas = new Set()) {
  if (!descricao.passos.length) return '<p class="vazio">Fluxo vazio.</p>'
  const posicoes = posicoesDoEditor(descricao, nos) || posicoesEmCamadas(descricao)
  const xs = [...posicoes.values()].map((p) => p.x)
  const ys = [...posicoes.values()].map((p) => p.y)
  const minX = Math.min(...xs) - 20
  const minY = Math.min(...ys) - 20
  const largura = Math.max(...xs) - minX + LARGURA + 20
  const altura = Math.max(...ys) - minY + ALTURA + 20
  const centro = (n) => {
    const p = posicoes.get(n)
    return { x: p.x - minX, y: p.y - minY }
  }

  const linhas = []
  for (const passo of descricao.passos) {
    const de = centro(passo.n)
    const ligacoes = [...passo.saidas.flatMap((s) => s.destinos.map((d) => ({ d, rotulo: s.handle === null ? '' : s.rotulo, especial: s.motor }))), ...(passo.irPara ? [{ d: passo.irPara, rotulo: 'vai para', tracejada: true }] : [])]
    for (const ligacao of ligacoes) {
      if (!posicoes.has(ligacao.d)) continue
      const para = centro(ligacao.d)
      const x1 = de.x + LARGURA / 2
      const y1 = de.y + ALTURA
      const x2 = para.x + LARGURA / 2
      const y2 = para.y
      const meio = (y1 + y2) / 2
      const caminho = y2 > y1 ? `M${x1},${y1} C${x1},${meio} ${x2},${meio} ${x2},${y2}` : `M${x1},${y1} C${x1},${y1 + 60} ${x2 + LARGURA * 0.7},${y2 - 60} ${x2},${y2}`
      linhas.push(`<path class="aresta${ligacao.tracejada ? ' tracejada' : ''}${ligacao.especial ? ' especial' : ''}" d="${caminho}" marker-end="url(#seta)"/>`)
      if (ligacao.rotulo) linhas.push(`<text class="rotulo-aresta" x="${(x1 + x2) / 2}" y="${meio - 4}" text-anchor="middle">${esc(corta(ligacao.rotulo, 26))}</text>`)
    }
  }
  const caixas = descricao.passos.map((passo) => {
    const { x, y } = centro(passo.n)
    const classe = ['no', passo.tipo === 'start' ? 'inicio' : '', problemas.has(passo.id) ? 'problema' : '', passo.orfao ? 'orfao' : ''].filter(Boolean).join(' ')
    const titulo = passo.tipo === 'start' ? 'Início' : `${passo.n}. ${passo.rotuloTipo}`
    const sub = passo.tipo === 'start' ? descricao.gatilhos.map((g) => g.rotulo).join(', ') || 'sem gatilho' : passo.titulo || ''
    return `<g class="${classe}" transform="translate(${x},${y})"><a href="#passo-${passo.n}"><rect width="${LARGURA}" height="${ALTURA}" rx="10"/><text x="12" y="23" class="t1">${esc(corta(titulo, 30))}</text><text x="12" y="43" class="t2">${esc(corta(sub, 34))}</text></a></g>`
  })
  return `<svg class="desenho" viewBox="0 0 ${Math.ceil(largura)} ${Math.ceil(altura)}" width="${Math.ceil(largura)}" height="${Math.ceil(altura)}" role="img" aria-label="Desenho do fluxo"><defs><marker id="seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ponta"/></marker></defs>${linhas.join('')}${caixas.join('')}</svg>`
}
