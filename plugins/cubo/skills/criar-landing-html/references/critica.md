# A rodada de crítica

A primeira versão nunca é a que vai para a pessoa. **Aviso da prévia em aberto também não vai**: a
crítica começa com a saída do `previa.mjs` zerada, ou com cada aviso que ficou justificado. Depois da prévia com `--capturar`, **abra as
capturas e critique como um diretor de arte exigente** — é aqui que se pega o título quebrado em
cinco linhas, o formulário desproporcional, o rodapé largado. Corrija, capture de novo, e só então
mostre. Duas rodadas é o normal; três indica que o problema é o plano, não o acabamento.

> Adaptado do "slop test" da [Hallmark](https://github.com/Nutlope/hallmark) (MIT).

## 1. A nota, antes da lista

Dê uma nota de 1 a 5 em cada eixo, olhando as capturas (não o código). **Qualquer nota abaixo de 3
volta para o trabalho** antes de seguir para a lista.

| Eixo | A pergunta |
|---|---|
| **Ideia** | A página tem uma posição clara (uma promessa, um porquê), ou é só um layout? |
| **Hierarquia** | Em 2 segundos dá para saber o que é principal, secundário e terciário? |
| **Execução** | Espaços, quebras, contraste, alinhamentos — tudo no lugar, ou tem desleixo? |
| **Especificidade** | Parece **deste** cliente, ou de qualquer um da categoria? |
| **Parentesco** | Lado a lado com o site do cliente (`previa/lado-a-lado.jpg`), parece uma página dele? Mesmos cantos, botão, títulos, fontes, movimento? |
| **Contenção** | Sobrou alguma coisa que só está ali porque ficou bonito? |
| **Conversão** | A ação é óbvia, está visível sem rolar, e a prova aparece cedo? |
| **Riqueza** | A página usa o que o cliente tem de real (produtos com dados, fotos, vídeo, depoimentos), ou parece feita só com o briefing? |

## 2. A lista — toda resposta tem que ser "não"

**Tipos e quebras**
1. Algum título passa de 3 linhas no computador, ou tem mais de 90 caracteres?
2. Alguma frase curta está quebrada em várias linhas por uma largura estreita demais?
3. Algum título tem palavra sozinha na última linha (faltou `text-wrap: balance`)?
4. Texto corrido com linha de mais de 75 ou menos de 45 caracteres?
5. Mais de cinco tamanhos de letra na página? Mais de três famílias?
6. Título em itálico, ou uma palavra do título em outra cor?
7. Algum botão ou link quebrou em duas linhas, em alguma largura?

**Espaço e proporção**
8. Duas colunas lado a lado com alturas muito diferentes (um formulário enorme ao lado de pouco
   texto, um vazio grande embaixo de uma delas)?
9. Todas as seções com o mesmo respiro, a página sem ritmo?
10. Algum `padding`/`margin` fora da escala de espaço?
11. Tudo centralizado?
12. A primeira dobra em 1280×800 corta o título, o botão ou o formulário pela metade?

**Estrutura** (as regras do `SKILL.md`)
13. Duas seções seguidas com a mesma composição?
14. Faixa de números, grade de cartões iguais, rótulo acima do título, "01/02/03" sem sequência?
15. Rodapé sem formato — itens empilhados de um lado e o resto vazio, ou colunas de links?

**Vida** ([movimento.md](movimento.md))
16a. A página está parada — sem chegada suave dos blocos, sem botão ao fim dos blocos, sem os tons da
     cor dando ritmo?
16b. Algum conteúdo da primeira tela está escondido esperando animação?
16c. Mais de um tipo de efeito na página, ou algum efeito que não desliga com `prefers-reduced-motion`?

**Parentesco com o site** ([marca.md](marca.md), "o sistema do site")
16h. Algum canto, sombra, botão ou título diferente do que o site usa, sem motivo?
16i. A fonte do site não carregou e ninguém avisou a pessoa?
16j. O site tem vídeo, fotos ou ícones aproveitáveis que a página não usou?

**Riqueza** ([riqueza.md](riqueza.md))
16d. Algum item da matéria-prima do dossiê ficou de fora sem motivo escrito?
16e. Formulário só no topo, numa página de mais de três blocos?
16f. Lista de benefícios, recursos ou etapas sem ícone? Ícone de família misturada, ou emoji?
16g. Algum bloco sem matéria-prima real (galeria de banco de imagem, ficha sem dado do site)?

**Conteúdo**
16. Algum número, prazo, depoimento ou compromisso que não veio do material do cliente?
17. Alguma imagem sem ser do cliente, ou suspeita de render usada como foto real?
18. Nenhuma pessoa na página — e a pessoa **sabe** que isso custa?

**Cor**
19. Algum texto abaixo de 4,5:1 sobre o seu fundo (inclusive o botão do formulário)?
20. A cor de destaque cobrindo mais que um detalhe por tela?

**Técnico** (o `previa.mjs --capturar` já acusa a maioria — leia a saída dele)
21. A página rola para o lado em alguma largura?
22. Recurso `http://` numa página que vai ser `https`?
23. Imagem sem `alt`, sem `width`/`height`?

## 3. Registre

Abra o CSS com a nota e o que foi corrigido, para quem editar depois:

```css
/* estrutura: perguntas-e-respostas · crítica: ideia 4, hierarquia 4, execução 5,
   especificidade 5, contenção 4, conversão 5 · 2 rodadas */
```

E diga à pessoa, em uma linha, o que a crítica mudou ("o título estava em 4 linhas, encurtei; o
formulário ficou em duas colunas para caber ao lado da oferta").
