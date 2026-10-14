# Página rica: usar tudo o que é real

A página que um bom profissional faz à mão não é rica por ter mais enfeite. É rica porque **usa todo
o material de verdade que o cliente já tem**: a linha de produtos com os dados de cada um, as fotos
das lojas, o vídeo institucional, os depoimentos com número, as dúvidas que o comercial ouve todo
dia. A página feita por IA costuma sair pobre porque para no briefing e na home do site.

Por isso a riqueza **não é um molde** ("toda página tem mostruário em abas"). É um inventário: o que
existe vira bloco; o que não existe não vira nada. Uma clínica pequena sem fotos boas terá uma página
mais curta — e isso está certo. Um fabricante com vinte produtos e três vídeos, com página curta,
jogou material fora.

## 1. O inventário (no dossiê)

Percorra o site **além da home**. O `marca.mjs` lista as páginas internas que parecem ter
matéria-prima (produtos, serviços, cases, galeria, depoimentos, sobre); rode-o também nelas. Anote
em `dossie/contexto.md`, na seção "Matéria-prima":

```markdown
## Matéria-prima
| o quê | quantos | onde está | vira |
|---|---|---|---|
| linha de produtos com dados (capacidade, tempo) | 2 categorias, 7 modelos | site/lavadoras, site/secadoras | mostruário em abas |
| fotos reais de lojas de clientes | 9 | site/cases | galeria |
| vídeo institucional | 1 (YouTube, 2 min) | home | vídeo para assistir |
| depoimentos com nome e resultado | 5 | site/cases | faixa de depoimentos |
| números publicados | 3 | home, "sobre" | faixa com contador |
| etapas do atendimento | 4 | briefing | jornada |
| dúvidas frequentes | 6 | briefing + FAQ do site | perguntas |
```

## 2. Matéria-prima → bloco

| Quando existe | O bloco | Mínimo para valer |
|---|---|---|
| linha de produtos, serviços, planos, modelos, tratamentos, cursos, com **dados** de cada um | **mostruário**: abas por categoria, cada item com foto e 2 a 4 dados curtos tirados do site | 2 categorias, ou 3 itens com dados |
| fotos reais do lugar, da obra, das lojas, da equipe, de clientes | **galeria**: faixa de fotos (rola de lado no celular, mosaico no computador), com legenda curta | 4 fotos boas |
| vídeo do próprio cliente | **vídeo de fundo** no topo, se mostra o lugar ou o produto em uso; **vídeo para assistir**, se é depoimento ou apresentação ([movimento.md](movimento.md)) | 1 |
| depoimentos com nome (e, de preferência, resultado) | **um grande** perto do topo; se houver 3 ou mais, **faixa** que a pessoa rola, com o de número em destaque | 1 |
| números publicados pela marca | **faixa com contador**, cada número com uma frase de sentido ([movimento.md](movimento.md)) | 2 |
| processo com etapas de verdade | **jornada** numerada: o que acontece, quem faz, quanto tempo | 3 etapas |
| dúvidas que o comercial ouve, objeções do briefing, FAQ do site | **perguntas** em acordeão | 4 |
| clientes ou parceiros conhecidos, com permissão | **2 a 4 logotipos na cor original**, com uma linha sobre cada | 2 |
| benefícios, diferenciais, recursos | **lista com ícone** — todo item leva um, da mesma família (`icone.mjs`) | sempre |
| certificação, prêmio, garantia, tempo de mercado | **selo** perto do formulário | 1 |

Duas regras que seguram isso:

- **Todo item do inventário entra, ou tem um motivo escrito no plano** ("vídeo de 2016, com a marca
  antiga — fica de fora"). Item esquecido é o que empobrece a página.
- **Nenhum bloco sem matéria-prima.** Mostruário sem os dados dos produtos, galeria com banco de
  imagem, faixa de números inventados: é pior que não ter.

Com material de sobra, uma página de captação costuma ter **7 a 10 blocos** entre o topo e o
rodapé. Menos que 5 com o inventário cheio quer dizer que ficou coisa de fora.

## 3. Formulário no topo e no fim

Quem chega ao fim da página decidiu; mandá-lo de volta ao topo para preencher é perder parte deles.
**O formulário aparece duas vezes**: no topo (ou a um botão de distância) e no último bloco, com uma
frase de fechamento. É o **mesmo** formulário do Cubo em dois lugares — o SDK conta a visita uma vez
só.

```html
<div class="lp-formulario"></div>   <!-- no topo -->
…
<div class="lp-formulario"></div>   <!-- no último bloco -->

<script src="https://SEU-CRM/sdk/form.js" defer></script>
<script>
  addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.lp-formulario').forEach(function (alvo) {
      new Form({ form: 'frm_XXXXXXXXXXXXXXXX', target: alvo, minHeight: 420, inheritPageStyles: true })
    })
  })
</script>
```

Página curta (até 3 blocos) dispensa o segundo. Os botões de cada bloco levam ao formulário mais
próximo ([movimento.md](movimento.md)).

## 4. Os blocos, prontos

Todos funcionam **sem script** (tudo aparece, empilhado) e usam o mesmo sistema de chegada da página
(`lp-revela`). O script de cada um entra no script único do fim do corpo.

### Mostruário em abas

```html
<section class="lp-mostruario">
  <h2>Lavagem e secagem para cada tamanho de loja</h2>
  <div class="lp-abas" role="tablist" aria-label="Categorias">
    <button role="tab" aria-selected="true" aria-controls="aba-lavagem" id="t-lavagem">Lavagem</button>
    <button role="tab" aria-selected="false" aria-controls="aba-secagem" id="t-secagem" tabindex="-1">Secagem</button>
  </div>
  <div class="lp-painel" role="tabpanel" id="aba-lavagem" aria-labelledby="t-lavagem">
    <article class="lp-item lp-revela">
      <img src="…/genius-10.webp" alt="Lavadora Genius de 10 kg" width="480" height="480" loading="lazy">
      <h3>Genius 10 kg</h3>
      <dl><dt>Centrifugação</dt><dd>até 450G</dd><dt>Ciclo</dt><dd>30 min</dd></dl>
    </article>
    …
  </div>
  <div class="lp-painel" role="tabpanel" id="aba-secagem" aria-labelledby="t-secagem">…</div>
  <a class="lp-botao" href="#contato">Quero ajuda para escolher</a>
</section>
```

```css
.lp-abas { display: none; }
.lp-js .lp-abas { display: flex; gap: var(--e-2); }
.lp-js .lp-painel[hidden] { display: none; }
.lp-painel { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--e-4); }
.lp-abas [aria-selected="true"] { background: var(--lp-cor); color: #fff; }
```

```js
document.querySelectorAll('.lp-mostruario').forEach(function (bloco) {
  var abas = [].slice.call(bloco.querySelectorAll('[role="tab"]'))
  var escolhe = function (aba) {
    abas.forEach(function (a) {
      var ativa = a === aba
      a.setAttribute('aria-selected', ativa); a.tabIndex = ativa ? 0 : -1
      document.getElementById(a.getAttribute('aria-controls')).hidden = !ativa
    })
  }
  abas.forEach(function (aba, i) {
    aba.addEventListener('click', function () { escolhe(aba) })
    aba.addEventListener('keydown', function (e) {
      var passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (passo) { var outra = abas[(i + passo + abas.length) % abas.length]; escolhe(outra); outra.focus() }
    })
  })
  escolhe(abas[0])
})
```

Os dados vêm **do site do cliente**, com a mesma grafia. Dado que você não achou, não entra.

### Galeria

```html
<section class="lp-galeria" aria-label="Lojas de clientes">
  <figure class="lp-revela"><img src="…" alt="Loja em Curitiba, fachada" width="800" height="600" loading="lazy"><figcaption>Curitiba, PR</figcaption></figure>
  …
</section>
```

```css
.lp-galeria { display: grid; grid-auto-flow: column; grid-auto-columns: 78%; gap: var(--e-3);
  overflow-x: auto; scroll-snap-type: x mandatory; padding-inline: var(--e-4); }
.lp-galeria figure { scroll-snap-align: start; margin: 0; }
.lp-galeria img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; }
@media (min-width: 900px) {
  .lp-galeria { grid-auto-flow: row; grid-template-columns: 2fr 1fr 1fr; overflow: visible; }
  .lp-galeria figure:first-child { grid-row: span 2; }
}
```

### Depoimentos que a pessoa rola

Nunca rodando sozinhos (quem lê perde o fio). Faixa com rolagem lateral e, no computador, dois ou
três lado a lado. O de resultado com número vem primeiro. Mesmo CSS da galeria, com cartões de texto:
a frase, o nome, o que a pessoa faz, e a foto quando houver.

### Perguntas

```html
<section class="lp-perguntas">
  <h2>Antes de falar com a gente</h2>
  <details class="lp-revela"><summary>A Girbau é uma franquia?</summary><p>Não. …</p></details>
  …
</section>
```

```css
.lp-perguntas summary { cursor: pointer; padding: var(--e-3) 0; font-weight: 600; list-style: none; }
.lp-perguntas summary::after { content: "+"; float: right; }
.lp-perguntas details[open] summary::after { content: "–"; }
.lp-perguntas details { border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
```

A primeira pergunta pode vir aberta (`<details open>`). As respostas são do briefing e do site; a
pergunta que ninguém respondeu vira `data-rascunho`.
