# Quando falta conteúdo

O cliente muitas vezes manda pouco ou nada: "faz uma página de franquia, segue a identidade da
marca". **Não pare.** O valor está em chegar com uma página que já parece dele e já diz algo
verdadeiro, com os buracos **visíveis e nomeados**.

**Lorem ipsum, só se a pessoa pedir** — é comum para aprovar o desenho com o cliente antes de ter o
texto. Nesse caso ele vai **sempre dentro de um `data-rascunho`** que diz o que entra ali
(`<blockquote data-rascunho="depoimento de gestor de hotel: texto, nome, cargo, foto">Lorem
ipsum…</blockquote>`): a prévia lista o trecho, e a página com lorem ipsum **nunca vai ao ar**.
Sem o pedido, escreva o rascunho com o que é verdadeiro, como abaixo.

## De onde tirar o conteúdo, em ordem

1. **O que a pessoa mandou**: briefing, apresentação, proposta, conversa.
2. **O que o cliente já publicou**: site, landing antiga, loja, blog — o `marca.mjs` traz títulos e
   parágrafos junto com as cores ([marca.md](marca.md)). Um texto "Sobre nós" do site vira a seção
   de história; os diferenciais listados na LP antiga viram a seção de vantagens.
3. **O que se deduz disso, escrito por você**: título, subtítulo, explicação do funcionamento,
   resposta de objeção. É texto de rascunho, mas escrito sério, com o vocabulário do cliente — o
   bastante para ele reagir ("não é bem assim", "perfeito").
4. **Lacuna marcada**: só o que não dá para saber nem deduzir.

## O que NUNCA se inventa

Nem como rascunho, nem "só para ver como fica":

- **depoimento** (texto, nome, foto, cidade);
- **número**: clientes, anos, faturamento, prazo, percentual, preço, quantidade de unidades;
- **nome de cliente, logotipo de cliente, prêmio, selo, certificação, matéria na imprensa**;
- **prazo e promessa operacional** ("retorno em 24 h", "entrega em 3 dias").

Um número plausível escrito "só por enquanto" é aprovado sem ler e vai ao ar. No lugar, deixe a
lacuna à vista: `Retorno em até ___ dias úteis.`, ou um bloco que diz o que falta.

Número que o próprio cliente divulgou (no site, na apresentação) pode ser usado — é dele. Se o
briefing disser que ele **ainda precisa ser validado para uso público**, use e marque como rascunho.

## Como marcar

Todo trecho que depende de confirmação leva `data-rascunho="o que falta"`:

```html
<p data-rascunho="valor aguardando validação para uso público">Investimento a partir de R$ 235 mil.</p>

<div class="lp-depoimento" data-rascunho="depoimento de cliente: texto, nome, cidade e foto">
  <p>Espaço para o relato de quem já fez esse caminho.</p>
</div>

<div class="lp-arco" data-rascunho="confirmar se é foto do espaço real ou projeto">
  <img src="…" alt="…">
</div>
```

A descrição diz **o que a pessoa precisa mandar**, não "texto provisório". Ela vira a lista de
pendências.

Na prévia (`previa.mjs`), cada trecho marcado ganha um número pequeno no canto (`R1`, `R2`… — passar
o mouse mostra o que falta), discreto o bastante para não atrapalhar a leitura do visual. O terminal
lista o que é cada um. Para mostrar ao cliente sem os números, `--limpa`.

## Entregar o rascunho

Junto com a prévia, mande a lista, pronta para ser encaminhada ao cliente:

```
Para a página ficar pronta, preciso de:
R1  investimento a partir de R$ 235 mil — pode aparecer publicamente?
R2  a imagem do showroom é foto do espaço real ou projeto?
R6  um depoimento de consultora que virou franqueada: texto, nome, cidade e foto
R7  em quantos dias úteis a equipe retorna o contato?

E duas informações que não bateram entre o briefing e a apresentação:
- o segundo formato se chama Start ou Standard?
- o telefone de contato é (11) 93442-8019 ou (19) 99476-0735?
```

## Antes de publicar

Procure `data-rascunho` no HTML. **Se sobrou algum, não publique sem dizer.** Liste o que falta e
pergunte se vai assim mesmo — a decisão é da pessoa, e ela pode ter motivo (lançar hoje e completar
amanhã). Se for, o selo não aparece na página publicada (só na prévia), mas o texto de lacuna
aparece: prefira esconder a seção inteira a publicar `___`.

Quando o conteúdo chegar, troque o texto **e apague o atributo** — é assim que a lista zera.
