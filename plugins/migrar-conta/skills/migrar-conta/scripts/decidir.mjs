#!/usr/bin/env node
// Grava no ledger o que a pessoa decidiu. O Claude faz a pergunta (com escolha clicável) e chama
// este script com a resposta; a decisão fica salva e o `aplicar` respeita.
import { carregar, etapa, registrar, salvar } from './ledger.mjs'
import { falha } from './lib.mjs'

const USO = `uso:
  decidir.mjs listar                                   perguntas em aberto, com as opções
  decidir.mjs usuario <nºOrigem> <nºDestino|dono>      quem fica no lugar do usuário
  decidir.mjs existente <área:nº> <usar|criar|pular>   item que já existe na conta nova
  decidir.mjs existentes-todos <usar|criar|pular>      a mesma resposta para todos os que já existem
  decidir.mjs dominio <nº> <trocar|pular|outro:dominio.com.br>
  decidir.mjs mcp <nº> remover                         seguir sem a conexão MCP (para usar, conecte
                                                       na conta nova e rode o plano de novo)`

const [comando, alvo, resposta] = process.argv.slice(2)
const ledger = carregar()

// `exigir: false` serve para mudar uma resposta já dada (ex.: "criar" deu nome repetido, agora "usar").
function tira(id, { exigir = true } = {}) {
  const antes = ledger.perguntas.length
  ledger.perguntas = ledger.perguntas.filter((pergunta) => pergunta.id !== id)
  if (exigir && ledger.perguntas.length === antes) falha(`não há pergunta em aberto "${id}". Veja as que existem: decidir.mjs listar`, 2)
}

function fecha(texto) {
  registrar(ledger, `Decisão: ${texto}`)
  if (!ledger.perguntas.length) etapa(ledger, 'decisoes', 'feito', 'tudo decidido')
  else etapa(ledger, 'decisoes', 'andamento', `${ledger.perguntas.length} perguntas`)
  salvar(ledger)
  console.log(`ok: ${texto}. ${ledger.perguntas.length ? `Faltam ${ledger.perguntas.length} perguntas.` : 'Nada mais a decidir.'}`)
}

if (comando === 'listar') {
  if (!ledger.perguntas.length) {
    console.log('Nenhuma pergunta em aberto.')
    process.exit(0)
  }
  for (const pergunta of ledger.perguntas) {
    console.log(`[${pergunta.id}] ${pergunta.texto}`)
    if (pergunta.tipo === 'usuario') {
      const usuarios = ledger.usuariosDestino || []
      console.log(`   opções: dono (o dono da chave da conta nova)${usuarios.length ? `, ou um destes: ${usuarios.map((u) => `${u.id}=${u.nome} <${u.email}>`).join('; ')}` : ''}`)
    }
    if (pergunta.tipo === 'existente') console.log('   opções: usar | criar | pular')
    if (pergunta.tipo === 'dominio') console.log('   opções: trocar | pular | outro:<novo domínio>')
    if (pergunta.tipo === 'mcp') console.log('   opções: remover (ou conectar na conta nova e rodar o plano de novo)')
  }
} else if (comando === 'usuario') {
  if (!alvo || !resposta) falha(USO, 2)
  if (resposta !== 'dono' && !/^\d+$/.test(resposta)) falha('responda com o número do usuário da conta nova, ou "dono".', 2)
  if (resposta !== 'dono' && ledger.usuariosDestino && !ledger.usuariosDestino.some((u) => String(u.id) === resposta)) {
    falha(`o usuário nº ${resposta} não existe na conta nova. Veja as opções: decidir.mjs listar`, 2)
  }
  tira(`usuario:${alvo}`)
  ledger.decisoes.usuarios[alvo] = resposta === 'dono' ? 'dono' : Number(resposta)
  fecha(`usuário ${alvo} → ${resposta}`)
} else if (comando === 'existente') {
  if (!alvo || !['usar', 'criar', 'pular'].includes(resposta)) falha(USO, 2)
  if (!ledger.itens[alvo]) falha(`não conheço o item "${alvo}". O formato é área:nº, como aparece no listar.`, 2)
  tira(`existente:${alvo}`, { exigir: false })
  ledger.decisoes.existentes[alvo] = resposta
  fecha(`${alvo} → ${resposta}`)
} else if (comando === 'existentes-todos') {
  const escolha = alvo
  if (!['usar', 'criar', 'pular'].includes(escolha)) falha(USO, 2)
  ledger.decisoes.existentesTodos = escolha
  const abertas = ledger.perguntas.filter((pergunta) => pergunta.tipo === 'existente')
  for (const pergunta of abertas) ledger.decisoes.existentes[pergunta.chave] = escolha
  ledger.perguntas = ledger.perguntas.filter((pergunta) => pergunta.tipo !== 'existente')
  fecha(`todos os itens que já existem → ${escolha} (${abertas.length} agora, e os que aparecerem depois)`)
} else if (comando === 'dominio') {
  const valido = ['trocar', 'pular'].includes(resposta) || /^outro:[a-z0-9.-]+\.[a-z]{2,}$/i.test(resposta || '')
  if (!alvo || !valido) falha(USO, 2)
  tira(`dominio:${alvo}`)
  ledger.decisoes.dominios[alvo] = resposta.toLowerCase()
  fecha(`domínio ${alvo} → ${resposta}`)
} else if (comando === 'mcp') {
  if (!alvo || resposta !== 'remover') falha(USO, 2)
  tira(`mcp:${alvo}`)
  ledger.decisoes.mcp[alvo] = 'remover'
  fecha(`MCP ${alvo} → remover das ferramentas dos agentes`)
} else falha(USO, 2)
