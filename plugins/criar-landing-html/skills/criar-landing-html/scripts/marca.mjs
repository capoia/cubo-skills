#!/usr/bin/env node
// Raio-x da marca: abre as páginas que o cliente já tem (site, landing atual, loja) num navegador de
// verdade, tira capturas e mede o que está NA TELA — cor ponderada pela área que ocupa, fonte pelo
// texto que carrega, logotipo, fotos e textos.
//
// Ler o CSS não basta: a landing da RD Station carrega 19 fontes e dezenas de cinzas do próprio
// framework, e a cor da marca some no meio. A captura é o que o Claude olha; os números confirmam.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { abrirNavegador, argumentos, falha } from './lib.mjs'
import { medirSistema } from './sistema.mjs'

const { posicionais, opcoes } = argumentos()
if (!posicionais.length) {
  console.log(`uso: marca.mjs <url> [<url> ...] [--pasta=marca]

Para cada endereço grava, em <pasta>/<site>/:
  desktop-topo.jpg     o que aparece sem rolar, no computador
  desktop-pagina.jpg   a página inteira (cortada em 7000px)
  celular-topo.jpg     o que aparece sem rolar, no celular
  celular-pagina.jpg   a página inteira no celular
  marca.json           cores, fontes, logotipo, imagens e textos medidos

Depois, OLHE as capturas: é nelas que aparece o que nenhum número mostra (um formato de foto, um
ornamento, o jeito de usar a cor).`)
  process.exit(2)
}

const PASTA = resolve(opcoes.pasta || 'marca')
const ALTURA_MAXIMA = 7000

// Banner de cookies cobre metade da captura (o Cookiebot da Girbau cobria o topo inteiro) e a
// comparação com a landing vira comparação com um pop-up. Some antes de medir e de capturar.
async function tirarAvisoDeCookies(pagina) {
  await pagina.evaluate(() => {
    const conhecidos = '#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, #onetrust-consent-sdk, #onetrust-banner-sdk, .cky-consent-container, .cky-overlay, #cookie-law-info-bar, .cc-window, #usercentrics-root, .cmplz-cookiebanner, #cookiescript_injected, #moove_gdpr_cookie_info_bar, .adopt-c-cMUDrl'
    document.querySelectorAll(conhecidos).forEach((el) => el.remove())
    const tela = window.innerWidth * window.innerHeight
    for (const el of document.querySelectorAll('body *')) {
      const e = getComputedStyle(el)
      if (!/fixed|sticky/.test(e.position)) continue
      const c = el.getBoundingClientRect()
      if (c.width * c.height < tela * 0.06 || el.querySelector('nav')) continue
      if (/cookie|consentimento|consent|lgpd|dados pessoais|privacidade/i.test(el.innerText || '')) el.remove()
    }
    for (const raiz of [document.documentElement, document.body]) raiz.style.setProperty('overflow', 'auto', 'important')
  }).catch(() => {})
}

async function carregar(pagina, url) {
  await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  // Página de construtor (RD Station, Wix, Elementor) raramente chega ao "load" em tempo útil:
  // esperar por ele trava. Damos um prazo e seguimos com o que já desenhou.
  await pagina.waitForLoadState('load', { timeout: 10_000 }).catch(() => {})
  await pagina.waitForTimeout(800)
  await tirarAvisoDeCookies(pagina)
  // Antes de rolar, anota como está o que ainda não apareceu: depois de rolar dá para ver quem
  // chegou animando (opacidade, deslocamento) e como — é o jeito de se mexer do site.
  await pagina.evaluate(() => {
    let n = 0
    for (const el of document.querySelectorAll('body *')) {
      const c = el.getBoundingClientRect()
      if (c.top < window.innerHeight || c.width < 40 || c.height < 20 || n > 3000) continue
      const e = getComputedStyle(el)
      el.dataset.rxAntes = `${e.opacity}|${e.transform}|${el.className && typeof el.className === 'string' ? el.className : ''}`
      n++
    }
  }).catch(() => {})
  await pagina.evaluate(async () => {
    const passo = Math.max(400, Math.floor(window.innerHeight * 0.8))
    for (let y = 0; y < Math.min(document.body.scrollHeight, 14000); y += passo) {
      window.scrollTo(0, y)
      await new Promise((pronto) => setTimeout(pronto, 120))
    }
    window.scrollTo(0, 0)
  })
  await pagina.waitForTimeout(1200)
}

async function capturar(pagina, destino, prefixo) {
  await tirarAvisoDeCookies(pagina)
  await pagina.screenshot({ path: join(destino, `${prefixo}-topo.jpg`), type: 'jpeg', quality: 72, timeout: 30_000 })
  const altura = await pagina.evaluate(() => document.documentElement.scrollHeight)
  const largura = pagina.viewportSize().width
  await pagina.screenshot({
    path: join(destino, `${prefixo}-pagina.jpg`),
    type: 'jpeg',
    quality: 60,
    fullPage: true,
    clip: { x: 0, y: 0, width: largura, height: Math.min(altura, ALTURA_MAXIMA) },
    timeout: 60_000,
  })
}

// Roda dentro da página. Não pode usar nada de fora desta função.
function medir() {
  const paraHex = (cor) => {
    const partes = cor.match(/[\d.]+/g)
    if (!partes || partes.length < 3) return null
    if (partes.length >= 4 && Number(partes[3]) < 0.6) return null
    return '#' + partes.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('')
  }
  const soma = (mapa, chave, peso) => chave && mapa.set(chave, (mapa.get(chave) || 0) + peso)
  const visivel = (el, estilo, caixa) =>
    caixa.width > 0 && caixa.height > 0 && estilo.visibility !== 'hidden' && estilo.display !== 'none' && Number(estilo.opacity) > 0.1

  const fundos = new Map()
  const textos = new Map()
  const acoes = new Map()
  const fontesTitulo = new Map()
  const fontesTexto = new Map()
  const larguraPagina = document.documentElement.clientWidth
  const alturaPagina = Math.min(document.documentElement.scrollHeight, 14000)

  // `html` e `body` entram: é neles que muito site põe a cor base, e ela sumiria da contagem.
  for (const el of [document.documentElement, document.body, ...document.body.querySelectorAll('*')]) {
    const estilo = getComputedStyle(el)
    const caixa = el.getBoundingClientRect()
    if (!visivel(el, estilo, caixa)) continue
    const topo = caixa.top + window.scrollY
    if (topo > alturaPagina) continue

    const area = Math.min(caixa.width, larguraPagina) * Math.min(caixa.height, alturaPagina)
    soma(fundos, paraHex(estilo.backgroundColor), area)

    const textoProprio = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ')
    if (textoProprio.length < 2) continue
    soma(textos, paraHex(estilo.color), textoProprio.length)
    const familia = estilo.fontFamily.split(',')[0].replace(/["']/g, '').trim()
    const titulo = /^H[1-3]$/.test(el.tagName) || parseFloat(estilo.fontSize) >= 26
    soma(titulo ? fontesTitulo : fontesTexto, `${familia} ${estilo.fontWeight}`, textoProprio.length)

    const clicavel = el.closest('a, button, [role="button"], input[type="submit"]')
    if (clicavel) {
      const cor = paraHex(getComputedStyle(clicavel).backgroundColor)
      soma(acoes, cor, 1)
    }
  }

  const ordena = (mapa, total, quantos) => {
    const soma = total ?? [...mapa.values()].reduce((a, b) => a + b, 0)
    return [...mapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, quantos)
      .map(([valor, peso]) => ({ valor, parte: `${Math.round((peso / soma) * 1000) / 10}%` }))
  }

  const absoluta = (url) => {
    try {
      return new URL(url, location.href).href
    } catch {
      return null
    }
  }

  const imagens = []
  const vistas = new Set()
  for (const img of document.images) {
    const src = absoluta(img.currentSrc || img.src)
    if (!src || src.startsWith('data:') || vistas.has(src)) continue
    if (img.naturalWidth < 280 && img.naturalHeight < 280) continue
    vistas.add(src)
    imagens.push({ src, alt: img.alt || '', largura: img.naturalWidth, altura: img.naturalHeight })
  }
  // Construtor costuma pôr um degradê por cima da foto: `linear-gradient(...), url(...)`.
  for (const el of document.body.querySelectorAll('*')) {
    const caixa = el.getBoundingClientRect()
    if (caixa.width < 280 || caixa.height < 200) continue
    for (const [, , bruta] of getComputedStyle(el).backgroundImage.matchAll(/url\((["']?)(.*?)\1\)/g)) {
      const src = absoluta(bruta)
      if (!src || src.startsWith('data:') || vistas.has(src)) continue
      vistas.add(src)
      imagens.push({ src, alt: '(fundo de seção)', largura: Math.round(caixa.width), altura: Math.round(caixa.height) })
    }
  }

  const cabecalho = (el) => el.closest('header, nav, [class*="header" i], [id*="header" i]') || el.getBoundingClientRect().top + window.scrollY < 220
  const logotipos = []
  for (const el of document.querySelectorAll('img, svg')) {
    const pista = `${el.getAttribute('src') || ''} ${el.getAttribute('alt') || ''} ${el.getAttribute('class') || ''} ${el.id || ''} ${el.closest('a')?.getAttribute('href') || ''}`.toLowerCase()
    const parecido = /logo|marca|brand/.test(pista) || (cabecalho(el) && /^(\/|https?:\/\/[^/]+\/?)$/.test(el.closest('a')?.getAttribute('href') || '-'))
    if (!parecido || !cabecalho(el)) continue
    if (el.tagName === 'IMG') logotipos.push({ tipo: 'imagem', src: absoluta(el.currentSrc || el.src) })
    if (el.tagName.toLowerCase() === 'svg') logotipos.push({ tipo: 'svg', svg: el.outerHTML.slice(0, 60000) })
    if (logotipos.length >= 3) break
  }
  if (!logotipos.length) {
    const noTopo = [...document.images].find((img) => {
      const caixa = img.getBoundingClientRect()
      return caixa.top + window.scrollY < 300 && caixa.width > 40 && caixa.width < 600
    })
    if (noTopo) logotipos.push({ tipo: 'imagem', src: absoluta(noTopo.currentSrc || noTopo.src), palpite: 'primeira imagem do topo — confirme na captura' })
  }

  // Vídeo próprio do cliente (fundo do topo, institucional) é matéria-prima: o video.mjs aceita o endereço.
  const videos = [...document.querySelectorAll('video')]
    .map((v) => ({ src: absoluta(v.currentSrc || v.getAttribute('src') || v.querySelector('source')?.getAttribute('src') || ''), poster: absoluta(v.poster || '') || '' }))
    .filter((v) => v.src && !v.src.startsWith('blob:'))
  for (const quadro of document.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"]')) videos.push({ src: absoluta(quadro.src), poster: '' })

  // A matéria-prima rica (linha de produtos com dados, cases, galeria) quase nunca está na home:
  // as páginas internas são o próximo passo do raio-x (riqueza.md).
  const PISTAS = /produt|solu[cç]|servi[cç]|equipament|linha|modelo|cat[aá]logo|portf|case|cliente|depoiment|galeria|projeto|obra|loja|unidade|sobre|quem-somos|hist[oó]ria|tratament|plano|curso|product|service|gallery|about/i
  const paginas = [...document.querySelectorAll('a[href]')]
    .map((a) => ({ url: absoluta(a.getAttribute('href')), texto: a.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) }))
    .filter((p) => p.url && p.url.startsWith(location.origin) && !/#|\.(pdf|jpe?g|png|webp|zip)$/i.test(p.url) && p.url.replace(/\/$/, '') !== location.href.replace(/\/$/, ''))
    .filter((p) => PISTAS.test(`${p.url} ${p.texto}`))
    .filter((p, i, lista) => lista.findIndex((o) => o.url === p.url) === i)
    .slice(0, 20)

  const meta = (nome) => document.querySelector(`meta[property="${nome}"], meta[name="${nome}"]`)?.content || ''
  const textoDe = (seletor, limite) => [...document.querySelectorAll(seletor)]
    .map((el) => el.innerText.replace(/\s+/g, ' ').trim())
    .filter((t) => t.length > 1)
    .filter((t, i, lista) => lista.indexOf(t) === i)
    .slice(0, limite)

  return {
    titulo: document.title,
    descricao: meta('description') || meta('og:description'),
    imagemCompartilhamento: absoluta(meta('og:image')) || '',
    corDoTema: meta('theme-color'),
    favicon: absoluta(document.querySelector('link[rel~="icon"]')?.getAttribute('href') || '') || '',
    fundos: ordena(fundos, null, 8),
    textos: ordena(textos, null, 6),
    botoes: ordena(acoes, null, 4),
    fontesTitulo: ordena(fontesTitulo, null, 4),
    fontesTexto: ordena(fontesTexto, null, 4),
    logotipos,
    videos: videos.slice(0, 10),
    paginas,
    imagens: [...imagens.filter((i) => i.alt === '(fundo de seção)'), ...imagens.filter((i) => i.alt !== '(fundo de seção)')].slice(0, 60),
    titulos: textoDe('h1, h2, h3', 40),
    chamadas: textoDe('a[class*="btn" i], a[class*="button" i], button, [role="button"]', 20),
    paragrafos: textoDe('p', 40).filter((t) => t.length > 40),
  }
}


// Roda dentro da página, depois de rolar: quem estava escondido ou deslocado antes e agora está no
// lugar chegou animando. Devolve quantos, o efeito, a duração e a classe que o script do site põe.
function medirChegada() {
  const achados = []
  const classesNovas = new Map()
  for (const el of document.querySelectorAll('[data-rx-antes]')) {
    const [opacidade, transformacao, classes] = el.dataset.rxAntes.split('|')
    const e = getComputedStyle(el)
    const sumiu = Number(opacidade) < 0.9 && Number(e.opacity) > Number(opacidade)
    const moveu = transformacao !== 'none' && transformacao !== e.transform
    if (!sumiu && !moveu) continue
    if (el.parentElement?.closest('[data-rx-chegou]')) continue
    el.dataset.rxChegou = '1'
    const antes = new Set(classes.split(/\s+/))
    for (const nova of (typeof el.className === 'string' ? el.className : '').split(/\s+/)) if (nova && !antes.has(nova)) classesNovas.set(nova, (classesNovas.get(nova) || 0) + 1)
    const m = transformacao.match(/matrix\(([^)]+)\)/)
    const partes = m ? m[1].split(',').map(Number) : []
    const desloc = partes.length === 6 ? `${partes[5] ? `sobe ${Math.round(partes[5])}px` : ''}${partes[4] ? ` desliza ${Math.round(partes[4])}px` : ''}${partes[0] && partes[0] !== 1 ? ` escala ${partes[0].toFixed(2)}` : ''}`.trim() : ''
    achados.push(`${sumiu ? 'aparece' : ''}${sumiu && desloc ? ' e ' : ''}${desloc}`.trim() + ` em ${e.transitionDuration !== '0s' ? e.transitionDuration : e.animationDuration} ${e.transitionDuration !== '0s' ? e.transitionTimingFunction : e.animationName}`)
  }
  const tipos = new Map()
  for (const a of achados) tipos.set(a, (tipos.get(a) || 0) + 1)
  return {
    elementos: achados.length,
    efeitos: [...tipos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${v} (${n}×)`),
    classe: [...classesNovas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v),
  }
}

const { navegador, qual } = await abrirNavegador()
console.log(`navegador: ${qual}`)
const resumo = []

for (const url of posicionais) {
  const nome = new URL(url).hostname.replace(/^www\./, '') + new URL(url).pathname.replace(/\/+$/, '').replace(/[^a-z0-9]+/gi, '-')
  const destino = join(PASTA, nome.replace(/-+$/, ''))
  mkdirSync(destino, { recursive: true })
  console.log(`\n→ ${url}`)

  try {
    const desktop = await navegador.newPage({ viewport: { width: 1366, height: 860 } })
    await carregar(desktop, url)
    const medidas = await desktop.evaluate(medir)
    medidas.sistema = await desktop.evaluate(medirSistema)
    medidas.sistema.chegada = await desktop.evaluate(medirChegada)
    await capturar(desktop, destino, 'desktop')
    await desktop.close()

    const celular = await navegador.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    await carregar(celular, url)
    await capturar(celular, destino, 'celular')
    await celular.close()

    medidas.logotipos.forEach((logo, indice) => {
      if (logo.tipo !== 'svg') return
      writeFileSync(join(destino, `logotipo-${indice + 1}.svg`), logo.svg)
      logo.arquivo = join(destino, `logotipo-${indice + 1}.svg`)
      delete logo.svg
    })
    writeFileSync(join(destino, 'marca.json'), JSON.stringify({ url, ...medidas }, null, 2))

    const lista = (itens) => itens.map((i) => `${i.valor} (${i.parte})`).join(', ') || '—'
    console.log(`  título:          ${medidas.titulo || '—'}`)
    console.log(`  fundos:          ${lista(medidas.fundos)}`)
    console.log(`  texto:           ${lista(medidas.textos)}`)
    console.log(`  botões:          ${lista(medidas.botoes)}`)
    console.log(`  fonte de título: ${lista(medidas.fontesTitulo)}`)
    console.log(`  fonte de texto:  ${lista(medidas.fontesTexto)}`)
    const nomeDoLogo = (l) => (l.src?.startsWith('data:') ? `(imagem embutida na página, ${Math.round(l.src.length / 1365)} KB — está no marca.json)` : l.src || l.arquivo)
    console.log(`  logotipo:        ${[...new Set(medidas.logotipos.map(nomeDoLogo))].join(' | ') || 'não achei — procure na captura'}`)
    console.log(`  imagens grandes: ${medidas.imagens.length}`)
    if (medidas.videos.length) console.log(`  vídeos:          ${medidas.videos.map((v) => v.src).slice(0, 3).join(' | ')}`)
    if (medidas.paginas.length) console.log(`  páginas internas com matéria-prima (rode o marca.mjs nelas também):\n${medidas.paginas.slice(0, 12).map((p) => `    ${p.url}${p.texto ? `  (${p.texto})` : ''}`).join('\n')}`)
    const si = medidas.sistema
    const junta = (lista) => lista.join(' · ') || '—'
    console.log('  o jeito do site (é isto que a landing herda — references/marca.md, "o sistema do site"):')
    console.log(`    cantos:        botão ${junta(si.raio.botao)} | cartão ${junta(si.raio.cartao)} | imagem ${junta(si.raio.imagem)} | campo ${junta(si.raio.campo)}`)
    console.log(`    sombra:        ${junta(si.sombra)}${si.borda.length ? ` | borda: ${junta(si.borda)}` : ''}`)
    console.log(`    botão:         ${junta(si.botao)}`)
    console.log(`    títulos:       h1 ${junta(si.titulos.h1)} | h2 ${junta(si.titulos.h2)}`)
    console.log(`    coluna:        ${junta(si.coluna)}`)
    if (si.chegada.elementos) console.log(`    chegada:       ${si.chegada.elementos} blocos chegam animando ao rolar — ${junta(si.chegada.efeitos)}${si.chegada.classe.length ? ` (classe: ${si.chegada.classe.join(', ')})` : ''}`)
    console.log(`    movimento:     ${junta(si.movimento)}${si.transicoes.length ? ` | transições: ${junta(si.transicoes)}` : ''}`)
    if (si.efeitosHover.length) console.log(`    ao passar o mouse: ${si.efeitosHover.slice(0, 3).join('  ||  ')}`)
    console.log(`    fontes:        ${junta([...si.fontes.externas, ...si.fontes.arquivos])}`)
    console.log(`    ícones:        ${junta(si.icones)}`)
    console.log(`  capturas:        ${destino}`)
    resumo.push(destino)
  } catch (erro) {
    console.log(`  falhou: ${String(erro.message).split('\n')[0]}`)
    console.log('  (página fora do ar, bloqueando robô ou exigindo login — Instagram e TikTok exigem. Peça as imagens à pessoa.)')
  }
}

await navegador.close()
if (!resumo.length) falha('nenhuma página pôde ser lida.')
console.log(`\nAgora abra as capturas (*-topo.jpg primeiro) e descreva a identidade antes de propor qualquer coisa.`)
