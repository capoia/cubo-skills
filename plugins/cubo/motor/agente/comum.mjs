// O que explicar, editar e criar agente usam igual: achar, ler, descrever, validar, juntar os
// problemas e montar a página.
import { api, desembrulhar, ErroApi, todos } from '../api.mjs'
import { catalogo, chipsPorNome } from '../catalogo.mjs'
import { falha, normalizar } from '../lib.mjs'
import { Nomes } from '../nomes.mjs'
import { icone } from '../icones.mjs'
import { esc, etiqueta, listaDeProblemas, pagina, texto } from '../pagina.mjs'
import { contarProblemas, usosEmHtml } from '../fluxo/comum.mjs'
import { descreverChips, fraseDoChip, lerChips } from './chips.mjs'

// Os campos que a API ainda aceita no corpo. `handoffTargets` é inerte, `enabledMcpConnections` e
// `allowKnowledgeWriting` saíram: nada disso vai para o Cubo.
export const CAMPOS_FORA = ['id', 'updatedAt', 'createdAt', 'refs', 'warnings', 'handoffTargets', 'enabledMcpConnections', 'allowKnowledgeWriting', 'companyId']

export function corpoGravavel(agente) {
  const corpo = {}
  for (const [chave, valor] of Object.entries(agente || {})) if (!CAMPOS_FORA.includes(chave) && valor !== undefined) corpo[chave] = valor
  return corpo
}

export async function acharAgente(alvo) {
  if (alvo === undefined || alvo === '') falha('diga o número (ID) ou o nome do agente.', 2)
  if (/^\d+$/.test(String(alvo))) return Number(alvo)
  const lista = await todos('/api/agents')
  const procurado = normalizar(alvo)
  const iguais = lista.filter((a) => normalizar(a.name) === procurado)
  const parecidos = iguais.length ? iguais : lista.filter((a) => normalizar(a.name).includes(procurado))
  if (parecidos.length === 1) return parecidos[0].id
  if (!parecidos.length) falha(`não achei nenhum agente com o nome “${alvo}”. Confira o nome no Cubo (Agentes de IA) ou use o número.`, 2)
  console.log(`Achei ${parecidos.length} agentes com esse nome. Pergunte qual é:`)
  for (const a of parecidos) console.log(`  #${a.id} — ${a.name}`)
  process.exit(3)
}

export async function lerAgente(id) {
  const { corpo, etag } = await api('GET', `/api/agents/${id}?include=refs`, undefined, { completo: true })
  return { agente: desembrulhar(corpo), etag }
}

// PUT com If-Match: 412 quer dizer que alguém mudou o agente depois da leitura.
export async function gravarAgente(id, corpo, etag) {
  return api('PUT', `/api/agents/${id}`, corpo, { completo: true, cabecalhos: { 'If-Match': etag } })
}

export async function contextoAgente(agente) {
  const cat = await catalogo('agentes')
  const porNome = chipsPorNome(cat)
  const nomes = new Nomes()
  const kinds = new Set((agente?.refs || []).map((r) => r.kind))
  for (const chip of lerChips(agente?.systemPrompt, cat.chipSyntax?.regex)) for (const p of porNome[chip.nome]?.params || []) if (p.refKind) kinds.add(p.refKind)
  const acao = agente?.followUpConfig?.exhaustedAction
  if (acao?.automationId) kinds.add('automation')
  if (acao?.agentId) kinds.add('agent')
  if (agente?.integrationId) kinds.add('integration')
  await nomes.carregar([...kinds])
  return { cat, porNome, nomes }
}

const ACAO_ESGOTOU = { handoff_to_human: 'passa para um humano', call_agent: 'chama outro agente', start_flow: 'inicia um fluxo', end_conversation: 'encerra a conversa', handle_node: 'segue pela saída do fluxo' }

export function descreverFollowUp(followUp, nomes) {
  if (!followUp || !followUp.enabled) return { ligado: false, texto: 'Sem lembretes (follow-up desligado).' }
  const acao = followUp.exhaustedAction || {}
  let quando = ACAO_ESGOTOU[acao.type] ?? acao.type ?? 'nada'
  if (acao.type === 'start_flow' && acao.automationId) quando = `inicia o fluxo ${nomes.nome('automation', acao.automationId)}`
  if (acao.type === 'call_agent' && acao.agentId) quando = `chama o agente ${nomes.nome('agent', acao.agentId)}`
  const campos = Object.keys(followUp.fields || {})
  return { ligado: true, campos, quando, texto: `Lembretes ligados${campos.length ? ` (cobra: ${campos.join(', ')})` : ''}. Quando os lembretes acabam, ${quando}.` }
}

export function descreverAgente(agente, ctx) {
  const chips = descreverChips(agente.systemPrompt, { porNome: ctx.porNome, nomes: ctx.nomes, regex: ctx.cat.chipSyntax?.regex })
  return {
    id: agente.id,
    nome: agente.name,
    modelo: agente.model ?? null,
    integracao: agente.integrationId ? ctx.nomes.nome('integration', agente.integrationId) : null,
    integracaoId: agente.integrationId ?? null,
    tamanhoPrompt: String(agente.systemPrompt ?? '').length,
    chips,
    followUp: descreverFollowUp(agente.followUpConfig, ctx.nomes),
    legado: (agente.enabledTools || []).length ? agente.enabledTools : [],
    inerte: (agente.handoffTargets || []).length,
  }
}

// O modelo usa ferramentas? Sem `integrations:read`, não dá para saber: devolve null.
export async function modeloSemFerramentas(agente) {
  if (!agente.integrationId || !agente.model) return null
  try {
    const corpo = await api('GET', `/api/integrations/${agente.integrationId}/ai-models`)
    const modelo = (corpo?.data ?? corpo ?? []).find((m) => m.id === agente.model)
    return modelo ? Boolean(modelo.toolsUnsupported) : null
  } catch (erro) {
    if (erro instanceof ErroApi) return null
    throw erro
  }
}

export async function validarAgente(corpo, id = null) {
  return api('POST', id ? `/api/agents/${id}/validate` : '/api/agents/validate', corpo)
}

export function juntarProblemasAgente({ descricao, validacao, usos, semFerramentas, nomes }) {
  const problemas = []
  const chipDe = (token) => descricao.chips.find((c) => c.token === token)
  for (const erro of validacao?.errors || []) problemas.push({ gravidade: 'erro', codigo: erro.code, caminho: erro.path, onde: erro.token ? `chip ${erro.token}` : erro.path, mensagem: erro.message, oQueFazer: 'O Cubo não deixa gravar um chip novo assim: corrija o chip.' })
  for (const aviso of validacao?.warnings || []) problemas.push({ gravidade: 'aviso', codigo: aviso.code, caminho: aviso.path, onde: aviso.token ? `chip ${aviso.token}` : aviso.path, mensagem: aviso.message, oQueFazer: /^Já estava gravado/.test(aviso.message) ? 'Esse chip já estava assim; o agente roda sem ele. Corrija ou tire.' : null })
  const jaDito = new Set(problemas.map((p) => p.onde))
  for (const chip of descricao.chips) {
    if (chip.estado === 'ok' || jaDito.has(`chip ${chip.token}`)) continue
    problemas.push({ gravidade: chip.estado === 'desconhecido' ? 'erro' : 'aviso', codigo: `chip_${chip.estado.replace(/\s+/g, '_')}`, onde: `chip ${chip.token}`, mensagem: `O chip “${chip.rotulo}” está com problema: ${chip.estado}.`, oQueFazer: chip.estado === 'intent desligada' ? 'Ligue a intent em Agentes → Intents, ou tire o chip.' : chip.estado.startsWith('MCP') || chip.estado.startsWith('ferramenta') ? 'Reconecte a conexão MCP (Configurações → MCP) ou tire o chip.' : 'Escolha de novo um item que exista, ou tire o chip.' })
  }
  const integracao = descricao.integracaoId ? nomes.item('integration', descricao.integracaoId) : null
  if (integracao && integracao.status && integracao.status !== 'active') problemas.push({ gravidade: 'erro', codigo: 'integracao_desligada', onde: `integração ${nomes.nome('integration', descricao.integracaoId)}`, mensagem: `A integração de IA “${nomes.nome('integration', descricao.integracaoId)}” está desligada: o agente não responde ninguém enquanto ela estiver assim.`, oQueFazer: 'Ligue a integração no Cubo (Configurações → Integrações) e confira a chave do serviço.' })
  if (semFerramentas && descricao.chips.length) problemas.push({ gravidade: 'erro', codigo: 'modelo_sem_ferramentas', onde: `modelo ${descricao.modelo}`, mensagem: `O modelo ${descricao.modelo} não usa ferramentas: o agente roda sem nenhum dos ${descricao.chips.length} chips.`, oQueFazer: 'Troque o modelo por um que use ferramentas.' })
  if (descricao.legado.length) problemas.push({ gravidade: 'nota', codigo: 'legacy_field', onde: 'enabledTools', mensagem: `Campo antigo “enabledTools” preenchido (${descricao.legado.join(', ')}): não define ferramenta, só acrescenta contexto ao prompt.`, oQueFazer: 'As ferramentas vêm dos chips do prompt.' })
  if (descricao.inerte) problemas.push({ gravidade: 'nota', codigo: 'inert_field', onde: 'handoffTargets', mensagem: 'Há transferências antigas para outros agentes (handoffTargets): elas não fazem nada.', oQueFazer: 'Para passar para outro agente, use o follow-up ou um chip.' })
  if (usos && !usos.length) problemas.push({ gravidade: 'aviso', codigo: 'sem_uso', mensagem: 'Nenhum canal, automação ou outro agente usa este agente: ele não atende ninguém.', oQueFazer: 'Ligue-o a um canal (Canais → agente padrão) ou chame-o numa automação.' })
  for (const aviso of nomes.avisos()) problemas.push({ gravidade: 'nota', codigo: 'sem_leitura', mensagem: aviso })
  return problemas
}

export function roteiroAgente(descricao, { usos, prompt }) {
  const linhas = [`AGENTE #${descricao.id} “${descricao.nome}” — modelo ${descricao.modelo ?? '?'}${descricao.integracao ? ` (${descricao.integracao})` : ''}`, '', `FERRAMENTAS (chips no prompt: ${descricao.chips.length}):`]
  if (!descricao.chips.length) linhas.push('  (nenhuma: o agente só conversa)')
  for (const chip of descricao.chips) linhas.push(`  - ${fraseDoChip(chip)}${chip.vezes > 1 ? ` (aparece ${chip.vezes} vezes)` : ''}`)
  linhas.push('', `FOLLOW-UP: ${descricao.followUp.texto}`, '', 'ONDE É USADO:')
  if (usos === null) linhas.push('  (não varri)')
  else if (!usos.length) linhas.push('  em lugar nenhum')
  for (const u of usos || []) linhas.push(`  - ${u.onde} “${u.nome}” (#${u.id}): ${u.detalhe}`)
  if (prompt) linhas.push('', 'PROMPT (cada chip seguido do que ele faz, entre ⟦ ⟧):', prompt)
  return linhas.join('\n')
}

export function conversaEmHtml(exemplo) {
  const falas = exemplo.turnos.map((t) => {
    const ferramentas = (t.toolCalls || []).map((f) => `<div class="ferramenta">${icone(f.error ? 'circle-x' : 'wrench', { tamanho: 14 })}<span>usou <code>${esc(f.name)}</code>${f.simulated ? ' (simulado: nada mudou na conta)' : ''}${f.error ? ` — erro: ${esc(f.error)}` : ''}</span></div>`).join('')
    return `<div class="fala user">${esc(t.cliente)}</div>${t.erro ? `<div class="fala assistant">(erro: ${esc(t.erro)})</div>` : `<div class="fala assistant">${esc(t.resposta)}${ferramentas}</div>`}`
  })
  const custo = exemplo.turnos.reduce((s, t) => s + (t.custoCentavos || 0), 0)
  return `<div class="cartao"><strong>${esc(exemplo.titulo)}</strong>${exemplo.objetivo ? `<p class="sub">${esc(exemplo.objetivo)}</p>` : ''}<div class="conversa">${falas.join('')}</div><p class="custo">Custo: ${custo.toFixed(2).replace('.', ',')} centavos</p>${exemplo.comentario ? texto(exemplo.comentario) : ''}</div>`
}

// As etiquetas do topo: modelo, ferramentas, lembretes e os problemas por gravidade.
export function etiquetasDoAgente(descricao, problemas, extra = []) {
  const conta = contarProblemas(problemas)
  const n = descricao.chips.length
  return [
    ...extra,
    descricao.modelo ? { texto: descricao.modelo, tom: 'neutro', icone: 'bot' } : null,
    { texto: n ? `${n} ${n === 1 ? 'ferramenta' : 'ferramentas'}` : 'Só conversa', tom: 'marca', icone: 'wrench' },
    descricao.followUp.ligado ? { texto: 'Lembretes ligados', tom: 'marca', icone: 'alarm-clock' } : { texto: 'Sem lembretes', tom: 'neutro', icone: 'alarm-clock' },
    conta.erro ? { texto: `${conta.erro} ${conta.erro === 1 ? 'erro' : 'erros'}`, tom: 'erro', icone: 'circle-x' } : null,
    conta.aviso ? { texto: `${conta.aviso} ${conta.aviso === 1 ? 'ponto' : 'pontos'} de atenção`, tom: 'aviso', icone: 'triangle-alert' } : null,
    conta.nota ? { texto: `${conta.nota} ${conta.nota === 1 ? 'observação' : 'observações'}`, tom: 'nota', icone: 'info' } : null,
    !conta.erro && !conta.aviso && !conta.nota ? { texto: 'Sem problemas', tom: 'ok', icone: 'circle-check' } : null,
  ].filter(Boolean)
}

export function paginaDoAgente({ dados, textoDoClaude = {}, exemplos = [], titulo, subtitulo, etiquetas, extra = [] }) {
  const { descricao, problemas, usos, prompt } = dados
  const situacao = (c) => (c.estado === 'ok' ? etiqueta({ texto: 'ok', tom: 'ok', icone: 'circle-check' }) : etiqueta({ texto: c.estado, tom: c.estado === 'desconhecido' ? 'erro' : 'aviso', icone: 'triangle-alert' }))
  const chips = descricao.chips.length
    ? `<div class="tabela"><table><tr><th>Ferramenta</th><th>O que faz</th><th>Situação</th></tr>${descricao.chips.map((c) => `<tr><td><strong>${esc(c.rotulo)}</strong><br><code>${esc(c.token)}</code></td><td>${esc((textoDoClaude.chips || {})[c.token] ?? c.descricao ?? '')}${c.params.length ? `<br><span class="sub">${esc(c.params.map((p) => `${p.rotulo}: ${p.nome}`).join('; '))}</span>` : ''}</td><td>${situacao(c)}</td></tr>`).join('')}</table></div>`
    : '<p>Nenhuma: este agente só conversa.</p>'
  const exemplosHtml = exemplos.length
    ? `<p class="sub">Conversas simuladas no Cubo com o agente como está gravado. Nos exemplos, escrever é de mentira (nada mudou na conta) e ler é de verdade. Ferramentas que dependem de uma conversa real (por exemplo, passar para humano) falham, e os lembretes não aparecem.</p>${exemplos.map(conversaEmHtml).join('')}`
    : '<p>Sem exemplos: a simulação não foi rodada.</p>'
  return pagina({
    titulo,
    subtitulo,
    tipoDocumento: 'Agentes de IA',
    etiquetas: etiquetas ?? etiquetasDoAgente(descricao, problemas),
    secoes: [
      { id: 'resumo', titulo: 'Resumo', html: `<div class="cartao">${texto(textoDoClaude.resumo || '')}</div>` },
      textoDoClaude.explicacao ? { id: 'como', titulo: 'Como ele age', html: `<div class="cartao">${texto(textoDoClaude.explicacao)}</div>` } : null,
      ...extra,
      { id: 'ferramentas', titulo: 'O que ele pode fazer', html: chips },
      { id: 'followup', titulo: 'Lembretes (follow-up)', html: `<div class="cartao"><p>${esc(descricao.followUp.texto)}</p></div>` },
      { id: 'exemplos', titulo: 'Conversas de exemplo', html: exemplosHtml },
      usos ? { id: 'usos', titulo: 'Onde é usado', html: usosEmHtml(usos, 'Em lugar nenhum: nenhum canal, automação ou agente usa este agente.') } : null,
      { id: 'problemas', titulo: 'Problemas encontrados', html: `<p class="sub">Lista para o suporte, do mais grave para o mais leve.</p>${listaDeProblemas(problemas)}` },
      prompt !== undefined ? { id: 'prompt', titulo: 'Prompt completo', html: `<details><summary>Mostrar o prompt (${String(prompt).length} caracteres)</summary><pre>${esc(prompt)}</pre></details>` } : null,
    ],
  })
}
