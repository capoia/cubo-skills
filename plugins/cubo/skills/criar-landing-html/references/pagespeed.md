# PageSpeed

Medir faz parte da entrega. Uma página de anúncio que demora 4 segundos no celular perde lead antes
de ser lida — e o custo por lead sobe sem ninguém entender por quê.

## Como medir

```bash
node "<scripts>/pagespeed.mjs" https://dominio/caminho
```

Mede **celular** por padrão (é de onde vem a maior parte do tráfego de anúncio) e devolve as quatro
notas mais as métricas que costumam explicar a de desempenho. Para o computador:

```bash
node "<scripts>/pagespeed.mjs" https://dominio/caminho desktop
```

A API é a do PageSpeed Insights do Google. **Sem chave, ela usa uma cota pública dividida com o mundo
inteiro, que acaba todo dia** (erro 429, "Quota exceeded … Queries per day") — medido: numa tarde
qualquer, a primeira chamada sem chave já voltou 429. Por isso o `requisitos.mjs` avisa quando a
chave falta, e o passo a passo para a pessoa pegar a dela (grátis, sem cartão, dois minutos) está em
[requisitos.md](requisitos.md#a-chave-do-pagespeed). O script lê `PAGESPEED_API_KEY` do `.cubo.env`.

Sem chave e com pressa, dá para medir na própria máquina — **só se houver Google Chrome instalado**
(o Lighthouse não usa o Edge nem o navegador que a skill baixa):

```bash
npx --yes lighthouse@12 https://dominio/caminho --quiet --chrome-flags="--headless" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./lh.json
```

As notas saem em `lh.json`, em `categories.*.score`. Não é a mesma medição do Google (a rede e a
máquina são as da pessoa), então diga isso ao entregar.

A página precisa estar **publicada e alcançável**: o Google busca de fora. Não dá para medir a
pré-visualização.

## O que perseguir

| Categoria | Meta |
|---|---|
| Desempenho (celular) | ≥ 90 |
| Acessibilidade | ≥ 95 |
| Boas práticas | ≥ 95 |
| SEO | ≥ 95 |

Abaixo disso, conserte e meça de novo. Se depois de dois ajustes não subir, diga à pessoa o que
está segurando e por quê, em vez de entregar um número sem explicação.

## O que costuma derrubar, em ordem

1. **Imagem grande.** É a causa em quase todo caso — e é por isso que existe o `imagem.mjs`, que
   redimensiona, converte para webp e aperta até caber no orçamento (200 KB no topo, 100 KB nas
   demais). No HTML, `width`/`height` em todas, `fetchpriority="high"` na do topo e
   `loading="lazy"` no resto.
2. **Fonte.** Cada família e cada peso é um arquivo. Use uma família e dois pesos no máximo, com
   `display=swap` e `preconnect`. Fonte do sistema custa zero.
3. **Deslocamento de layout (CLS).** Imagem sem dimensão, e formulário sem altura reservada. Use
   `minHeight` no SDK — é para isso que ele existe.
4. **Script de terceiro.** Chat, mapa embutido, vídeo incorporado. Cada um paga pedágio. Mapa e
   vídeo podem virar imagem clicável que só carrega o embutido depois do clique.
5. **CSS demais.** Uma landing cabe em poucos kB de CSS escrito à mão. Não traga framework inteiro
   para usar três classes.

## O que **não** é culpa sua

O Cubo injeta Pixel, GTM, GA4, Clarity e enriquecimento de dados conforme o que estiver configurado
**na página** — e cada um desses pesa. Numa página com GTM e Clarity ligados, desempenho 100 no
celular é improvável, e tudo bem: o cliente escolheu medir.

Quando a nota estiver presa por causa disso, **diga com clareza**: "desempenho 78; 14 pontos vêm do
GTM e do Clarity, que estão ligados nas configurações da página. Desligando o Clarity, sobe para
~88. Quer que eu desligue?" — a decisão é dela, não sua.
