#!/usr/bin/env node
// O checklist de entrega: junta o que os outros scripts gravaram (prévia, PageSpeed, teste final) e
// confere a página no ar, num resumo em Markdown que o Claude cola na mensagem final para a pessoa.
// Nada aqui é afirmado de memória: o que não foi medido aparece como "não medido".
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { argumentos } from './lib.mjs'

const { posicionais, opcoes } = argumentos()
const [endereco] = posicionais
if (!endereco) {
  console.log(`uso: entrega.mjs <endereço publicado> [--pasta=lp] [--titulo="…"]

Lê, da pasta (padrão: a atual, depois ./lp):
  previa/resultado.json       o que a prévia achou (telas, avisos, rascunhos)
  pagespeed-mobile.json       notas do celular      (pagespeed.mjs <url>)
  pagespeed-desktop.json      notas do computador   (pagespeed.mjs <url> desktop)
  teste-final.json            o lead de teste       (teste-final.mjs <url> --telefone=…)
e imprime o checklist em Markdown. Cole a saída inteira na mensagem de entrega.`)
  process.exit(2)
}

const pastas = [opcoes.pasta, '.', 'lp'].filter(Boolean).map((p) => resolve(p))
const ler = (nome) => {
  const achado = pastas.map((p) => join(p, nome)).find(existsSync)
  return achado ? JSON.parse(readFileSync(achado, 'utf8')) : null
}
const previa = ler(join('previa', 'resultado.json'))
const celular = ler('pagespeed-mobile.json')
const computador = ler('pagespeed-desktop.json')
const teste = ler('teste-final.json')

const linhas = []
const marca = (ok, atencao) => (ok ? '✅' : atencao ? '⚠️' : '❌')
const linha = (item, estado, detalhe) => linhas.push(`| ${estado} | ${item} | ${detalhe} |`)

const noAr = await fetch(endereco, { redirect: 'follow', signal: AbortSignal.timeout(30_000) })
  .then(async (r) => ({ status: r.status, html: await r.text() }))
  .catch((erro) => ({ status: 0, html: '', erro: erro.cause?.code || erro.message }))
const temFormulario = /frm_[A-Za-z0-9]{16}/.test(noAr.html)
linha('Página no ar', marca(noAr.status === 200), noAr.status === 200 ? `respondeu 200${temFormulario ? ', com o formulário do Cubo' : ' — **sem o trecho do formulário**'}` : `não respondeu (${noAr.status || noAr.erro})`)

const notas = (medida, nome) => {
  if (!medida) return linha(`PageSpeed ${nome}`, '➖', 'não medido — rode o pagespeed.mjs')
  const n = medida.notas
  const desempenho = n.Desempenho ?? 0
  linha(`PageSpeed ${nome}`, marca(desempenho >= 90, desempenho >= 50), Object.entries(n).map(([k, v]) => `${k} **${v}**`).join(' · '))
}
notas(celular, 'no celular')
notas(computador, 'no computador')

if (!previa) linha('Responsivo', '➖', 'sem prévia capturada — rode o previa.mjs --capturar')
if (previa) {
  const abertos = previa.avisos.length
  linha('Responsivo', marca(!previa.rolagemLateral && !abertos, !previa.rolagemLateral), `conferido em ${previa.telas.join(' e ')}${previa.rolagemLateral ? ' — **rola para o lado**' : ', sem rolagem lateral'}${abertos ? `; ${abertos} aviso(s) em aberto` : ', nenhum aviso em aberto'}`)
  if (previa.comparadaComSite) linha('Cara do site', marca(!previa.avisos.some((a) => /o site usa|o site não usa|o site anima|formulário:/.test(a)), true), 'comparada com o raio-x do site (cantos, títulos, botão, formulário)')
}

if (!teste) linha('Lead de teste', '❌', 'não enviado — rode o teste-final.mjs')
if (teste && !teste.negociacao) linha('Lead de teste', '❌', teste.motivo || 'falhou')
if (teste?.negociacao) {
  const n = teste.negociacao
  const campos = teste.campos ? `${teste.campos.filter((c) => c.ok).length} de ${teste.campos.length} campos` : 'campos não conferidos (a chave não lê negócios)'
  const utms = teste.utms ? `${teste.utms.gravadas} de ${teste.utms.enviadas} UTMs` : ''
  const utmIncompleta = teste.utms && teste.utms.gravadas < teste.utms.enviadas
  linha('Lead de teste', marca(teste.ok && !utmIncompleta, true), `[negociação #${n.id}](${n.link}) — ${[campos, utms].filter(Boolean).join(', ')}${n.funil ? `, em ${n.funil} › ${n.etapa}` : ''}${n.responsavel ? `, com ${n.responsavel}` : ''}`)
  if (utmIncompleta) linha('UTMs', '⚠️', `só ${teste.utms.gravadas} de ${teste.utms.enviadas} são gravadas — mapeie as que faltam em tracking.utm do formulário, senão a origem do lead se perde`)
  if (teste.campos?.some((c) => !c.ok)) linha('Campos que não chegaram', '❌', teste.campos.filter((c) => !c.ok).map((c) => c.nome).join(', '))
  linha('Pixel da Meta', teste.pixel === 'disparado' ? '✅' : '➖', teste.pixel === 'disparado' ? 'evento de conversão disparado no envio' : teste.pixel)
}

const rascunhos = previa?.rascunhos ?? []
if (rascunhos.length) linha('Trechos em rascunho', '⚠️', `${rascunhos.length}: ${rascunhos.slice(0, 3).join('; ')}${rascunhos.length > 3 ? '…' : ''}`)

const tudoOk = !linhas.some((l) => /\| (❌|⚠️) \|/.test(l))
console.log(`## ${tudoOk ? '✅ Landing page entregue' : '⚠️ Landing page publicada, com pendências'}${opcoes.titulo ? ` — ${opcoes.titulo}` : ''}

**No ar:** ${endereco}

| | Checagem | Resultado |
|---|---|---|
${linhas.join('\n')}
${teste?.negociacao ? `\n**Falta você:** apagar a negociação de teste [#${teste.negociacao.id}](${teste.negociacao.link}) depois de conferir.` : ''}`)
