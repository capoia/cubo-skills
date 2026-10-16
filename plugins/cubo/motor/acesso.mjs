#!/usr/bin/env node
// Acesso à conta do Cubo. A chave nunca passa pela conversa: a pessoa cola no arquivo, que abre no
// editor do sistema. O `conferir` testa a conexão e as permissões que a skill pede, e não deixa
// seguir enquanto faltar algo.
import { chmodSync, existsSync, writeFileSync } from 'node:fs'
import { acesso, api, arquivoDeAcesso } from './api.mjs'
import { abrirNoSistema, argumentos, falha, gravarJson, pasta } from './lib.mjs'

const USO = `uso:
  acesso.mjs abrir                                 cria o arquivo de acesso (se faltar) e abre no editor
  acesso.mjs conferir --para=<skill> [--simular]   testa a chave; sai com erro se faltar algo
     <skill>: explicar-fluxo · explicar-agente · investigar-teste · editar-fluxo · criar-fluxo · editar-agente · criar-agente`

const MODELO = `# Acesso ao Cubo, para as skills de fluxo e agente.
# Cole a chave de API na linha de baixo, salve o arquivo (Ctrl+S) e feche.
#
# No Cubo: Configurações → Chaves de API → Nova chave. Crie com um usuário administrador.
# Para só explicar: permissão de LEITURA em tudo.
# Para criar e editar: LEITURA, CRIAÇÃO e EDIÇÃO em tudo.
# Para os exemplos de agente: marque também "Agentes de IA: simular".
# Cole a chave inteira depois do sinal de igual, sem espaço.
CUBO_API_KEY=
`

// O que cada skill precisa. `leituraGeral`: os nomes de etapa, tag, campo… vêm das outras áreas;
// sem a leitura delas a explicação mostra só o número.
const PEDIDOS = {
  'explicar-fluxo': { escopos: { automations: ['read'], agents: ['read'], channels: ['read'] }, leituraGeral: true },
  'explicar-agente': { escopos: { agents: ['read'], automations: ['read'], channels: ['read'] }, leituraGeral: true, simular: true },
  'investigar-teste': { escopos: { conversations: ['read'], automations: ['read'], agents: ['read'], channels: ['read'] }, leituraGeral: true },
  'editar-fluxo': { escopos: { automations: ['read', 'create', 'update'] }, leituraGeral: true },
  'criar-fluxo': { escopos: { automations: ['read', 'create', 'update'] }, leituraGeral: true },
  'editar-agente': { escopos: { agents: ['read', 'update'], automations: ['read'], channels: ['read'] }, admin: true, modulo: 'ai-agents', leituraGeral: true, simular: true },
  'criar-agente': { escopos: { agents: ['read', 'create', 'update'], integrations: ['read'] }, admin: true, modulo: 'ai-agents', leituraGeral: true, simular: true },
}

// As áreas de onde vêm os nomes que aparecem nos fluxos e agentes.
const LEITURA_GERAL = ['pipes', 'stages', 'customfields', 'tags', 'users', 'templates', 'departments', 'products', 'knowledgeBases', 'intents', 'integrations']

// Escopos no formato do CRM: { pipes: ['read'], '*': ['*'] }. Chave de acesso total chega com
// `fullAccess: true`.
export function temEscopo(chave, recurso, acao) {
  if (chave?.fullAccess) return true
  const escopos = chave?.scopes || {}
  if ((escopos['*'] || []).includes('*') || (escopos['*'] || []).includes(acao)) return true
  return (escopos[recurso] || []).includes(acao) || (escopos[recurso] || []).includes('*')
}

const ROTULO_ACAO = { read: 'leitura', create: 'criação', update: 'edição', simulate: 'simular' }
const ROTULO_AREA = { conversations: 'Conversas', automations: 'Automações', agents: 'Agentes de IA', channels: 'Canais', integrations: 'Integrações', pipes: 'Funis', stages: 'Etapas', customfields: 'Campos personalizados', tags: 'Tags', users: 'Usuários', templates: 'Templates', departments: 'Departamentos', products: 'Produtos', knowledgeBases: 'Base de conhecimento', intents: 'Intents' }

function abrir() {
  const arquivo = arquivoDeAcesso()
  if (!existsSync(arquivo)) writeFileSync(arquivo, MODELO, { mode: 0o600 })
  try {
    chmodSync(arquivo, 0o600)
  } catch {}
  const abriu = abrirNoSistema(arquivo, { editor: true })
  console.log(abriu ? 'Abri o arquivo de acesso no editor:' : 'Abra este arquivo num editor de texto:')
  console.log(`  ${arquivo}`)
  console.log('Cole a chave, salve e feche. Depois é só avisar.')
}

async function conferir() {
  const { opcoes } = argumentos(process.argv.slice(3))
  const pedido = PEDIDOS[opcoes.para]
  if (!pedido) falha(`diga para qual skill: --para=…\n${USO}`, 2)
  const config = acesso()
  const linhas = []
  const ok = (texto) => linhas.push(`  ✔ ${texto}`)
  const ruim = (texto) => linhas.push(`  ✘ ${texto}`)
  const atencao = (texto) => linhas.push(`  ! ${texto}`)
  let certo = true
  const termina = () => {
    console.log(linhas.join('\n'))
    if (!certo) {
      console.log('\nResultado: FALTA ACERTAR. Corrija o que está com ✘ e confira de novo.')
      process.exit(1)
    }
    console.log('\nResultado: TUDO CERTO. Pode seguir.')
  }

  if (!config.existe) {
    certo = false
    ruim('falta o arquivo de acesso. Para criar e abrir: node "<motor>/acesso.mjs" abrir')
    return termina()
  }
  if (!/^https?:\/\/[^\s/]+/.test(config.base)) {
    certo = false
    ruim('o endereço do Cubo está vazio ou não começa com https:// (vem do cubo.json do plugin, ou do CUBO_BASE_URL do arquivo de acesso).')
    return termina()
  }
  if (!config.chave) {
    certo = false
    ruim('a chave (CUBO_API_KEY) está vazia. Abra de novo: node "<motor>/acesso.mjs" abrir')
    return termina()
  }

  let eu
  try {
    eu = await api('GET', '/api/whoami', undefined, { config })
    eu = eu?.data ?? eu
  } catch (erro) {
    certo = false
    ruim(erro.message)
    return termina()
  }
  const empresa = eu.company || {}
  ok(`conectou em ${config.base}: conta “${empresa.name ?? 'sem nome'}” (nº ${empresa.id})`)

  if (pedido.admin && eu.user && eu.user.isAdmin === false) {
    certo = false
    ruim(`a chave é do usuário ${eu.user.name}, que não é administrador. Agente só se grava com chave de administrador: crie a chave com um usuário administrador ou dono da conta.`)
  } else if (eu.user) ok(`chave do usuário ${eu.user.name}${eu.user.isAdmin ? ' (administrador)' : ''}`)

  const precisa = Object.entries(pedido.escopos).flatMap(([recurso, acoes]) => acoes.map((acao) => [recurso, acao]))
  if (opcoes.simular && pedido.simular) precisa.push(['agents', 'simulate'])
  const faltam = precisa.filter(([recurso, acao]) => !temEscopo(eu.apiKey, recurso, acao))
  if (faltam.length) {
    certo = false
    ruim(`faltam permissões na chave: ${faltam.map(([recurso, acao]) => `"${ROTULO_AREA[recurso] || recurso}: ${ROTULO_ACAO[acao] || acao}"`).join(', ')}. No Cubo: Configurações → Chaves de API → editar a chave → marcar essas permissões.`)
  } else ok('permissões da skill conferidas')

  if (pedido.leituraGeral) {
    const semLeitura = LEITURA_GERAL.filter((recurso) => !temEscopo(eu.apiKey, recurso, 'read'))
    if (semLeitura.length) atencao(`sem leitura de ${semLeitura.map((r) => ROTULO_AREA[r] || r).join(', ')}: onde o fluxo ou o agente usar essas coisas, vou mostrar só o número, sem o nome. Para ver os nomes, marque a leitura delas na chave.`)
  }

  const modulos = eu.modules?.activeSlugs
  const precisaModulo = pedido.modulo || (opcoes.simular && pedido.simular ? 'ai-agents' : null)
  if (precisaModulo && Array.isArray(modulos)) {
    if (!modulos.includes(precisaModulo)) {
      certo = false
      ruim('a conta não tem o módulo “Agentes de IA” ligado. Ligue o módulo (ou peça ao suporte do Cubo) e confira de novo.')
    } else ok('módulo Agentes de IA ligado')
  }

  if (certo) gravarJson(pasta('conta.json'), { companyId: empresa.id, nome: empresa.name ?? `conta nº ${empresa.id}`, base: config.base, usuario: eu.user ?? null, escopos: eu.apiKey ?? null })
  termina()
}

const comando = process.argv[2]
if (comando === 'abrir') abrir()
else if (comando === 'conferir') await conferir()
else falha(USO, 2)
