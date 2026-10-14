#!/usr/bin/env node
// Acesso às duas contas. A chave nunca passa pela conversa: a pessoa cola no arquivo, que abre no
// editor do sistema. Depois o `conferir` testa conexão, permissões e se as contas são diferentes,
// e não deixa seguir enquanto faltar algo.
import { chmodSync, existsSync, writeFileSync } from 'node:fs'
import { AREA, areasDaEscolha } from './areas.mjs'
import { carregar, etapa, registrar, salvar } from './ledger.mjs'
import { CONTAS, NOME_CONTA, abrirNoSistema, acesso, api, argumentos, arquivoDaConta, falha } from './lib.mjs'

const USO = `uso:
  conta.mjs abrir <origem|destino>     cria o arquivo de acesso (se faltar) e abre no editor
  conta.mjs conferir [--areas=…]       testa as duas contas; sai com erro se faltar algo`

const MODELO = (conta) => `# Acesso à ${NOME_CONTA[conta].toUpperCase()} do Cubo.
# Preencha as duas linhas de baixo, salve o arquivo (Ctrl+S) e feche.
#
# 1) O endereço do Cubo dessa conta, como aparece no navegador. Exemplo: https://app.cubosuite.com.br
CUBO_BASE_URL=
#
# 2) A chave de API dessa conta. No Cubo: Configurações → Chaves de API → Nova chave.
#    ${conta === 'origem' ? 'Basta permissão de LEITURA em tudo: nada será alterado nesta conta.' : 'Precisa de permissão de LEITURA, CRIAÇÃO e EDIÇÃO.'}
#    Cole a chave inteira depois do sinal de igual, sem espaço.
CUBO_API_KEY=
`

function abrir(conta) {
  if (!CONTAS.includes(conta)) falha(`diga qual conta: origem ou destino.\n${USO}`, 2)
  const arquivo = arquivoDaConta(conta)
  if (!existsSync(arquivo)) writeFileSync(arquivo, MODELO(conta), { mode: 0o600 })
  try {
    chmodSync(arquivo, 0o600)
  } catch {}
  const abriu = abrirNoSistema(arquivo, { editor: true })
  console.log(abriu ? `Abri o arquivo de acesso da ${NOME_CONTA[conta]} no editor:` : `Abra este arquivo num editor de texto:`)
  console.log(`  ${arquivo}`)
  console.log('Preencha o endereço e a chave, salve e feche. Depois é só avisar.')
}

// Escopos no formato do CRM: { pipes: ['read'], '*': ['*'] }. Chave antiga e chave de acesso total
// chegam com `fullAccess: true` e passam em tudo.
function temEscopo(chave, recurso, acao) {
  if (chave?.fullAccess) return true
  const escopos = chave?.scopes || {}
  if ((escopos['*'] || []).includes('*')) return true
  return (escopos[recurso] || []).includes(acao)
}

async function conferirConta(conta, kinds, linhas) {
  const config = acesso(conta)
  const ok = (texto) => linhas.push(`  ✔ ${texto}`)
  const ruim = (texto) => {
    linhas.push(`  ✘ ${texto}`)
    return null
  }
  linhas.push(`${NOME_CONTA[conta]}:`)
  if (!config.existe) return ruim(`falta o arquivo de acesso. Para criar e abrir: node "<scripts>/conta.mjs" abrir ${conta}`)
  if (!/^https?:\/\/[^\s/]+/.test(config.base)) return ruim(`o endereço (CUBO_BASE_URL) está vazio ou não começa com https://. Abra de novo: node "<scripts>/conta.mjs" abrir ${conta}`)
  if (!config.chave) return ruim(`a chave (CUBO_API_KEY) está vazia. Abra de novo: node "<scripts>/conta.mjs" abrir ${conta}`)

  let eu
  try {
    eu = await api(conta, 'GET', '/api/whoami', undefined, config)
  } catch (erro) {
    return ruim(erro.message)
  }
  // { company: { id, name }, user: { id, name, email, isAdmin }, apiKey: { scopes, fullAccess }, modules, counts }
  eu = eu?.data ?? eu
  const empresa = eu.company || {}
  ok(`conectou em ${config.base}: conta “${empresa.name ?? 'sem nome'}” (nº ${empresa.id})`)

  let tudoCerto = true
  if (eu.user && eu.user.isAdmin === false) {
    tudoCerto = false
    ruim(`a chave é do usuário ${eu.user.name}, que não é administrador. Crie a chave com um usuário administrador ou dono da conta: com usuário comum o Cubo esconde parte da configuração.`)
  } else if (eu.user) ok(`chave do usuário ${eu.user.name} (administrador)`)

  // Na origem só se lê. No destino, cada área pede o que ela tem (domínio não tem edição, MCP só se lê).
  // Algumas leituras aceitam também uma permissão mais antiga (etapa e motivo de perda com `pipes:read`).
  const precisa = new Map([['users', { acoes: new Set(['read']), alternativo: null }]])
  const pede = (recurso, acoes, alternativo = null) => {
    const atual = precisa.get(recurso) || { acoes: new Set(), alternativo }
    for (const acao of acoes) atual.acoes.add(acao)
    precisa.set(recurso, atual)
  }
  for (const kind of kinds) pede(AREA[kind].escopo, conta === 'origem' ? ['read'] : AREA[kind].acoes, AREA[kind].escopoTambem)
  // Arquivo do storage da conta antiga (imagem de produto, de proposta, da página…) é copiado.
  if (conta === 'destino') pede('files', ['create'])
  const faltam = []
  for (const [recurso, { acoes, alternativo }] of precisa) {
    for (const acao of acoes) {
      if (temEscopo(eu.apiKey, recurso, acao) || (acao === 'read' && alternativo && temEscopo(eu.apiKey, alternativo, acao))) continue
      faltam.push(`${recurso}:${acao}`)
    }
  }
  if (faltam.length) {
    tudoCerto = false
    ruim(`faltam permissões na chave: ${faltam.join(', ')}. No Cubo: Configurações → Chaves de API → editar a chave → marcar essas permissões.`)
  } else ok(`permissões de ${conta === 'origem' ? 'leitura' : 'leitura, criação e edição'} conferidas`)

  return tudoCerto ? { companyId: empresa.id, nome: empresa.name ?? `conta nº ${empresa.id}`, base: config.base, usuario: eu.user ?? null, modulos: eu.modules ?? null, contagem: eu.counts ?? null } : null
}

async function conferir() {
  const { opcoes } = argumentos(process.argv.slice(3))
  const ledger = carregar()
  const kinds = opcoes.areas ? areasDaEscolha(opcoes.areas) : ledger.areas.length ? ledger.areas : areasDaEscolha('todos')
  const linhas = []
  etapa(ledger, 'acesso', 'andamento')

  const origem = acesso('origem')
  const destino = acesso('destino')
  if (origem.chave && origem.chave === destino.chave) {
    linhas.push('  ✘ a mesma chave foi colada nas duas contas. A da conta nova tem que ser criada DENTRO da conta nova.')
  }
  const resultado = {}
  for (const conta of CONTAS) resultado[conta] = await conferirConta(conta, kinds, linhas)

  let tudoCerto = Boolean(resultado.origem && resultado.destino) && !(origem.chave && origem.chave === destino.chave)
  if (resultado.origem && resultado.destino && resultado.origem.companyId === resultado.destino.companyId) {
    tudoCerto = false
    linhas.push(`  ✘ as duas chaves são da MESMA conta (nº ${resultado.origem.companyId}). A chave da conta nova tem que ser criada dentro da conta nova.`)
  }

  console.log(linhas.join('\n'))
  if (!tudoCerto) {
    etapa(ledger, 'acesso', 'bloqueado', 'falta acertar o acesso')
    registrar(ledger, 'Conferência de acesso: ainda falta algo')
    salvar(ledger)
    console.log('\nResultado: FALTA ACERTAR. Corrija o que está com ✘ e confira de novo.')
    process.exit(1)
  }
  ledger.origem = resultado.origem
  ledger.destino = resultado.destino
  etapa(ledger, 'acesso', 'feito', `${resultado.origem.nome} → ${resultado.destino.nome}`)
  registrar(ledger, `Acesso conferido: ${resultado.origem.nome} → ${resultado.destino.nome}`)
  salvar(ledger)
  console.log('\nResultado: TUDO CERTO. Pode seguir.')
}

const [comando, conta] = process.argv.slice(2)
if (comando === 'abrir') abrir(conta)
else if (comando === 'conferir') await conferir()
else falha(USO, 2)
