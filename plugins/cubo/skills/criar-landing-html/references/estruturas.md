# Estruturas de página

A cara de IA não está na cor, está na **forma**: topo com texto de um lado e imagem do outro, faixa
de números, três cartões iguais, duas colunas alternando até o rodapé. Trocar a paleta não resolve;
a página continua sendo a mesma de sempre com outra roupa.

Por isso a estrutura é **escolhida antes de qualquer cor**, entre opções bem diferentes umas das
outras — e não deixada para o que "sai naturalmente", que é justamente o molde de sempre.

> Adaptado da ideia de *macroestruturas* da [Hallmark](https://github.com/Nutlope/hallmark) (MIT) e
> do sorteio de estruturas da [Impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0),
> reescrito para página de captação: aqui **o botão ou o formulário aparece sem rolar, sempre**.

## Como escolher

1. Ache o **tipo de negócio** na tabela do fim e pegue as três estruturas sugeridas.
2. Descarte a que não tem **matéria-prima**: "Depoimento na frente" sem depoimento real, "Foto
   primeiro" sem foto boa, "Carta" sem uma pessoa de verdade para assinar.
3. Apresente **três**, de famílias diferentes, cada uma com um desenho em texto da primeira dobra e
   uma frase de por que serve. A pessoa escolhe. Se ela disser "escolhe você", escolha — e diga por
   quê.
4. Abra o CSS com o carimbo `/* estrutura: <nome> */`. Serve para quem editar depois saber o que foi
   decidido, e para a próxima página do mesmo cliente poder ser diferente de propósito.

## As estruturas

### Carta
Uma pessoa fala em primeira pessoa: a fundadora, o especialista, o dono. Abre como carta, com
assinatura e foto pequena de quem escreve; o texto corre em coluna única e larga, com títulos
curtos no meio do texto em vez de "seções". O formulário aparece cedo, ao lado ou logo abaixo da
primeira dobra, e de novo no fim, depois da assinatura.
**Para:** franquia, serviço de confiança pessoal (advogado, médico, consultor), negócio de fundador
conhecido. **Não use** se ninguém de verdade vai assinar.

```
┌──────────────────────────────────────────┐
│ logo                                     │
│  (foto)  "Se você está pensando em abrir │  ┌ formulário ┐
│   Veri   o seu negócio, eu quero te      │  │            │
│          contar como começou o meu…"     │  │            │
│  — Veridiana, fundadora                  │  └────────────┘
└──────────────────────────────────────────┘
```

### Foto primeiro
Uma foto grande e real domina cada dobra; o texto é legenda curta sobre ou ao lado dela. A página
diz "olhe" antes de dizer "leia". Poucas seções, cada uma com uma imagem que prova algo (o lugar, o
produto, a equipe trabalhando).
**Para:** lugar físico (clínica, escola, restaurante, imóvel, showroom), produto que se vê
(semijoia, estética, moda), obra. **Exige** 3 ou mais fotos próprias boas.

### Depoimento na frente
O título é a frase de um cliente real, com nome, foto e o que ele é. A página empresta a
credibilidade antes de falar de si; a oferta vem logo abaixo, e mais dois ou três relatos aparecem
ao longo da página, cada um respondendo uma objeção.
**Para:** quando existe **um** depoimento forte e específico (com resultado, não "adorei"). Sem ele,
não existe esta estrutura.

### Perguntas e respostas
A página é uma entrevista honesta: as perguntas que a persona faria, em negrito, com respostas
curtas e diretas. A primeira dobra é a oferta em uma frase + o formulário; o resto é a conversa.
**Para:** decisão racional, cara ou demorada — franquia, investimento, B2B, tratamento de saúde,
curso caro. Funciona muito bem com persona "analítica, pesquisa antes".

### Relatório
Lê como um documento sério: um prospecto, um memorando. Coluna de leitura, números **dentro das
frases**, tabela de verdade quando há comparação (investimento, prazos), notas de rodapé para as
ressalvas. Nada de cartões.
**Para:** B2B, financeiro, franquia com DRE, imobiliário de investimento, licitação. Público que
desconfia de "marketing".

### Jornada
A página conta as etapas, em ordem: o que acontece do primeiro contato até o resultado. Cada etapa
é uma seção com o que a pessoa faz, o que recebe e quanto tempo leva. Aqui numerar faz sentido,
porque é sequência de verdade.
**Para:** serviço com processo (implante, reforma, implantação de franquia, curso por módulos,
consórcio). Resolve o medo "não sei como funciona".

### Antes e depois
Duas situações lado a lado — como é hoje e como fica —, ou duas opções comparadas honestamente
(inclusive "fazer sozinho"). A comparação é o corpo da página.
**Para:** quando existe uma alternativa clara que a pessoa já usa (planilha, concorrente, fazer à
mão, não fazer nada). **Nunca** invente números para o "depois".

### Manifesto
Uma declaração forte, em tipografia grande, antes do produto: no que a marca acredita. Poucas
palavras por tela, contraste alto, a oferta aparece como consequência da crença.
**Para:** marca de propósito, causa, movimento, comunidade (empreendedorismo feminino, sustentável,
religioso). Arriscado para público conservador.

### Vitrine
Uma grade de variações da mesma coisa — modelos, unidades, turmas, planos — em que as diferenças
são o conteúdo. É a única estrutura em que itens do mesmo tamanho lado a lado estão certos, porque
são pares de verdade.
**Para:** várias unidades/turmas/imóveis/planos para a pessoa escolher antes de preencher.

## Tipo de negócio → as três para oferecer

| Negócio | Ofereça |
|---|---|
| franquia, licenciamento, oportunidade de negócio | Carta · Perguntas e respostas · Relatório |
| clínica, saúde, estética, odontologia | Foto primeiro · Jornada · Depoimento na frente |
| curso, escola, mentoria, evento | Depoimento na frente · Jornada · Carta |
| imóvel, loteamento, construtora | Foto primeiro · Vitrine · Relatório |
| serviço B2B, software, consultoria | Relatório · Antes e depois · Perguntas e respostas |
| varejo, produto físico, moda, semijoia | Foto primeiro · Vitrine · Manifesto |
| advogado, contador, serviço profissional | Carta · Perguntas e respostas · Jornada |
| financeiro, crédito, consórcio, seguro | Antes e depois · Perguntas e respostas · Relatório |
| causa, comunidade, marca de propósito | Manifesto · Carta · Depoimento na frente |

Não achou o negócio? Pegue uma de cada família: uma **de pessoa** (Carta, Depoimento na frente),
uma **de prova** (Foto primeiro, Relatório, Vitrine) e uma **de conversa** (Perguntas e respostas,
Jornada, Antes e depois).

## Dentro da estrutura: os blocos

A estrutura é o esqueleto; o que enche a página é a matéria-prima do cliente — mostruário, galeria,
vídeo, depoimentos, perguntas ([riqueza.md](riqueza.md)). Qualquer estrutura recebe esses blocos: numa
**Carta**, a galeria entra entre dois parágrafos; num **Relatório**, o mostruário vira tabela.

## Dentro da estrutura: variar a composição

Escolhida a estrutura, **duas seções seguidas não podem ter a mesma composição.** Texto à esquerda e
imagem à direita, depois texto à direita e imagem à esquerda, depois de novo — é o molde que a gente
está fugindo, só espelhado. Alterne entre: texto largo sozinho; foto de ponta a ponta com legenda
curta; um depoimento grande sozinho; tabela; lista; perguntas e respostas; faixa de cor com uma
frase só.

Três proibições que valem em qualquer estrutura (a não ser que a marca peça, com todas as letras):

- **faixa de números solta** — número grande com rótulo de duas palavras. Número bom vai perto da
  afirmação que ele prova; em faixa, só se for publicado pela marca, com fonte e uma frase de
  sentido para cada um;
- **grade de cartões iguais** com ícone + título + frase. Se os itens não são pares de verdade, vire
  lista, texto ou um item em destaque;
- **rótulo em cima do título** (o "SOBRE NÓS" pequenininho acima de "Sobre nós"). O título se
  sustenta sozinho.
