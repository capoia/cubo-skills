// Peças comuns aos scripts. Tudo aqui precisa rodar igual em Windows, macOS e Linux: nada de
// caminho com barra fixa, nada de comando do sistema, nada que dependa de shell.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCRIPTS = dirname(fileURLToPath(import.meta.url))
export const NODE_MINIMO = [20, 9]

export function falha(mensagem, codigo = 1) {
  console.error(`erro: ${mensagem}`)
  process.exit(codigo)
}

export function kb(bytes) {
  return Math.ceil(bytes / 1024)
}

// `.cubo.env` na pasta onde a pessoa está trabalhando. Variável de ambiente vence o arquivo.
export function configuracao() {
  const arquivo = resolve(process.env.CUBO_CONFIG || '.cubo.env')
  const doArquivo = {}
  if (existsSync(arquivo)) {
    for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const achado = linha.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (!achado) continue
      doArquivo[achado[1]] = achado[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  const valor = (nome) => process.env[nome] || doArquivo[nome] || ''
  return {
    arquivo,
    existe: existsSync(arquivo),
    base: valor('CUBO_BASE_URL').replace(/\/+$/, ''),
    chave: valor('CUBO_API_KEY'),
    pagespeed: valor('PAGESPEED_API_KEY'),
  }
}

export function exigeAcesso(config = configuracao()) {
  if (config.base && config.chave) return config
  falha(`faltam CUBO_BASE_URL e/ou CUBO_API_KEY.\nDefina no ambiente, ou crie ${config.arquivo} com as duas linhas.`, 2)
}

// `conteudo` em texto vai como JSON; FormData vai como multipart (o fetch põe o boundary).
export async function apiCubo(metodo, rota, conteudo, config = exigeAcesso()) {
  const cabecalhos = { 'X-API-Key': config.chave, Accept: 'application/json' }
  if (typeof conteudo === 'string') cabecalhos['Content-Type'] = 'application/json'
  const resposta = await fetch(`${config.base}${rota}`, {
    method: metodo,
    headers: cabecalhos,
    body: conteudo,
    signal: AbortSignal.timeout(120_000),
  }).catch((erro) => falha(`não consegui falar com ${config.base}: ${erro.cause?.code || erro.message}`))
  return { codigo: resposta.status, texto: await resposta.text() }
}

// As dependências moram em `scripts/node_modules`, instaladas pelo `requisitos.mjs`. Importar daqui
// dá uma mensagem que diz o que fazer, em vez do "Cannot find package" cru do Node.
export async function dependencia(nome) {
  try {
    return await import(nome)
  } catch (erro) {
    if (erro?.code === 'ERR_MODULE_NOT_FOUND') {
      falha(`a dependência "${nome}" não está instalada. Rode primeiro:\n  node "${join(SCRIPTS, 'requisitos.mjs')}"`, 3)
    }
    throw erro
  }
}

export function cliDoPlaywright() {
  const require = createRequire(join(SCRIPTS, 'package.json'))
  return join(dirname(require.resolve('playwright/package.json')), 'cli.js')
}

// Chrome e Edge instalados servem, e o Edge vem em todo Windows. Só na falta dos dois usamos o
// Chromium que o Playwright baixa (~150 MB), instalado pelo `requisitos.mjs`.
export async function abrirNavegador() {
  const { chromium } = await dependencia('playwright')
  const tentativas = [{ channel: 'chrome' }, { channel: 'msedge' }, {}]
  for (const opcao of tentativas) {
    try {
      const navegador = await chromium.launch({ ...opcao, headless: true, timeout: 30_000 })
      return { navegador, qual: opcao.channel || 'chromium' }
    } catch {}
  }
  falha(`nenhum navegador disponível. Rode:\n  node "${join(SCRIPTS, 'requisitos.mjs')}"`, 3)
}

export async function baixar(url, limiteBytes = 25 * 1024 * 1024) {
  const resposta = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cubo-skills/criar-landing-html)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  })
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} ao baixar ${url}`)
  const buffer = Buffer.from(await resposta.arrayBuffer())
  if (buffer.length > limiteBytes) throw new Error(`${url} tem ${kb(buffer.length)} KB, acima do que faz sentido baixar`)
  return buffer
}

export function argumentos(lista = process.argv.slice(2)) {
  const posicionais = []
  const opcoes = {}
  for (const item of lista) {
    const achado = item.match(/^--([a-z-]+)(?:=(.*))?$/)
    if (achado) {
      opcoes[achado[1]] = achado[2] ?? true
      continue
    }
    posicionais.push(item)
  }
  return { posicionais, opcoes }
}
