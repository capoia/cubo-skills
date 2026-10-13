#!/usr/bin/env node
// Onde a migração está: o que foi feito, o que falta e o comando que continua. É o primeiro script a
// rodar quando a conversa recomeça (ou quando algo caiu no meio).
import { existsSync } from 'node:fs'
import { AREA } from './areas.mjs'
import { ETAPAS, carregar, contagem } from './ledger.mjs'
import { pasta } from './lib.mjs'

const COMANDO = {
  acesso: 'conta.mjs conferir',
  escolha: 'plano.mjs --areas=…',
  plano: 'plano.mjs --areas=…',
  decisoes: 'decidir.mjs listar',
  aplicar: 'aplicar.mjs',
  'segunda-passada': 'aplicar.mjs',
  conferencia: 'conferir.mjs',
  relatorio: 'relatorio.mjs',
}
const ICONE = { pendente: '⬜', andamento: '⏳', feito: '✅', erro: '❌', bloqueado: '⛔' }

if (!existsSync(pasta('ledger.json'))) {
  console.log('Nenhuma migração começada nesta pasta.')
  console.log(`Próximo: node "<scripts>/conta.mjs" abrir origem`)
  process.exit(0)
}

const ledger = carregar()
if (ledger.origem && ledger.destino) console.log(`Migração: ${ledger.origem.nome} → ${ledger.destino.nome}`)
console.log(`Ledger: ${pasta('LEDGER.md')}\n`)

let proxima = null
for (const { chave, titulo } of ETAPAS) {
  const { status, detalhe } = ledger.etapas[chave]
  console.log(`${ICONE[status] || '⬜'} ${titulo}${detalhe ? ` — ${detalhe}` : ''}`)
  if (!proxima && status !== 'feito') proxima = chave
}

const porArea = contagem(ledger)
if (Object.keys(porArea).length) {
  console.log('\nPor área (prontos/total):')
  for (const kind of Object.keys(porArea).sort((a, b) => AREA[a].ordem - AREA[b].ordem)) {
    const l = porArea[kind]
    const prontos = (l.criado || 0) + (l.usado || 0) + (l.pulado || 0)
    const extra = [l.erro && `${l.erro} com erro`, l.aguardando && `${l.aguardando} aguardando`].filter(Boolean).join(', ')
    console.log(`  ${prontos === l.total ? '✔' : '…'} ${AREA[kind].rotulo}: ${prontos}/${l.total}${extra ? ` (${extra})` : ''}`)
  }
}
if (ledger.perguntas.length) console.log(`\n${ledger.perguntas.length} perguntas esperando resposta (decidir.mjs listar).`)
if (ledger.pendencias.length) console.log(`${ledger.pendencias.length} tarefas para fazer à mão na conta nova (vão no relatório).`)

console.log(proxima ? `\nPróximo: node "<scripts>/${COMANDO[proxima]}"` : '\nMigração concluída.')
