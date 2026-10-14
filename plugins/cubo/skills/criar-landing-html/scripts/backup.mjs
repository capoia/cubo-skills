#!/usr/bin/env node
// Guarda a versão atual da landing antes de mexer nela, e devolve ao estado guardado quando algo
// der errado. Página no ar é anúncio rodando: desfazer precisa ser mais rápido que explicar.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { apiCubo, falha } from './lib.mjs'

// Só os campos que o PUT aceita. Mandar `id`, `createdAt` ou `publicUrl` faz a API recusar tudo.
const ACEITOS = [
  'title', 'url', 'domainId', 'status',
  'html', 'head', 'codeHead', 'codeBody',
  'metaDescription', 'robots', 'favicon', 'fonts',
  'gtmCode', 'pixelCode', 'uaCode', 'ga4Code', 'clarityCode',
  'cookieAlert', 'enhanceData',
]

const USO = `uso:
  backup.mjs guardar <id> [pasta]      guarda a landing (padrão: ./backups-lp)
  backup.mjs restaurar <arquivo.json>  devolve a landing ao estado do arquivo

O que é guardado: title, url, status, todo o conteúdo (html, head, code_head, code_body),
SEO (meta description, robots, favicon, fontes) e os códigos de rastreamento.

⚠️ O que NÃO é guardado, porque a API de leitura não devolve: as integrações da Meta ligadas
à página. Se a landing tem API de Conversões, confira no CRM depois de restaurar.`

async function cubo(metodo, rota, conteudo) {
  const { codigo, texto } = await apiCubo(metodo, rota, conteudo)
  if (codigo < 200 || codigo > 299) falha(`HTTP ${codigo}: ${texto.slice(0, 600)}`)
  return texto
}

function carimbo() {
  const agora = new Date()
  const dois = (n) => String(n).padStart(2, '0')
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}-${dois(agora.getHours())}${dois(agora.getMinutes())}${dois(agora.getSeconds())}`
}

async function guardar(id, pasta = 'backups-lp') {
  if (!id) falha('informe o id da landing', 2)
  mkdirSync(pasta, { recursive: true })
  const base = join(pasta, `landing-${id}-${carimbo()}`)

  const dados = JSON.parse(await cubo('GET', `/api/landings/${id}`)).data
  if (!dados) falha('a resposta não trouxe a landing. Confira o id e a chave.')

  writeFileSync(`${base}.json`, JSON.stringify(dados, null, 2))
  writeFileSync(`${base}.html`, dados.html || '')
  writeFileSync(`${base}.head.html`, dados.head || '')

  console.log(`guardado: ${dados.title} (${dados.publicUrl || 'sem domínio'})`)
  console.log(`  status:   ${dados.status} · construtor: ${dados.builderVersion}`)
  console.log(`  conteúdo: ${(dados.html || '').length} caracteres de html, ${(dados.head || '').length} de head`)
  console.log(`  arquivos: ${base}.json`)
  console.log(`            ${base}.html  (só o corpo, para ler e comparar)`)
  console.log(`            ${base}.head.html`)
}

async function restaurar(arquivo) {
  if (!arquivo) falha('informe o arquivo de backup', 2)
  if (!existsSync(arquivo)) falha(`${arquivo} não existe`, 2)
  const dados = JSON.parse(readFileSync(arquivo, 'utf8'))
  const corpo = Object.fromEntries(ACEITOS.filter((campo) => campo in dados).map((campo) => [campo, dados[campo]]))
  await cubo('PUT', `/api/landings/${dados.id}`, JSON.stringify(corpo))
  console.log(`restaurada a landing ${dados.id} para o estado de ${arquivo}`)
}

const [comando, ...resto] = process.argv.slice(2)
if (comando === 'guardar') await guardar(...resto)
if (comando === 'restaurar') await restaurar(...resto)
if (comando !== 'guardar' && comando !== 'restaurar') {
  console.log(USO)
  process.exit(comando && !['-h', '--help', 'help'].includes(comando) ? 2 : 0)
}
