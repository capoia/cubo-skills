// Peças comuns do motor das skills de fluxo e agente. Roda igual em Windows, macOS e Linux, só com o
// Node (20.9+): nada de dependência, nada de comando de shell.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

// A versão mínima do Node, a mesma da skill de landing. Mais velho, o acesso.mjs para e diz como atualizar.
export const NODE_MINIMO = '20.9'
export function nodeAntigo(versao = process.versions.node) {
  const [maior, menor] = String(versao).replace(/^v/, '').split('.').map(Number)
  const [minimoMaior, minimoMenor] = NODE_MINIMO.split('.').map(Number)
  return maior < minimoMaior || (maior === minimoMaior && menor < minimoMenor)
}

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

// A pasta de trabalho é `cubo/`, onde a pessoa abriu o Claude Code, e é a mesma para as seis skills.
// O teste muda com CUBO_PASTA.
export function pasta(...partes) {
  const raiz = resolve(process.env.CUBO_PASTA || 'cubo')
  const caminho = join(raiz, ...partes)
  const diretorio = partes.length && /\.[a-z]+$/i.test(partes.at(-1)) ? dirname(caminho) : caminho
  if (!existsSync(diretorio)) mkdirSync(diretorio, { recursive: true })
  return caminho
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

// `@arquivo.json` lê o arquivo (corpo grande não cabe na linha de comando do Windows); o resto é o
// próprio texto.
export function lerEntrada(valor, nome = 'entrada') {
  if (typeof valor !== 'string' || !valor) falha(`falta a ${nome}.`, 2)
  if (!valor.startsWith('@')) return valor
  const arquivo = resolve(valor.slice(1))
  if (!existsSync(arquivo)) falha(`não achei o arquivo ${arquivo}.`, 2)
  return readFileSync(arquivo, 'utf8')
}

export function lerJsonEntrada(valor, nome) {
  const texto = lerEntrada(valor, nome)
  try {
    return JSON.parse(texto)
  } catch (erro) {
    falha(`a ${nome} não é um JSON válido: ${erro.message}`, 2)
  }
}

export const espera = (ms) => new Promise((pronto) => setTimeout(pronto, ms))

// Sem acento, sem maiúscula, sem espaço sobrando: é como se compara nome digitado com nome da conta.
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function agora() {
  return new Date().toISOString()
}

// Data e hora boas para nome de arquivo nos três sistemas (sem `:`).
export function carimbo(data = new Date()) {
  return data.toISOString().replace(/[:.]/g, '-')
}

// Abrir arquivo ou página no programa padrão do sistema. Único ponto que depende do sistema, e só
// porque não existe jeito portátil de abrir o bloco de notas.
export function abrirNoSistema(alvo, { editor = false } = {}) {
  if (process.env.CUBO_NAO_ABRIR) return false
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

export function gravarTexto(arquivo, texto) {
  writeFileSync(arquivo, texto)
}

// O arquivo foi chamado direto (`node arquivo.mjs`) e não importado? Compara pelo caminho real:
// no macOS o /tmp é link, e no Windows a letra do disco muda de caixa.
export function ehPrincipal(urlDoModulo) {
  if (!process.argv[1]) return false
  const real = (caminho) => {
    try {
      return realpathSync(caminho)
    } catch {
      return resolve(caminho)
    }
  }
  const a = real(fileURLToPath(urlDoModulo))
  const b = real(process.argv[1])
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}
