// Peças comuns aos scripts da migração. Tudo aqui roda igual em Windows, macOS e Linux, só com o
// Node (20.9+): nada de dependência para instalar, nada de comando de shell.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const CONTAS = ['origem', 'destino']
export const NOME_CONTA = { origem: 'conta de origem (a antiga)', destino: 'conta nova (destino)' }

export function falha(mensagem, codigo = 1) {
  console.error(`\n✘ ${mensagem}`)
  process.exit(codigo)
}

// --chave=valor e --flag viram opções; o resto, posicionais.
export function argumentos(lista = process.argv.slice(2)) {
  const opcoes = {}
  const posicionais = []
  for (const item of lista) {
    const achado = item.match(/^--([^=]+)(?:=(.*))?$/)
    if (achado) opcoes[achado[1]] = achado[2] ?? true
    else posicionais.push(item)
  }
  return { opcoes, posicionais }
}

// A pasta de trabalho fica onde a pessoa abriu o Claude Code. O teste muda com CUBO_MIGRACAO_PASTA.
export function pasta(...partes) {
  const raiz = resolve(process.env.CUBO_MIGRACAO_PASTA || 'migracao')
  if (!existsSync(raiz)) mkdirSync(raiz, { recursive: true })
  return join(raiz, ...partes)
}

export function lerJson(arquivo, padrao) {
  if (!existsSync(arquivo)) return padrao
  return JSON.parse(readFileSync(arquivo, 'utf8'))
}

// Grava num temporário e renomeia: se o processo cair no meio, o arquivo antigo continua inteiro.
export function gravarJson(arquivo, dado) {
  const temporario = `${arquivo}.tmp`
  writeFileSync(temporario, `${JSON.stringify(dado, null, 2)}\n`)
  renameSync(temporario, arquivo)
}

// ---------------------------------------------------------------------------------------------
// Acesso às contas: migracao/origem.env e migracao/destino.env.

export function arquivoDaConta(conta) {
  return pasta(`${conta}.env`)
}

export function acesso(conta) {
  const arquivo = arquivoDaConta(conta)
  const valores = {}
  if (existsSync(arquivo)) {
    for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (achado) valores[achado[1]] = achado[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  return {
    conta,
    arquivo,
    existe: existsSync(arquivo),
    base: (valores.CUBO_BASE_URL || '').replace(/\/+$/, ''),
    chave: valores.CUBO_API_KEY || '',
  }
}

export function exigeAcesso(conta) {
  const config = acesso(conta)
  if (config.base && config.chave) return config
  falha(
    `falta o acesso à ${NOME_CONTA[conta]}: o arquivo ${config.arquivo} precisa das linhas CUBO_BASE_URL e CUBO_API_KEY.\n` +
      `  Para abrir o arquivo e colar: node "<scripts>/conta.mjs" abrir ${conta}`,
    2,
  )
}

// ---------------------------------------------------------------------------------------------
// Cliente da API. Erro aqui tem que dizer o que fazer, porque quem lê não é técnico.

export class ErroApi extends Error {
  constructor(mensagem, { codigo, rota, conta, corpo } = {}) {
    super(mensagem)
    this.codigo = codigo
    this.rota = rota
    this.conta = conta
    this.corpo = corpo
  }
}

function explica(codigo, conta, metodo, rota, corpo) {
  const qual = NOME_CONTA[conta]
  const detalhe = corpo?.errors?.map((erro) => erro.message).join('; ') || corpo?.message || ''
  if (codigo === 401) return `a ${qual} recusou a chave (401). Confira se ela foi colada inteira, sem espaço, e se não está desativada.`
  if (codigo === 403) {
    const escopo = String(detalhe).match(/scope:\s*([\w*-]+:[\w*]+)/)?.[1]
    if (escopo) return `a chave da ${qual} não tem a permissão "${escopo}" (403). No Cubo: Configurações → Chaves de API → editar a chave → marcar essa permissão.`
    return `a ${qual} negou ${metodo} ${rota} (403): ${detalhe || 'sem permissão'}.`
  }
  if (codigo === 404) return `a ${qual} não conhece ${metodo} ${rota} (404). Ou o item não existe, ou o Cubo dessa conta ainda não tem essa rota (precisa estar atualizado).`
  if (codigo === 422) return `a ${qual} recusou os dados de ${metodo} ${rota} (422): ${detalhe || 'dado inválido'}`
  if (codigo === 429) return `a ${qual} pediu para ir mais devagar (429).`
  return `a ${qual} respondeu ${codigo} em ${metodo} ${rota}${detalhe ? `: ${detalhe}` : ''}`
}

const espera = (ms) => new Promise((pronto) => setTimeout(pronto, ms))

// GET tenta de novo em 429/5xx/queda de rede. Escrita NÃO: um POST repetido às cegas duplicaria.
export async function api(conta, metodo, rota, dado, config = exigeAcesso(conta)) {
  const tentativas = metodo === 'GET' ? 4 : 1
  for (let tentativa = 1; ; tentativa++) {
    let resposta
    try {
      resposta = await fetch(`${config.base}${rota}`, {
        method: metodo,
        headers: {
          'X-API-Key': config.chave,
          Accept: 'application/json',
          ...(dado === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: dado === undefined ? undefined : JSON.stringify(dado),
        signal: AbortSignal.timeout(120_000),
      })
    } catch (erro) {
      if (tentativa < tentativas) {
        await espera(1000 * tentativa)
        continue
      }
      throw new ErroApi(`não consegui falar com a ${NOME_CONTA[conta]} em ${config.base} (${erro.cause?.code || erro.message}). Confira o endereço no arquivo ${config.arquivo} e a internet.`, { rota, conta })
    }
    const texto = await resposta.text()
    let corpo
    try {
      corpo = texto ? JSON.parse(texto) : undefined
    } catch {
      corpo = { message: texto.slice(0, 300) }
    }
    if (resposta.ok) return corpo
    if ((resposta.status === 429 || resposta.status >= 500) && tentativa < tentativas) {
      await espera(1500 * tentativa)
      continue
    }
    throw new ErroApi(explica(resposta.status, conta, metodo, rota, corpo), { codigo: resposta.status, rota, conta, corpo })
  }
}

// Lê todas as páginas de uma lista paginada ({data, meta}) ou uma lista simples.
export async function todos(conta, rota) {
  const separador = rota.includes('?') ? '&' : '?'
  const itens = []
  for (let pagina = 1; pagina < 10_000; pagina++) {
    const corpo = await api(conta, 'GET', `${rota}${separador}page=${pagina}&perPage=100`)
    if (Array.isArray(corpo)) return corpo
    const lista = corpo?.data ?? []
    itens.push(...lista)
    const ultima = corpo?.meta?.lastPage ?? 1
    if (pagina >= ultima || lista.length === 0) break
  }
  return itens
}

// ---------------------------------------------------------------------------------------------
// Abrir arquivo ou página no programa padrão do sistema. Único ponto que depende do sistema, e só
// porque não existe jeito portátil de abrir o bloco de notas.

export function abrirNoSistema(alvo, { editor = false } = {}) {
  if (process.env.CUBO_MIGRACAO_NAO_ABRIR) return false
  const [comando, args] =
    process.platform === 'win32'
      ? editor
        ? ['notepad.exe', [alvo]]
        : ['cmd.exe', ['/c', 'start', '', alvo]]
      : process.platform === 'darwin'
        ? ['open', editor ? ['-t', alvo] : [alvo]]
        : ['xdg-open', [alvo]]
  try {
    const filho = spawn(comando, args, { detached: true, stdio: 'ignore' })
    filho.on('error', () => {})
    filho.unref()
    return true
  } catch {
    return false
  }
}
