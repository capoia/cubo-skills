# O HTML da página

## O que você escreve, e o que o Cubo escreve

A página é montada assim, a cada visita:

```
<html>
  <head>
    metatags, favicon, robots        ← colunas da página no Cubo
    Pixel, GTM, GA4, Clarity, CAPI   ← integrações da página no Cubo
    {{ head }}                       ← SEU: fontes + <style>
    {{ codeHead }}                   ← script extra do cliente, se houver
  </head>
  <body>
    {{ html }}                       ← SEU: o corpo da página
    aviso de cookies, enriquecimento ← Cubo
    {{ codeBody }}                   ← script extra do cliente, se houver
  </body>
</html>
```

Então:

| Campo da API | O que vai nele |
|---|---|
| `html` | **só o corpo**: `<header>`, `<section>`, `<footer>`, os `<div class="lp-formulario">` e o trecho do SDK |
| `head` | `<link>` das fontes e **o `<style>` com o CSS da página** |
| `codeHead` / `codeBody` | script de terceiro que o cliente pediu, e só |
| `metaDescription`, `robots`, `favicon` | campos próprios, não escreva no HTML |

⚠️ **O CSS vai em `head`, dentro de um `<style>`.** Existe uma coluna `css` por causa do construtor
visual antigo, mas **ela não é renderizada** na página em HTML. CSS mandado só em `css` não aparece.

## Proibido no `html`

`<!doctype>`, `<html>`, `<head>`, `<body>`, `<meta>`, `<title>` — e **qualquer** rastreamento:
`fbq`, `gtag`, `dataLayer`, GTM, Clarity, chamadas para `/api/capi/track`, aviso de cookies.

Não é questão de estilo: o Cubo já disparou o PageView com um id que casa com o que vai pela API de
Conversões. Um segundo evento seu, com outro id, faz a Meta contar duas visitas — e o cliente toma
decisão de verba em cima desse número.

## Esqueleto

```html
<div class="lp">
  <header class="lp-topo">
    <img src="https://…/logo.svg" alt="Nome da empresa" width="140" height="40" />
  </header>

  <section class="lp-oferta">
    <div class="lp-oferta__texto">
      <h1>A promessa, em uma frase</h1>
      <p class="lp-subtitulo">A frase que tira a dúvida mais óbvia.</p>
      <ul class="lp-provas">…</ul>
    </div>

    <div class="lp-oferta__form">
      <h2>Fale com a gente</h2>
      <div class="lp-formulario"></div>
    </div>
  </section>

  <section class="lp-prova">… <a class="lp-cta" href="#contato">Quero começar</a></section>
  <section class="lp-objecoes">… <a class="lp-cta" href="#contato">Quero começar</a></section>
  <section class="lp-fechamento" id="contato">
    <h2>A frase de fechamento</h2>
    <div class="lp-formulario"></div>
  </section>

  <footer class="lp-rodape">…</footer>
</div>

<script src="https://SEU-CRM/sdk/form.js" defer></script>
<script>
  addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.lp-formulario').forEach(function (alvo) {
      new Form({ form: 'frm_XXXXXXXXXXXXXXXX', target: alvo, minHeight: 420, inheritPageStyles: true })
    })
  })
</script>
```

O formulário aparece **no topo e no fim** — o mesmo, desenhado duas vezes ([riqueza.md](riqueza.md)).

Três coisas sobre o trecho do formulário:

- `SEU-CRM` é o mesmo endereço configurado no acesso. **Não passe `apiBase`**: o SDK descobre pelo
  endereço do próprio script, e é isso que faz a marca branca funcionar;
- `frm_…` é o `publicId` que a criação do formulário devolveu;
- `minHeight` reserva a altura e evita o salto de layout. **Nunca use `lazy`** — ele não existe mais
  e, quando existia, trocava alguns kB por risco de lead perdido.

## CSS

Em `head`, num `<style>` só. Regras práticas:

- **zere a margem da página**: `html, body { margin: 0; padding: 0 }`. As páginas do construtor
  visual trazem esse reset no próprio CSS; a sua, em HTML, não — e o template do Cubo não zera. Sem
  ele, sobra uma borda branca de 8px em volta. O `previa.mjs --capturar` acusa;
- prefixe o resto (`.lp-`): o CSS convive com o que o Cubo injeta;
- **não estilize o formulário por CSS da página** — ele desenha em shadow DOM e nada vaza para
  dentro. Para mudar a aparência dele, use as configurações do formulário
  ([formulario.md](formulario.md));
- mobile primeiro. A maior parte do tráfego de anúncio é celular;
- reserve `width` e `height` em toda imagem: é a causa número um de nota baixa por deslocamento;
- fonte do sistema não custa nada e é aceitável quando a marca não tem fonte própria. Se usar Google
  Fonts, **um** peso ou dois, com `display=swap`, e `preconnect` antes.
- **fontes do site**: se o site do cliente usa Google Fonts, use o mesmo link. Se usa arquivo próprio
  (o raio-x lista os endereços), declare o `@font-face` apontando para o arquivo **no site do
  cliente**, com `font-display: swap` e uma alternativa parecida do Google Fonts na pilha. Muitos
  servidores bloqueiam fonte usada em outro domínio: o `previa.mjs --capturar` acusa a fonte que não
  carregou, e aí fica a alternativa — diga à pessoa qual, e que dá para liberar no servidor do site
  (cabeçalho `Access-Control-Allow-Origin`).

```css
@font-face { font-family: "HTF Gotham"; font-weight: 700; font-display: swap;
  src: url("https://www.cliente.com.br/wp-content/themes/cliente/fonts/Gotham-Ultra.ttf"); }
:root { --fonte-titulo: "HTF Gotham", "Montserrat", system-ui, sans-serif; }
```

```html
<!-- head -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap" rel="stylesheet" />
<style>
  .lp { … }
</style>
```

## Imagens

**Toda imagem que a pessoa mandar vira arquivo no Cubo.** Se ela anexou uma foto, mandou link do
Drive, apontou uma imagem do site antigo ou colou no chat: baixe, prepare e **suba pelo
`POST /api/landings/assets`**, usando a URL que ele devolve.

Nunca aponte o `<img src>` para endereço de terceiro. Link do Drive não funciona como imagem, link
do site antigo quebra quando ele sai do ar, e imagem hospedada fora não entra na cota nem no backup
do cliente — some sem aviso, e a página quebra semanas depois, quando ninguém liga mais uma coisa à
outra.

**Toda imagem passa pelo `imagem.mjs` antes de subir. Sem exceção.**

```bash
node "<scripts>/imagem.mjs" foto.jpg topo topo.webp
node "<scripts>/imagem.mjs" https://site-do-cliente.com.br/fachada.png conteudo fachada.webp
node "<scripts>/imagem.mjs" logo.png logo logo.webp
```

Ele aceita arquivo ou **endereço** — é assim que se aproveita a foto que o cliente já usa no site
(o `marca.mjs` lista as que achou). Redimensiona, converte para **webp** e aperta a qualidade até
caber no orçamento; no papel `logo`, também apara a margem transparente em volta. A primeira linha
da saída é o arquivo pronto, que é o que vai para o `POST /api/landings/assets`.

Ele avisa quando a original é **estreita demais** para o papel (uma foto de 1024px como `topo` vai
aparecer esticada no computador): nesse caso, use a imagem em meia largura em vez de tela
inteira.

| Papel | Largura máxima | Alvo |
| --- | --- | --- |
| `topo` — a imagem grande do começo | 1600px | 200 KB |
| `conteudo` — qualquer outra | 1200px | 100 KB |
| `logo` | 480px | 40 KB |

Três limites que não são opinião:

- **1 MB por arquivo** é o teto do Cubo (`landingUploadAssetValidator`). Acima disso a API recusa
  com 422, não importa o formato;
- **cada imagem consome a cota de armazenamento da empresa** — é o mesmo balde dos anexos. Subir
  três versões "para escolher depois" gasta cota de verdade;
- **`webp` sempre.** O mesmo conteúdo costuma sair com um terço do peso de um jpg, e é aceito em
  todo navegador que importa há anos. A única exceção é **SVG**, que já é vetor: sobe como está.

O alvo de 200 KB para a imagem do topo não é arbitrário — é ela que o Lighthouse mede como LCP, a
métrica que mais mexe na nota de desempenho no celular. O script avisa quando não conseguiu chegar
lá; quando avisar, o caminho é cortar a imagem ou pedir uma com menos detalhe, não subir assim
mesmo.

**Se o script disser que a dependência não está instalada**, rode o `requisitos.mjs`
([requisitos.md](requisitos.md)). Não contorne subindo o jpg original: é exatamente o que ele
existe para impedir.

**Durante a prévia**, antes de subir, o `<img src>` pode apontar para o arquivo local com caminho
relativo (`imagens/topo.webp`): o `previa.mjs` serve a pasta do `corpo.html`. Na hora de criar a
página no Cubo, troque cada um pela URL que o `POST /api/landings/assets` devolveu.

No HTML, toda imagem leva `width`, `height` e `alt`; a do topo leva `fetchpriority="high"` e as
demais, `loading="lazy"`.

## Script de terceiro

O conteúdo passa por uma checagem: `<script src>` apontando para um domínio fora da lista conhecida
(jsDelivr, cdnjs, unpkg, Google Fonts, GTM, Facebook, jQuery) é **recusado** com 422 dizendo qual
origem foi barrada. Script escrito na própria página continua liberado.

A checagem vale para `html`, `head`, `codeHead` e `codeBody`. Quando for recusado, explique por que
existe a trava em vez de procurar um jeito de contorná-la — inclusive porque **dá** para contorná-la
(script embutido é liberado, e ele carrega o que quiser). Contornar uma trava que existe para
proteger a página do cliente é traição de confiança, não esperteza.
