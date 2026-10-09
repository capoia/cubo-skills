// O "sistema" de uma página: cantos, sombra, botão, títulos, coluna, movimento, fontes, ícones.
// O marca.mjs mede o site do cliente; o previa.mjs mede a landing com a MESMA régua e compara —
// regra escrita só em texto a IA pula; a diferença medida ela não consegue ignorar.

// Roda dentro da página. O "jeito" do site, além da cor e da fonte: o raio dos cantos, a sombra, o
// botão, os títulos, a largura da coluna, como as coisas se mexem e de onde vêm as fontes e os
// ícones. É o que faz a landing parecer uma página do próprio site, e não um tema de IA.
export function medirSistema() {
  const conta = new Map()
  const soma = (grupo, valor, peso = 1) => {
    if (!valor) return
    const mapa = conta.get(grupo) || new Map()
    mapa.set(valor, (mapa.get(valor) || 0) + peso)
    conta.set(grupo, mapa)
  }
  const top = (grupo, quantos = 3) => [...(conta.get(grupo) || new Map()).entries()].sort((a, b) => b[1] - a[1]).slice(0, quantos).map(([v, n]) => `${v} (${n}×)`)
  const visivel = (el) => { const c = el.getBoundingClientRect(); const e = getComputedStyle(el); return c.width > 0 && c.height > 0 && e.display !== 'none' && e.visibility !== 'hidden' }
  const raio = (e) => (e.borderTopLeftRadius === '0px' && e.borderBottomRightRadius === '0px' ? '0' : e.borderRadius)
  const temFundo = (e) => !/rgba\(0, 0, 0, 0\)|transparent/.test(e.backgroundColor)

  for (const el of document.querySelectorAll('a, button, [role="button"], input[type="submit"]')) {
    if (!visivel(el)) continue
    const e = getComputedStyle(el)
    const c = el.getBoundingClientRect()
    if (!temFundo(e) && e.borderTopWidth === '0px') continue
    if (c.height < 28 || c.width < 60 || el.innerText.trim().length > 40) continue
    soma('botaoRaio', raio(e))
    soma('botaoForma', `${Math.round(c.height)}px de altura, padding ${e.paddingTop} ${e.paddingRight}, ${e.fontWeight} ${e.fontSize}${e.textTransform !== 'none' ? `, ${e.textTransform}` : ''}${e.letterSpacing !== 'normal' ? `, espaçamento ${e.letterSpacing}` : ''}${!temFundo(e) ? ', só contorno' : ''}`)
    if (e.transitionDuration !== '0s') soma('botaoTransicao', `${e.transitionProperty} ${e.transitionDuration}`)
  }

  // Cartão: bloco médio com fundo próprio, borda ou sombra, com texto ou imagem dentro.
  for (const el of document.querySelectorAll('body div, body article, body li, body a, body figure')) {
    const c = el.getBoundingClientRect()
    if (c.width < 160 || c.height < 120 || c.width > document.documentElement.clientWidth * 0.7 || !visivel(el)) continue
    const e = getComputedStyle(el)
    const sombra = e.boxShadow !== 'none'
    if (!sombra && !temFundo(e) && e.borderTopWidth === '0px') continue
    soma('cartaoRaio', raio(e))
    if (sombra) soma('cartaoSombra', e.boxShadow)
    if (e.borderTopWidth !== '0px') soma('cartaoBorda', `${e.borderTopWidth} ${e.borderTopStyle}`)
    if (parseFloat(e.borderTopWidth) >= 3 && parseFloat(e.borderLeftWidth) < 1 && parseFloat(e.borderRightWidth) < 1) soma('bordaTopo', 'sim')
    if (e.transitionDuration !== '0s') soma('cartaoTransicao', `${e.transitionProperty} ${e.transitionDuration} ${e.transitionTimingFunction}`)
  }

  for (const img of document.querySelectorAll('img, video')) {
    const c = img.getBoundingClientRect()
    if (c.width < 150 || !visivel(img)) continue
    soma('imagemRaio', raio(getComputedStyle(img.closest('figure, picture') && raio(getComputedStyle(img)) === '0' ? img.closest('figure, picture') : img)))
  }
  // Campo de formulário de verdade: a caixa de busca do cabeçalho sozinha não diz como o site
  // desenha um formulário.
  for (const form of document.querySelectorAll('form')) {
    const campos = [...form.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=search]), select, textarea')].filter(visivel)
    if (campos.length < 2) continue
    for (const campo of campos) soma('campoRaio', raio(getComputedStyle(campo)))
  }

  for (const nivel of ['h1', 'h2', 'h3']) {
    for (const el of document.querySelectorAll(nivel)) {
      if (!visivel(el)) continue
      const e = getComputedStyle(el)
      soma(`${nivel}Caixa`, e.textTransform === 'uppercase' ? 'caixa alta' : 'caixa normal')
      soma(nivel, `${e.fontFamily.split(',')[0].replace(/["']/g, '')} ${e.fontWeight} ${e.fontSize}/${e.lineHeight}${e.textTransform !== 'none' ? ` ${e.textTransform}` : ''}${e.letterSpacing !== 'normal' ? ` espaçamento ${e.letterSpacing}` : ''}`)
    }
  }

  // Coluna de conteúdo: a largura em que o texto e as grades se alinham.
  const largura = document.documentElement.clientWidth
  for (const el of document.querySelectorAll('body *')) {
    const c = el.getBoundingClientRect()
    if (c.width < 700 || c.width > largura - 40 || Math.abs(c.left - (largura - c.right)) > 4 || el.children.length < 1) continue
    soma('coluna', `${Math.round(c.width)}px`)
  }

  // Movimento: biblioteca de animação ao rolar, efeitos por classe, carrosséis e o que o CSS declara.
  const movimento = []
  const tem = (seletor) => document.querySelector(seletor)
  if (tem('[data-aos]')) movimento.push(`AOS (animação ao rolar): ${[...new Set([...document.querySelectorAll('[data-aos]')].map((e) => e.dataset.aos))].slice(0, 6).join(', ')}`)
  if (tem('.wow')) movimento.push('WOW.js (animação ao rolar)')
  const elementor = [...document.querySelectorAll('[data-settings*="animation"]')].map((e) => (e.dataset.settings.match(/"_?animation":"([^"]+)"/) || [])[1]).filter(Boolean)
  if (elementor.length) movimento.push(`Elementor, chegada ao rolar: ${[...new Set(elementor)].slice(0, 6).join(', ')} (${elementor.length} elementos)`)
  if (tem('[class*="animate__"], .animated')) movimento.push('animate.css')
  if (window.gsap || window.TweenMax || window.ScrollTrigger) movimento.push('GSAP')
  if (window.lottie || tem('lottie-player, dotlottie-player')) movimento.push('Lottie (animação desenhada)')
  if (tem('.swiper, .swiper-container')) movimento.push('carrossel Swiper')
  if (tem('.slick-slider, .owl-carousel, .splide, .flickity-enabled')) movimento.push('carrossel (slick/owl/splide)')
  if (tem('[data-parallax], .parallax, .jarallax, .rellax')) movimento.push('parallax')
  const efeitosHover = new Set()
  const quadros = new Set()
  const fontes = new Set()
  for (const folha of document.styleSheets) {
    let regras
    try { regras = folha.cssRules } catch { continue }
    for (const regra of regras || []) {
      if (regra.type === 7) quadros.add(regra.name)
      if (regra.type === 5) {
        const arquivo = (regra.style.src.match(/url\(["']?([^"')]+)/) || [])[1]
        if (arquivo && !arquivo.startsWith('data:')) fontes.add(`${regra.style.fontFamily.replace(/["']/g, '')} ${regra.style.fontWeight || ''}: ${new URL(arquivo, folha.href || location.href).href}`)
      }
      if (regra.selectorText?.includes(':hover') && /transform|box-shadow|translate|scale/.test(regra.cssText)) efeitosHover.add(regra.cssText.replace(/\s+/g, ' ').slice(0, 140))
    }
  }
  if (quadros.size) movimento.push(`@keyframes: ${[...quadros].slice(0, 8).join(', ')}`)

  const fontesExternas = [...document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="typekit"], link[href*="fonts.bunny"]')].map((l) => l.href)
  const icones = []
  if (tem('[class*="fa-"], .fa, .fas, .fab')) icones.push('Font Awesome')
  if (tem('.material-icons, .material-symbols-outlined')) icones.push('Material')
  if (tem('[class*="eicon"], .elementor-icon')) icones.push('ícones do Elementor')
  if (tem('.bi[class*="bi-"]')) icones.push('Bootstrap Icons')
  const svgsPequenos = [...document.querySelectorAll('svg')].filter((s) => { const c = s.getBoundingClientRect(); return c.width > 8 && c.width <= 64 })
  if (svgsPequenos.length) icones.push(`${svgsPequenos.length} ícones em SVG (${[...new Set(svgsPequenos.map((s) => (getComputedStyle(s).fill !== 'none' && s.getAttribute('fill') !== 'none' ? 'cheio' : 'traço')))].join(' e ')})`)

  return {
    raio: { botao: top('botaoRaio'), cartao: top('cartaoRaio'), imagem: top('imagemRaio'), campo: top('campoRaio') },
    sombra: top('cartaoSombra', 2),
    bordaTopo: conta.get('bordaTopo')?.get('sim') || 0,
    caixa: { h1: top('h1Caixa', 2), h2: top('h2Caixa', 2) },
    borda: top('cartaoBorda', 2),
    botao: top('botaoForma', 2),
    titulos: { h1: top('h1', 2), h2: top('h2', 2), h3: top('h3', 2) },
    coluna: top('coluna', 2),
    transicoes: [...top('botaoTransicao', 2), ...top('cartaoTransicao', 2)],
    movimento,
    efeitosHover: [...efeitosHover].slice(0, 6),
    fontes: { arquivos: [...fontes].filter((f) => !/^\s*:/.test(f)).slice(0, 10), externas: fontesExternas },
    icones,
  }
}

const itens = (lista = []) => lista.map((texto) => {
  const achado = String(texto).match(/^(.*) \((\d+)×\)$/)
  return achado ? [achado[1], Number(achado[2])] : [String(texto), 1]
})

// Junta o sistema de várias páginas do site: a home costuma ter o banner, e o jeito dos cartões
// aparece nas páginas de produto. Vale o que se repete em mais lugares.
export function consolidar(sistemas) {
  const grupos = {
    botao: (s) => s.raio?.botao, cartao: (s) => s.raio?.cartao, imagem: (s) => s.raio?.imagem, campo: (s) => s.raio?.campo,
    h2: (s) => s.caixa?.h2, sombra: (s) => s.sombra,
  }
  const saida = {
    paginas: sistemas.length,
    bordaTopo: sistemas.reduce((total, s) => total + (s.bordaTopo || 0), 0),
    hover: [...new Set(sistemas.flatMap((s) => s.efeitosHover || []))],
    chegada: sistemas.reduce((total, s) => total + (s.chegada?.elementos || 0), 0),
  }
  for (const [grupo, pega] of Object.entries(grupos)) {
    const mapa = new Map()
    for (const sistema of sistemas) for (const [valor, n] of itens(pega(sistema))) mapa.set(valor, (mapa.get(valor) || 0) + n)
    saida[grupo] = [...mapa.entries()].sort((a, b) => b[1] - a[1])
  }
  return saida
}

const forma = (raio) => {
  const numero = parseFloat(raio)
  if (!raio || Number.isNaN(numero)) return raio
  if (numero === 0) return 'reto'
  if (numero >= 100 || (raio.includes('%') && numero >= 30)) return 'pílula'
  return `${Math.round(numero)}px`
}
const parecido = (a, b) => a === b || (/px$/.test(a) && /px$/.test(b) && Math.abs(parseFloat(a) - parseFloat(b)) <= 3)

// O formulário do Cubo desenha em shadow DOM, com um raio só no tema: sem cuidado sai campo reto e
// botão em pílula dentro de um cartão arredondado. O campo segue o campo do site; se o site não tem
// formulário, segue o cartão (até 12px, campo muito redondo vira pílula e fica estranho com texto).
export function compararFormulario(site, pagina, formulario) {
  if (!formulario) return []
  const avisos = []
  const esperadoCampo = forma(site?.campo?.[0]?.[0]) ?? (() => {
    const cartao = parseFloat(site?.cartao?.[0]?.[0] ?? pagina.cartao?.[0]?.[0] ?? '')
    return Number.isNaN(cartao) ? null : forma(`${Math.min(cartao, 12)}px`)
  })()
  const campo = forma(formulario.campo)
  if (esperadoCampo && campo && !parecido(esperadoCampo, campo)) avisos.push(`formulário: campo com canto ${campo}, ${site?.campo?.length ? 'o site usa' : 'os cartões pedem'} ${esperadoCampo} — acerte com theme.radius ou css ".lf-input{border-radius:…}" (formulario.md, "a cara do site")`)
  const esperadoBotao = forma(site?.botao?.[0]?.[0] ?? pagina.botao?.[0]?.[0])
  const botao = forma(formulario.botao)
  if (esperadoBotao && botao && !parecido(esperadoBotao, botao)) avisos.push(`formulário: botão com canto ${botao}, os botões da página são ${esperadoBotao} — css ".lf-button{border-radius:…}"`)
  if (formulario.localEmTexto.length) avisos.push(`formulário: "${formulario.localEmTexto.join('", "')}" em texto livre — use campo personalizado do tipo state/city, que vira lista e chega padronizado (formulario.md, "tipos de campo")`)
  return avisos
}

// O que a landing faz diferente do site. Cada linha vira aviso na prévia.
export function comparar(site, pagina) {
  const avisos = []
  for (const [grupo, nome] of [['botao', 'botão'], ['cartao', 'cartão'], ['imagem', 'imagem']]) {
    const doSite = forma(site[grupo]?.[0]?.[0])
    const daPagina = forma(pagina[grupo]?.[0]?.[0])
    if (doSite && daPagina && !parecido(doSite, daPagina)) avisos.push(`canto de ${nome}: o site usa ${doSite}, a landing ${daPagina} — use o do site (marca.md, "o sistema do site")`)
  }
  const caixaSite = site.h2?.[0]?.[0]
  const caixaPagina = pagina.h2?.[0]?.[0]
  if (caixaSite && caixaPagina && caixaSite !== caixaPagina) avisos.push(`títulos de seção: o site escreve em ${caixaSite}, a landing em ${caixaPagina}`)
  if (!site.sombra?.length && pagina.sombra?.length) avisos.push(`sombra nos cartões: o site não usa, a landing usa (${pagina.sombra[0][0]})`)
  if (site.hover.length && !pagina.hover.length) avisos.push(`o site anima ao passar o mouse (${site.hover[0].slice(0, 90)}…) e a landing não — repita o efeito nos cartões e imagens (marca.md)`)
  if (pagina.bordaTopo && !site.bordaTopo) avisos.push(`borda superior grossa em ${pagina.bordaTopo} cartão(ões): o site não usa, e é a marca mais comum de página feita por IA (SKILL.md, regra 3) — tire`)
  return avisos
}
