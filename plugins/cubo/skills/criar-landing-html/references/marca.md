# Raio-x da marca

O cliente quase nunca manda paleta, fonte e logotipo. Mas quase sempre tem **site, landing antiga,
loja ou blog** — e ali está tudo. Ler isso antes de perguntar é o que faz a página sair com a cara
dele mesmo quando o briefing diz só "seguir a identidade visual".

## Rodar

Com todos os endereços que aparecerem (briefing, conversa, assinatura de e-mail), de uma vez:

```bash
node "<scripts>/marca.mjs" https://site-do-cliente.com.br https://lp-atual.com.br/pagina
```

Para cada endereço ele grava, em `./marca/<site>/`, as capturas (`desktop-topo.jpg`,
`desktop-pagina.jpg`, `celular-topo.jpg`, `celular-pagina.jpg`) e um `marca.json` com o que mediu
**na página desenhada**: cores pesadas pela área que ocupam, fontes pelo texto que carregam, cor dos
botões, logotipo, fotos grandes (inclusive as de fundo de seção), títulos e parágrafos.

## Olhe as capturas. Sempre.

Os números confirmam; a captura é que mostra. **Abra os `*-topo.jpg` e o `*-pagina.jpg` do site
principal antes de descrever a marca.** Neste tipo de página aparece o que nenhuma medida pega:

- **um elemento que é da marca**: um formato (arco, círculo, recorte), um ornamento, um jeito de
  enquadrar foto. Achou? Ele é o candidato natural a carregar a personalidade da página nova;
- **o uso da cor**: qual é a de fundo, qual é a de ação, qual só aparece em detalhe;
- **o estilo das fotos**: gente ou produto, estúdio ou vida real, fundo claro ou escuro;
- **o tom do texto**: próximo, técnico, luxuoso, divertido.

## O sistema do site: a landing é uma página dele

Quando o cliente tem um site com cara própria, **a landing tem que parecer uma página desse site**.
Colocada ao lado dele, ela encaixa: mesmos cantos, mesmo botão, mesmas fontes, mesmo jeito de
título, o mesmo tipo de movimento. Quem clica no anúncio e depois abre o site precisa reconhecer a
marca — e é isso que separa a página feita por quem estudou o cliente da página "bonita" que podia
ser de qualquer um.

O `marca.mjs` imprime "o jeito do site" e grava em `marca.json` (`sistema`):

| O que mede | O que a landing faz com isso |
|---|---|
| **cantos** do botão, do cartão, da imagem, do campo | os **mesmos valores**. Botão em pílula (`999px`) fica pílula; cartão de 16px fica 16px; foto reta fica reta |
| **sombra** e **borda** dos cartões | a mesma, ou nenhuma se o site não usa |
| **botão**: altura, padding, peso, caixa alta, só contorno | o botão da landing é o botão do site, na cor de ação da marca |
| **títulos** h1/h2: família, peso, tamanho, caixa alta, espaçamento | a mesma família e o mesmo tratamento (se o site titula em caixa alta, a landing também) |
| **coluna**: a largura em que o site alinha tudo | a mesma largura máxima |
| **chegada**: blocos que aparecem animando ao rolar (e como) | o mesmo efeito, com a mesma duração e curva, no sistema único de [movimento.md](movimento.md). Site parado → chegada discreta, sem inventar efeito que ele não tem |
| **ao passar o mouse**: o efeito dos cartões e das imagens | o mesmo efeito nos cartões da landing |
| **fontes**: os arquivos e os links do Google Fonts | as **mesmas fontes** ([html.md](html.md), "fontes do site") |
| **ícones**: traço ou cheio, qual jogo | o `icone.mjs` (Lucide) é traço; se o site usa ícone cheio, reaproveite os SVG do próprio site |
| **vídeos** e **fotos** | matéria-prima: `video.mjs` e `imagem.mjs` aceitam o endereço direto ([riqueza.md](riqueza.md)) |

Escreva isso no dossiê como tokens, com os valores ("botão: pílula 999px, 48px, contorno, 600 14px;
cartão: 16px sem sombra; h2: Gotham 700 36px caixa alta") — é daí que sai o `:root` da página.

**O site manda sobre as regras de estilo desta skill.** A lista de "cara de IA" de
[design.md](design.md) e o par de fontes de [acabamento.md](acabamento.md) valem para quando **não**
há um sistema a seguir. Se o site usa cartão arredondado, Inter no texto ou título em caixa alta, a
landing usa — é a marca, não um padrão. O que continua valendo sempre: a estrutura escolhida, o
acabamento (quebras, espaço, proporção), a conversão e o que é proibido inventar.

Só não herde o que o site faz **mal**: texto sem contraste, fonte ilegível no celular, carrossel que
roda sozinho, pop-up. Aí vale a regra, e diga à pessoa o que mudou e por quê.

## Por que não confiar só nos números

- Página de construtor (RD Station, Wix, Elementor, Nuvemshop) carrega o CSS do framework inteiro:
  dezenas de cinzas e fontes que nem aparecem. **Use o que foi medido na tela**, não o que está no
  código.
- Branco e cinza-claro quase sempre ganham em área. A cor da marca costuma ser a **segunda ou
  terceira** de fundo e a **primeira dos botões**.
- O logotipo às vezes não tem "logo" no nome do arquivo. Quando o script chuta ("primeira imagem do
  topo"), confirme na captura. Logotipo em PNG transparente pode aparecer **preto** numa folha de
  contato: é a transparência, não a cor.

## O que NÃO serve, mesmo sendo do cliente

- **Banner com texto gravado na imagem** ("Peças marcantes, confira"): não é foto, é anúncio. Não
  use como imagem de topo — o texto fica ilegível no celular e não é lido pelo Google.
- **Render 3D ou projeto** apresentado como se fosse o lugar de verdade. Iluminação perfeita, objetos
  idênticos, nenhuma marca de uso: pergunte "essa imagem é foto do espaço real ou projeto?" antes de
  legendar como "nosso showroom". Página que mostra o que não existe queima a confiança no primeiro
  encontro presencial.
- **Foto pequena demais para o papel**: o `imagem.mjs` avisa quando a original é mais estreita que a
  largura do papel. Foto de 1024px não vira fundo de tela inteira no computador; vai em meia
  largura.

## Redes sociais

Instagram, TikTok e Facebook **exigem login** e o script não entra. Não tente contornar. Peça à
pessoa: "me manda 5 a 10 fotos do Instagram que você mais gosta" (ou prints do perfil). Um print do
perfil já mostra paleta e estilo de foto.

## Fontes que discordam entre si

Briefing, apresentação, site e LP antiga foram feitos em épocas diferentes, por gente diferente. Vão
discordar: um telefone num e outro no outro, "Light e Start" num e "Light e Standard" no outro, um
número de consultoras em cada. **Não escolha uma em silêncio.** Use a mais oficial (apresentação
institucional > site > briefing > LP antiga) na página e **liste a divergência** para a pessoa
confirmar, junto com as pendências do rascunho ([rascunho.md](rascunho.md)).

## O que entregar depois do raio-x

Antes da entrevista, em poucas linhas, para a pessoa confirmar:

```
Identidade que encontrei (site + LP atual):
- cores: sálvia escuro #384e46 (fundo de faixa), sálvia #7f9c90, claro #f2f4f0; rosé #ea9e95 nos botões
- fontes: Instrument Sans nos títulos, Figtree no texto
- o jeito do site: botão pílula com contorno, cartões de 12px sem sombra, títulos em caixa baixa,
  blocos chegam subindo 20px em 0,6s
- elemento da marca: arco — nas fotos de categoria do site e nos nichos do showroom
- fotos aproveitáveis: fachada da fábrica, matérias na imprensa, showroom (confirmar se é real)
- tom: próximo e caloroso, fala com mulheres
Divergências: telefone de contato, nome do segundo formato
```

Com isso, metade do bloco 4 da entrevista ([questionario.md](questionario.md)) já está respondida:
pergunte só o que ficou faltando.

## Concorrentes

Com **todos** os concorrentes que o briefing citar (senão, pergunte "quem o seu cliente compara com
vocês?" e peça 2 ou 3), rode o mesmo raio-x. Concorrente citado "como referência de estrutura" é o
mais importante de olhar, não o primeiro a ser pulado:

```bash
node "<scripts>/marca.mjs" https://concorrente-a.com.br/franquia https://concorrente-b.com.br/franquia --pasta=concorrentes
```

Abra as capturas e monte, para você e para a pessoa, uma tabela curta:

| | Promessa do título | Como provam | Estrutura da página | Cor e tom |
|---|---|---|---|---|
| Concorrente A | … | … | … | … |
| Concorrente B | … | … | … | … |

E tire dela duas listas:

- **o que todos fazem** — é o padrão da categoria. A página não precisa fugir de tudo, mas se fizer
  igual, vai parecer mais uma;
- **o que ninguém faz** — é a oportunidade: uma prova que só este cliente tem, um medo que ninguém
  responde, uma forma de mostrar que ninguém usa.

**Nunca copie** texto, foto ou layout de concorrente. O estudo serve para diferenciar, não para
imitar — e página parecida com a do concorrente trabalha para ele.

## A linguagem do cliente final

O melhor título quase nunca é escrito: é **achado** na boca de quem compra. Antes de escrever, junte
frases reais de clientes — do jeito que eles falam, sem corrigir:

- depoimentos e avaliações no **próprio site** (o `marca.json` traz os parágrafos da página);
- avaliações do **Google** e do **Reclame Aqui** do cliente e dos concorrentes (as reclamações dos
  concorrentes são a lista de medos que a página pode responder);
- comentários do **YouTube**; do Instagram, peça prints à pessoa (exige login).

Agrupe por tema (a dor, o medo, o resultado que querem, o que quase os fez desistir) e guarde as
frases exatas. Um tema que aparece em **três fontes diferentes** é forte; em uma só, é palpite —
não construa a página em cima dele. Use as frases no título, nas perguntas e respostas e nas
objeções. **Não invente** depoimento a partir delas: frase de avaliação vira linguagem da página,
não "depoimento de fulano".

> Método adaptado de `customer-research`, da
> [marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT).

## Contraste herdado

A marca manda na cor, não no contraste. Se o site usa texto branco sobre um rosé claro (contraste de
2:1), a página nova usa **a mesma cor de botão com texto escuro** — continua sendo a marca, e passa a
ser legível. Diga isso ao apresentar o plano, para não parecer que você "errou a cor".
