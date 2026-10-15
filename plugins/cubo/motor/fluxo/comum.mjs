// O que explicar, editar e criar fluxo usam igual: achar, ler, validar, juntar os problemas e montar
// a página.
import { api, desembrulhar, todos } from '../api.mjs'
import { catalogo, gatilhosPorTipo, nosPorTipo } from '../catalogo.mjs'
import { desenho } from '../desenho.mjs'
import { falha, normalizar } from '../lib.mjs'
import { Nomes } from '../nomes.mjs'
import { icone } from '../icones.mjs'
import { esc, etiqueta, irPara, listaDeProblemas, pagina, texto } from '../pagina.mjs'
import { corDoTipo, iconeDoGatilho, iconeDoTipo } from '../tipos.mjs'
import { armadilhas } from './armadilhas.mjs'
import { caminhoEmTexto } from './caminhos.mjs'
import { nosDoFluxo } from './modelo.mjs'

// Pelo número ou pelo nome. Nome com mais de um resultado sai com código 3 e a lista, para o Claude
// perguntar qual.
export async function acharFluxo(alvo) {
  if (alvo === undefined || alvo === '') falha('diga o número (ID) ou o nome do fluxo.', 2)
  if (/^\d+$/.test(String(alvo))) return Number(alvo)
  const lista = await todos(`/api/automations?name=${encodeURIComponent(alvo)}`)
  const procurado = normalizar(alvo)
  const iguais = lista.filter((a) => normalizar(a.name) === procurado)
  const parecidos = iguais.length ? iguais : lista.filter((a) => normalizar(a.name).includes(procurado))
  if (parecidos.length === 1) return parecidos[0].id
  if (!parecidos.length) falha(`não achei nenhum fluxo com o nome “${alvo}”. Confira o nome no Cubo (Automações) ou use o número.`, 2)
  console.log(`Achei ${parecidos.length} fluxos com esse nome. Pergunte qual é:`)
  for (const a of parecidos) console.log(`  #${a.id} — ${a.name} (${a.status === 'active' ? 'ligado' : 'desligado'})`)
  process.exit(3)
}

// versao: 'published' | 'draft'. Devolve { fluxo, etag }.
export async function lerFluxo(id, { versao = 'published', refs = true } = {}) {
  const consulta = [`version=${versao}`, refs ? 'include=refs' : null].filter(Boolean).join('&')
  const { corpo, etag } = await api('GET', `/api/automations/${id}?${consulta}`, undefined, { completo: true })
  return { fluxo: desembrulhar(corpo), etag }
}

export async function contexto(refs = []) {
  const cat = await catalogo('automacoes')
  const nomes = new Nomes()
  await nomes.carregar(refs.map((ref) => ref.kind))
  return { cat, defs: nosPorTipo(cat), gatilhos: gatilhosPorTipo(cat), nomes }
}

// O índice do nó no caminho (`flowData.nodes[3].data.x`) → o nó.
export function noDoCaminho(fluxo, caminho) {
  const i = String(caminho ?? '').match(/flowData\.nodes\[(\d+)\]/)?.[1]
  return i === undefined ? null : nosDoFluxo(fluxo)[Number(i)] ?? null
}

// Validação do Cubo (sem gravar). `id` presente: `/:id/validate` (o que não vier vale como gravado).
export async function validar(corpo, id = null) {
  const rota = id ? `/api/automations/${id}/validate` : '/api/automations/validate'
  return api('POST', rota, corpo)
}

// Junta validação do Cubo, armadilhas e refs que não existem numa lista só, já com "onde".
export function juntarProblemas({ fluxo, validacao, defs, descricao, nomes }) {
  const numero = new Map(descricao.passos.map((p) => [p.id, p.n]))
  const onde = (no) => (no ? `passo ${numero.get(no.id) ?? '?'}${no.data?.label ? ` “${no.data.label}”` : ''} (${no.type})` : null)
  const problemas = []
  const vistos = new Set()
  const add = (p) => {
    const chave = `${p.codigo}|${p.onde}|${p.mensagem}`
    if (vistos.has(chave)) return
    vistos.add(chave)
    problemas.push(p)
  }
  const local = (no) => ({ onde: onde(no), noId: no?.id ?? null })
  for (const erro of validacao?.errors || []) add({ gravidade: 'erro', codigo: erro.code, caminho: erro.path, ...local(noDoCaminho(fluxo, erro.path)), mensagem: erro.message, oQueFazer: impedeQue(erro.code) })
  for (const aviso of validacao?.warnings || []) add({ gravidade: 'aviso', codigo: aviso.code, caminho: aviso.path, ...local(noDoCaminho(fluxo, aviso.path)), mensagem: aviso.message })
  for (const a of armadilhas(fluxo, defs)) add({ gravidade: a.gravidade, codigo: a.codigo, ...local(nosDoFluxo(fluxo).find((no) => no.id === a.noId)), mensagem: a.mensagem, oQueFazer: a.oQueFazer })
  for (const ref of descricao.quebrados || []) add({ gravidade: 'erro', codigo: 'ref_inexistente', caminho: ref.path, ...local(noDoCaminho(fluxo, ref.path)), mensagem: `Aponta para ${nomes.descrever(ref.kind, ref.id)}, que não existe nesta conta (apagado, ou veio de outra conta).`, oQueFazer: 'Escolha de novo, no passo, um item que exista.' })
  for (const aviso of nomes.avisos()) add({ gravidade: 'nota', codigo: 'sem_leitura', mensagem: aviso })
  return problemas
}

function impedeQue(codigo) {
  if (['invalid_shape', 'too_large', 'foreign_ref'].includes(codigo)) return 'O Cubo não deixa gravar assim: precisa corrigir antes.'
  return 'O Cubo não deixa publicar assim: precisa corrigir antes de publicar.'
}

export function contarProblemas(problemas) {
  const conta = { erro: 0, aviso: 0, nota: 0 }
  for (const p of problemas) conta[p.gravidade] = (conta[p.gravidade] || 0) + 1
  return conta
}

export function problemasEmTexto(problemas) {
  if (!problemas.length) return '  (nenhum)'
  return problemas.map((p) => `  [${p.gravidade.toUpperCase()}] ${p.onde ? `${p.onde}: ` : ''}${p.mensagem}${p.oQueFazer ? ` → ${p.oQueFazer}` : ''}${p.codigo ? ` (${p.codigo})` : ''}`).join('\n')
}

const ROTULO_ONDE = { canal: 'Canal', 'automação': 'Automação', agente: 'Agente' }
const ICONE_ONDE = { canal: 'message-circle', 'automação': 'workflow', agente: 'bot' }

export function usosEmHtml(usos, vazio) {
  if (!usos.length) return `<p>${esc(vazio)}</p>`
  return `<div class="tabela"><table><tr><th>Onde</th><th>Nome</th><th>Como</th></tr>${usos.map((u) => `<tr><td>${etiqueta({ texto: ROTULO_ONDE[u.onde] ?? u.onde, tom: 'marca', icone: ICONE_ONDE[u.onde] })}</td><td><strong>${esc(u.nome)}</strong> <span class="sub">#${esc(u.id)}</span></td><td>${esc(u.detalhe)}</td></tr>`).join('')}</table></div>`
}

// As etiquetas do topo: ligado ou não, quantos passos, e os problemas por gravidade.
export function etiquetasDoFluxo(descricao, problemas, extra = []) {
  const conta = contarProblemas(problemas)
  const passos = descricao.passos.filter((p) => p.tipo !== 'start').length
  return [
    descricao.ligado ? { texto: 'Ligado', tom: 'ok', icone: 'circle-check' } : { texto: 'Desligado', tom: 'neutro', icone: 'circle-pause' },
    ...extra,
    { texto: `${passos} ${passos === 1 ? 'passo' : 'passos'}`, tom: 'marca', icone: 'workflow' },
    conta.erro ? { texto: `${conta.erro} ${conta.erro === 1 ? 'erro' : 'erros'}`, tom: 'erro', icone: 'circle-x' } : null,
    conta.aviso ? { texto: `${conta.aviso} ${conta.aviso === 1 ? 'ponto' : 'pontos'} de atenção`, tom: 'aviso', icone: 'triangle-alert' } : null,
    conta.nota ? { texto: `${conta.nota} ${conta.nota === 1 ? 'observação' : 'observações'}`, tom: 'nota', icone: 'info' } : null,
    !conta.erro && !conta.aviso && !conta.nota ? { texto: 'Sem problemas', tom: 'ok', icone: 'circle-check' } : null,
  ].filter(Boolean)
}

const caixaDoIcone = (tipo, simbolo = iconeDoTipo(tipo)) => `<span class="ic-caixa" style="background:${corDoTipo(tipo)}">${icone(simbolo, { tamanho: 18 })}</span>`

// A página do fluxo, para explicar ou para mostrar a prévia antes de gravar.
// textoDoClaude: { resumo, passos: { "<n>": "frase" }, caminhos: [{ titulo, historia }] }
export function paginaDoFluxo({ dados, textoDoClaude = {}, titulo, subtitulo, etiquetas, extra = [] }) {
  const { descricao, problemas, caminhos = [], usos = [], diferencas = null } = dados
  const comProblema = new Set(problemas.filter((p) => p.gravidade !== 'nota' && p.noId).map((p) => p.noId))
  const frases = textoDoClaude.passos || {}
  const passosHtml = descricao.passos
    .filter((p) => p.tipo !== 'start')
    .map((p) => {
      const saidas = p.saidas.filter((s) => s.destinos.length || !s.motor).map((s) => `<li>${esc(s.rotulo)} ${icone('arrow-right', { tamanho: 14 })} ${s.destinos.length ? s.destinos.map((d) => irPara(d)).join(' ') : '<span class="fim">fim</span>'}</li>`)
      if (p.irPara) saidas.push(`<li>vai para ${irPara(p.irPara)}</li>`)
      const frase = frases[p.n] ?? frases[String(p.n)] ?? p.descricaoTipo ?? ''
      const marcas = [comProblema.has(p.id) ? etiqueta({ texto: 'tem problema', tom: 'erro', icone: 'triangle-alert' }) : '', p.orfao ? etiqueta({ texto: 'solto: nada chega aqui', tom: 'aviso' }) : ''].join('')
      return `<div class="passo" id="passo-${p.n}">${caixaDoIcone(p.tipo)}<h3><span class="n">${p.n}.</span> ${esc(p.titulo || p.rotuloTipo)} <span class="tipo">${esc(p.rotuloTipo)}</span>${marcas}</h3>${texto(frase)}${saidas.length ? `<ul class="saidas">${saidas.join('')}</ul>` : ''}</div>`
    })
    .join('')
  const gatilhos = descricao.gatilhos.length ? `<ul class="gatilhos">${descricao.gatilhos.map((g) => `<li>${caixaDoIcone('trigger', iconeDoGatilho(g.tipo))}${esc(g.rotulo)}</li>`).join('')}</ul>` : '<p>Nenhum gatilho: este fluxo não começa sozinho.</p>'
  const historias = textoDoClaude.caminhos?.length
    ? textoDoClaude.caminhos.map((c) => `<div class="cartao"><strong>${esc(c.titulo)}</strong>${texto(c.historia)}</div>`).join('')
    : caminhos.map((c) => `<div class="cartao">${esc(caminhoEmTexto(c))}</div>`).join('')
  const dif = diferencas && !diferencas.igual
    ? `<div class="cartao"><p><strong>Há mudanças salvas e ainda não publicadas.</strong> Esta página explica a versão publicada (a que está rodando). No rascunho:</p><ul>${[...diferencas.adicionados.map((n) => `<li>entra o passo “${esc(n.titulo || n.tipo)}”</li>`), ...diferencas.removidos.map((n) => `<li>sai o passo “${esc(n.titulo || n.tipo)}”</li>`), ...diferencas.alterados.map((n) => `<li>muda o passo “${esc(n.titulo || n.tipo)}”</li>`), ...(diferencas.ligacoesMudaram ? ['<li>mudam as ligações entre os passos</li>'] : [])].join('')}</ul></div>`
    : ''
  return pagina({
    titulo,
    subtitulo,
    tipoDocumento: 'Automações',
    etiquetas: etiquetas ?? etiquetasDoFluxo(descricao, problemas),
    secoes: [
      { id: 'resumo', titulo: 'Resumo', html: `<div class="cartao">${texto(textoDoClaude.resumo || '')}</div>${dif}` },
      ...extra,
      { id: 'gatilhos', titulo: 'O que faz o fluxo começar', html: gatilhos },
      { id: 'desenho', titulo: 'Desenho', html: `<div class="rolagem" id="caixa-desenho">${desenho(descricao, comProblema)}</div><button class="alterna" type="button" data-alvo="caixa-desenho">Ver em tamanho real</button>` },
      { id: 'passos', titulo: 'Passo a passo', html: passosHtml ? `<div class="passos">${passosHtml}</div>` : '<p>Nenhum passo.</p>' },
      { id: 'caminhos', titulo: 'Caminhos de exemplo', html: `<p class="sub">Caminhos lidos do desenho, não execuções reais: o Cubo não tem simulação de automação.</p>${historias || '<p>Sem caminhos para mostrar.</p>'}` },
      usos ? { id: 'usos', titulo: 'Quem chama este fluxo', html: usosEmHtml(usos, 'Nenhum outro fluxo, agente ou canal chama este fluxo: ele só começa pelos gatilhos.') } : null,
      { id: 'problemas', titulo: 'Problemas encontrados', html: `<p class="sub">Lista para o suporte, do mais grave para o mais leve.</p>${listaDeProblemas(problemas)}` },
    ],
  })
}
