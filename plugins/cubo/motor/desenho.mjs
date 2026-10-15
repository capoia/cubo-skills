// O desenho do fluxo em SVG, dentro da página (sem biblioteca, sem internet), com a cara do editor do
// Cubo: cada passo com o cabeçalho na cor e no ícone do tipo. O arranjo é sempre de cima para baixo, em
// camadas, e não as posições do editor: o editor espalha o fluxo para os lados e a página ficava
// mais larga que a tela, com setas cruzando os nós.
import { icone } from './icones.mjs'
import { corDoTipo, ehEntrada, iconeDoGatilho, iconeDoTipo } from './tipos.mjs'

const LARGURA = 240
const ALTURA = 66
const CABECA = 26
const ESPACO_X = 36
const ESPACO_Y = 52
const MARGEM = 24
const FAIXA = 14

export const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const corta = (texto, max) => (String(texto).length > max ? `${String(texto).slice(0, max - 1)}…` : String(texto))

// As saídas que aparecem no desenho: as de quem desenha o fluxo, e as do motor só quando levam a algum lugar.
const saidasVisiveis = (passo) => passo.saidas.filter((s) => !s.motor || s.destinos.length)

// As ligações de cada passo, com a posição de cada saída na base do nó.
function ligacoes(descricao, existe) {
  const lista = []
  for (const passo of descricao.passos) {
    const saidas = saidasVisiveis(passo)
    // Com um caminho só de verdade, ele sai do meio (linha reta) e os "fim" ficam à direita.
    const comDestino = saidas.filter((s) => s.destinos.length).length
    saidas.forEach((s, i) => {
      const x = comDestino === 1 && saidas.length > 1 ? (s.destinos.length ? LARGURA / 2 : LARGURA - 34) : (LARGURA * (i + 1)) / (saidas.length + 1)
      const rotulo = saidas.length > 1 || s.handle !== null ? s.rotulo : ''
      if (!s.destinos.length && !passo.irPara) lista.push({ de: passo.n, para: null, x, rotulo: saidas.length > 1 ? `${s.rotulo} · fim` : 'fim', ordem: i })
      for (const d of s.destinos) if (existe(d)) lista.push({ de: passo.n, para: d, x, rotulo, especial: s.motor, ordem: i })
    })
    if (passo.irPara && existe(passo.irPara)) lista.push({ de: passo.n, para: passo.irPara, x: LARGURA / 2, rotulo: 'vai para', tracejada: true, ordem: saidas.length })
  }
  return lista
}

// Camadas pelo caminho mais longo, sem contar as voltas (ligação para um passo de antes). O que nasce da
// entrada vem primeiro; o que nada alcança (passo solto e o que vem dele) fica embaixo, à parte.
export function arranjo(descricao) {
  const numeros = descricao.passos.map((p) => p.n)
  const existe = (n) => numeros.includes(n)
  const todas = ligacoes(descricao, existe)
  const reais = todas.filter((l) => l.para !== null)
  const filhos = new Map(numeros.map((n) => [n, reais.filter((l) => l.de === n)]))
  const chegam = new Set(reais.map((l) => l.para))
  const raizes = [...descricao.passos.filter((p) => ehEntrada(p.tipo)).map((p) => p.n), ...numeros.filter((n) => !chegam.has(n))]

  // Busca em profundidade: marca as voltas e guarda a ordem para as camadas.
  const estado = new Map()
  const posOrdem = []
  const voltas = new Set()
  const visita = (n) => {
    estado.set(n, 1)
    for (const l of filhos.get(n)) {
      if (estado.get(l.para) === 1) voltas.add(l)
      else if (!estado.has(l.para)) visita(l.para)
    }
    estado.set(n, 2)
    posOrdem.push(n)
  }
  for (const n of [...raizes, ...numeros]) if (!estado.has(n)) visita(n)

  const entradas = descricao.passos.filter((p) => ehEntrada(p.tipo)).map((p) => p.n)
  const alcancados = new Set(entradas)
  for (const fila = [...entradas]; fila.length; ) for (const l of filhos.get(fila.shift())) if (!alcancados.has(l.para)) alcancados.add(l.para), fila.push(l.para)
  const principal = (n) => !entradas.length || alcancados.has(n)

  const camada = new Map(numeros.map((n) => [n, 0]))
  for (const n of posOrdem.reverse()) for (const l of filhos.get(n)) if (!voltas.has(l) && principal(l.de) === principal(l.para)) camada.set(l.para, Math.max(camada.get(l.para), camada.get(n) + 1))
  const fundo = Math.max(...numeros.filter(principal).map((n) => camada.get(n))) + 1
  for (const n of numeros) if (!principal(n)) camada.set(n, camada.get(n) + fundo)

  // Em cada camada, o passo fica embaixo de quem leva a ele; irmãos lado a lado, na ordem das saídas.
  const centro = new Map()
  const totalCamadas = Math.max(...camada.values()) + 1
  let proximaRaiz = 0
  for (let c = 0; c < totalCamadas; c++) {
    const daCamada = posOrdem.filter((n) => camada.get(n) === c)
    const ideal = daCamada.map((n) => {
      const pais = reais.filter((l) => l.para === n && !voltas.has(l) && centro.has(l.de))
      if (!pais.length) return { n, alvo: (proximaRaiz++) * (LARGURA + ESPACO_X), ordem: 0 }
      return { n, alvo: pais.reduce((s, l) => s + centro.get(l.de), 0) / pais.length, ordem: pais[0].ordem }
    })
    ideal.sort((a, b) => a.alvo - b.alvo || a.ordem - b.ordem)
    // Quem mira o mesmo ponto se divide em volta dele; depois, ninguém encosta em ninguém.
    let i = 0
    let direita = -Infinity
    while (i < ideal.length) {
      let j = i
      while (j + 1 < ideal.length && Math.abs(ideal[j + 1].alvo - ideal[i].alvo) < 1) j++
      const grupo = ideal.slice(i, j + 1)
      const largura = grupo.length * LARGURA + (grupo.length - 1) * ESPACO_X
      let x = Math.max(ideal[i].alvo - largura / 2 + LARGURA / 2, direita + ESPACO_X + LARGURA / 2)
      for (const item of grupo) {
        centro.set(item.n, x)
        x += LARGURA + ESPACO_X
      }
      direita = x - ESPACO_X - LARGURA / 2
      i = j + 1
    }
  }
  const menor = Math.min(...centro.values()) - LARGURA / 2
  const posicoes = new Map(numeros.map((n) => [n, { x: centro.get(n) - LARGURA / 2 - menor + MARGEM, y: camada.get(n) * (ALTURA + ESPACO_Y) + MARGEM, camada: camada.get(n) }]))
  return { posicoes, ligacoes: todas, voltas }
}

// Caminho em ângulos retos com cantos arredondados.
function caminho(pontos) {
  const r = 6
  let d = `M${pontos[0][0]},${pontos[0][1]}`
  for (let i = 1; i < pontos.length - 1; i++) {
    const [ax, ay] = pontos[i - 1]
    const [bx, by] = pontos[i]
    const [cx, cy] = pontos[i + 1]
    const r1 = Math.min(r, Math.hypot(bx - ax, by - ay) / 2, Math.hypot(cx - bx, cy - by) / 2)
    const antes = [bx - Math.sign(bx - ax) * r1, by - Math.sign(by - ay) * r1]
    const depois = [bx + Math.sign(cx - bx) * r1, by + Math.sign(cy - by) * r1]
    d += ` L${antes[0]},${antes[1]} Q${bx},${by} ${depois[0]},${depois[1]}`
  }
  const ultimo = pontos[pontos.length - 1]
  return `${d} L${ultimo[0]},${ultimo[1]}`
}

const larguraDoRotulo = (texto) => Math.ceil(String(texto).length * 6.2) + 14

function rotulo(x, y, texto, classe = '') {
  const l = larguraDoRotulo(texto)
  return `<g class="rotulo${classe ? ` ${classe}` : ''}" transform="translate(${x - l / 2},${y - 9})"><rect width="${l}" height="18" rx="9"/><text x="${l / 2}" y="13" text-anchor="middle">${esc(texto)}</text></g>`
}

// descricao: saída do `descrever`; problemas: Set com o id dos passos que têm erro ou aviso.
export function desenho(descricao, problemas = new Set()) {
  if (!descricao.passos.length) return '<p class="vazio">Fluxo vazio.</p>'
  const { posicoes, ligacoes: lista, voltas } = arranjo(descricao)
  const direitaAte = (c1, c2) => Math.max(...[...posicoes.values()].filter((p) => p.camada >= c1 && p.camada <= c2).map((p) => p.x + LARGURA))
  let faixas = 0

  const linhas = []
  const rotulos = []
  const abaixo = []
  for (const l of lista) {
    const de = posicoes.get(l.de)
    const x1 = de.x + l.x
    const y1 = de.y + ALTURA
    if (l.para === null) {
      linhas.push(`<path class="aresta fim" d="M${x1},${y1} V${y1 + 6}"/>`)
      abaixo.push({ de: l.de, x: x1, y: y1 + 14, texto: l.rotulo, classe: 'fim' })
      continue
    }
    const para = posicoes.get(l.para)
    const classe = `aresta${l.tracejada ? ' tracejada' : ''}${l.especial ? ' especial' : ''}${voltas.has(l) ? ' volta' : ''}`
    let pontos
    if (voltas.has(l) || para.camada <= de.camada) {
      // Volta: sai por baixo, vai até uma faixa à direita, sobe e entra pela direita do passo de destino.
      const faixa = direitaAte(para.camada, de.camada) + 18 + FAIXA * faixas++
      const baixo = y1 + ESPACO_Y / 2
      pontos = [[x1, y1], [x1, baixo], [faixa, baixo], [faixa, para.y + ALTURA / 2], [para.x + LARGURA + 2, para.y + ALTURA / 2]]
    } else {
      const x2 = para.x + LARGURA / 2
      const y2 = para.y - 2
      const meio = para.y - ESPACO_Y / 2
      if (para.camada - de.camada > 1) {
        // Salto de várias camadas: desvia por uma faixa à direita para não passar por cima de ninguém.
        const faixa = direitaAte(de.camada + 1, para.camada - 1) + 18 + FAIXA * faixas++
        const saida = y1 + ESPACO_Y / 2
        pontos = [[x1, y1], [x1, saida], [faixa, saida], [faixa, meio], [x2, meio], [x2, y2]]
      } else pontos = x1 === x2 ? [[x1, y1], [x2, y2]] : [[x1, y1], [x1, meio], [x2, meio], [x2, y2]]
    }
    linhas.push(`<path class="${classe}" d="${caminho(pontos)}" marker-end="url(#seta)"/>`)
    if (l.rotulo) abaixo.push({ de: l.de, x: x1, y: y1 + 14, texto: l.rotulo })
  }

  // Os rótulos embaixo de um passo ficam numa linha só, sem encostar um no outro.
  for (const n of new Set(abaixo.map((r) => r.de))) {
    let direita = -Infinity
    for (const r of abaixo.filter((r) => r.de === n).sort((a, b) => a.x - b.x)) {
      const l = larguraDoRotulo(r.texto)
      const x = Math.max(r.x, direita + 4 + l / 2)
      rotulos.push(rotulo(x, r.y, r.texto, r.classe))
      direita = x + l / 2
    }
  }

  const caixas = descricao.passos.map((passo) => {
    const { x, y } = posicoes.get(passo.n)
    const entrada = ehEntrada(passo.tipo)
    const classe = ['no', problemas.has(passo.id) ? 'problema' : '', passo.orfao ? 'orfao' : ''].filter(Boolean).join(' ')
    const tipo = passo.tipo === 'start' ? 'Início' : passo.rotuloTipo
    const gatilhos = descricao.gatilhos.map((g) => g.rotulo).join(', ')
    const titulo = entrada ? gatilhos || passo.titulo || 'sem gatilho' : passo.titulo || passo.rotuloTipo
    const simbolo = entrada && descricao.gatilhos.length === 1 && passo.tipo === 'trigger' ? iconeDoGatilho(descricao.gatilhos[0].tipo) : iconeDoTipo(passo.tipo)
    const alerta = problemas.has(passo.id) ? `<g class="alerta" transform="translate(${LARGURA - 9},-9)"><circle r="9" cx="9" cy="9"/><text x="9" y="13.5" text-anchor="middle">!</text></g>` : ''
    return `<g class="${classe}" transform="translate(${x},${y})"><a href="#passo-${passo.n}"><title>${esc(`${passo.n}. ${titulo}`)}</title><rect class="corpo" width="${LARGURA}" height="${ALTURA}" rx="8"/><path class="cabeca" style="fill:${corDoTipo(passo.tipo)}" d="M0,8 a8,8 0 0 1 8,-8 h${LARGURA - 16} a8,8 0 0 1 8,8 v${CABECA - 8} h-${LARGURA} z"/><g transform="translate(10,6)" class="ic-no">${icone(simbolo, { tamanho: 14 })}</g><text class="tipo" x="30" y="17.5">${esc(corta(tipo, 26))}</text>${entrada ? '' : `<text class="num" x="${LARGURA - 10}" y="17.5" text-anchor="end">${passo.n}</text>`}<text class="titulo" x="12" y="${CABECA + 25}">${esc(corta(titulo, 34))}</text></a>${alerta}</g>`
  })

  const xs = [...posicoes.values()].map((p) => p.x + LARGURA)
  const ys = [...posicoes.values()].map((p) => p.y + ALTURA)
  const largura = Math.ceil(Math.max(...xs) + MARGEM + 18 + FAIXA * faixas)
  const altura = Math.ceil(Math.max(...ys) + MARGEM + 40)
  return `<svg class="desenho" viewBox="0 0 ${largura} ${altura}" width="${largura}" height="${altura}" role="img" aria-label="Desenho do fluxo"><defs><marker id="seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="ponta"/></marker></defs>${linhas.join('')}${caixas.join('')}${rotulos.join('')}</svg>`
}
