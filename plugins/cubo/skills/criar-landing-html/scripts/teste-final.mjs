#!/usr/bin/env node
// O teste final de conversão: abre a página PUBLICADA num navegador de verdade, preenche o
// formulário como uma pessoa, envia, e segue o lead até a negociação no Cubo, conferindo campo por
// campo o que chegou. É a única prova de que o caminho inteiro funciona: página, SDK, domínio
// autorizado, funil com gente, campos, UTM e o evento da Meta.
import { writeFileSync } from 'node:fs'
import { abrirNavegador, apiCubo, argumentos, configuracao, exigeAcesso, falha } from './lib.mjs'

const { posicionais, opcoes } = argumentos()
const [endereco] = posicionais

if (!endereco) {
  console.log(`uso: teste-final.mjs <endereço publicado> [--telefone="(11) 98888-7777"]

Envia UM lead de teste pela página publicada e confere a negociação criada.

--telefone  opcional; sem ele vai ${'(11) 90000-0000'}. Use o seu se quiser receber o que as
            automações do funil mandam para o lead.

O lead sai com o nome "TESTE FINAL DE CONVERSÃO (pode apagar)" e a URL com as cinco UTMs
(utm_source=teste-final…), para ninguém confundir com cliente de verdade. Apague a negociação depois.
Grava teste-final.json, que o entrega.mjs usa no checklist.`)
  process.exit(2)
}

const config = exigeAcesso(configuracao())
const NOME = 'TESTE FINAL DE CONVERSÃO (pode apagar)'
const TELEFONE = opcoes.telefone || '(11) 90000-0000'
const UTM = { utm_source: 'teste-final', utm_medium: 'skill-landing', utm_campaign: 'validacao-da-pagina', utm_term: 'teste-de-conversao', utm_content: 'lead-de-teste' }
const url = new URL(endereco)
for (const [chave, valor] of Object.entries(UTM)) url.searchParams.set(chave, valor)

const { navegador } = await abrirNavegador()
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 900 } })
let resposta = null
const pixel = []
pagina.on('response', async (r) => {
  if (r.request().method() === 'POST' && /\/public\/forms\/[^/]+\/submissions/.test(r.url())) {
    resposta = { status: r.status(), corpo: await r.json().catch(() => null) }
  }
})
pagina.on('request', (r) => {
  if (/facebook\.com\/tr/.test(r.url())) pixel.push(new URL(r.url()).searchParams.get('ev'))
})

await pagina.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 45_000 })
const host = pagina.locator('.lf-host').first()
await host.locator('.lf-form').waitFor({ timeout: 20_000 }).catch(() => falha('o formulário não apareceu na página publicada — o SDK carregou? o endereço do Cubo no trecho está certo?'))

const publicId = await pagina.evaluate(() => {
  const s = [...document.scripts].map((x) => x.textContent || '').join(' ')
  return (s.match(/frm_[A-Za-z0-9]{16}/) || [])[0] || null
})
if (!publicId) falha('não achei o frm_… no trecho do formulário da página')
const definicao = (await (await fetch(`${config.base}/public/forms/${publicId}`)).json()).data

const preenchidos = {}
const hoje = new Date().toISOString().slice(0, 16)
for (const campo of definicao.fields.filter((f) => !f.hidden)) {
  const controle = host.locator(`[name="${campo.key}"]`)
  if (campo.key === 'title') await controle.fill(NOME)
  if (campo.key === 'phone') await controle.pressSequentially(TELEFONE.replace(/\D/g, ''))
  if (campo.key === 'title' || campo.key === 'phone') {
    preenchidos[campo.key] = campo.key === 'title' ? NOME : TELEFONE
    continue
  }
  if (campo.kind === 'state') {
    const valor = await controle.evaluate((s) => ([...s.options].find((o) => /^(SP|São Paulo)$/i.test(o.value) || /São Paulo/.test(o.text)) || s.options[1]).value)
    await controle.selectOption(valor)
    preenchidos[campo.key] = valor
    continue
  }
  if (campo.kind === 'city') {
    await pagina.waitForFunction((el) => el.options.length > 1 && !el.disabled, await controle.elementHandle(), { timeout: 15_000 }).catch(() => {})
    const valor = await controle.evaluate((s) => s.options[1]?.value ?? '')
    await controle.selectOption(valor)
    preenchidos[campo.key] = valor
    continue
  }
  if (campo.kind === 'selectbox') {
    const valor = await controle.evaluate((s) => s.options[1]?.value ?? '')
    await controle.selectOption(valor)
    preenchidos[campo.key] = valor
    continue
  }
  const valor = campo.kind === 'datetime' ? hoje
    : campo.inputType === 'email' ? 'teste-final@teste.cubosuite.com.br'
      : ['number', 'integer'].includes(campo.inputType) || campo.kind === 'number' ? '1'
        : campo.inputType === 'letters' ? 'Teste'
          : 'Teste final de conversão'
  await controle.fill(valor)
  preenchidos[campo.key] = valor
}
const aceite = host.locator('input[name="lgpd"]')
if (await aceite.count()) await aceite.check()

// O SDK segura envio rápido demais para ser gente (minFillSeconds): espera como uma pessoa.
await pagina.waitForTimeout(3500)
await host.locator('button[type="submit"]').click()
for (let i = 0; i < 40 && !resposta; i++) await pagina.waitForTimeout(500)
await pagina.waitForTimeout(1500)
const naTela = await host.locator('.lf-success, .lf-form-error').first().innerText().catch(() => '')
await pagina.screenshot({ path: 'teste-final.jpg', type: 'jpeg', quality: 70, fullPage: false })
await navegador.close()

console.log(`página:     ${url.href}`)
console.log(`formulário: ${publicId}`)
const registrar = (dados) => writeFileSync('teste-final.json', JSON.stringify({ pagina: url.href, formulario: publicId, testadoEm: new Date().toISOString(), ...dados }, null, 2))
if (!resposta) registrar({ ok: false, motivo: 'o envio não saiu da página' })
if (!resposta) falha('o envio não saiu da página (nenhuma resposta do Cubo). Veja teste-final.jpg: campo com erro?')
if (resposta.status !== 202) {
  registrar({ ok: false, motivo: `recusado: ${resposta.corpo?.error?.message || resposta.status}` })
  console.log(`\nRECUSADO (${resposta.status}): ${resposta.corpo?.error?.message || JSON.stringify(resposta.corpo)}`)
  console.log(naTela ? `na tela: ${naTela}` : '')
  process.exit(1)
}
const eventId = resposta.corpo?.data?.eventId
console.log(`envio:      aceito (${eventId})${naTela ? ` — na tela: "${naTela.replace(/\s+/g, ' ').slice(0, 80)}"` : ''}`)
console.log(`pixel:      ${pixel.includes('Lead') || pixel.includes(definicao.settings?.tracking?.metaEventName) ? 'evento de conversão disparado' : pixel.length ? `só ${[...new Set(pixel)].join(', ')}` : 'nenhum pixel da Meta na página (normal se a conta não usa)'}`)

let negociacao = null
for (let i = 0; i < 45 && !negociacao; i++) {
  const { codigo, texto } = await apiCubo('GET', `/api/deals/async/${eventId}`, undefined, config)
  const estado = codigo === 200 ? JSON.parse(texto).data : null
  if (estado?.status === 'failed') falha('o Cubo recebeu o envio mas não conseguiu criar a negociação (status failed). Veja o funil e os campos obrigatórios da etapa.')
  if (estado?.status === 'done') negociacao = estado.deal
  if (!negociacao) await new Promise((pronto) => setTimeout(pronto, 2000))
}
if (!negociacao) registrar({ ok: false, motivo: 'a negociação não apareceu em 90 s' })
if (!negociacao) falha('a negociação não apareceu em 90 s — a fila do Cubo pode estar atrasada; confira no funil daqui a pouco.')
console.log(`negociação: #${negociacao.id} "${negociacao.title}", responsável ${negociacao.user?.name ?? '—'}`)

const link = `${config.base}/deals/${negociacao.id}/edit`
const detalhe = await apiCubo('GET', `/api/deals/${negociacao.id}`, undefined, config)
if (detalhe.codigo === 403) {
  registrar({ ok: true, negociacao: { id: negociacao.id, link, responsavel: negociacao.user?.name ?? null }, campos: null, utms: null, pixel: pixel.includes('Lead') })
  console.log('\nA negociação foi criada, mas a chave não tem "Negócios: leitura" para conferir os campos. Marque essa permissão na chave e rode de novo, ou confira à mão no funil.')
  process.exit(0)
}
const deal = JSON.parse(detalhe.texto)
const chegou = new Map((deal.normalizedCustomfields || []).map((c) => [`cf_${c.customfieldId}`, String(c.value ?? '')]))
const nomes = new Map(definicao.fields.map((f) => [f.key, f.label]))

console.log(`funil:      ${deal.pipe?.name ?? deal.pipeId} → ${deal.stage?.name ?? deal.stageId}\n`)
let faltou = 0
const campos = []
for (const [chave, enviado] of Object.entries(preenchidos)) {
  const recebido = chave === 'title' ? deal.title : chave === 'phone' ? (deal.people?.phone ?? '') : (chegou.get(chave) ?? '')
  const ok = chave === 'phone' ? recebido.replace(/\D/g, '').endsWith(String(enviado).replace(/\D/g, '').slice(-8)) : recebido !== ''
  if (!ok) faltou++
  campos.push({ nome: nomes.get(chave) || chave, ok, valor: recebido })
  console.log(`  ${ok ? 'ok     ' : 'FALTOU '} ${(nomes.get(chave) || chave).slice(0, 34).padEnd(34)} ${recebido ? `"${recebido.slice(0, 50)}"` : '(vazio)'}`)
}
const utmChegou = [...chegou.values()].filter((v) => Object.values(UTM).includes(v))
registrar({
  ok: !faltou && utmChegou.length > 0,
  negociacao: { id: negociacao.id, link, titulo: deal.title, funil: deal.pipe?.name ?? null, etapa: deal.stage?.name ?? null, responsavel: negociacao.user?.name ?? null },
  campos,
  utms: { gravadas: utmChegou.length, enviadas: Object.keys(UTM).length },
  pixel: pixel.includes('Lead') || pixel.includes(definicao.settings?.tracking?.metaEventName) ? 'disparado' : pixel.length ? 'sem o evento de conversão' : 'sem pixel na página',
})
console.log(`\n  UTM:       ${utmChegou.length ? `${utmChegou.length} de ${Object.keys(UTM).length} gravadas (${utmChegou.join(', ')})` : 'NENHUMA gravada — mapeie utm_source, utm_medium, utm_campaign, utm_term e utm_content em tracking.utm do formulário (formulario.md)'}`)
console.log(`  link:      ${link}`)
console.log(`\nApague a negociação #${negociacao.id} no funil depois de conferir (ela está marcada como teste no nome e na UTM).`)
console.log('captura do envio: teste-final.jpg')
process.exit(faltou || !utmChegou.length ? 1 : 0)
