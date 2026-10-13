# Direção visual

Uma landing page tem um trabalho: fazer a pessoa certa entender a oferta e agir. Beleza que atrapalha
a leitura é prejuízo. Mas página sem personalidade nenhuma também é: ela parece de qualquer um, e
quem chega de anúncio decide em três segundos se está no lugar certo.

## Decida a partir do assunto

Antes de escolher cor ou fonte, responda: **do que essa página trata, e para quem?** A resposta é
que decide. Uma página de clínica odontológica infantil e uma de consultoria tributária não podem
sair com a mesma cara — e sairão, se você escolher pelo que costuma ficar bonito.

Puxe do universo do cliente: material, cor do produto, vocabulário da área, o que o público já vê o
dia inteiro. Se a marca tem cor e fonte, elas mandam; seu trabalho é fazê-las funcionar, não
substituí-las. **Se o cliente tem site com cara própria, a landing é uma página dele**: cantos,
botão, títulos, fontes, sombra e movimento vêm do site ([marca.md](marca.md), "o sistema do site"),
e a lista abaixo cede ao que o site já faz. O raio-x ([marca.md](marca.md)) costuma achar também um **elemento da marca** — um
formato, um ornamento, um jeito de enquadrar foto — e ele é o melhor candidato a carregar a
personalidade da página: ninguém confunde com a de um concorrente.

## O visual genérico que denuncia página feita por IA

Evite, a menos que a marca peça:

- fundo creme (perto de `#F4F1EA`) com serifa de alto contraste e um laranja-barro de destaque;
- fundo quase preto com um único verde-limão ou vermelho vivo;
- tudo picado em cartões arredondados iguais, com a mesma sombra cinza em cada um — e cartão dentro
  de cartão, nunca;
- a **faixa de números** com números soltos: três ou quatro números grandes com um rótulo de duas
  palavras embaixo. Com número **publicado pela marca**, com fonte e uma frase que diz o que ele
  significa, ela vale — e ganha o contador ([movimento.md](movimento.md));
- **borda superior grossa na cor principal** nos cartões — a menos que seja um traço da identidade
  da marca, é o enfeite que mais denuncia página gerada;
- a mesma composição seção após seção (texto de um lado, imagem do outro, espelhando até o fim) —
  ver [estruturas.md](estruturas.md);
- rótulo pequeno acima do título ("SOBRE NÓS" em cima de "Sobre nós"). Este não tem exceção: o título
  se sustenta sozinho;
- "01 / 02 / 03" numerando coisas que não são uma sequência;
- meia dúzia de gradientes usados como enfeite, e texto em gradiente;
- borda colorida grossa só do lado esquerdo de cartões e avisos;
- emoji ou símbolo no lugar de ícone;
- parede de logotipos desbotados em cinza — dois a quatro, na cor original e com uma linha dizendo
  quem é cada um, valem mais;
- carrossel de depoimentos **que roda sozinho** — um depoimento real, grande, com nome, foto e o que
  a pessoa faz, vale mais que cinco rodando. Com três ou mais reais, uma faixa que **a pessoa** rola
  está certa ([riqueza.md](riqueza.md));
- uma palavra só do título pintada de outra cor ou em itálico;
- uma seta `→` colada no fim de todo botão e link;
- **cada seção com um efeito diferente** ao rolar, ou animação no que está na primeira tela. Um
  sistema único e suave de chegada é outra coisa, e é bem-vindo ([movimento.md](movimento.md)).

Nenhuma dessas coisas é errada em si. O problema é que aparecem **independentemente do assunto** —
são o padrão, não uma escolha. Se você for usar uma delas, saiba dizer por que ela serve a **esta**
página.

## Gaste a ousadia em um lugar só

Escolha **um** elemento para carregar a personalidade: o título, uma foto grande e real, um detalhe
gráfico da marca. O resto fica quieto e disciplinado. Página onde tudo grita não tem
hierarquia, e sem hierarquia ninguém sabe o que fazer.

Na dúvida entre o refinado e o comprometido, **comprometa-se**: uma escolha clara e coerente com a
marca vale mais que três escolhas tímidas.

## O que ninguém desenha, e entrega que foi feito com cuidado

A cor da seleção de texto, o foco do teclado, o sublinhado dos links, o cursor do campo: o
navegador pinta tudo isso com o padrão dele se ninguém mexer. Dar a cor da marca a eles custa três
linhas e é o sinal mais barato de página feita, não montada:

```css
::selection { background: <cor da marca clara>; color: <texto>; }
:focus-visible { outline: 3px solid <cor da marca>; outline-offset: 3px; }
a { text-underline-offset: .2em; }
```

## Tipografia

- uma família, ou duas bem diferentes entre si. Duas parecidas viram sujeira;
- escala clara: se o título é 48px, o subtítulo não é 44px;
- linha de texto com menos de 80 caracteres; serifa aguenta um pouco mais e pede mais entrelinha;
- o título é elemento de desenho, não só texto grande. Peso, largura e espaçamento fazem parte da
  escolha.

## O que precisa estar na página

Os ingredientes são quase sempre os mesmos; **a forma não**. A forma vem da estrutura escolhida
([estruturas.md](estruturas.md)) — montar sempre "topo, oferta, prova, como funciona, objeções,
fechamento", nessa ordem e com essa cara, é o molde que faz toda página parecer a mesma.

- **a oferta**: a promessa, uma frase de apoio e o botão ou o formulário;
- **prova**, e cedo — um depoimento real, um caso, um cliente conhecido, um número dentro de uma
  frase;
- **como funciona**, quando o serviço não é óbvio;
- **as três objeções reais**, respondidas;
- **o que acontece depois de enviar**: quem vai responder, por onde e em quanto tempo — o prazo
  vem do cliente, nunca de você;
- rodapé com razão social, contato e a política de privacidade.

Quatro regras que valem em qualquer forma:

- **o formulário aparece sem rolar**, no celular, ou existe um botão visível que leva até ele;
- **a mesma ação o tempo todo.** Um único verbo, do começo ao fim: "Quero falar com um especialista"
  não pode virar "Saiba mais" três seções abaixo;
- **sem menu de navegação.** Cada link que sai da página é uma saída — ver
  [conversao.md](conversao.md);
- **gente real** quando existir: de quem atende, da equipe, do lugar, de clientes. É o que o olho
  procura primeiro ([conversao.md](conversao.md)).

## Escrita

- o título diz o que a pessoa ganha, não o que o produto tem;
- voz ativa, frase curta, sem palavra inventada. "Fale com um especialista", não "Submeter";
- o botão diz o que acontece ao clicar, e mantém o nome em toda a página;
- número específico vale mais que adjetivo: "atendemos 1.240 famílias" ganha de "referência no
  mercado";
- nada de "solução inovadora", "excelência", "parceria de sucesso". São palavras que não significam
  nada e o leitor já aprendeu a pular;
- **palavra do dia a dia**, a que o próprio cliente usa ([marca.md](marca.md), "a linguagem do
  cliente final"). Texto fácil converte mais que texto sofisticado ([conversao.md](conversao.md));
- os vícios de texto de IA: trios de adjetivos ("simples, rápido e seguro"), "não é só X, é Y",
  toda frase terminando em conclusão inspiradora, travessão em toda linha. Leia em voz alta: se não
  soa como alguém falando, reescreva.

## Acessibilidade e cuidado, sem alarde

Contraste de texto em pelo menos 4,5:1. Foco visível no que é clicável. Toda imagem com `alt` que
descreva a imagem (ou `alt=""` quando for enfeite). Área de toque de pelo menos 44px. Respeite
`prefers-reduced-motion`. Nada disso aparece na página — mas a falta aparece.

## Antes de mostrar

Olhe a pré-visualização no celular e no computador e pergunte:

1. Em três segundos dá para saber **o que é** e **para quem**?
2. O que a página pede está claro, e é uma coisa só?
3. Tem prova de verdade, ou só promessa?
4. Se eu tapar o logotipo, essa página poderia ser de qualquer concorrente?
5. Duas seções seguidas têm a mesma composição? Sobrou faixa de números, grade de cartões iguais
   ou rótulo em cima de título?
6. Tem gente real? Se não tem, a pessoa sabe que isso custa?
7. Tem algo aqui que só está porque ficou bonito?

A última pergunta costuma render um corte. Faça o corte.
