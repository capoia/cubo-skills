#!/usr/bin/env node
// Nota do PageSpeed Insights da página publicada. Celular por padrão: é de onde vem quase todo o
// tráfego de anúncio, e é onde a nota costuma doer.
import { writeFileSync } from 'node:fs'
import { configuracao, falha } from './lib.mjs'

const [url, estrategia = 'mobile'] = process.argv.slice(2)
if (!url) {
  console.log('uso: pagespeed.mjs <url> [mobile|desktop]')
  process.exit(2)
}

const config = configuracao()
const consulta = new URLSearchParams({ url, strategy: estrategia })
for (const categoria of ['performance', 'accessibility', 'best-practices', 'seo']) consulta.append('category', categoria)
if (config.pagespeed) consulta.set('key', config.pagespeed)

console.log(`medindo ${url} (${estrategia})… costuma levar de 20 a 60 segundos`)

const resposta = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${consulta}`, {
  signal: AbortSignal.timeout(180_000),
}).catch((erro) => falha(`não consegui falar com o PageSpeed: ${erro.cause?.code || erro.message}`))
const dados = await resposta.json().catch(() => falha(`o PageSpeed respondeu HTTP ${resposta.status} sem JSON`))

if (dados.error) {
  console.log(`erro ${dados.error.code}: ${dados.error.message}`)
  if (dados.error.code === 429 || /quota/i.test(dados.error.message || '')) {
    console.log('')
    console.log(config.pagespeed
      ? 'A cota desta chave acabou por hoje (são 25 mil medições por dia, então algo está medindo em laço).'
      : 'Sem chave, a medição usa uma cota pública do Google que é dividida com o mundo inteiro e acaba todo dia.\nPegue uma chave gratuita (2 minutos): references/pagespeed.md, e ponha PAGESPEED_API_KEY no .cubo.env.')
  }
  process.exit(1)
}

const farol = dados.lighthouseResult || {}
const categorias = farol.categories || {}
const auditorias = farol.audits || {}
const rotulos = { performance: 'Desempenho', accessibility: 'Acessibilidade', 'best-practices': 'Boas práticas', seo: 'SEO' }

console.log(`\nPageSpeed — ${estrategia}`)
console.log(`URL: ${farol.finalUrl || '?'}\n`)
const notas = {}
for (const [chave, rotulo] of Object.entries(rotulos)) {
  const nota = categorias[chave]?.score
  if (nota === null || nota === undefined) continue
  const valor = Math.round(nota * 100)
  notas[rotulo] = valor
  console.log(`  [${valor >= 90 ? 'OK  ' : valor >= 50 ? 'ATN ' : 'RUIM'}] ${rotulo.padEnd(16)} ${valor}`)
}

console.log('\n  métricas')
for (const [chave, rotulo] of [
  ['first-contentful-paint', 'Primeiro conteúdo'],
  ['largest-contentful-paint', 'Maior conteúdo (LCP)'],
  ['total-blocking-time', 'Bloqueio total'],
  ['cumulative-layout-shift', 'Deslocamento (CLS)'],
  ['speed-index', 'Índice de velocidade'],
]) {
  if (auditorias[chave]?.displayValue) console.log(`    ${rotulo.padEnd(24)} ${auditorias[chave].displayValue}`)
}

const pesados = [
  'uses-optimized-images', 'modern-image-formats', 'uses-responsive-images', 'unused-css-rules',
  'render-blocking-resources', 'unsized-images', 'third-party-summary', 'total-byte-weight',
]
  .map((chave) => auditorias[chave])
  .filter((item) => item && item.score !== null && item.score !== undefined && item.score < 0.9)
  .map((item) => {
    const economia = item.details?.overallSavingsMs
    return `    - ${item.title}${economia ? ` (aprox. ${Math.round(economia)} ms)` : ''}`
  })

if (pesados.length) console.log(`\n  o que está segurando\n${pesados.join('\n')}`)
console.log('')
// O entrega.mjs monta o checklist final a partir disto.
writeFileSync(`pagespeed-${estrategia}.json`, JSON.stringify({ url: farol.finalUrl || url, estrategia, notas, medidoEm: new Date().toISOString() }, null, 2))
