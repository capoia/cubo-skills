// A página local das explicações e prévias: um HTML único, com CSS e SVG dentro, que abre sem
// internet. Quem lê é o dono da conta (em cima) e o suporte (a lista técnica no fim).
import { AVISO } from './aviso.mjs'
import { esc } from './desenho.mjs'

export { esc }

// Texto do Claude: parágrafos separados por linha em branco, **negrito** e `código`. Nada de HTML
// cru vindo de fora (o texto pode citar prompt de cliente).
export function texto(conteudo) {
  return String(conteudo ?? '')
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim()).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const ROTULO_GRAVIDADE = { erro: 'Erro', aviso: 'Atenção', nota: 'Observação' }

export function listaDeProblemas(problemas) {
  if (!problemas.length) return '<p class="ok">Nenhum problema encontrado.</p>'
  const ordem = { erro: 0, aviso: 1, nota: 2 }
  return `<ul class="problemas">${[...problemas]
    .sort((a, b) => (ordem[a.gravidade] ?? 3) - (ordem[b.gravidade] ?? 3))
    .map((p) => `<li class="${esc(p.gravidade)}"><span class="selo">${ROTULO_GRAVIDADE[p.gravidade] ?? esc(p.gravidade)}</span>${p.onde ? `<span class="onde">${esc(p.onde)}</span>` : ''}<div>${esc(p.mensagem)}</div>${p.oQueFazer ? `<div class="fazer">O que fazer: ${esc(p.oQueFazer)}</div>` : ''}${p.codigo ? `<code class="codigo">${esc(p.codigo)}${p.caminho ? ` · ${esc(p.caminho)}` : ''}</code>` : ''}</li>`)
    .join('')}</ul>`
}

const CSS = `
:root{--fundo:#f7f7f5;--papel:#fff;--tinta:#1d1d1b;--suave:#6b6b66;--linha:#e2e1dc;--marca:#3b5bdb;--erro:#c92a2a;--aviso:#b7791f;--nota:#5c6b7a;--ok:#2b8a3e;--no:#eef1fb;--inicio:#e6f4ea}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fundo:#151514;--papel:#1f1f1d;--tinta:#ecece8;--suave:#a3a39c;--linha:#34342f;--marca:#8ea4ff;--erro:#ff8787;--aviso:#f6c060;--nota:#a5b4c3;--ok:#69db7c;--no:#262a3a;--inicio:#1f3326}}
:root[data-theme="dark"]{--fundo:#151514;--papel:#1f1f1d;--tinta:#ecece8;--suave:#a3a39c;--linha:#34342f;--marca:#8ea4ff;--erro:#ff8787;--aviso:#f6c060;--nota:#a5b4c3;--ok:#69db7c;--no:#262a3a;--inicio:#1f3326}
*{box-sizing:border-box}body{margin:0;background:var(--fundo);color:var(--tinta);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.7rem;margin:0 0 4px}h2{font-size:1.2rem;margin:40px 0 12px;padding-top:8px;border-top:1px solid var(--linha)}
.sub{color:var(--suave);margin:0 0 20px}.cartao{background:var(--papel);border:1px solid var(--linha);border-radius:12px;padding:16px 20px;margin:12px 0}
.aviso-topo{border-left:4px solid var(--aviso);background:var(--papel);padding:12px 16px;border-radius:8px;font-size:.92rem;margin:16px 0}
.rolagem{overflow:auto;background:var(--papel);border:1px solid var(--linha);border-radius:12px;padding:12px}
.desenho .no rect{fill:var(--no);stroke:var(--linha)}.desenho .inicio rect{fill:var(--inicio)}.desenho .problema rect{stroke:var(--erro);stroke-width:2}.desenho .orfao rect{stroke-dasharray:5 4}
.desenho text{fill:var(--tinta);font:13px system-ui,sans-serif}.desenho .t1{font-weight:600}.desenho .t2{fill:var(--suave);font-size:12px}
.desenho .aresta{fill:none;stroke:var(--suave);stroke-width:1.4}.desenho .aresta.tracejada,.desenho .aresta.especial{stroke-dasharray:5 4}.desenho .ponta{fill:var(--suave)}.desenho .rotulo-aresta{fill:var(--marca);font-size:11px}
.passo{background:var(--papel);border:1px solid var(--linha);border-radius:12px;padding:14px 18px;margin:10px 0}.passo h3{margin:0 0 6px;font-size:1rem}.passo .tipo{color:var(--suave);font-weight:400;font-size:.88rem}
.passo .saidas{margin:8px 0 0;padding-left:18px;color:var(--suave);font-size:.92rem}
.problemas{list-style:none;padding:0}.problemas li{background:var(--papel);border:1px solid var(--linha);border-left:4px solid var(--nota);border-radius:8px;padding:10px 14px;margin:8px 0}
.problemas li.erro{border-left-color:var(--erro)}.problemas li.aviso{border-left-color:var(--aviso)}.selo{font-weight:700;margin-right:8px}.erro .selo{color:var(--erro)}.aviso .selo{color:var(--aviso)}.nota .selo{color:var(--nota)}
.onde{color:var(--suave);font-size:.9rem}.fazer{margin-top:4px}.codigo{display:block;margin-top:6px;color:var(--suave);font-size:.8rem;word-break:break-all}
.ok{color:var(--ok);font-weight:600}code{background:var(--fundo);padding:1px 5px;border-radius:4px;font-size:.88em}
.conversa{display:flex;flex-direction:column;gap:8px}.fala{max-width:80%;padding:8px 12px;border-radius:12px;white-space:pre-wrap}.fala.user{align-self:flex-end;background:var(--no)}.fala.assistant{align-self:flex-start;background:var(--fundo);border:1px solid var(--linha)}
.ferramenta{font-size:.85rem;color:var(--suave);border-left:2px solid var(--linha);padding-left:8px}.custo{color:var(--suave);font-size:.85rem}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--linha);padding:6px 8px;text-align:left;vertical-align:top}
pre{white-space:pre-wrap;word-break:break-word;background:var(--papel);border:1px solid var(--linha);border-radius:8px;padding:12px;font-size:.88rem}
footer{margin-top:48px;color:var(--suave);font-size:.85rem}
@media (max-width:600px){main{padding:20px 16px 48px}.fala{max-width:95%}}
`

// secoes: [{ id, titulo, html }]
export function pagina({ titulo, subtitulo, secoes }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(titulo)}</h1>
${subtitulo ? `<p class="sub">${esc(subtitulo)}</p>` : ''}
<div class="aviso-topo">${esc(AVISO)}</div>
${secoes.filter(Boolean).map((s) => `<section id="${esc(s.id)}"><h2>${esc(s.titulo)}</h2>${s.html}</section>`).join('\n')}
<footer>Gerado em ${esc(new Date().toLocaleString('pt-BR'))} pelas skills do Cubo. ${esc(AVISO)}</footer>
</main>
</body>
</html>
`
}
