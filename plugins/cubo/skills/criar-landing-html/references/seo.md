# SEO e compartilhamento

Primeiro decida se a página **quer** ser encontrada na busca. Página feita para anúncio muitas vezes
não quer: ela compete com o site da própria empresa e polui o relatório. Pergunte antes.

Se não quer ser indexada:

```json
{ "robots": "User-agent: *\nDisallow: /" }
```

## Os campos, e onde eles vão

| O quê | Campo da API | Regra |
|---|---|---|
| Título da aba | `title` da landing | 50–60 caracteres, começa com o que a pessoa busca |
| Descrição | `metaDescription` | 120–155 caracteres, com a promessa e um verbo |
| Robots | `robots` | conteúdo do `robots.txt` daquela página |
| Ícone da aba | `favicon` | URL de um `.png` ou `.ico`, quadrado |

Tudo isso é **campo do registro**, não tag no HTML. Escrever `<title>` ou `<meta name="description">`
dentro do `html` não funciona: eles ficariam no meio do corpo, e o Cubo já pôs os de verdade no
cabeçalho.

## Título e descrição

- **título**: o termo que a pessoa buscaria primeiro, depois a marca. "Curso de inglês para
  adultos em Campinas | Escola X". Sem `|` decorativo no fim, sem CAIXA ALTA;
- **descrição**: não repita o título. Ela é o anúncio do resultado da busca — diga o que a pessoa
  ganha e termine com um verbo ("veja as turmas", "peça seu orçamento"). Não enfie palavra-chave
  repetida: hoje isso derruba em vez de ajudar.

## Dentro do HTML

O que **de fato** conta e depende de você:

- **um `<h1>` só**, e ele é a promessa. Nada de `<h1>` no logotipo;
- `<h2>` para cada seção, `<h3>` dentro delas. Hierarquia de verdade, não escolhida pelo tamanho da
  letra;
- `alt` em toda imagem, descrevendo a imagem (`alt=""` quando for enfeite);
- texto de verdade, não texto dentro de imagem;
- endereço e telefone em texto, quando o negócio é local — é o que casa com a busca "perto de mim";
- um `<a>` para a política de privacidade no rodapé. Obrigatório se há coleta de dados.

## Dados estruturados

Valem a pena quando a página tem um fato objetivo: um evento com data, um curso, um produto com
preço, um negócio local. Para uma página de captura genérica, não mudam nada — e dado estruturado
que não bate com o conteúdo visível é penalizado.

Quando fizer sentido, um bloco só, no fim do `html`:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Clínica Exemplo",
    "telephone": "+55 19 99999-0000",
    "address": { "@type": "PostalAddress", "addressLocality": "Campinas", "addressRegion": "SP" }
  }
</script>
```

`FAQPage` combina com a seção de objeções — **desde que as perguntas apareçam na página**.

## Compartilhamento (WhatsApp, redes)

A imagem que aparece ao colar o link sai do `og:image`, e ele é montado pelo Cubo a partir do
registro da página. Se a pessoa entregou uma imagem de compartilhamento e você não achar onde
colocá-la, **diga isso** em vez de tentar reescrever a metatag no corpo: ela não vai ao cabeçalho.

Para conferir como o link aparece, use o depurador de compartilhamento da própria rede depois de
publicar.

## Depois de publicar

O `pagespeed.mjs` também devolve a nota de **SEO** do Lighthouse. Ela cobre o básico mecânico
(título, descrição, `alt`, links rastreáveis, viewport). Abaixo de 90 é quase sempre alguma coisa
desta página esquecida — leia o relatório antes de supor.
