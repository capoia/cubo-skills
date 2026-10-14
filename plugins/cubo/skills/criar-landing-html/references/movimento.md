# Página viva

Página estática lê como rascunho. Movimento bem feito diz que alguém cuidou dela: os blocos chegam
com suavidade, os números sobem até o valor, o botão está sempre à mão. Mal feito, é o contrário —
cada seção com um efeito diferente, texto que demora a aparecer, página que trava no celular.

Tudo aqui cabe nas regras de desempenho: **só se anima `transform` e `opacity`**, o script é
embutido e pequeno (o Cubo aceita `<script>` escrito na página; o que ele barra é `<script src>` de
fora — ver [html.md](html.md)), e **tudo desliga para quem pediu menos movimento** no sistema.

## As regras

1. **Um sistema de movimento para a página inteira.** O mesmo jeito de chegar em todos os blocos,
   a mesma duração (400–600 ms), a mesma curva (desacelerando no fim). Efeito diferente por seção
   é o que parece enfeite.
2. **Nada da primeira tela anima para aparecer.** O título, o texto, o botão e a imagem do topo já
   estão lá quando a página abre — esconder o topo atrás de animação derruba a nota (o Lighthouse
   mede quando o maior elemento aparece) e deixa a pessoa olhando para o vazio. O `previa.mjs`
   acusa conteúdo invisível na primeira tela.
3. **Sem script, tudo aparece.** A classe que esconde só entra quando o script roda; se ele falhar,
   a página fica estática, não em branco.
4. **Nada de pulo, rotação, zoom ou tremida.** Deslocamento curto (12–16 px) e opacidade.

## A estrutura

No `<style>` (em `head`), uma vez:

```css
.lp-js .lp-revela { opacity: 0; transform: translateY(14px);
  transition: opacity .55s cubic-bezier(.2,.7,.2,1), transform .55s cubic-bezier(.2,.7,.2,1);
  transition-delay: calc(var(--i, 0) * 80ms); }
.lp-js .lp-revela.lp-visivel { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .lp-js .lp-revela { opacity: 1; transform: none; transition: none; }
}
```

No fim do corpo (em `html`), um script só, que liga todos os efeitos da página:

```html
<script>
(function () {
  var calmo = matchMedia('(prefers-reduced-motion: reduce)').matches
  document.documentElement.classList.add('lp-js')

  // Revelação ao rolar: cada .lp-revela aparece uma vez, quando entra na tela.
  var olho = new IntersectionObserver(function (itens) {
    itens.forEach(function (item) {
      if (!item.isIntersecting) return
      item.target.classList.add('lp-visivel')
      olho.unobserve(item.target)
    })
  }, { rootMargin: '0px 0px -10% 0px' })
  document.querySelectorAll('.lp-revela').forEach(function (el) { olho.observe(el) })

  // Contador: o número final já está no HTML (é o que vale sem script e para o Google).
  var contador = new IntersectionObserver(function (itens) {
    itens.forEach(function (item) {
      if (!item.isIntersecting) return
      contador.unobserve(item.target)
      var el = item.target, alvo = parseFloat(el.dataset.contar), casas = (el.dataset.contar.split('.')[1] || '').length
      var antes = el.dataset.antes || '', depois = el.dataset.depois || '', inicio = null
      if (calmo) return
      function passo(t) {
        inicio = inicio || t
        var p = Math.min((t - inicio) / 1400, 1), suave = 1 - Math.pow(1 - p, 3)
        el.textContent = antes + (alvo * suave).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + depois
        if (p < 1) requestAnimationFrame(passo)
      }
      requestAnimationFrame(passo)
    })
  })
  document.querySelectorAll('[data-contar]').forEach(function (el) { contador.observe(el) })
})()
</script>
```

Ao escrever os blocos: `class="lp-revela"` nos elementos que devem chegar (o título da seção, o
bloco de texto, a imagem, cada item de uma lista — com `style="--i:1"`, `--i:2`… para chegarem em
cascata). **Não** ponha `lp-revela` em nada da primeira tela.

## Números que sobem

Só número **real e publicado** (anos de marca, clientes, unidades, dados do fabricante com a fonte
na página). O HTML traz o valor final; o script anima do zero até ele:

```html
<strong class="lp-numero" data-contar="105" data-antes="+">+105</strong> anos de história
<strong class="lp-numero" data-contar="30" data-antes="−" data-depois="%">−30%</strong> no consumo de água*
```

`font-variant-numeric: tabular-nums` no número, para ele não tremer de largura enquanto conta. Uma
faixa de números é aceita **quando os números são da marca e têm fonte** — mas cada um com uma frase
que diz o que significa, não só um rótulo de duas palavras.

## Botão em cada bloco, e a barra no celular

Cada seção que termina um argumento termina com o botão — **o mesmo verbo** da página toda, levando
ao formulário do fim (`href="#contato"`, o id do último bloco — ver o formulário duplo em
[riqueza.md](riqueza.md)). No celular, uma barra fixa embaixo com o botão aparece depois que o topo
sai da tela e some quando algum dos formulários está visível:

```css
.lp-barra { position: fixed; inset: auto 0 0 0; z-index: 50; padding: .75rem 1rem calc(.75rem + env(safe-area-inset-bottom));
  background: var(--lp-fundo); box-shadow: 0 -1px 0 rgba(0,0,0,.08); transform: translateY(110%); transition: transform .3s; }
.lp-barra.lp-mostra { transform: none; }
@media (min-width: 900px) { .lp-barra { display: none; } }
```

```html
<div class="lp-barra" aria-hidden="true"><a class="lp-cta" href="#contato" tabindex="-1">Quero meu estudo</a></div>
<script>
(function () {
  var barra = document.querySelector('.lp-barra'), topo = document.querySelector('.lp-oferta')
  var forms = document.querySelectorAll('.lp-formulario')
  if (!barra || !topo || !forms.length) return
  var topoVisivel = true, formsVisiveis = new Set()
  function atualiza() { barra.classList.toggle('lp-mostra', !topoVisivel && !formsVisiveis.size) }
  new IntersectionObserver(function (e) { topoVisivel = e[0].isIntersecting; atualiza() }).observe(topo)
  var olhoForm = new IntersectionObserver(function (itens) {
    itens.forEach(function (i) { i.isIntersecting ? formsVisiveis.add(i.target) : formsVisiveis.delete(i.target) })
    atualiza()
  })
  forms.forEach(function (f) { olhoForm.observe(f) })
})()
</script>
```

## Tons da cor da marca

Uma cor só dá uma página chapada. Gere a escala a partir da cor principal e use os tons para dar
ritmo aos fundos das seções (um claro, um médio, um escuro, alternando com o branco):

```css
:root {
  --lp-cor: #1a7f8e;
  --lp-cor-50:  color-mix(in oklch, var(--lp-cor) 6%, white);
  --lp-cor-100: color-mix(in oklch, var(--lp-cor) 14%, white);
  --lp-cor-300: color-mix(in oklch, var(--lp-cor) 45%, white);
  --lp-cor-700: color-mix(in oklch, var(--lp-cor) 80%, black);
  --lp-cor-900: color-mix(in oklch, var(--lp-cor) 55%, black);
}
```

Texto sobre o tom escuro é claro, sobre o tom claro é escuro — confira 4,5:1 ([acabamento.md](acabamento.md)).

## Vídeo

O vídeo entra **por upload** no Cubo (mp4 ou webm, até 25 MB — o mesmo limite do construtor
visual). Sempre passe pelo `video.mjs` antes: ele comprime, corta e gera o pôster.

```bash
node "<scripts>/video.mjs" fachada.mov fundo --segundos=12
node "<scripts>/cubo.mjs" upload /api/landings/assets fachada.mp4
node "<scripts>/cubo.mjs" upload /api/landings/assets fachada-poster.webp
```

**Vídeo de fundo** (topo ou faixa): mudo, em loop, com o pôster — e **não baixa no celular nem para
quem pediu menos movimento**, onde fica só o pôster. Por cima, uma camada escura para o texto ler:

```html
<div class="lp-video-fundo">
  <video muted loop playsinline preload="none" poster="https://…/fachada-poster.webp" data-src="https://…/fachada.mp4"></video>
</div>
<script>
(function () {
  var v = document.querySelector('.lp-video-fundo video')
  if (!v || matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)').matches) return
  addEventListener('load', function () { v.src = v.dataset.src; v.play().catch(function () {}) })
})()
</script>
```

**Vídeo para assistir** (depoimento, apresentação): com `controls`, `preload="none"` e o pôster.
Vídeo do YouTube do próprio cliente também serve — com a imagem de capa no lugar e o `<iframe>`
entrando só no clique, porque o player do YouTube pesa mais que a página inteira.

## Parallax leve

Só na imagem de fundo de uma faixa, só no computador, e sem script — o navegador faz sozinho onde
souber (onde não souber, a imagem simplesmente fica parada):

```css
@supports (animation-timeline: view()) {
  @media (min-width: 900px) and (prefers-reduced-motion: no-preference) {
    .lp-parallax img { animation: lp-parallax linear both; animation-timeline: view(); scale: 1.15; }
    @keyframes lp-parallax { from { translate: 0 -6%; } to { translate: 0 6%; } }
  }
}
```

Uma faixa com parallax por página. Duas já cansam.

## Ícones

Desenhados, de **uma família só**, na mesma espessura — nunca emoji. Use o SVG do
[Lucide](https://lucide.dev) (licença ISC), escrito direto no HTML, com `stroke="currentColor"` para
herdar a cor:

```html
<svg class="lp-icone" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor"
  stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
</svg>
```

Não copie à mão: o `icone.mjs` procura e imprime o `<svg>` pronto, no padrão acima.

```bash
node "<scripts>/icone.mjs" buscar wash timer money     # os nomes vêm em inglês
node "<scripts>/icone.mjs" washing-machine timer banknote
```

**Todo item de lista de benefícios, diferenciais, recursos ou etapas leva um ícone** — é o que faz o
bloco ser lido de relance. Ícone não vira enfeite de título nem de parágrafo solto.
