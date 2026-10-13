# Acabamento

A estrutura certa com acabamento ruim ainda parece feita às pressas: título gigante quebrando em
cinco linhas, formulário mais alto que tudo em volta, frase curta partida no meio, rodapé que é só
o que sobrou. O que separa "feito à mão" de "gerado" é disciplina em quatro coisas: **tipos,
espaço, proporção e quebras de linha**. Elas vão como **tokens** no topo do CSS, e o resto da
página só usa os tokens — nunca um valor solto.

> Adaptado das referências de tipografia, espaço e da checagem final da
> [Hallmark](https://github.com/Nutlope/hallmark) (MIT).

## Tipos

**Um par, não uma fonte.** Uma fonte de **título** e uma de **texto**, bem diferentes entre si — o
contraste entre as duas é boa parte do que faz a página parecer desenhada.

- **Se o site do cliente tem fonte de título e de texto, são essas** — mesmo que seja Inter,
  mesmo que as duas sejam parecidas. A landing é uma página do site ([marca.md](marca.md), "o sistema
  do site"). O par abaixo é para quando o site não tem sistema.
- Se a marca tem **uma** fonte só (o raio-x diz qual), ela fica — quase sempre como a de **texto**. Dê a ela
  um par de título que contraste: uma serifa para uma marca de sans, uma sans forte para uma marca de
  serifa. Ex.: marca em *Instrument Sans* → títulos em *Instrument Serif*; marca em *Montserrat* →
  títulos em *Fraunces* ou *Newsreader*.
- Três famílias é o teto (a terceira só para um momento: o logotipo em texto, uma citação).
- **Evite as fontes que toda IA escolhe** quando não há motivo (a marca usar é motivo): Inter, Roboto, Open Sans, Lato,
  Poppins, Montserrat, Nunito, Raleway, DM Sans; e Playfair Display como texto. Boas escolhas
  gratuitas no Google Fonts: títulos — Fraunces, Newsreader, Instrument Serif, DM Serif Display,
  Cormorant Garamond (luxo), Bricolage Grotesque (forte), Cabinet Grotesk; texto — Instrument Sans,
  Geist, IBM Plex Sans, Source Serif 4, Newsreader.
- Título **sem itálico** e sem uma palavra pintada de outra cor. Ênfase é peso ou tamanho.

**Uma escala, no máximo cinco tamanhos na página.** Escolha uma razão (1,25 é o padrão) e derive
tudo dela. Precisou de mais hierarquia? Use peso e cor, não outro tamanho.

```css
:root {
  --fonte-titulo: "Instrument Serif", Georgia, serif;
  --fonte-texto: "Instrument Sans", system-ui, sans-serif;
  --t-pequeno: 0.875rem;
  --t-texto: 1.0625rem;
  --t-destaque: 1.3rem;
  --t-secao: clamp(1.75rem, 1.2rem + 2vw, 2.6rem);
  --t-titulo: clamp(2.4rem, 1.4rem + 4vw, 4.5rem);
}
```

**O tamanho do título depende de quantas letras ele tem** — é o erro que faz um título virar parede:

| Título (caracteres) | Tamanho |
|---|---|
| até 50 (o ideal — escreva para caber aqui) | `--t-titulo` |
| 51 a 90 | um degrau abaixo (`--t-secao` crescido), e tente encurtar |
| mais de 90 | reescreva. Título de 100 letras em tamanho grande é o sinal mais confiável de página gerada |

Frase de efeito no meio da página (uma citação, a "frase-tese" de uma seção) segue a mesma regra:
se passa de duas linhas no computador, está grande demais ou comprida demais.

**Entrelinha muda com o tamanho:** 1,05–1,15 nos títulos, 1,5–1,65 no texto.

## Quebras de linha

- **Largura de leitura entre 45 e 75 caracteres** (`max-width: 65ch` no parágrafo). Menos que 45,
  o texto fica picado; mais que 75, o olho se perde.
- **Não espreme o que é curto.** Uma frase de 90 caracteres numa caixa de `42ch` quebra em três
  linhas sem motivo. A largura máxima é para o texto corrido; frase curta, legenda e título
  respeitam a largura do bloco em que estão.
- **Equilibre os títulos:** `text-wrap: balance` em `h1`, `h2`, `h3` e citações (sem palavra sozinha
  na última linha); `text-wrap: pretty` nos parágrafos.
- **Botão e link nunca quebram em duas linhas**, em nenhuma largura de tela. Encurte o texto ou use
  `white-space: nowrap`.
- Palavra longa no título, no celular: `overflow-wrap: anywhere; min-width: 0`.

## Espaço

**Uma escala de espaço, usada em tudo** — nada de `padding: 17px`:

```css
:root {
  --e-1: 0.5rem; --e-2: 0.75rem; --e-3: 1rem; --e-4: 1.5rem;
  --e-5: 2.5rem; --e-6: 4rem; --e-7: 6rem; --e-8: 9rem;
}
```

- **Espaço variado dá ritmo.** Se toda seção tem o mesmo respiro em cima e embaixo, a página é
  uma lista. Alterne seções apertadas e generosas; mais espaço **acima** de um título do que abaixo
  dele (o título pertence ao que vem depois).
- `gap` para espaçar irmãos, não `margin` em cada um.
- **Primeira dobra:** mais espaço embaixo do que em cima, para ela assentar na página; e tudo que
  importa (título, apoio, botão ou formulário, a primeira prova) visível em **1280×800**, sem rolar.

## Proporção

É o que mais denuncia pressa, e o `previa.mjs --capturar` mede:

- **Colunas lado a lado precisam conversar em altura.** Formulário de 700px ao lado de um texto de
  300px deixa um buraco. Resolva: formulário mais curto (menos campos, campos em duas colunas),
  texto com mais conteúdo (a prova, uma foto), ou formulário **abaixo** da dobra com um botão no topo.
- **O formulário pede menos que o bloco em que está.** A caixa do formulário não é maior nem mais
  chamativa que a oferta — ela serve à oferta.
- **Grade com imagem:** `minmax(0, 1fr)` nas colunas, não `1fr` (imagem grande estoura a coluna no
  celular). E `html, body { overflow-x: clip }` como rede de segurança.
- **Não centralize tudo.** Título, texto e botão todos centralizados é o molde. Alinhe à esquerda por
  padrão; centralize com intenção (um fechamento, uma citação).

## Rodapé

O rodapé é a última impressão e costuma ser a mais descuidada. Escolha um formato em vez de empilhar
o que sobrou:

- **Faixa com a marca** — logotipo e uma frase numa linha só; ao lado, dois ou três links pequenos
  (política, contato); embaixo, razão social e CNPJ em letra miúda.
- **Linha única** — uma só linha com razão social, CNPJ, contato e política, separados por espaço, com
  um fio fino em cima. Para página enxuta.
- **Frase de fechamento** — uma frase grande que encerra o argumento, e o resto (marca, links, CNPJ)
  pequeno embaixo. Casa com Manifesto e Carta.
- **Assinatura** — fecha como carta: "Veridiana e equipe", com a foto pequena. Só com a estrutura
  Carta.

Nunca: quatro colunas de links (landing page não tem para onde mandar ninguém), ícones de rede
social soltos, ou os itens empilhados à esquerda com o resto da faixa vazio.

## Cor com contraste

- A cor de destaque cobre pouco: botão, um detalhe, um fio. Não pinte seções inteiras com ela.
- Todo fundo escuro troca a cor do texto na mesma regra (`background` escuro e `color` claro juntos).
- Texto em cima da cor da marca tem a sua própria cor definida e conferida (4,5:1). O botão
  rosé com texto branco a 2:1 é o erro mais comum — e o botão do formulário do Cubo vem com texto
  branco fixo ([formulario.md](formulario.md)).
- Cinza puro parece morto: puxe os cinzas para a cor da marca (um cinza esverdeado numa marca verde).
