#!/usr/bin/env node
// Ícones do Lucide (licença ISC) prontos para colar no HTML. Sem isto, pôr ícone numa lista exigia
// abrir o site, achar o nome e copiar o desenho — e a página saía sem nenhum.
import { argumentos, falha } from './lib.mjs'

const BASE = 'https://cdn.jsdelivr.net/npm/lucide-static@1'
const { posicionais, opcoes } = argumentos()

if (!posicionais.length) {
  console.log(`uso: icone.mjs buscar <termo> [<termo> ...]    procura pelo nome e pelas etiquetas (em inglês)
     icone.mjs <nome> [<nome> ...] [--tamanho=28]  imprime o <svg> de cada um, pronto para o HTML

Exemplos:
  icone.mjs buscar wash dry timer money
  icone.mjs washing-machine timer banknote

Todos saem com class="lp-icone", stroke="currentColor" (herda a cor do texto), a mesma espessura e
aria-hidden. Uma família só na página inteira — não misture com outro jogo de ícones.`)
  process.exit(2)
}

async function texto(url) {
  const resposta = await fetch(url).catch((erro) => falha(`sem acesso a ${url}: ${erro.message}`))
  return resposta.ok ? resposta.text() : null
}

if (posicionais[0] === 'buscar') {
  const termos = posicionais.slice(1).map((t) => t.toLowerCase())
  if (!termos.length) falha('diga o que procurar: icone.mjs buscar <termo>', 2)
  const etiquetas = JSON.parse((await texto(`${BASE}/tags.json`)) || '{}')
  for (const termo of termos) {
    const achados = Object.entries(etiquetas)
      .filter(([nome, tags]) => nome.includes(termo) || tags.some((t) => t.includes(termo)))
      .sort(([a], [b]) => Number(!a.includes(termo)) - Number(!b.includes(termo)))
      .slice(0, 12)
      .map(([nome]) => nome)
    console.log(`${termo}: ${achados.join(', ') || 'nada — tente um sinônimo em inglês'}`)
  }
  process.exit(0)
}

const tamanho = Number(opcoes.tamanho || 28)
for (const nome of posicionais) {
  const svg = await texto(`${BASE}/icons/${nome}.svg`)
  if (!svg) {
    console.log(`<!-- ${nome}: não existe; procure com icone.mjs buscar ${nome.split('-')[0]} -->`)
    continue
  }
  const desenho = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s*\n\s*/g, '')
  console.log(`<!-- ${nome} -->\n<svg class="lp-icone" viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${desenho}</svg>`)
}
