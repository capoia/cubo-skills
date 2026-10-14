#!/usr/bin/env node
// Relatório final em HTML: o que migrou, o que foi trocado, o que a conferência achou e o que a
// pessoa precisa fazer à mão. Um arquivo só, sem nada de fora, que abre no navegador.
import { writeFileSync } from 'node:fs'
import { AREA, AREAS } from './areas.mjs'
import { carregar, contagem, etapa, registrar, salvar } from './ledger.mjs'
import { abrirNoSistema, argumentos, pasta } from './lib.mjs'

const { opcoes } = argumentos()
const ledger = carregar()

const esc = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const data = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

const itens = Object.values(ledger.itens)
const conta = (status) => itens.filter((item) => item.status === status).length
const trocas = itens.reduce((soma, item) => soma + (item.trocas || 0), 0)
const problemas = ledger.conferencia?.problemas || []
const avisosConferencia = ledger.conferencia?.avisos || []
const pendentes = conta('erro') + conta('aguardando') + conta('pendente') + conta('enviando')

const situacao = problemas.length || conta('erro')
  ? { classe: 'ruim', texto: 'Com problemas' }
  : pendentes || ledger.pendencias.length
    ? { classe: 'atencao', texto: 'Migrada, com tarefas para você' }
    : { classe: 'bom', texto: 'Concluída' }

const ROTULO_STATUS = { criado: 'criado', usado: 'já existia', pulado: 'pulado', erro: 'erro', aguardando: 'aguardando', pendente: 'não feito', enviando: 'não confirmado' }

const porArea = contagem(ledger)
const linhasArea = AREAS.filter((area) => porArea[area.kind]).map((area) => {
  const l = porArea[area.kind]
  const trocasDaArea = itens.filter((item) => item.kind === area.kind).reduce((soma, item) => soma + (item.trocas || 0), 0)
  const falta = (l.erro || 0) + (l.aguardando || 0) + (l.pendente || 0)
  return `<tr><th scope="row">${esc(area.rotulo)}</th><td>${l.criado || 0}</td><td>${l.usado || 0}</td><td>${l.pulado || 0}</td><td class="${falta ? 'num-ruim' : ''}">${falta}</td><td>${trocasDaArea}</td></tr>`
})

const detalhes = AREAS.filter((area) => porArea[area.kind]).map((area) => {
  const lista = itens.filter((item) => item.kind === area.kind)
  const linhas = lista.map((item) => `<tr>
      <td>${esc(item.nome)}${item.motivo === 'dependencia' ? ' <span class="etiqueta">veio junto</span>' : ''}</td>
      <td><span class="status s-${esc(item.status)}">${esc(ROTULO_STATUS[item.status] || item.status)}</span></td>
      <td class="mono">${esc(item.origemId)} → ${esc(item.destinoId ?? '—')}</td>
      <td>${item.trocas || 0}</td>
      <td class="erro-texto">${esc(item.erro || '')}</td>
    </tr>`)
  return `<details><summary>${esc(area.rotulo)} <span class="contagem">${lista.length}</span></summary>
    <div class="tabela-rolavel"><table><thead><tr><th>Item</th><th>Situação</th><th>Nº antigo → novo</th><th>IDs trocados</th><th>Observação</th></tr></thead><tbody>${linhas.join('')}</tbody></table></div></details>`
})

const usuarios = Object.entries(ledger.decisoes.usuarios || {})
const nomeUsuario = (id) => {
  if (id === 'dono') return `${ledger.destino?.usuario?.name ?? 'dono da chave'} (dono da chave)`
  const u = (ledger.usuariosDestino || []).find((x) => String(x.id) === String(id))
  return u ? `${u.nome} <${u.email}>` : `nº ${id}`
}

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório da migração</title>
<style>
  :root { --fundo:#f6f7f9; --cartao:#fff; --texto:#1b1f24; --suave:#5b6470; --linha:#e3e6ea;
    --bom:#1f7a4d; --bom-fundo:#e5f4ec; --atencao:#8a5a00; --atencao-fundo:#fdf1d8; --ruim:#b42318; --ruim-fundo:#fde8e6; --destaque:#2554c7; }
  @media (prefers-color-scheme: dark) { :root { --fundo:#111418; --cartao:#1a1e23; --texto:#e8eaed; --suave:#9aa3ad; --linha:#2b3138;
    --bom:#5fd39a; --bom-fundo:#16301f; --atencao:#f0c060; --atencao-fundo:#33280f; --ruim:#ff8a7a; --ruim-fundo:#3a1815; --destaque:#8fb0ff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--fundo); color:var(--texto); font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  main { max-width:1040px; margin:0 auto; padding:32px 16px 64px; }
  h1 { font-size:26px; margin:0 0 4px; } h2 { font-size:18px; margin:36px 0 12px; }
  .sub { color:var(--suave); margin:0; }
  .faixa { display:inline-block; margin-top:14px; padding:6px 12px; border-radius:999px; font-weight:600; font-size:14px; }
  .bom { color:var(--bom); background:var(--bom-fundo); } .atencao { color:var(--atencao); background:var(--atencao-fundo); } .ruim { color:var(--ruim); background:var(--ruim-fundo); }
  .numeros { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-top:24px; }
  .numero { background:var(--cartao); border:1px solid var(--linha); border-radius:12px; padding:14px 16px; }
  .numero b { display:block; font-size:28px; font-variant-numeric:tabular-nums; } .numero span { color:var(--suave); font-size:13px; }
  .caixa { background:var(--cartao); border:1px solid var(--linha); border-radius:12px; padding:16px 18px; }
  .caixa.ok { border-color:var(--bom); } .caixa.problema { border-color:var(--ruim); }
  ul.tarefas { list-style:none; margin:0; padding:0; } ul.tarefas li { padding:10px 0; border-bottom:1px solid var(--linha); display:flex; gap:10px; align-items:flex-start; }
  ul.tarefas li:last-child { border-bottom:0; } ul.tarefas input { margin-top:4px; width:18px; height:18px; flex:none; }
  ul.tarefas li.feita span { text-decoration:line-through; color:var(--suave); }
  .tabela-rolavel { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; background:var(--cartao); font-size:14px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--linha); vertical-align:top; }
  thead th { color:var(--suave); font-weight:600; font-size:13px; }
  td { font-variant-numeric:tabular-nums; } .num-ruim { color:var(--ruim); font-weight:600; }
  details { background:var(--cartao); border:1px solid var(--linha); border-radius:12px; margin-bottom:8px; overflow:hidden; }
  summary { cursor:pointer; padding:12px 16px; font-weight:600; } .contagem { color:var(--suave); font-weight:400; margin-left:6px; }
  details table { border-top:1px solid var(--linha); }
  .status { font-size:12px; padding:2px 8px; border-radius:999px; white-space:nowrap; }
  .s-criado { color:var(--bom); background:var(--bom-fundo); } .s-usado, .s-pulado { color:var(--suave); background:var(--fundo); }
  .s-erro { color:var(--ruim); background:var(--ruim-fundo); } .s-aguardando, .s-pendente, .s-enviando { color:var(--atencao); background:var(--atencao-fundo); }
  .etiqueta { font-size:11px; color:var(--destaque); border:1px solid currentColor; border-radius:999px; padding:0 6px; margin-left:4px; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; }
  .erro-texto { color:var(--ruim); font-size:13px; }
  ul.lista { margin:0; padding-left:20px; } ul.lista li { margin:6px 0; }
  footer { margin-top:40px; color:var(--suave); font-size:13px; }
</style>
</head>
<body>
<main>
  <h1>Migração de conta do Cubo</h1>
  <p class="sub">De <b>${esc(ledger.origem?.nome)}</b> (conta nº ${esc(ledger.origem?.companyId)}) para <b>${esc(ledger.destino?.nome)}</b> (conta nº ${esc(ledger.destino?.companyId)}) · começou ${esc(data(ledger.criadoEm))} · atualizado ${esc(data(ledger.atualizadoEm))}</p>
  <span class="faixa ${situacao.classe}">${esc(situacao.texto)}</span>

  <div class="numeros">
    <div class="numero"><b>${conta('criado')}</b><span>itens criados na conta nova</span></div>
    <div class="numero"><b>${conta('usado')}</b><span>já existiam e foram aproveitados</span></div>
    <div class="numero"><b>${trocas}</b><span>números (IDs) trocados</span></div>
    <div class="numero"><b>${ledger.pendencias.length}</b><span>tarefas para você</span></div>
    <div class="numero"><b class="${problemas.length ? 'num-ruim' : ''}">${problemas.length}</b><span>problemas na conferência</span></div>
  </div>

  <h2>O que você precisa fazer na conta nova</h2>
  ${ledger.pendencias.length
    ? `<div class="caixa"><ul class="tarefas">${ledger.pendencias.map((p, i) => `<li><input type="checkbox" id="t${i}"><span><label for="t${i}">${esc(p.texto)}</label></span></li>`).join('')}</ul></div>`
    : '<div class="caixa ok">Nada. Tudo o que foi escolhido funciona sem ação manual.</div>'}

  <h2>Para fechar</h2>
  <div class="caixa"><ul class="tarefas">
    <li><input type="checkbox" id="f1"><span><label for="f1">Apagar no Cubo as duas chaves de API “Migração” (a da conta antiga e a da conta nova). ${ledger.chaveFormulario ? 'A chave do formulário das páginas <b>fica</b>: as landing pages usam.' : ''}</label></span></li>
    <li><input type="checkbox" id="f2"><span><label for="f2">Apagar a pasta <code>migracao/</code> deste computador: ela guarda as chaves e os segredos que vieram da conta antiga.</label></span></li>
  </ul></div>

  <h2>Conferência</h2>
  ${!ledger.conferencia
    ? '<div class="caixa">A conferência ainda não rodou.</div>'
    : problemas.length
      ? `<div class="caixa problema"><p><b>${problemas.length} ligações não apontam para a conta nova.</b> Elas precisam ser corrigidas antes de ligar as automações e os agentes.</p><ul class="lista">${problemas.map((p) => `<li><b>${esc(p.item)}</b>: ${esc(p.texto)}</li>`).join('')}</ul></div>`
      : `<div class="caixa ok">✔ ${ledger.conferencia.conferidos} itens relidos na conta nova: todas as ligações (funis, campos, agentes, automações…) apontam para itens da conta nova. Nenhum número da conta antiga sobrou.</div>`}
  ${avisosConferencia.length ? `<div class="caixa" style="margin-top:8px"><ul class="lista">${avisosConferencia.map((a) => `<li><b>${esc(a.item)}</b>: ${esc(a.texto)}</li>`).join('')}</ul></div>` : ''}

  <h2>Por área</h2>
  <div class="tabela-rolavel"><table>
    <thead><tr><th>Área</th><th>Criados</th><th>Já existiam</th><th>Pulados</th><th>Faltam</th><th>IDs trocados</th></tr></thead>
    <tbody>${linhasArea.join('')}</tbody>
  </table></div>

  <h2>Item por item</h2>
  ${detalhes.join('')}

  ${usuarios.length ? `<h2>Usuários</h2><div class="caixa"><ul class="lista">${usuarios.map(([de, para]) => `<li>usuário nº ${esc(de)} da conta antiga → ${esc(nomeUsuario(para))}</li>`).join('')}</ul></div>` : ''}

  ${ledger.avisos.length ? `<h2>Avisos</h2><div class="caixa"><ul class="lista">${ledger.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}

  <footer>A conta antiga não foi alterada. Automações e landing pages foram criadas desligadas: revise e ligue quando estiver tudo certo. Detalhes técnicos em migracao/ledger.json.</footer>
</main>
<script>
  // Marca as tarefas feitas neste navegador (só aqui; não muda nada no Cubo).
  document.querySelectorAll('ul.tarefas input').forEach(function (caixa) {
    var chave = 'migracao-tarefa-' + caixa.id
    try { caixa.checked = localStorage.getItem(chave) === '1' } catch (e) {}
    var marca = function () { caixa.closest('li').classList.toggle('feita', caixa.checked) }
    marca()
    caixa.addEventListener('change', function () { marca(); try { localStorage.setItem(chave, caixa.checked ? '1' : '0') } catch (e) {} })
  })
</script>
</body>
</html>
`

const arquivo = pasta('relatorio.html')
writeFileSync(arquivo, html)
etapa(ledger, 'relatorio', 'feito', arquivo)
registrar(ledger, 'Relatório gerado')
salvar(ledger)
console.log(`Relatório: ${arquivo}`)
if (!opcoes['nao-abrir']) console.log(abrirNoSistema(arquivo) ? 'Abri no navegador.' : 'Abra esse arquivo no navegador.')
