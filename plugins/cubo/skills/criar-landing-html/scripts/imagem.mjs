#!/usr/bin/env node
// Prepara uma imagem para a landing: redimensiona, converte para webp e aperta a qualidade até
// caber no orçamento de bytes. Quem usa a skill não é de desenvolvimento web — deixar passar uma
// foto de 3 MB tirada do celular é o jeito mais fácil de derrubar a nota do PageSpeed e o lead junto.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { argumentos, baixar, dependencia, falha, kb } from './lib.mjs'

const PAPEIS = {
  topo: { largura: 1600, alvoKb: 200, descricao: 'imagem grande do começo da página (é ela que o Lighthouse mede como LCP)' },
  conteudo: { largura: 1200, alvoKb: 100, descricao: 'qualquer outra imagem da página' },
  logo: { largura: 480, alvoKb: 40, descricao: 'logotipo' },
}
const LIMITE_DURO_KB = 1024 // o validador do Cubo recusa acima disso
const QUALIDADES = [82, 75, 68, 60, 52]

const { posicionais } = argumentos()
const [entrada, papel = 'conteudo', saidaPedida] = posicionais

if (!entrada) {
  console.log(`uso: imagem.mjs <arquivo-ou-endereço> [topo|conteudo|logo] [saida.webp]

${Object.entries(PAPEIS).map(([nome, p]) => `  ${nome.padEnd(9)} ${p.descricao}\n            largura máxima ${p.largura}px, alvo de ${p.alvoKb} KB`).join('\n')}

Aceita arquivo local ou endereço (https://…), para aproveitar a foto que o cliente já usa no site.
Sempre devolve **webp**. O limite duro do Cubo é 1 MB por arquivo, e cada imagem consome a cota de
armazenamento da empresa.`)
  process.exit(2)
}

const regra = PAPEIS[papel] || falha(`papel inválido (${papel}). Use topo, conteudo ou logo.`, 2)
const remota = /^https?:\/\//i.test(entrada)

if (!remota && !existsSync(entrada)) falha(`${entrada} não existe`, 2)

const nomeBase = remota ? basename(new URL(entrada).pathname).replace(/[^a-z0-9._-]+/gi, '-') || 'imagem' : basename(entrada)
const extensao = extname(nomeBase).slice(1).toLowerCase()

if (extensao === 'svg') {
  console.error('aviso: SVG já é vetor — não converta. Suba como está, se for logotipo ou ícone.')
  process.exit(0)
}

const original = remota ? await baixar(entrada).catch((erro) => falha(erro.message)) : readFileSync(entrada)
const sharp = (await dependencia('sharp')).default

const metadados = await sharp(original).metadata().catch(() => falha('o arquivo não é uma imagem que dê para ler (formato desconhecido ou corrompido).', 2))
if (metadados.format === 'svg') {
  console.error('aviso: SVG já é vetor — não converta. Suba como está, se for logotipo ou ícone.')
  process.exit(0)
}

const saida = saidaPedida || `${nomeBase.replace(/\.[^.]+$/, '')}.webp`
let resultado = null
let qualidade = null
for (qualidade of QUALIDADES) {
  // Logotipo exportado costuma vir com margem transparente enorme em volta; aparar é o que deixa ele
  // alinhar com o resto do topo.
  const base = sharp(original, { animated: false }).rotate()
  const aparada = papel === 'logo' ? sharp(await base.trim({ threshold: 10 }).toBuffer()) : base
  resultado = await aparada
    .resize({ width: regra.largura, withoutEnlargement: true })
    .webp({ quality: qualidade, effort: 5 })
    .toBuffer({ resolveWithObject: true })
  if (kb(resultado.data.length) <= regra.alvoKb) break
}

const finalKb = kb(resultado.data.length)
if (finalKb > LIMITE_DURO_KB) {
  falha(`mesmo apertada, a imagem ficou em ${finalKb} KB e o Cubo recusa acima de ${LIMITE_DURO_KB} KB.\nPeça uma imagem menor, ou corte o que não precisa aparecer.`)
}

writeFileSync(saida, resultado.data)
console.log(saida)
console.log(`  origem:    ${kb(original.length)} KB (${metadados.format}, ${metadados.width}x${metadados.height})`)
console.log(`  resultado: ${finalKb} KB (webp, qualidade ${qualidade}, ${resultado.info.width}x${resultado.info.height})`)
if (metadados.width < regra.largura && papel === 'topo') {
  console.log(`  ⚠ a original tem só ${metadados.width}px de largura: no computador ela vai aparecer esticada ou borrada.`)
}
if (finalKb > regra.alvoKb) {
  console.log(`  ⚠ acima do alvo de ${regra.alvoKb} KB para '${papel}'. Passa no Cubo, mas pesa na nota —`)
  console.log('    vale cortar a imagem ou pedir uma com menos detalhe.')
}
