// Acesso à conta e cliente da API do Cubo. Erro aqui tem que dizer o que fazer, porque quem lê não é
// técnico.
import { existsSync, readFileSync } from 'node:fs'
import { espera, falha, pasta } from './lib.mjs'

// O endereço do Cubo é um só para todas as contas (a chave é que diz qual conta): ele vem do
// `cubo.json` do plugin, e não da pessoa. `CUBO_BASE_URL` no arquivo de acesso só serve para teste
// (um CRM local) e para o Cubo de marca branca.
export function enderecoPadrao() {
  try {
    const config = JSON.parse(readFileSync(new URL('../cubo.json', import.meta.url), 'utf8'))
    return String(config.endereco || '').replace(/\/+$/, '')
  } catch {
    return ''
  }
}

export function arquivoDeAcesso() {
  return pasta('.cubo.env')
}

export function acesso() {
  const arquivo = arquivoDeAcesso()
  const valores = {}
  if (existsSync(arquivo)) {
    for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const achado = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (achado) valores[achado[1]] = achado[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  return {
    arquivo,
    existe: existsSync(arquivo),
    base: (valores.CUBO_BASE_URL || enderecoPadrao()).replace(/\/+$/, ''),
    chave: valores.CUBO_API_KEY || '',
  }
}

export function exigeAcesso() {
  const config = acesso()
  if (config.base && config.chave) return config
  falha(`falta a chave de acesso ao Cubo: o arquivo ${config.arquivo} precisa da linha CUBO_API_KEY.\n  Para abrir o arquivo e colar: node "<motor>/acesso.mjs" abrir`, 2)
}

export class ErroApi extends Error {
  constructor(mensagem, { codigo, rota, corpo } = {}) {
    super(mensagem)
    this.codigo = codigo
    this.rota = rota
    this.corpo = corpo
  }
}

// O 422 de validação traz `errors[]` com `{ path, code, message }`; os outros, `message` ou `error`.
export function mensagensDoCorpo(corpo) {
  if (Array.isArray(corpo?.errors) && corpo.errors.length) return corpo.errors.map((erro) => (erro.path ? `${erro.message} (${erro.path})` : erro.message))
  const uma = corpo?.message || corpo?.error
  return uma ? [String(uma)] : []
}

function explica(codigo, metodo, rota, corpo) {
  const detalhe = mensagensDoCorpo(corpo).join('; ')
  if (codigo === 401) return 'o Cubo recusou a chave (401). Confira se ela foi colada inteira, sem espaço, e se não foi apagada no Cubo.'
  if (codigo === 403) {
    const escopo = String(detalhe).match(/scope:\s*([\w*-]+:[\w*]+)/)?.[1]
    if (escopo) return `a chave não tem a permissão "${escopo}" (403). No Cubo: Configurações → Chaves de API → editar a chave → marcar essa permissão.`
    if (/m[oó]dulo|module/i.test(detalhe)) return `a conta não tem o módulo ligado para ${metodo} ${rota} (403): ${detalhe}. Peça ao suporte do Cubo para ligar.`
    return `o Cubo negou ${metodo} ${rota} (403): ${detalhe || 'sem permissão'}.`
  }
  if (codigo === 404) return `o Cubo não achou ${metodo} ${rota} (404). Ou o item não existe (confira o número), ou o Cubo ainda não tem essa rota.`
  if (codigo === 412) return 'alguém mudou este item no Cubo enquanto eu trabalhava (412). Nada foi gravado: é preciso reler e aplicar de novo.'
  if (codigo === 422) return `o Cubo recusou os dados de ${metodo} ${rota} (422):\n  - ${mensagensDoCorpo(corpo).join('\n  - ') || 'dado inválido'}`
  if (codigo === 429) return 'o Cubo pediu para ir mais devagar (429), e as esperas acabaram. Espere um minuto e rode de novo.'
  return `o Cubo respondeu ${codigo} em ${metodo} ${rota}${detalhe ? `: ${detalhe}` : ''}`
}

// GET tenta de novo em 429/5xx/queda de rede. Escrita só em 429: o Cubo recusou sem executar (teto
// de escritas por minuto por chave). 5xx e queda numa escrita NÃO repetem: o POST pode ter sido
// feito, e repetir às cegas duplicaria.
//
// Devolve o corpo; com `{ completo: true }`, `{ status, corpo, etag }` (para ETag, 304 e If-Match).
export async function api(metodo, rota, dado, { cabecalhos = {}, completo = false, config = exigeAcesso(), aviso = 'o Cubo aceita um número de pedidos por minuto' } = {}) {
  const tentativas = metodo === 'GET' ? 4 : 1
  let esperasPorTeto = 0
  for (let tentativa = 1; ; tentativa++) {
    let resposta
    try {
      resposta = await fetch(`${config.base}${rota}`, {
        method: metodo,
        headers: {
          'X-API-Key': config.chave,
          Accept: 'application/json',
          ...(dado === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...cabecalhos,
        },
        body: dado === undefined ? undefined : JSON.stringify(dado),
        signal: AbortSignal.timeout(180_000),
      })
    } catch (erro) {
      if (tentativa < tentativas) {
        await espera(1000 * tentativa)
        continue
      }
      throw new ErroApi(`não consegui falar com o Cubo em ${config.base} (${erro.cause?.code || erro.message}). Confira a internet; se ela estiver boa, o Cubo pode estar fora do ar.`, { rota })
    }
    const etag = resposta.headers.get('etag')
    if (resposta.status === 304) return completo ? { status: 304, corpo: undefined, etag } : undefined
    const texto = await resposta.text()
    let corpo
    try {
      corpo = texto ? JSON.parse(texto) : undefined
    } catch {
      corpo = { message: texto.slice(0, 300) }
    }
    if (resposta.ok) return completo ? { status: resposta.status, corpo, etag } : corpo
    if (resposta.status === 429 && esperasPorTeto < 8) {
      esperasPorTeto++
      const cabecalho = resposta.headers.get('retry-after')
      const pedido = cabecalho === null ? NaN : Number(cabecalho)
      const ms = Number.isFinite(pedido) && pedido >= 0 ? pedido * 1000 : Math.min(60_000, 5000 * esperasPorTeto)
      // Sem aviso, um minuto parado parece travamento.
      if (ms >= 2000) console.log(`  (o Cubo pediu uma pausa: ${aviso}. Esperando ${Math.round(ms / 1000)} s e sigo sozinho…)`)
      await espera(ms)
      tentativa--
      continue
    }
    if ((resposta.status === 429 || resposta.status >= 500) && tentativa < tentativas) {
      await espera(1500 * tentativa)
      continue
    }
    throw new ErroApi(explica(resposta.status, metodo, rota, corpo), { codigo: resposta.status, rota, corpo })
  }
}

const POR_PAGINA = 100

// Lê todas as páginas de uma lista. O Cubo responde `{ data, metadata: { lastPage } }`; lista simples
// também serve.
export async function todos(rota) {
  const separador = rota.includes('?') ? '&' : '?'
  const itens = []
  for (let pagina = 1; pagina < 10_000; pagina++) {
    const corpo = await api('GET', `${rota}${separador}page=${pagina}&perPage=${POR_PAGINA}`)
    if (Array.isArray(corpo)) return corpo
    const lista = corpo?.data ?? []
    itens.push(...lista)
    const ultima = corpo?.metadata?.lastPage ?? corpo?.meta?.lastPage ?? 1
    if (pagina >= ultima || lista.length === 0) break
  }
  return itens
}

// O objeto vem direto ou em `{ data }`.
export function desembrulhar(corpo) {
  return corpo && typeof corpo === 'object' && !Array.isArray(corpo) && !('id' in corpo) && corpo.data && typeof corpo.data === 'object' ? corpo.data : corpo
}

export async function detalhe(rota, id, consulta = '') {
  return desembrulhar(await api('GET', `${rota}/${id}${consulta}`))
}

// Leitura com o ETag, para gravar depois com If-Match.
export async function detalheComEtag(rota, id, consulta = '') {
  const { corpo, etag } = await api('GET', `${rota}/${id}${consulta}`, undefined, { completo: true })
  return { item: desembrulhar(corpo), etag }
}

export async function quemSou() {
  const corpo = await api('GET', '/api/whoami')
  return corpo?.data ?? corpo
}
