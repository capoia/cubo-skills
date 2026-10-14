#!/usr/bin/env node
// Passo zero da skill: confere tudo o que ela precisa e instala o que dá para instalar sozinho.
// Existe para a pessoa descobrir o que falta ANTES da entrevista, e não no meio da publicação.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NODE_MINIMO, SCRIPTS, cliDoPlaywright, configuracao } from './lib.mjs'

const linhas = []
let bloqueado = false

function registra(estado, titulo, detalhe = '') {
  if (estado === 'FALTA') bloqueado = true
  linhas.push(`  [${estado.padEnd(5)}] ${titulo}${detalhe ? `\n          ${detalhe.replace(/\n/g, '\n          ')}` : ''}`)
}

function roda(comando, rotulo) {
  console.log(`… ${rotulo}`)
  const resultado = spawnSync(comando, { cwd: SCRIPTS, shell: true, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
  return { ok: resultado.status === 0, saida: `${resultado.stdout || ''}${resultado.stderr || ''}`.trim() }
}

function versaoInstalada(pacote) {
  const arquivo = join(SCRIPTS, 'node_modules', pacote, 'package.json')
  return existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')).version : null
}

const [maior, menor] = process.versions.node.split('.').map(Number)
const nodeOk = maior > NODE_MINIMO[0] || (maior === NODE_MINIMO[0] && menor >= NODE_MINIMO[1])
if (!nodeOk) {
  console.log(`Node.js ${process.versions.node} é antigo demais: a skill precisa do ${NODE_MINIMO.join('.')} ou mais novo.`)
  console.log('Instale a versão LTS em https://nodejs.org (ou veja references/requisitos.md) e rode de novo.')
  process.exit(1)
}
registra('ok', `Node.js ${process.versions.node}`)

const esperadas = JSON.parse(readFileSync(join(SCRIPTS, 'package.json'), 'utf8')).dependencies
const desatualizadas = Object.entries(esperadas).filter(([nome, versao]) => versaoInstalada(nome) !== versao)
if (desatualizadas.length) {
  const instalacao = roda('npm install --omit=dev --no-audit --no-fund --loglevel=error', 'instalando dependências (só na primeira vez; ~1 minuto)')
  if (!instalacao.ok) {
    registra('FALTA', 'dependências dos scripts', `o npm falhou:\n${instalacao.saida.split('\n').slice(-6).join('\n')}`)
  }
}

let sharpOk = false
try {
  const sharp = (await import('sharp')).default
  await sharp({ create: { width: 4, height: 4, channels: 3, background: '#808080' } }).webp().toBuffer()
  sharpOk = true
  registra('ok', `conversão de imagem (sharp ${versaoInstalada('sharp')})`)
} catch (erro) {
  registra('FALTA', 'conversão de imagem (sharp)', `não carregou neste sistema: ${String(erro.message).split('\n')[0]}`)
}

try {
  const ffmpeg = (await import('ffmpeg-static')).default
  if (!ffmpeg || !existsSync(ffmpeg)) throw new Error('binário não baixado')
  registra('ok', 'conversão de vídeo (ffmpeg)')
} catch (erro) {
  registra('aviso', 'conversão de vídeo (ffmpeg)', `não instalou (${String(erro.message).split('\n')[0]}). A página sai sem vídeo próprio; imagem e o resto funcionam.`)
}

async function tentaNavegador() {
  const { chromium } = await import('playwright')
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const navegador = await chromium.launch({ channel, headless: true, timeout: 30_000 })
      await navegador.close()
      return channel || 'chromium do Playwright'
    } catch {}
  }
  return null
}

let navegador = null
try {
  navegador = await tentaNavegador()
  if (!navegador) {
    const instalacao = roda(`"${process.execPath}" "${cliDoPlaywright()}" install chromium`, 'baixando um navegador para as capturas (~150 MB, só na primeira vez)')
    navegador = instalacao.ok ? await tentaNavegador() : null
  }
} catch {}

if (navegador) {
  registra('ok', `navegador para capturas: ${navegador}`)
}
if (!navegador) {
  const dica = process.platform === 'linux'
    ? `no Linux costuma faltar biblioteca do sistema. Rode:\n  sudo "${process.execPath}" "${cliDoPlaywright()}" install-deps chromium`
    : 'instale o Google Chrome (https://www.google.com/chrome) e rode este passo de novo.'
  registra('FALTA', 'navegador para capturas', dica)
}

const config = configuracao()
if (config.base && config.chave) {
  registra('ok', `acesso ao Cubo: ${config.base} (chave ${config.chave.slice(0, 8)}…)`, 'confira as permissões com: cubo.mjs check')
}
if (!config.base || !config.chave) {
  registra('FALTA', 'acesso ao Cubo', `falta ${[!config.base && 'CUBO_BASE_URL', !config.chave && 'CUBO_API_KEY'].filter(Boolean).join(' e ')} em ${config.arquivo}\nComo pegar: references/acesso.md`)
}

if (config.pagespeed) {
  registra('ok', 'chave do PageSpeed')
}
if (!config.pagespeed) {
  registra('aviso', 'chave do PageSpeed', `sem ela a nota final quase sempre falha (a cota pública do Google estoura todo dia).\nGrátis, 2 minutos: references/pagespeed.md. Dá para começar a página sem ela.`)
}

console.log('')
console.log('Requisitos da skill de landing page')
console.log(linhas.join('\n'))
console.log('')
console.log(bloqueado ? 'Resolva o que está como FALTA antes de começar.' : 'Tudo certo para começar.')
process.exit(bloqueado || !sharpOk ? 1 : 0)
