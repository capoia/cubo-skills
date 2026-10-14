#!/usr/bin/env node
// O que a categoria está pagando para anunciar agora, pela Biblioteca de Anúncios da Meta — pública,
// gratuita e sem login. Anúncio ativo há semanas é promessa que está funcionando para alguém: é o
// melhor retrato de como o público do cliente já está sendo abordado.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { abrirNavegador, argumentos, falha } from './lib.mjs'

const { posicionais, opcoes } = argumentos()
if (!posicionais.length) {
  console.log(`uso: anuncios.mjs "<termo ou concorrente>" ["<outro>" ...] [--pais=BR] [--pasta=anuncios]

Para cada termo grava, em <pasta>/<termo>/:
  captura.jpg     a página de resultados, para olhar
  anuncios.json   anunciante, desde quando está no ar, e o texto de cada anúncio

Termos que funcionam: o nome COMPLETO do concorrente ("Ekim Semijoias", não "Ekim" — palavra solta
pega anúncio de tudo que a contém, até em outra língua), ou a categoria com a oferta ("franquia
semijoias", "implante dentário campinas"). Só anúncios ATIVOS.`)
  process.exit(2)
}

const PASTA = resolve(opcoes.pasta || 'anuncios')
const pais = String(opcoes.pais || 'BR').toUpperCase()

function lerAnuncios(texto) {
  return texto
    .split(/Identificação da biblioteca:|Library ID:/)
    .slice(1)
    .map((bloco) => {
      const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean)
      const desde = (bloco.match(/Veiculação iniciada em ([^\n]+)|Started running on ([^\n]+)/) || []).slice(1).find(Boolean) || ''
      const indicePatrocinado = linhas.findIndex((l) => /^(Patrocinado|Sponsored)$/.test(l))
      const anunciante = indicePatrocinado > 0 ? linhas[indicePatrocinado - 1] : ''
      const corpo = indicePatrocinado >= 0 ? linhas.slice(indicePatrocinado + 1) : []
      const fim = corpo.findIndex((l) => /^(Saiba mais|Learn more|Cadastre-se|Sign up|Enviar mensagem|Send message|Fale conosco|Ver detalhes do anúncio|See ad details)$/i.test(l))
      return { anunciante, desde: desde.trim(), texto: (fim >= 0 ? corpo.slice(0, fim) : corpo.slice(0, 6)).join(' ').slice(0, 700) }
    })
    .filter((a) => a.anunciante && a.texto)
}

const { navegador } = await abrirNavegador()
let algum = false

for (const termo of posicionais) {
  const destino = join(PASTA, termo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  mkdirSync(destino, { recursive: true })
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${pais}&q=${encodeURIComponent(termo)}&search_type=keyword_unordered&media_type=all`
  console.log(`\n→ ${termo}`)
  try {
    const pagina = await navegador.newPage({ viewport: { width: 1366, height: 1500 }, locale: 'pt-BR' })
    await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await pagina.waitForTimeout(7000)
    for (let i = 0; i < 3; i++) {
      await pagina.mouse.wheel(0, 2500)
      await pagina.waitForTimeout(1500)
    }
    await pagina.evaluate(() => window.scrollTo(0, 0))
    await pagina.screenshot({ path: join(destino, 'captura.jpg'), type: 'jpeg', quality: 60, fullPage: true, timeout: 60_000 })
    const texto = await pagina.evaluate(() => document.body.innerText)
    await pagina.close()

    const total = (texto.match(/~?([\d.]+)\s+resultados?/) || [])[1] || '?'
    const anuncios = lerAnuncios(texto)
    writeFileSync(join(destino, 'anuncios.json'), JSON.stringify({ termo, url, total, anuncios }, null, 2))
    console.log(`  ${total} resultados; li ${anuncios.length} anúncios`)
    for (const anuncio of anuncios.slice(0, 6)) console.log(`  - ${anuncio.anunciante} (desde ${anuncio.desde || '?'}): ${anuncio.texto.slice(0, 160)}…`)
    console.log(`  captura: ${join(destino, 'captura.jpg')}`)
    algum = true
  } catch (erro) {
    console.log(`  falhou: ${String(erro.message).split('\n')[0]}`)
  }
}

await navegador.close()
if (!algum) falha('nenhuma busca funcionou. A Meta pode ter mudado a página ou bloqueado o acesso automático; abra a Biblioteca de Anúncios no navegador e peça prints.')
console.log('\nLeia os textos: qual promessa se repete (o padrão da categoria), qual objeção todos respondem, e o que ninguém diz.')
