#!/usr/bin/env node
// Explicar um fluxo, em duas partes:
//   preparar <id|nome>  lê tudo, descreve, junta os problemas e imprime o roteiro para o Claude;
//   pagina <id>         junta o texto que o Claude escreveu e gera a página, que abre sozinha.
// Não muda nada na conta.
import { existsSync } from 'node:fs'
import { abrirNoSistema, argumentos, falha, gravarJson, gravarTexto, lerJson, pasta } from '../lib.mjs'
import { quemChamaFluxo, varrer } from '../usos.mjs'
import { caminhoEmTexto, caminhos } from './caminhos.mjs'
import { acharFluxo, contarProblemas, contexto, juntarProblemas, lerFluxo, paginaDoFluxo, problemasEmTexto, validar } from './comum.mjs'
import { descrever, diferencas, roteiro } from './descrever.mjs'
import { nosDoFluxo } from './modelo.mjs'

const USO = `uso:
  explicar.mjs preparar <id|nome> [--sem-usos]
  explicar.mjs pagina <id>`

async function preparar(alvo, opcoes) {
  const id = await acharFluxo(alvo)
  // A publicada é a que roda. Nunca publicado: o rascunho.
  let { fluxo } = await lerFluxo(id, { versao: 'published' })
  const nuncaPublicado = fluxo.publishedVersion === null || fluxo.publishedVersion === undefined
  let rascunho = null
  if (nuncaPublicado) fluxo = (await lerFluxo(id, { versao: 'draft' })).fluxo
  else if (fluxo.hasUnpublishedChanges) rascunho = (await lerFluxo(id, { versao: 'draft', refs: false })).fluxo

  const ctx = await contexto(fluxo.refs || [])
  const descricao = descrever(fluxo, ctx)
  const validacao = await validar({ flowData: fluxo.flowData }, id)
  const problemas = juntarProblemas({ fluxo, validacao, defs: ctx.defs, descricao, nomes: ctx.nomes })
  const exemplos = caminhos(descricao)
  const usos = opcoes['sem-usos'] ? null : quemChamaFluxo(await varrer(), id)
  const dif = rascunho ? diferencas(fluxo, rascunho) : null

  const dados = { tipo: 'fluxo', id, preparadoEm: new Date().toISOString(), nuncaPublicado, descricao, problemas, caminhos: exemplos, usos, diferencas: dif, nosOriginais: nosDoFluxo(fluxo) }
  const arquivoDados = pasta('explicacoes', `fluxo-${id}.dados.json`)
  gravarJson(arquivoDados, dados)

  const conta = contarProblemas(problemas)
  const saida = [
    roteiro(descricao),
    '',
    nuncaPublicado ? 'ATENÇÃO: este fluxo NUNCA FOI PUBLICADO. O roteiro é do rascunho; nada disso está rodando.' : null,
    dif && !dif.igual ? `ATENÇÃO: há mudanças salvas e NÃO PUBLICADAS (o roteiro é da versão publicada, a que roda). No rascunho: ${[...dif.adicionados.map((n) => `entra “${n.titulo || n.tipo}”`), ...dif.removidos.map((n) => `sai “${n.titulo || n.tipo}”`), ...dif.alterados.map((n) => `muda “${n.titulo || n.tipo}”`), ...(dif.ligacoesMudaram ? ['mudam as ligações'] : [])].join('; ')}.` : null,
    '',
    'CAMINHOS LIDOS DO DESENHO (não são execuções):',
    ...(exemplos.length ? exemplos.map((c, i) => `  ${i + 1}) ${caminhoEmTexto(c)}`) : ['  (nenhum)']),
    '',
    'QUEM CHAMA ESTE FLUXO:',
    ...(usos === null ? ['  (não varri)'] : usos.length ? usos.map((u) => `  - ${u.onde} “${u.nome}” (#${u.id}): ${u.detalhe}`) : ['  ninguém: só os gatilhos']),
    '',
    `PROBLEMAS: ${conta.erro} erro(s), ${conta.aviso} aviso(s), ${conta.nota} observação(ões)`,
    problemasEmTexto(problemas),
    '',
    `PRÓXIMO: escreva ${pasta('explicacoes', `fluxo-${id}.texto.json`)} com`,
    '  { "resumo": "…", "passos": { "<nº do passo>": "frase simples" }, "caminhos": [{ "titulo": "…", "historia": "…" }] }',
    `  (uma frase para cada passo de 1 a ${descricao.passos.length}, exceto o início) e rode: explicar.mjs pagina ${id}`,
  ].filter((linha) => linha !== null)
  console.log(saida.join('\n'))
}

function paginaCli(id) {
  if (!/^\d+$/.test(String(id ?? ''))) falha(USO, 2)
  const dados = lerJson(pasta('explicacoes', `fluxo-${id}.dados.json`), null)
  if (!dados) falha(`rode antes: explicar.mjs preparar ${id}`, 2)
  const arquivoTexto = pasta('explicacoes', `fluxo-${id}.texto.json`)
  if (!existsSync(arquivoTexto)) falha(`falta o texto: escreva ${arquivoTexto} (veja o fim do "preparar").`, 2)
  const textoDoClaude = lerJson(arquivoTexto, {})
  const faltam = dados.descricao.passos.filter((p) => p.tipo !== 'start' && !(textoDoClaude.passos || {})[p.n]).map((p) => p.n)
  if (!textoDoClaude.resumo) falha(`o texto não tem "resumo". Escreva o resumo em ${arquivoTexto} e rode de novo.`, 2)
  const html = paginaDoFluxo({ dados, textoDoClaude, titulo: `Fluxo: ${dados.descricao.nome}`, subtitulo: `Automação nº ${id} · ${dados.descricao.ligado ? 'ligada' : 'desligada'}${dados.nuncaPublicado ? ' · nunca publicada' : ''}` })
  const arquivo = pasta('explicacoes', `fluxo-${id}.html`)
  gravarTexto(arquivo, html)
  abrirNoSistema(arquivo)
  console.log(`Página pronta: ${arquivo}`)
  if (faltam.length) console.log(`(sem frase para os passos ${faltam.join(', ')}: usei a descrição do catálogo)`)
}

const { opcoes, posicionais } = argumentos(process.argv.slice(2))
const [comando, alvo] = posicionais
if (comando === 'preparar') await preparar(posicionais.slice(1).join(' ') || alvo, opcoes)
else if (comando === 'pagina') paginaCli(alvo)
else falha(USO, 2)
