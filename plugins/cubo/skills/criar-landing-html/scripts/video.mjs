#!/usr/bin/env node
// Prepara um vídeo para a landing: encolhe, comprime em mp4 (H.264, o que todo navegador toca),
// põe o índice no começo para tocar enquanto baixa, e tira o pôster em webp. Vídeo de celular tem
// centenas de MB; vídeo de fundo precisa de poucos, porque cada visita baixa o arquivo inteiro.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { argumentos, baixar, dependencia, falha, kb } from './lib.mjs'

const PAPEIS = {
  fundo: { largura: 1280, alvoMb: 6, crf: [30, 33, 36], audio: false, descricao: 'vídeo de fundo, mudo e em loop (topo ou faixa)' },
  conteudo: { largura: 1280, alvoMb: 15, crf: [26, 29, 32], audio: true, descricao: 'vídeo que a pessoa assiste, com som e controles' },
}
const LIMITE_CUBO_MB = 25

const { posicionais, opcoes } = argumentos()
const [entrada, papel = 'fundo'] = posicionais

if (!entrada) {
  console.log(`uso: video.mjs <arquivo-ou-endereço> [fundo|conteudo] [--saida=nome] [--segundos=15]

${Object.entries(PAPEIS).map(([nome, p]) => `  ${nome.padEnd(9)} ${p.descricao}\n            largura máxima ${p.largura}px, alvo de ${p.alvoMb} MB${p.audio ? '' : ', sem áudio'}`).join('\n')}

Devolve <nome>.mp4 e <nome>-poster.webp. O pôster é a imagem que aparece antes de o vídeo
carregar — e a única coisa que o celular mostra no vídeo de fundo.

--segundos corta o vídeo (padrão: 15 no fundo, inteiro no conteúdo). Fundo longo é peso sem ganho.
O limite do Cubo é ${LIMITE_CUBO_MB} MB por vídeo.`)
  process.exit(2)
}

const regra = PAPEIS[papel] || falha(`papel inválido (${papel}). Use fundo ou conteudo.`, 2)
const ffmpeg = (await dependencia('ffmpeg-static')).default
if (!ffmpeg || !existsSync(ffmpeg)) falha('o ffmpeg não foi instalado junto com as dependências. Rode o requisitos.mjs de novo.', 3)

const pasta = mkdtempSync(join(tmpdir(), 'lp-video-'))
const remota = /^https?:\/\//i.test(entrada)
const origem = remota ? join(pasta, 'origem') : entrada
if (remota) writeFileSync(origem, await baixar(entrada, 800 * 1024 * 1024).catch((erro) => falha(erro.message)))
if (!existsSync(origem)) falha(`${entrada} não existe`, 2)

const nome = String(opcoes.saida || basename(remota ? new URL(entrada).pathname : entrada).replace(/\.[^.]+$/, '') || 'video')
const saida = `${nome}.mp4`
const poster = `${nome}-poster.webp`
const segundos = Number(opcoes.segundos || (papel === 'fundo' ? 15 : 0))

function rodar(args) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
  if (r.status !== 0) falha(`o ffmpeg recusou o vídeo: ${(r.stderr || '').trim().split('\n').slice(-2).join(' ')}`)
}

let tamanhoMb = Infinity
let crfUsado = null
for (const crf of regra.crf) {
  rodar([
    '-i', origem,
    ...(segundos ? ['-t', String(segundos)] : []),
    '-vf', `scale='min(${regra.largura},iw)':-2`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
    ...(regra.audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']),
    '-movflags', '+faststart',
    saida,
  ])
  tamanhoMb = statSync(saida).size / 1024 / 1024
  crfUsado = crf
  if (tamanhoMb <= regra.alvoMb) break
}

rodar(['-ss', '0.5', '-i', saida, '-frames:v', '1', join(pasta, 'quadro.png')])
const sharp = (await dependencia('sharp')).default
await sharp(readFileSync(join(pasta, 'quadro.png'))).webp({ quality: 72 }).toFile(poster)
rmSync(pasta, { recursive: true, force: true })

if (tamanhoMb > LIMITE_CUBO_MB) {
  falha(`mesmo comprimido, o vídeo ficou com ${tamanhoMb.toFixed(1)} MB e o Cubo recusa acima de ${LIMITE_CUBO_MB} MB. Corte com --segundos ou peça um vídeo mais curto.`)
}

console.log(saida)
console.log(poster)
console.log(`  vídeo:  ${tamanhoMb.toFixed(1)} MB (mp4 H.264, crf ${crfUsado}${regra.audio ? '' : ', sem áudio'}${segundos ? `, ${segundos}s` : ''})`)
console.log(`  pôster: ${kb(statSync(poster).size)} KB (webp)`)
if (tamanhoMb > regra.alvoMb) console.log(`  ⚠ acima do alvo de ${regra.alvoMb} MB para '${papel}': passa no Cubo, mas cada visita baixa isso. Corte com --segundos.`)
