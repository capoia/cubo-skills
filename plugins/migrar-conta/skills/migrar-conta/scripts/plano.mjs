#!/usr/bin/env node
// Lê a conta antiga e monta o plano. NÃO escreve em conta nenhuma: só lê as duas e grava o plano
// no ledger. Puxa junto o que cada item escolhido usa (dependências), casa usuários por e-mail, acha
// o que já existe na conta nova pelo nome e deixa as perguntas para a pessoa.
import { mkdirSync } from 'node:fs'
import { AREA, AREAS, GRUPOS, KINDS_DE_DADO, KIND_PUBLIC_ID, KIND_USUARIO, areasDaEscolha, rotuloDe } from './areas.mjs'
import { aviso, carregar, chaveItem, etapa, pendencia, registrar, salvar } from './ledger.mjs'
import { argumentos, falha, gravarJson, pasta, todos } from './lib.mjs'

// Áreas cujo nome depende de outro ID (estágio é por funil, pasta por pasta-mãe…): só dá para saber se
// já existem depois que o pai for criado. O `aplicar` confere na hora.
const NOME_COM_ID = new Set(['stage', 'knowledge_base_folder', 'agent_folder', 'automation_folder', 'landing', 'filter'])

const { opcoes } = argumentos()
const ledger = carregar()
if (ledger.etapas.acesso.status !== 'feito') falha('o acesso ainda não foi conferido. Rode antes: node "<scripts>/conta.mjs" conferir', 2)
if (!opcoes.areas && !ledger.escolha.length) falha(`diga o que migrar: --areas=todos ou uma lista separada por vírgula entre: ${GRUPOS.map((g) => g.chave).join(', ')}`, 2)

const temItensFeitos = Object.values(ledger.itens).some((item) => ['criado', 'usado'].includes(item.status))
if (temItensFeitos && opcoes.areas && !opcoes.refazer) {
  falha('esta pasta já tem uma migração em andamento. Para continuar, rode o aplicar. Para recomeçar do zero, use outra pasta de trabalho.', 2)
}

const escolha = opcoes.areas ? String(opcoes.areas).split(',').map((s) => s.trim()) : ledger.escolha
let escolhidas
try {
  escolhidas = areasDaEscolha(escolha.join(','))
} catch (erro) {
  falha(erro.message, 2)
}

etapa(ledger, 'escolha', 'feito', escolha.join(', '))
etapa(ledger, 'plano', 'andamento')
ledger.escolha = escolha
ledger.areas = escolhidas
salvar(ledger)

// ---------------------------------------------------------------------------------------------
// Leitura, com cache por área (origem e destino).

const daOrigem = {}
const doDestino = {}

async function lerOrigem(kind) {
  if (!daOrigem[kind]) {
    process.stdout.write(`  lendo ${AREA[kind].rotulo} da conta antiga… `)
    daOrigem[kind] = await todos('origem', `${AREA[kind].rota}?include=refs`)
    console.log(daOrigem[kind].length)
  }
  return daOrigem[kind]
}

async function lerDestino(kind) {
  if (!doDestino[kind]) doDestino[kind] = await todos('destino', AREA[kind].rota)
  return doDestino[kind]
}

// ---------------------------------------------------------------------------------------------

try {
  console.log('Lendo a conta antiga:')
  const itens = new Map() // chave → { kind, registro, motivo }
  const fila = []
  for (const kind of escolhidas) {
    if (AREA[kind].somenteCasar) continue
    for (const registro of await lerOrigem(kind)) {
      const chave = chaveItem(kind, registro.id)
      itens.set(chave, { kind, registro, motivo: 'escolhido' })
      fila.push(chave)
    }
  }

  // Dependências: tudo que um item usa e não foi escolhido entra junto (ou casa com o que existe).
  const usuariosUsados = new Set()
  const mcpUsados = new Map()
  let refsDeDado = 0
  while (fila.length) {
    const { registro } = itens.get(fila.shift())
    for (const ref of registro.refs || []) {
      if (ref.kind === KIND_USUARIO) usuariosUsados.add(String(ref.id))
      if (KINDS_DE_DADO.has(ref.kind)) refsDeDado++
      // O formulário embutido numa landing aparece pelo código público (frm_…): ele vem junto.
      if (ref.kind === KIND_PUBLIC_ID) {
        const formulario = (await lerOrigem('form')).find((f) => f.publicId === ref.id)
        if (formulario && !itens.has(chaveItem('form', formulario.id))) {
          itens.set(chaveItem('form', formulario.id), { kind: 'form', registro: formulario, motivo: 'dependencia' })
          fila.push(chaveItem('form', formulario.id))
        }
        continue
      }
      const area = AREA[ref.kind]
      if (!area) continue
      if (area.somenteCasar) {
        mcpUsados.set(String(ref.id), null)
        continue
      }
      const chave = chaveItem(ref.kind, ref.id)
      if (itens.has(chave)) continue
      const alvo = (await lerOrigem(ref.kind)).find((r) => String(r.id) === String(ref.id))
      if (!alvo) {
        aviso(ledger, `${area.rotulo}: o item nº ${ref.id}, usado em outro item, não existe na conta antiga (já estava quebrado lá). Vai ficar sem par.`)
        continue
      }
      itens.set(chave, { kind: ref.kind, registro: alvo, motivo: 'dependencia' })
      fila.push(chave)
    }
  }
  if (refsDeDado) aviso(ledger, `${refsDeDado} configurações apontam para negociações, pessoas ou organizações específicas (dados, que não se migram). Essas referências serão retiradas.`)

  // Foto da origem, por área, só com o que vai ser migrado.
  mkdirSync(pasta('origem'), { recursive: true })
  const porArea = {}
  for (const { kind, registro } of itens.values()) (porArea[kind] ||= []).push(registro)
  for (const [kind, registros] of Object.entries(porArea)) gravarJson(pasta('origem', `${kind}.json`), registros)

  // Itens no ledger. Rodar o plano de novo não apaga o que já foi feito.
  for (const [chave, { kind, registro, motivo }] of itens) {
    const anterior = ledger.itens[chave]
    if (anterior && ['criado', 'usado', 'pulado'].includes(anterior.status)) continue
    ledger.itens[chave] = { kind, origemId: registro.id, nome: rotuloDe(registro), motivo, status: 'pendente' }
  }

  const perguntas = []

  // Usuários: casa por e-mail; o resto vira pergunta.
  if (usuariosUsados.size) {
    console.log('Casando usuários pelo e-mail…')
    const deLa = await todos('origem', '/api/users')
    const daqui = await todos('destino', '/api/users')
    const porEmail = new Map(daqui.map((u) => [String(u.email || '').toLowerCase(), u]))
    ledger.usuariosDestino = daqui.map((u) => ({ id: u.id, nome: u.name, email: u.email }))
    for (const id of usuariosUsados) {
      if (ledger.decisoes.usuarios[id] !== undefined) continue
      const usuario = deLa.find((u) => String(u.id) === id)
      const par = usuario && porEmail.get(String(usuario.email || '').toLowerCase())
      if (par) {
        ledger.decisoes.usuarios[id] = par.id
        continue
      }
      perguntas.push({
        id: `usuario:${id}`,
        tipo: 'usuario',
        origemId: id,
        texto: `Usuário “${usuario?.name ?? `nº ${id}`}” (${usuario?.email ?? 'sem e-mail'}) não existe na conta nova. Quem fica no lugar dele?`,
      })
    }
  }

  // MCP: só casa pelo nome com as conexões que já existem na conta nova.
  if (mcpUsados.size) {
    const deLa = await todos('origem', AREA.mcp_connection.rota)
    const daqui = await lerDestino('mcp_connection')
    for (const id of mcpUsados.keys()) {
      if (ledger.decisoes.mcp[id] !== undefined) continue
      const conexao = deLa.find((c) => String(c.id) === id)
      const par = conexao && daqui.find((c) => AREA.mcp_connection.nome(c) === AREA.mcp_connection.nome(conexao))
      if (par) {
        ledger.decisoes.mcp[id] = par.id
        continue
      }
      perguntas.push({
        id: `mcp:${id}`,
        tipo: 'mcp',
        origemId: id,
        texto: `Conexão MCP “${conexao?.name ?? `nº ${id}`}” (${conexao?.type ?? '?'}) é usada por agentes, mas não existe na conta nova e não dá para copiar (nasce de login). Conectar na conta nova antes de seguir, ou seguir sem ela (as ferramentas dela saem dos agentes)?`,
      })
    }
  }

  // Domínio: não pode existir nas duas contas ao mesmo tempo.
  for (const { kind, registro } of itens.values()) {
    if (kind !== 'domain' || ledger.decisoes.dominios[registro.id] !== undefined) continue
    perguntas.push({
      id: `dominio:${registro.id}`,
      tipo: 'dominio',
      origemId: registro.id,
      texto: `O domínio ${registro.domain} não pode estar nas duas contas ao mesmo tempo. Tirar da conta antiga (as páginas dele saem do ar até a conta nova verificar) ou usar outro domínio na conta nova?`,
    })
  }

  // O que já existe na conta nova, pelo nome (as áreas simples; as outras o `aplicar` confere na hora).
  console.log('Procurando na conta nova o que já existe…')
  const existentes = {}
  for (const [chave, { kind, registro }] of itens) {
    if (NOME_COM_ID.has(kind) || kind === 'domain' || ledger.itens[chave].status !== 'pendente') continue
    const area = AREA[kind]
    const par = (await lerDestino(kind)).find((r) => area.nome(r) === area.nome(registro))
    if (!par) continue
    existentes[kind] = (existentes[kind] || 0) + 1
    ledger.itens[chave].existeNoDestino = par.id
    if (ledger.decisoes.existentes[chave] || ledger.decisoes.existentesTodos) continue
    perguntas.push({
      id: `existente:${chave}`,
      tipo: 'existente',
      chave,
      destinoId: par.id,
      texto: `${area.rotulo}: “${ledger.itens[chave].nome}” já existe na conta nova. Usar o que já existe, criar outro igual, ou pular?`,
    })
  }

  // Pendências que já se sabe que vão existir (reconectar integração etc.).
  for (const { kind, registro } of itens.values()) pendencia(ledger, AREA[kind].pendencia?.(registro), { kind, origemId: registro.id })

  ledger.perguntas = perguntas
  etapa(ledger, 'plano', 'feito', `${itens.size} itens`)
  etapa(ledger, 'decisoes', perguntas.length ? 'andamento' : 'feito', perguntas.length ? `${perguntas.length} perguntas` : 'nada a decidir')
  registrar(ledger, `Plano: ${itens.size} itens em ${Object.keys(porArea).length} áreas; ${perguntas.length} perguntas`)
  salvar(ledger)

  // Resumo para a pessoa.
  console.log('\nPLANO (nada foi alterado ainda):')
  for (const area of AREAS) {
    const lista = porArea[area.kind]
    if (!lista) continue
    const dependencias = lista.filter((r) => itens.get(chaveItem(area.kind, r.id)).motivo === 'dependencia').length
    const jaExistem = existentes[area.kind] || 0
    const partes = [`${lista.length} ${lista.length === 1 ? 'item' : 'itens'}`]
    if (dependencias) partes.push(`${dependencias} vindo${dependencias === 1 ? '' : 's'} junto porque outro item usa`)
    if (jaExistem) partes.push(`${jaExistem} já existe${jaExistem === 1 ? '' : 'm'} na conta nova`)
    console.log(`  • ${area.rotulo}: ${partes.join(', ')}`)
  }
  if (ledger.avisos.length) {
    console.log('\nAVISOS:')
    for (const texto of ledger.avisos) console.log(`  • ${texto}`)
  }
  if (ledger.pendencias.length) console.log(`\nDepois da migração, ${ledger.pendencias.length} coisas vão precisar ser feitas à mão na conta nova (reconectar integrações etc.). Elas vão no relatório.`)
  if (perguntas.length) {
    console.log(`\nPERGUNTAS (${perguntas.length}) — responda com o decidir.mjs:`)
    for (const pergunta of perguntas) console.log(`  [${pergunta.id}] ${pergunta.texto}`)
  } else console.log('\nNada a decidir. Pode aplicar.')
} catch (erro) {
  etapa(ledger, 'plano', 'erro', erro.message)
  registrar(ledger, `Plano falhou: ${erro.message}`)
  salvar(ledger)
  falha(erro.message)
}
