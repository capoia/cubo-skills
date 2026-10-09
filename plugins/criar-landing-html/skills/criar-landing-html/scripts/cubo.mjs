#!/usr/bin/env node
// Cliente da API do Cubo. Põe a chave e o Accept em toda chamada, imprime o corpo e, quando o
// código não é 2xx, imprime o código junto — erro silencioso aqui vira página publicada errada.
import { appendFileSync, chmodSync, existsSync, openAsBlob, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { apiCubo, argumentos, configuracao, exigeAcesso, falha } from './lib.mjs'

const [comando, caminho, dado] = process.argv.slice(2)
const config = configuracao()

const USO = `uso:
  cubo.mjs configurar --base=https://… --chave=sk_… [--pagespeed=…]
  cubo.mjs check
  cubo.mjs destino <funil> [etapa]   confere se o funil recebe leads (etapa e usuário ativo)
  cubo.mjs get    <caminho>
  cubo.mjs post   <caminho> [json|@arquivo.json]
  cubo.mjs put    <caminho> [json|@arquivo.json]
  cubo.mjs del    <caminho>
  cubo.mjs upload <caminho> <arquivo>

acesso (no ambiente, ou num arquivo .cubo.env na pasta de trabalho):
  CUBO_BASE_URL   https://crm-do-cliente.com.br
  CUBO_API_KEY    sk_...
  CUBO_CONFIG     outro arquivo no lugar do .cubo.env`

function corpo(entrada) {
  if (!entrada) return undefined
  if (!entrada.startsWith('@')) return entrada
  const arquivo = entrada.slice(1)
  if (!existsSync(arquivo)) falha(`${arquivo} não existe`, 2)
  return readFileSync(arquivo, 'utf8')
}

const chamar = (metodo, rota, conteudo) => apiCubo(metodo, rota, conteudo, config)

async function imprime(metodo, rota, conteudo) {
  const { codigo, texto } = await chamar(metodo, rota, conteudo)
  console.log(texto)
  if (codigo < 200 || codigo > 299) {
    console.error(`HTTP ${codigo}`)
    process.exit(1)
  }
}

// Variável de ambiente não sobrevive entre um comando e outro do Claude Code, então o acesso mora
// num arquivo. Ele é segredo: permissão só do dono e, se a pasta for repositório, fora do git.
function configurar() {
  const { opcoes } = argumentos(process.argv.slice(3))
  const novos = { CUBO_BASE_URL: opcoes.base, CUBO_API_KEY: opcoes.chave, PAGESPEED_API_KEY: opcoes.pagespeed }
  if (!Object.values(novos).some(Boolean)) falha('informe ao menos um: --base=https://… --chave=sk_… --pagespeed=…', 2)

  const linhas = existsSync(config.arquivo) ? readFileSync(config.arquivo, 'utf8').split(/\r?\n/).filter(Boolean) : []
  for (const [nome, valor] of Object.entries(novos)) {
    if (!valor) continue
    const limpo = nome === 'CUBO_BASE_URL' ? String(valor).trim().replace(/\/+$/, '') : String(valor).trim()
    const indice = linhas.findIndex((linha) => linha.startsWith(`${nome}=`))
    if (indice >= 0) linhas[indice] = `${nome}=${limpo}`
    if (indice < 0) linhas.push(`${nome}=${limpo}`)
  }
  writeFileSync(config.arquivo, `${linhas.join('\n')}\n`, { mode: 0o600 })
  chmodSync(config.arquivo, 0o600)

  const pasta = dirname(config.arquivo)
  const gitignore = join(pasta, '.gitignore')
  const repositorio = existsSync(join(pasta, '.git'))
  const jaIgnorado = existsSync(gitignore) && readFileSync(gitignore, 'utf8').split(/\r?\n/).includes(basename(config.arquivo))
  if (repositorio && !jaIgnorado) appendFileSync(gitignore, `${existsSync(gitignore) ? '\n' : ''}${basename(config.arquivo)}\n`)

  console.log(`gravado em ${config.arquivo}${repositorio ? ' (e fora do git)' : ''}`)
  for (const [nome, valor] of Object.entries(novos)) if (valor) console.log(`  ${nome}=${nome === 'CUBO_BASE_URL' ? valor : `${String(valor).slice(0, 8)}…`}`)
}

switch (comando) {
  case 'configurar':
    configurar()
    break
  case 'check': {
    exigeAcesso(config)
    console.log(`CRM:    ${config.base}`)
    console.log(`chave:  ${config.chave.slice(0, 10)}…\n`)
    console.log('— módulos da conta —')
    console.log((await chamar('GET', '/api/me/modules')).texto)
    console.log('\n— permissões da chave (403 = falta marcar na chave) —')
    const rotas = {
      landings: '/api/landings?perPage=1',
      forms: '/api/forms?perPage=1',
      domains: '/api/domains',
      customfields: '/api/customfields?perPage=1',
      pipes: '/api/pipes?perPage=1',
      deals: '/api/deals?perPage=1',
    }
    for (const [recurso, rota] of Object.entries(rotas)) {
      const { codigo } = await chamar('GET', rota)
      const estado = codigo >= 200 && codigo < 300 ? 'ok' : codigo === 403 ? 'FALTA PERMISSÃO' : codigo === 401 ? 'CHAVE INVÁLIDA' : `HTTP ${codigo}`
      console.log(`  ${recurso.padEnd(14)} ${estado}`)
    }
    break
  }
  // Formulário apontado para funil sem usuário ativo recusa TODO envio, e só se descobre quando o
  // primeiro lead de verdade bate na página publicada (foi o que aconteceu na Girbau).
  case 'destino': {
    exigeAcesso(config)
    const funilId = Number(caminho)
    const etapaId = dado ? Number(dado) : null
    if (!funilId) falha('informe o id do funil: cubo.mjs destino <funil> [etapa]', 2)
    let funil = null
    for (let pagina = 1; !funil && pagina <= 20; pagina++) {
      const { codigo, texto } = await chamar('GET', `/api/pipes?perPage=100&page=${pagina}`)
      if (codigo < 200 || codigo > 299) falha(`HTTP ${codigo} ao listar os funis: ${texto.slice(0, 200)}`)
      const resposta = JSON.parse(texto)
      const lista = Array.isArray(resposta) ? resposta : resposta.data ?? []
      funil = lista.find((item) => item.id === funilId) ?? null
      if (!lista.length || (resposta.meta && pagina >= (resposta.meta.lastPage ?? 1))) break
    }
    if (!funil) falha(`o funil ${funilId} não existe, ou o usuário da chave não participa dele`)
    const etapas = funil.stages ?? []
    const usuarios = funil.users ?? []
    console.log(`funil ${funil.name}: ${etapas.length} etapa(s), ${usuarios.length} usuário(s) ativo(s)${usuarios.length ? ` (${usuarios.map((u) => u.name).slice(0, 4).join(', ')})` : ''}`)
    const problemas = []
    if (!etapas.length) problemas.push('o funil não tem etapa: o formulário recusa todo envio')
    if (etapaId && !etapas.some((e) => e.id === etapaId)) problemas.push(`a etapa ${etapaId} não é deste funil`)
    if (!usuarios.length) problemas.push('o funil não tem nenhum usuário ativo: o formulário recusa todo envio. Peça para adicionarem alguém ao funil (configurações do funil) antes de publicar')
    if (problemas.length) {
      console.log(problemas.map((p) => `PROBLEMA: ${p}`).join('\n'))
      process.exit(1)
    }
    console.log('ok: o funil recebe leads')
    break
  }
  case 'get':
  case 'del':
    exigeAcesso(config)
    if (!caminho) falha('informe o caminho', 2)
    await imprime(comando === 'get' ? 'GET' : 'DELETE', caminho)
    break
  case 'post':
  case 'put':
    exigeAcesso(config)
    if (!caminho) falha('informe o caminho', 2)
    await imprime(comando.toUpperCase(), caminho, corpo(dado))
    break
  case 'upload': {
    exigeAcesso(config)
    if (!caminho || !dado) falha('informe o caminho e o arquivo', 2)
    if (!existsSync(dado)) falha(`${dado} não existe`, 2)
    const formulario = new FormData()
    formulario.append('file', await openAsBlob(dado, { type: dado.endsWith('.svg') ? 'image/svg+xml' : dado.endsWith('.webp') ? 'image/webp' : '' }), basename(dado))
    await imprime('POST', caminho, formulario)
    break
  }
  default:
    console.log(USO)
    process.exit(comando ? 2 : 0)
}
