#!/usr/bin/env node
// A prova de que nada passou: relê na conta nova cada item criado, com `?include=refs`, e exige que
// todo ID aponte para algo QUE EXISTE NA CONTA NOVA. No Cubo, um ID errado não dá erro: a ferramenta
// do agente some calada, a automação move o lead para lugar nenhum. Aqui ele aparece.
// Também confere se os textos grandes (prompt, base de conhecimento, HTML) chegaram inteiros.
import { createHash } from 'node:crypto'
import { AREA, KINDS_DE_DADO, KIND_ARQUIVO, KIND_CHAVE, KIND_PUBLIC_ID, KIND_USUARIO } from './areas.mjs'
import { carregar, etapa, registrar, salvar } from './ledger.mjs'
import { detalhe, falha, todos } from './lib.mjs'
import { ler } from './refs.mjs'

const ledger = carregar()
if (!['feito', 'bloqueado'].includes(ledger.etapas.aplicar.status)) falha('ainda não há o que conferir: rode o aplicar antes.', 2)

etapa(ledger, 'conferencia', 'andamento')
salvar(ledger)

const idsNoDestino = {}
async function existeNoDestino(kind, id) {
  if (!idsNoDestino[kind]) {
    const rota = kind === KIND_USUARIO ? '/api/users' : AREA[kind]?.rota
    if (!rota) return false
    const lista = await todos('destino', rota)
    idsNoDestino[kind] = new Set(lista.map((registro) => String(registro.id)))
    if (kind === 'form') idsNoDestino[KIND_PUBLIC_ID] = new Set(lista.map((registro) => String(registro.publicId)))
  }
  return idsNoDestino[kind].has(String(id))
}

const idsDaOrigem = (kind) => new Set(Object.keys(ledger.mapa[kind] || {}))
const pastaDaOrigem = ledger.origem ? `companies/${ledger.origem.companyId}/` : null

const problemas = []
const avisos = []
let conferidos = 0

try {
  const criados = Object.values(ledger.itens).filter((item) => item.status === 'criado')
  for (const item of criados) {
    const area = AREA[item.kind]
    const registro = await detalhe('destino', area.rota, item.destinoId, '?include=refs')
    conferidos++
    const rotulo = `${area.rotulo} “${item.nome}” (nº ${item.destinoId} na conta nova)`

    for (const ref of registro.refs || []) {
      const onde = ref.path + (ref.token ? ` (“${ref.token}”)` : '')
      if (KINDS_DE_DADO.has(ref.kind)) {
        problemas.push({ item: rotulo, texto: `${onde} aponta para um ${ref.kind} específico (dado da conta antiga)` })
        continue
      }
      if (ref.kind === KIND_CHAVE) {
        problemas.push({ item: rotulo, texto: `${onde} ainda tem uma chave de API embutida` })
        continue
      }
      if (ref.kind === KIND_ARQUIVO) {
        if (pastaDaOrigem && String(ref.id).includes(pastaDaOrigem)) avisos.push({ item: rotulo, texto: `${onde} ainda usa um arquivo guardado na conta antiga (${ref.id})` })
        continue
      }
      const kindParaConferir = ref.kind === KIND_PUBLIC_ID ? 'form' : ref.kind
      if (ref.kind === KIND_PUBLIC_ID) {
        await existeNoDestino('form', 0)
        if (idsNoDestino[KIND_PUBLIC_ID].has(String(ref.id))) continue
      } else if (await existeNoDestino(kindParaConferir, ref.id)) continue

      const daOrigem = idsDaOrigem(ref.kind).has(String(ref.id))
      problemas.push({
        item: rotulo,
        texto: `${onde} aponta para ${ref.kind} nº ${ref.id}, que não existe na conta nova${daOrigem ? ' — é o número da CONTA ANTIGA, não foi trocado' : ''}`,
      })
    }

    // Textos grandes: o que voltou tem que ser igual ao que foi mandado (mesma impressão digital).
    for (const [campo, { tamanho, hash }] of Object.entries(item.textos || {})) {
      const voltou = ler(registro, campo)
      if (typeof voltou !== 'string') continue
      if (createHash('sha256').update(voltou).digest('hex') === hash) continue
      problemas.push({
        item: rotulo,
        texto: voltou.length < tamanho
          ? `o texto de “${campo}” chegou CORTADO: ${voltou.length} de ${tamanho} caracteres`
          : `o texto de “${campo}” chegou diferente do enviado (${voltou.length} × ${tamanho} caracteres)`,
      })
    }
  }
} catch (erro) {
  etapa(ledger, 'conferencia', 'erro', erro.message)
  salvar(ledger)
  falha(erro.message)
}

ledger.conferencia = { quando: new Date().toISOString(), conferidos, problemas, avisos }
etapa(ledger, 'conferencia', problemas.length ? 'erro' : 'feito', problemas.length ? `${problemas.length} problemas` : `${conferidos} itens conferidos, nenhum ID da conta antiga`)
registrar(ledger, `Conferência: ${conferidos} itens, ${problemas.length} problemas, ${avisos.length} avisos`)
salvar(ledger)

console.log(`Conferi ${conferidos} itens na conta nova.`)
if (problemas.length) {
  console.log(`\n✘ ${problemas.length} problemas:`)
  for (const { item, texto } of problemas) console.log(`  • ${item}: ${texto}`)
}
if (avisos.length) {
  console.log(`\n${avisos.length} avisos:`)
  for (const { item, texto } of avisos) console.log(`  • ${item}: ${texto}`)
}
if (!problemas.length) console.log('\n✔ Nenhum ID da conta antiga sobrou. Todas as ligações apontam para a conta nova.')
else process.exit(1)
