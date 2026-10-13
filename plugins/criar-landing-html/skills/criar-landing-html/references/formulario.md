# O formulário

O formulário do Cubo não é um `<form>` que você escreve: é criado pela API, desenhado pelo SDK e,
ao ser enviado, cria a **negociação** no funil, com duplicidade, distribuição, automações e envio da
conversão para a Meta — o mesmo caminho da API de negociações. Você nunca escreve `<input>` na
página.

## Tudo o que ele faz (índice)

Use o recurso certo em vez de improvisar — cada linha abaixo tem o detalhe mais adiante.

| Precisa de… | Use |
|---|---|
| estado, cidade, lista de opções, data, número | o **tipo do campo personalizado** (`state`, `city`, `selectbox`, `datetime`, `number`) |
| e-mail validado, só letras, só inteiro | `validations.type`: `email`, `letters`, `integer`, `number` |
| tamanho mínimo/máximo do texto | `validations.minLength` / `maxLength` |
| dois campos lado a lado | `columns` 6 + 6 (grade de 12; no celular vira uma coluna) |
| gravar a origem, a campanha ou a unidade sem a pessoa ver | campo com `hide: true` + o valor em `values` no trecho da página |
| escolher o funil/etapa pela página (uma página por unidade, por exemplo) | `destination.allowed` + `overrides: { pipeId, stageId }` no trecho |
| mensagem de obrigado na página, ou mandar ao WhatsApp / página de obrigado | `afterSubmit.successMessage` ou `afterSubmit.redirectUrl` |
| qualificar **depois** do primeiro envio, sem pedir tudo de uma vez | um segundo formulário `type: "update"` na página de obrigado |
| aceite de LGPD gravado com data e origem | `lgpd` + `customfieldId` |
| UTM, `page_url` e `referrer` gravados no lead | `tracking.utm` (cada parâmetro → um campo personalizado) |
| conversão na Meta pelo servidor (API de Conversões), deduplicada com o pixel | `metaIntegrationId` no formulário — o SDK dispara o `Lead` com o mesmo id |
| barrar robô e envio de outro site | `protection`: `honeypot`, `minFillSeconds`, `allowedDomains` |
| descartar nome com palavrão ou teste | `blockedWords` no trecho (a pessoa vê sucesso falso) |
| o formulário numa página própria, sem landing | `hostedPage` + `domainId` + `path` |
| a cara do site | `theme` + `css` no trecho ([a cara do site](#a-cara-do-site)) |
| textos do botão em cada momento | `button`: `idle`, `sending`, `sent`, `redirecting` |
| mensagens de erro no tom da marca | `messages` no trecho |
| reagir ao envio (evento de analytics, abrir outra coisa) | `form.on('success' \| 'start' \| 'submit' \| 'error' \| 'redirect', …)` |

## Campos

Dois campos **base**, e só dois:

| `id` | Vira | Obrigatório? |
|---|---|---|
| `title` | o título da negociação **e o nome da pessoa** | quase sempre sim |
| `phone` | o telefone da pessoa, com máscara `(99) 99999-9999` | sim, quando o contato é por WhatsApp |

**Qualquer outro dado é campo personalizado** — inclusive e-mail. Procure em
`GET /api/customfields` antes de criar: quase toda empresa já tem "E-mail".

### Formato de um campo

```json
{
  "id": "title",
  "name": "Titulo",
  "label": "Seu nome",
  "isCustomfield": false,
  "columns": 12,
  "hide": false,
  "placeholder": "Como podemos te chamar?",
  "validations": {
    "required": true,
    "type": { "use": false, "value": null },
    "maxLength": { "use": false, "value": null },
    "minLength": { "use": false, "value": null }
  }
}
```

Campo personalizado, com validação de e-mail:

```json
{
  "id": 318035,
  "name": "E-mail",
  "label": "Seu melhor e-mail",
  "isCustomfield": true,
  "customfield": { "id": 318035, "name": "E-mail", "type": "text", "status": "active", "context": "deal" },
  "columns": 12,
  "hide": false,
  "placeholder": "nome@empresa.com.br",
  "validations": {
    "required": false,
    "type": { "use": true, "value": "email" },
    "maxLength": { "use": false, "value": null },
    "minLength": { "use": false, "value": null }
  }
}
```

- `columns` é de 1 a 12 (grade de 12). Dois campos lado a lado: 6 e 6. Em telas estreitas tudo vira
  uma coluna sozinho;
- `validations.type.value`: `email`, `number`, `integer`, `letters` (com `use: true`);
- `validations.minLength` / `maxLength`: `{ "use": true, "value": 3 }`;
- `placeholder`: o exemplo dentro do campo. Em `state` e `selectbox`, é o texto da opção vazia;
- `hide: true` manda o campo escondido. O valor vem do trecho da página, em `values`
  (`{ cf_318040: 'LP hotelaria' }`): serve para gravar origem, campanha ou unidade sem a pessoa ver;
- `label` é o que a pessoa lê; `name` é o nome interno (o do campo personalizado);
- máscara: o telefone (`phone`) já vem com a de celular brasileiro. Outros campos não têm máscara;
- as **opções** de um `selectbox` são as do campo personalizado (`customfield.options`), editadas no
  campo, não no formulário.

### Tipos de campo: use o que o Cubo já tem

O tipo vem do **campo personalizado** (`GET /api/customfields` mostra o `type`; crie com
`POST /api/customfields` e o `type` certo). O formulário desenha cada tipo do jeito dele:

| O dado | Tipo | Como aparece |
|---|---|---|
| estado | `state` | lista com os estados |
| cidade | `city` | lista com as cidades **do estado escolhido** — ponha o campo `state` antes |
| escolha fechada (segmento, faixa, momento) | `selectbox` | lista com as opções do campo |
| data | `datetime` | seletor de data |
| número | `number` | só aceita número |
| e-mail, empresa, cargo, texto livre | `text` (com `validations.type` `email` quando for e-mail) | caixa de texto |

**Nunca "Cidade / UF" num campo de texto.** Estado e cidade como `state` e `city` viram lista (a
pessoa não erra a grafia), chegam padronizados na negociação e servem para distribuir e filtrar por
região. Procure antes: quase toda conta já tem "Estado" e "Cidade".

**Peça pouco.** Nome e WhatsApp convertem muito mais que cinco campos. Se a pessoa quiser qualificar
mais, o caminho melhor é um segundo formulário (do tipo `update`) na página de obrigado.

## Criar

Antes, confira o destino:

```bash
node "<scripts>/cubo.mjs" destino <funil> [etapa]
```

O lead só entra se o funil tem **etapa** e **ao menos um usuário ativo** (é ele que fica como
responsável da negociação). Funil recém-criado costuma nascer sem ninguém — e aí o formulário recusa
todo envio com "o funil deste formulário não tem nenhum usuário ativo". Deu `PROBLEMA`, peça para
adicionarem alguém ao funil antes de publicar.

```json
{
  "name": "LP Turma de março",
  "type": "create",
  "fields": [ … ],
  "settings": {
    "destination": { "pipeId": 304170, "stageId": 998877 },
    "afterSubmit": {
      "successMessage": { "enabled": true, "title": "Recebemos!", "text": "Em instantes falamos com você no WhatsApp.", "durationMs": 2500 },
      "redirectUrl": null
    },
    "button": { "idle": "Quero falar com um especialista", "sending": "Enviando…", "sent": "Recebido!", "redirecting": "Abrindo…" },
    "theme": { "primary": "#1D4ED8", "background": "#FFFFFF", "text": "#111827", "radius": 10, "size": "normal", "inputStyle": "outline", "buttonWidth": "full", "buttonAlign": "center" },
    "lgpd": { "enabled": true, "required": true, "source": "url", "url": "https://cliente.com.br/privacidade", "label": "Li e aceito a política de privacidade", "customfieldId": 318027 },
    "tracking": { "utm": [ { "param": "utm_source", "customfieldId": 318034 } ], "pageView": false },
    "protection": { "honeypot": true, "minFillSeconds": 2, "allowedDomains": [] }
  }
}
```

A resposta traz `publicId` (`frm_…`) — é ele que vai no trecho do SDK na página.

### O que cada seção decide

- **`destination`** — onde a negociação nasce. Pegue os ids em `GET /api/pipes`. Errar aqui é o
  defeito mais caro: o lead entra e ninguém vê.
- **`afterSubmit`** — mensagem na própria página **ou** `redirectUrl`. Para mandar ao WhatsApp:
  `https://wa.me/55DDDNUMERO?text=Oi%2C%20vim%20pela%20p%C3%A1gina`.
- **`theme`** — a aparência do formulário vive **aqui**, não no CSS da página: ele desenha em shadow
  DOM e o CSS de fora não entra. Ver "a cara do site", abaixo.
- **`lgpd`** — `source`: `url` (link para a política), `custom` (texto próprio em `customText`) ou
  `default`. O aceite fica gravado no campo personalizado de `customfieldId`, com data e origem.
- **`tracking.utm`** — só o que estiver mapeado aqui é gravado. Sem mapeamento, a UTM **se perde**.
  Se a página vai receber anúncio, mapeie as cinco — `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_term` e `utm_content` (crie os campos personalizados se não existirem). O teste final manda
  as cinco e o checklist de entrega acusa as que não foram gravadas. Também dá para mapear `page_url` e `referrer`.
- **`tracking.pageView`** — ver abaixo.
- **`protection`** — deixe o honeypot ligado. `minFillSeconds` (0 a 60) segura envio rápido demais
  para ser gente. `allowedDomains` vazio libera qualquer origem; preencha se quiser travar no domínio
  da página.
- **`destination.allowed`** — a lista de funis e etapas que a **página** pode escolher com
  `overrides: { pipeId, stageId }` no trecho. Serve para uma página por unidade com um formulário só.
  Fora da lista, o envio é recusado.
- **`afterSubmit.successMessage`** — `title`, `text` e `durationMs` (até 30 s, antes do redirect).
  **`missingSubmissionRedirectUrl`** só vale para formulário `update`: para onde vai quem abre sem ter
  enviado o primeiro.
- **`button`** — o texto em cada momento: `idle` (o verbo da página toda), `sending`, `sent`,
  `redirecting`. Até 80 caracteres.
- **`metaIntegrationId`** (no formulário, fora de `settings`) — a integração da API de Conversões.
  Com ela, o envio vai para a Meta pelo servidor, com o mesmo id do pixel da página (conta uma vez).
- **`hostedPage`**, **`domainId`**, **`path`** — o formulário numa página própria do Cubo, sem
  landing: `title`, `description`, `logoUrl`, `faviconUrl`, `background`, `gtmId`, `headCode`. O
  caminho é único junto com o das landings no mesmo domínio.

### Formulário de atualização (`type: "update"`)

Para qualificar sem assustar: a landing pede só nome e WhatsApp (tipo `create`); a página de obrigado
tem um segundo formulário `update` com as perguntas de qualificação. Ele sabe de quem se trata pelo
token do primeiro envio (`?lfs=` na URL do redirect ou o navegador), pré-preenche nome e telefone e
**atualiza a mesma negociação**, sem criar outra.

## A cara do site

O formulário é a parte da página que a pessoa mais olha: se ele sai com outra cara (campo reto, botão
em pílula, dentro de um cartão arredondado), a página inteira parece remendada. Ele segue os tokens
do site ([marca.md](marca.md), "o sistema do site"):

| No tema | Vem de |
|---|---|
| `primary` | a cor de ação do site (a dos botões) |
| `radius` | o canto do **campo** do site, se o site tem formulário; se não tem, o do **cartão**, até 12px |
| `font` | a fonte de texto da página (ou `inheritPageStyles: true` no trecho) |
| `inputStyle` | `outline` para campo com borda, `filled` para campo com fundo, `underline` para só a linha — como o site |
| `text`, `border`, `background` | as cores de texto, de fio e de fundo da página |

O tema tem **um** raio para campo e botão. Quando o botão do site tem outro canto (pílula, por
exemplo), acerte pela opção `css` do trecho do SDK, que entra dentro do formulário — o mesmo texto
vai no `"css"` do JSON da prévia:

```js
new Form({ form: 'frm_…', target: alvo, minHeight: 420, inheritPageStyles: true,
  css: '.lf-button{border-radius:999px} .lf-input{border-radius:10px}' })
```

O `previa.mjs --capturar` mede o formulário desenhado e acusa campo ou botão com canto diferente do
site, e cidade ou estado em campo de texto.

## PageView

`tracking.pageView: true` faz o **formulário** disparar o PageView dos dois lados (pixel da página e
servidor, com o mesmo id, para a Meta contar uma visita só). Só vale com uma integração da API de
Conversões escolhida no formulário.

**Numa página hospedada no Cubo, deixe desligado.** O Cubo já dispara o PageView da página; ligar os
dois conta a visita duas vezes. A chave existe para o caso de o formulário estar embutido num site
fora do Cubo.

## Na página

```html
<div class="lp-formulario"></div>   <!-- no topo, e de novo no último bloco -->
<script src="https://SEU-CRM/sdk/form.js" defer></script>
<script>
  addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.lp-formulario').forEach(function (alvo) {
      new Form({ form: 'frm_XXXXXXXXXXXXXXXX', target: alvo, minHeight: 420, inheritPageStyles: true })
    })
  })
</script>
```

O mesmo formulário em dois lugares é o normal ([riqueza.md](riqueza.md)): o SDK desenha cada um e
conta a visita uma vez só. `form.on(…)` vale por instância.

Todas as opções do trecho:

| Opção | Para quê |
|---|---|
| `form` | o `publicId` (`frm_…`). Obrigatório |
| `target` | o elemento (ou seletor) onde desenha |
| `minHeight` | reserva a altura antes de carregar — evita o salto. Use a altura **real** do formulário, que o `previa.mjs --capturar` mede e acusa quando o valor está curto (a maior entre celular e computador). O SDK guarda a altura de cada visita e, da segunda em diante, acerta sozinho |
| `inheritPageStyles` | copia o CSS da página para dentro do formulário (fonte, cor de texto) |
| `css` | CSS extra **dentro** do formulário (`.lf-input`, `.lf-button`, `.lf-label`, `.lf-field`…) |
| `values` | pré-preenche: `title`, `phone`, `cf_<id>` — e é o valor dos campos escondidos |
| `overrides` | troca qualquer configuração nesta página (tema, textos, sucesso) e escolhe `pipeId`/`stageId` da lista permitida |
| `blockedWords` | nome com essas palavras recebe sucesso falso e não vira lead (`['teste', 'asdf']`) |
| `messages` | textos de erro: `required`, `requiredSelect`, `email`, `number`, `integer`, `letters`, `minLength`, `maxLength`, `phone`, `lgpd` |
| `classes` | classes extras em `root`, `field`, `label`, `input`, `error`, `button`, `success`, `lgpd` |
| `landingId` | a landing de origem (sem ele, o Cubo acha pela URL) |

Não passe `apiBase` (quebra a marca branca), nem `shadow: false` (o CSS da página vaza para dentro),
nem `lazy` (não existe).

Também dá para mudar a aparência **de fora**, por variáveis CSS no elemento do formulário —
`--lf-primary`, `--lf-background`, `--lf-text`, `--lf-input-bg`, `--lf-border`, `--lf-error`,
`--lf-radius`, `--lf-font`, `--lf-font-size`, `--lf-pad`, `--lf-gap`, `--lf-padding` (use `0` para
colar no layout) — e por `::part(input|label|button|field|error|success|lgpd)`.

Eventos e métodos, se precisar reagir:

```js
const form = new Form({ … })
form.on('start', () => {})                          // primeira interação (uma vez)
form.on('submit', ({ values }) => {})               // passou na validação, vai enviar
form.on('success', ({ eventId }) => {})             // o Cubo aceitou
form.on('error', ({ code, message, field }) => {})  // sem listener, a mensagem aparece sob o botão
form.on('redirect', ({ url, preventDefault }) => {}) // dá para cancelar
form.setValues({ cf_318040: 'unidade-centro' }); form.reset(); form.submit()
```

O envio já dispara sozinho, se estiverem na página: o `Lead` no pixel da Meta (com o mesmo id do
servidor) e `formStart` / `formSubmit` no `dataLayer` do GTM. Não escreva esses eventos à mão.

## Na prévia, antes de o formulário existir

Enquanto a página ainda é rascunho (sem chave, ou antes de decidir campos e destino), **não use
maquete**: o formulário é o elemento mais importante da página, e uma caixa de mentira não mostra
como ele vai ficar. Escreva uma definição local e passe para a prévia — o SDK publicado desenha o
formulário de verdade, em modo prévia, sem falar com nenhum CRM:

```json
{
  "definition": {
    "id": "frm_previa",
    "type": "create",
    "fields": [
      { "key": "title", "kind": "text", "label": "Nome completo", "required": true },
      { "key": "phone", "kind": "phone", "label": "WhatsApp", "required": true },
      { "key": "cf_email", "kind": "text", "label": "E-mail", "inputType": "email" },
      { "key": "cf_faixa", "kind": "selectbox", "label": "Quanto pode investir", "options": ["Até 100 mil", "Acima"] }
    ],
    "settings": {
      "button": { "idle": "Quero avaliar minha região" },
      "theme": { "primary": "#ea9e95", "text": "#1f2b27", "radius": 12, "buttonWidth": "full" }
    }
  },
  "css": ".lf-button{color:#1f2b27}"
}
```

```bash
node "<scripts>/previa.mjs" corpo.html cabeca.html --formulario=formulario.json --capturar
```

No corpo, deixe só os `<div class="lp-formulario"></div>` (a prévia desenha em todos). Na construção, os mesmos campos, textos e cores vão
para o `POST /api/forms`, e o `<div>` ganha o trecho definitivo do SDK.

⚠️ **O botão do formulário tem texto sempre branco.** Com uma cor de marca clara (rosé, amarelo,
verde-água), fica ilegível. Passe `css: ".lf-button{color:#<cor escura>}"` — na prévia e no trecho
definitivo.

## Testar sem sujar o funil

A prévia local (`previa.mjs`) desenha o formulário de verdade — ele vem do CRM — mas responde o
envio na própria página: pode preencher e mandar à vontade, nenhuma negociação é criada. Para isso
o formulário **já precisa existir** no Cubo (é o `publicId` dele que vai no trecho do SDK).

Para testar de verdade **depois de publicar**, combine com a pessoa: mande um lead real, confira a
negociação no funil e apague. É o único jeito de provar que o caminho inteiro funciona.
