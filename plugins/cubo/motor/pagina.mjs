// A página local das explicações e prévias: um HTML único, com CSS, fonte, logo e SVG dentro, que abre
// sem internet. Quem lê é o dono da conta (em cima) e o suporte (a lista técnica no fim). O visual é o do
// Cubo: o azul e os cinzas do tema do CRM (`inertia/assets/css/app.css`), o logo, e a Barlow no lugar da
// DIN 2014, que é paga e não pode ir num repositório público (a Barlow é OFL, veja `marca/barlow-OFL.txt`).
import { readFileSync } from 'node:fs'
import { AVISO } from './aviso.mjs'
import { esc } from './desenho.mjs'
import { icone } from './icones.mjs'

export { esc }

const marca = (arquivo) => readFileSync(new URL(`./marca/${arquivo}`, import.meta.url))
const LOGO = marca('logo.svg').toString('utf8').replace('<svg ', '<svg class="logo" aria-label="Cubo" role="img" ')
const FONTES = [400, 600, 700].map((peso) => `@font-face{font-family:"Barlow";font-style:normal;font-weight:${peso};font-display:swap;src:url(data:font/woff2;base64,${marca(`barlow-${peso}.woff2`).toString('base64')}) format("woff2")}`).join('')

// Texto do Claude: parágrafos separados por linha em branco, **negrito**, *itálico* e `código`. Nada de HTML
// cru vindo de fora (o texto pode citar prompt de cliente).
export function texto(conteudo) {
  return String(conteudo ?? '')
    .split(/\n\s*\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim()).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const GRAVIDADE = {
  erro: { rotulo: 'Erro', icone: 'circle-x' },
  aviso: { rotulo: 'Atenção', icone: 'triangle-alert' },
  nota: { rotulo: 'Observação', icone: 'info' },
}

// Etiqueta (selo arredondado), como os badges do Cubo. tom: marca, ok, aviso, erro, nota ou neutro.
export const etiqueta = ({ texto: conteudo, tom = 'neutro', icone: simbolo }) => `<span class="etiqueta ${esc(tom)}">${simbolo ? icone(simbolo, { tamanho: 13 }) : ''}${esc(conteudo)}</span>`

// Link para um passo do fluxo, como um botãozinho.
export const irPara = (n, conteudo = `passo ${n}`) => `<a class="ir" href="#passo-${esc(n)}">${esc(conteudo)}</a>`

export function listaDeProblemas(problemas) {
  if (!problemas.length) return `<p class="tudo-ok">${icone('circle-check', { tamanho: 18 })}Nenhum problema encontrado.</p>`
  const ordem = { erro: 0, aviso: 1, nota: 2 }
  return `<ul class="problemas">${[...problemas]
    .sort((a, b) => (ordem[a.gravidade] ?? 3) - (ordem[b.gravidade] ?? 3))
    .map((p) => {
      const g = GRAVIDADE[p.gravidade] ?? { rotulo: p.gravidade, icone: 'info' }
      const tecnico = p.codigo ? `<details class="tecnico"><summary>Detalhes para o suporte</summary><code>${esc(p.codigo)}${p.caminho ? ` · ${esc(p.caminho)}` : ''}</code></details>` : ''
      return `<li class="${esc(p.gravidade)}"><div class="topo">${etiqueta({ texto: g.rotulo, tom: p.gravidade, icone: g.icone })}${p.onde ? `<span class="onde">${esc(p.onde)}</span>` : ''}</div><p>${esc(p.mensagem)}</p>${p.oQueFazer ? `<p class="fazer"><strong>O que fazer:</strong> ${esc(p.oQueFazer)}</p>` : ''}${tecnico}</li>`
    })
    .join('')}</ul>`
}

// As cores do tema do CRM (oklch convertido) e a marca: azul #2253F5 e navy #252a3f.
const CLARO = '--fundo:#f5f6fa;--papel:#fff;--tinta:#09090b;--suave:#71717a;--linha:#e4e4e7;--marca:#2253f5;--marca-texto:#1d47d6;--marca-fundo:#eaefff;--navy:#252a3f;--erro:#dc2626;--erro-fundo:#fdecec;--aviso:#b45309;--aviso-fundo:#fdf3e1;--nota:#52607a;--nota-fundo:#eef1f6;--ok:#047857;--ok-fundo:#e3f6ee;--sombra:0 1px 3px rgba(9,9,11,.06),0 1px 2px rgba(9,9,11,.04);--aresta:#a1a1aa'
const ESCURO = '--fundo:#09090b;--papel:#18181b;--tinta:#fafafa;--suave:#a1a1aa;--linha:#2e2e33;--marca:#5b80ff;--marca-texto:#8ea6ff;--marca-fundo:#1a2140;--navy:#c9cfe8;--erro:#f87171;--erro-fundo:#3a1717;--aviso:#fbbf24;--aviso-fundo:#382a0d;--nota:#9fb0c8;--nota-fundo:#1f2530;--ok:#34d399;--ok-fundo:#0f2e22;--sombra:none;--aresta:#71717a'

const CSS = `${FONTES}
:root{${CLARO};--raio:10px;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${ESCURO};color-scheme:dark}}
:root[data-theme="dark"]{${ESCURO};color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--tinta);font:16px/1.6 "Barlow",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.ic{flex:none;vertical-align:-2px}
.barra{background:var(--papel);border-bottom:1px solid var(--linha)}
.barra div{max-width:1040px;margin:0 auto;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.logo{height:36px;width:auto;color:var(--navy);display:block}
.barra .tipo-doc{color:var(--suave);font-size:.9rem;font-weight:600;letter-spacing:.02em}
main{max-width:1040px;margin:0 auto;padding:28px 16px 64px}
.kicker{color:var(--marca-texto);font-weight:600;font-size:.9rem;letter-spacing:.03em;text-transform:uppercase;margin:0 0 4px}
h1{font-size:2rem;line-height:1.15;margin:0 0 12px;font-weight:700;letter-spacing:-.01em}
.etiquetas{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.etiqueta{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 10px;font-size:.84rem;font-weight:600;border:1px solid transparent;white-space:nowrap;background:var(--nota-fundo);color:var(--nota)}
.etiqueta.marca{background:var(--marca-fundo);color:var(--marca-texto)}.etiqueta.ok{background:var(--ok-fundo);color:var(--ok)}.etiqueta.aviso{background:var(--aviso-fundo);color:var(--aviso)}.etiqueta.erro{background:var(--erro-fundo);color:var(--erro)}.etiqueta.neutro{background:var(--papel);color:var(--suave);border-color:var(--linha)}
.indice{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;padding:0;list-style:none}
.indice a{display:inline-block;padding:5px 12px;border-radius:8px;color:var(--tinta);text-decoration:none;font-size:.9rem;font-weight:600;background:var(--papel);border:1px solid var(--linha)}
.indice a:hover{border-color:var(--marca);color:var(--marca-texto)}
.aviso-topo{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--linha);background:var(--papel);padding:12px 16px;border-radius:var(--raio);font-size:.9rem;color:var(--suave);margin:16px 0 0}
.aviso-topo .ic{color:var(--aviso);margin-top:3px}
section{margin-top:40px;scroll-margin-top:16px}
h2{font-size:1.3rem;margin:0 0 14px;font-weight:700;display:flex;align-items:center;gap:10px}
h2::before{content:"";width:4px;height:1.1em;border-radius:2px;background:var(--marca)}
a{color:var(--marca-texto)}
.sub{color:var(--suave);margin:0 0 12px;font-size:.95rem}
.cartao{background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);padding:16px 20px;margin:12px 0;box-shadow:var(--sombra)}
.cartao p:first-child,.passo p:first-of-type{margin-top:0}.cartao p:last-child{margin-bottom:0}
#resumo .cartao{font-size:1.06rem}
.gatilhos{display:flex;flex-wrap:wrap;gap:10px;margin:0;padding:0;list-style:none}
.gatilhos li{display:flex;align-items:center;gap:10px;background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);padding:10px 14px;font-weight:600;box-shadow:var(--sombra)}
.gatilhos .ic-caixa{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#3b82f6;color:#fff}
.rolagem{overflow:auto;background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);padding:8px;box-shadow:var(--sombra);background-image:radial-gradient(var(--linha) 1px,transparent 1px);background-size:18px 18px}
.rolagem .desenho{display:block;margin:0 auto;max-width:100%;height:auto}
.rolagem.real .desenho{max-width:none}
.alterna{margin:8px 0 0;font:inherit;font-size:.88rem;font-weight:600;color:var(--marca-texto);background:none;border:0;padding:0;cursor:pointer}
.desenho .corpo{fill:var(--papel);stroke:var(--linha)}
.desenho .no{filter:drop-shadow(0 1px 2px rgba(0,0,0,.12))}
.desenho .no a:hover .corpo{stroke:var(--marca)}
.desenho .problema .corpo{stroke:var(--erro);stroke-width:2}
.desenho .orfao .corpo{stroke-dasharray:5 4;stroke:var(--suave)}
.desenho text{font-family:inherit}
.desenho .tipo{fill:#fff;font-size:12px;font-weight:600}
.desenho .num{fill:#fff;font-size:12px;font-weight:700;opacity:.85}
.desenho .titulo{fill:var(--tinta);font-size:14px;font-weight:600}
.desenho .ic-no{color:#fff}
.desenho .alerta circle{fill:var(--erro)}.desenho .alerta text{fill:#fff;font-size:13px;font-weight:700}
.desenho .aresta{fill:none;stroke:var(--aresta);stroke-width:1.6}
.desenho .aresta.tracejada,.desenho .aresta.especial,.desenho .aresta.fim{stroke-dasharray:5 4}
.desenho .aresta.volta{stroke:var(--marca)}
.desenho .ponta{fill:var(--aresta)}
.desenho .rotulo rect{fill:var(--marca-fundo);stroke:var(--papel);stroke-width:2}
.desenho .rotulo text{fill:var(--marca-texto);font-size:11.5px;font-weight:700}
.desenho .rotulo.fim rect{fill:var(--nota-fundo)}.desenho .rotulo.fim text{fill:var(--nota)}
.passos{display:grid;gap:10px}
.passo{background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);padding:14px 18px 14px 16px;display:grid;grid-template-columns:36px 1fr;gap:4px 14px;box-shadow:var(--sombra);scroll-margin-top:16px}
.passo:target{border-color:var(--marca);box-shadow:0 0 0 3px var(--marca-fundo)}
.passo .ic-caixa{grid-row:span 3;display:grid;place-items:center;width:36px;height:36px;border-radius:9px;color:#fff}
.passo h3{margin:0;font-size:1.05rem;line-height:1.3;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.passo h3 .n{color:var(--suave);font-weight:600}
.passo .tipo{color:var(--suave);font-weight:600;font-size:.82rem;text-transform:uppercase;letter-spacing:.03em}
.passo p{margin:4px 0 0}
.saidas{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;padding:0;list-style:none;font-size:.92rem;color:var(--suave)}
.saidas li{display:flex;align-items:center;gap:6px}
.saidas .fim{font-weight:600;color:var(--nota)}
.ir{display:inline-block;padding:1px 9px;border-radius:999px;background:var(--marca-fundo);color:var(--marca-texto);font-weight:700;text-decoration:none;font-size:.88rem}
.ir:hover{background:var(--marca);color:#fff}
.problemas{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.problemas li{background:var(--papel);border:1px solid var(--linha);border-left:4px solid var(--nota);border-radius:var(--raio);padding:12px 16px;box-shadow:var(--sombra)}
.problemas li.erro{border-left-color:var(--erro)}.problemas li.aviso{border-left-color:var(--aviso)}
.problemas .topo{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.problemas p{margin:8px 0 0}.problemas .fazer{color:var(--suave)}.problemas .fazer strong{color:var(--tinta)}
.onde{color:var(--suave);font-size:.9rem}
.tecnico{margin-top:8px;font-size:.85rem;color:var(--suave)}.tecnico summary{cursor:pointer}.tecnico code{display:block;margin-top:6px;word-break:break-all}
.tudo-ok{display:flex;align-items:center;gap:8px;color:var(--ok);font-weight:700}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--fundo);border:1px solid var(--linha);padding:0 5px;border-radius:5px;font-size:.84em}
.conversa{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.fala{max-width:78%;padding:9px 14px;border-radius:14px;white-space:pre-wrap}
.fala.user{align-self:flex-end;background:var(--marca);color:#fff;border-bottom-right-radius:4px}
.fala.assistant{align-self:flex-start;background:var(--fundo);border:1px solid var(--linha);border-bottom-left-radius:4px}
.ferramenta{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:.84rem;color:var(--suave);white-space:normal}
.custo{color:var(--suave);font-size:.85rem}
.tabela{overflow-x:auto;background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);box-shadow:var(--sombra)}
table{border-collapse:collapse;width:100%}
th{font-size:.82rem;text-transform:uppercase;letter-spacing:.03em;color:var(--suave);font-weight:700;background:var(--fundo)}
td,th{border-bottom:1px solid var(--linha);padding:10px 14px;text-align:left;vertical-align:top}
tr:last-child td{border-bottom:0}
pre{white-space:pre-wrap;word-break:break-word;background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);padding:14px;font-size:.88rem}
details>summary{cursor:pointer;font-weight:600;color:var(--marca-texto)}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--linha);color:var(--suave);font-size:.85rem;display:flex;gap:14px;align-items:flex-start}
footer .logo{height:22px;flex:none}
@media (max-width:600px){main{padding:20px 16px 48px}h1{font-size:1.6rem}.indice{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}.indice li{flex:none}.rolagem .desenho{min-width:560px}.fala{max-width:92%}.passo{grid-template-columns:1fr}.passo .ic-caixa{display:none}.barra .tipo-doc{display:none}}
`

// Botão do desenho: alterna entre caber na tela e o tamanho real.
const SCRIPT = `document.addEventListener('click',function(e){var b=e.target.closest('.alterna');if(!b)return;var r=document.getElementById(b.dataset.alvo);r.classList.toggle('real');b.textContent=r.classList.contains('real')?'Ajustar à tela':'Ver em tamanho real'})`

// secoes: [{ id, titulo, html }]; etiquetas: [{ texto, tom, icone }]; tipoDocumento: o rótulo da barra.
export function pagina({ titulo, subtitulo, etiquetas = [], tipoDocumento = 'Automações e agentes', secoes }) {
  const visiveis = secoes.filter(Boolean)
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="barra"><div>${LOGO}<span class="tipo-doc">${esc(tipoDocumento)}</span></div></header>
<main>
${subtitulo ? `<p class="kicker">${esc(subtitulo)}</p>` : ''}
<h1>${esc(titulo)}</h1>
${etiquetas.length ? `<div class="etiquetas">${etiquetas.map(etiqueta).join('')}</div>` : ''}
<ul class="indice">${visiveis.map((s) => `<li><a href="#${esc(s.id)}">${esc(s.titulo)}</a></li>`).join('')}</ul>
<div class="aviso-topo">${icone('triangle-alert', { tamanho: 16 })}<span>${esc(AVISO)}</span></div>
${visiveis.map((s) => `<section id="${esc(s.id)}"><h2>${esc(s.titulo)}</h2>${s.html}</section>`).join('\n')}
<footer>${LOGO}<span>Gerado em ${esc(new Date().toLocaleString('pt-BR'))} pelas skills do Cubo. ${esc(AVISO)}</span></footer>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`
}
