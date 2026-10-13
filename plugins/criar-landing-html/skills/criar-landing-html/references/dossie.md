# O dossiê

Página genérica é, antes de tudo, falta de contexto. Com o briefing só, qualquer um escreve a mesma
página. Antes do plano, junte tudo o que dá para saber sobre o cliente, os concorrentes e a
categoria — e escreva num arquivo só, `dossie/contexto.md`, que é o que você relê ao planejar,
escrever e criticar. Ele também é o que se entrega a quem for editar a página depois.

## O que coletar, e como

| Peça | Como | O que tirar |
|---|---|---|
| **A marca** | `marca.mjs` no site, na LP atual, na loja | cores, fontes, logotipo, elemento da marca, fotos aproveitáveis ([marca.md](marca.md)) |
| **Os concorrentes** | `marca.mjs --pasta=dossie/concorrentes` em **todos** os citados | promessa, prova, estrutura, cor — e "o que todos fazem × o que ninguém faz" |
| **Os anúncios no ar** | `anuncios.mjs "Nome Completo do Concorrente" "categoria + oferta" --pasta=dossie/anuncios` | a promessa que a categoria está pagando para testar; a que está no ar há mais tempo é a que funciona |
| **As melhores páginas da categoria** | busca na web (ferramenta de busca do Claude): "franquia de semijoias", "franquia showroom", "landing page franquia" — escolha 3 a 5 páginas **bem feitas** (não as primeiras) e rode `marca.mjs --pasta=dossie/referencias` | o que elas fazem bem e daria para trazer: um jeito de mostrar o investimento, uma prova, uma estrutura |
| **A linguagem do cliente final** | depoimentos do site, Google, Reclame Aqui, comentários do YouTube | as frases exatas, agrupadas por tema ([marca.md](marca.md)) |
| **O inventário de provas** | o briefing, a apresentação, o site, a imprensa | o que existe (e onde), o que falta, o que precisa ser validado |
| **A matéria-prima** | as páginas internas que o `marca.mjs` listou (produtos, serviços, cases, galeria, sobre), rodando o `marca.mjs` nelas | linha de produtos com os dados de cada um, fotos reais, vídeos, depoimentos, etapas, dúvidas — e o bloco em que cada um vira ([riqueza.md](riqueza.md)) |

Referência da categoria é **inspiração**, nunca molde: o objetivo é entender o que funciona no
ramo, não copiar layout nem texto. Se a busca só trouxer páginas feias, diga isso e use menos delas
— referência ruim puxa a página para baixo.

## O arquivo

```markdown
# Dossiê — <cliente> — <data>

## A oferta em uma frase
## Para quem (persona, e o que ela teme)

## Identidade
- cores (com a função de cada uma), fontes, logotipo (arquivo), elemento da marca
- o jeito do site, em tokens com os valores: cantos (botão, cartão, imagem), sombra, botão, títulos,
  coluna, chegada e efeito ao passar o mouse, fontes (endereços), ícones ([marca.md](marca.md))
- capturas: dossie/marca/...

## Concorrentes
| | promessa | prova | estrutura | cor e tom |
- todos fazem: …
- ninguém faz (oportunidade): …

## Anúncios no ar
- a promessa que se repete: …
- a mais antiga ainda ativa: …

## Referências da categoria
- <endereço> — o que vale trazer: …

## Linguagem do cliente final
- tema → frases exatas (fonte)

## Provas
| prova | onde está | pode usar? |

## Matéria-prima
| o quê | quantos | onde está | vira |

## Divergências entre os materiais
## Lacunas (vão virar rascunho)
```

Mostre à pessoa um **resumo de cinco linhas** do dossiê antes da entrevista: a identidade, a
oportunidade contra os concorrentes, e o que falta. É ali que ela corrige uma leitura errada antes
de virar página.
