# A API do Cubo

Tudo em `https://SEU-CRM/api/...`, com o cabeçalho `X-API-Key: sk_...` e
`Accept: application/json`. O `cubo.mjs` já põe os dois (troque `<scripts>` pelo caminho completo,
como diz o `SKILL.md`):

```bash
node "<scripts>/cubo.mjs" get  /api/pipes
node "<scripts>/cubo.mjs" post /api/landings @pagina.json
node "<scripts>/cubo.mjs" put  /api/landings/12 @pagina.json
node "<scripts>/cubo.mjs" del  /api/landings/12
node "<scripts>/cubo.mjs" upload /api/landings/assets topo.webp
```

**Corpo com HTML vai sempre por arquivo** (`@pagina.json`), nunca escrito no comando: no Windows a
linha de comando corta por volta de 32 mil caracteres, e uma landing passa disso. Monte o JSON com a
ferramenta de escrever arquivo e passe o caminho.

Resposta de sucesso vem envelopada em `{"data": …}`. Erro vem como
`{"errors":[{"message":"…"}]}`.

Documentação viva do CRM da pessoa: `https://SEU-CRM/docs` (mostra só o que aquele CRM tem).

---

## Landing pages

### Listar

`GET /api/landings?page=1&perPage=20&status=active&domainId=7`

A listagem **não traz o HTML** (é grande). Para o conteúdo, leia uma página.

### Ler uma

`GET /api/landings/:id` → traz `html`, `head`, `codeHead`, `codeBody` e o resto.

### Criar

`POST /api/landings`

```json
{
  "title": "Turma de março",
  "url": "turma-marco",
  "domainId": 7,
  "html": "<div class=\"lp\">…</div>",
  "head": "<link …><style>.lp{…}</style>",
  "metaDescription": "Até 140 caracteres que descrevem a oferta.",
  "robots": "User-agent: *\nDisallow:",
  "favicon": "https://…/favicon.png",
  "codeHead": null,
  "codeBody": null,
  "cookieAlert": false,
  "enhanceData": true,
  "integrations": [12]
}
```

- **nasce no ar** (`status: "active"`), como na tela do Cubo. Para criar pronta e fora do ar, mande
  `"status": "deactivated"`. Por isso: **só crie depois do "pode publicar"** — antes disso, a prévia
  é local;
- **a API não aceita `css`.** O CSS vai dentro do `head`, num `<style>` — a página publicada ignora
  a coluna `css`;
- `url` é o caminho dentro do domínio, sem barra no começo. `"/"` é a raiz;
- `integrations` é opcional: ids de integração da Meta (API de Conversões) para a página. Pegue em
  `GET /api/landings` de uma página que já funcione, ou pergunte;
- consome uma unidade do módulo de landing pages. Estourando a capacidade, vem 422 com
  `E_INSUFFICIENT_QUOTA` — quem resolve é a pessoa, contratando mais.

A resposta traz `publicUrl`, já montado.

### Atualizar

`PUT /api/landings/:id` — só o que vier no corpo muda.

### Colocar no ar e tirar do ar

Não existe rota própria: é o `status` no `PUT`.

```json
{ "status": "active" }
```

`"active"` põe no ar; `"deactivated"` tira.

⚠️ **A API não confere o domínio.** Ela deixa a página `active` num domínio que ainda está
`validating` — e aí a página está "no ar" num endereço que não resolve. Antes de dizer que publicou,
confira em `GET /api/domains` que o domínio está `active`, e abra o endereço público.

`suspended` é da cobrança: só sai quando o pagamento normaliza, e o `PUT` não muda.

**Caminho ocupado** também é 422, na criação e na atualização: _"Já existe uma landing page ou
formulário com este domínio e caminho"_. Não existe endpoint para conferir antes — a resposta do
`POST` já diz. Leia a mensagem, proponha outro caminho e siga.

**Para mostrar ao cliente antes de valer**, a prévia é local (`previa.mjs`, sem passar pelo Cubo).
Se ele precisar abrir de outro lugar, crie num caminho descartável e depois troque a `url` com um
`PUT`.

### Imagem

`POST /api/landings/assets`, multipart, campo `file`, **até 1 MB** → `{"url": "https://…"}`

```bash
# sempre nesta ordem: preparar, depois subir
node "<scripts>/imagem.mjs" foto.jpg topo topo.webp
node "<scripts>/cubo.mjs" upload /api/landings/assets topo.webp
```

Formatos aceitos: imagem `jpg`, `jpeg`, `png`, `gif`, `svg`, `webp` até **1 MB** — a skill sobe
webp (ou SVG, quando for vetor), veja [html.md](html.md); e **vídeo `mp4` ou `webm` até 25 MB**,
sempre preparado pelo `video.mjs` antes ([movimento.md](movimento.md)). Arquivo acima do limite do
seu tipo volta 422 com o motivo.

Se o Cubo da pessoa ainda recusar o `mp4` por formato, ele é de antes do upload de vídeo: use o vídeo
do YouTube do próprio cliente, com a capa no lugar e o player entrando só no clique.

⚠️ **Cada arquivo consome a cota de armazenamento da empresa**, o mesmo balde dos anexos: a chamada
passa por `checkStorageQuota` e registra o arquivo. Estourando, vem 422 com
`E_STORAGE_QUOTA_EXCEEDED` — e quem resolve é a pessoa, liberando espaço ou contratando mais.

### Excluir

`DELETE /api/landings/:id` — exclusão lógica, libera a capacidade.

---

## Formulários

### Listar / ler

`GET /api/forms` · `GET /api/forms/:id` — a leitura traz o `publicId` (`frm_…`).

### Criar

`POST /api/forms` — corpo completo e regras de campo em [formulario.md](formulario.md).

### Atualizar / excluir

`PUT /api/forms/:id` · `DELETE /api/forms/:id`

---

## Domínios

### Listar

`GET /api/domains` → cada um com `status`: `active` (serve página), `validating` (esperando o
CNAME), `deactivated`, `suspended`.

### Cadastrar

`POST /api/domains` com `{"domain":"landing.cliente.com.br"}` →

```json
{ "data": { "id": 9, "domain": "landing.cliente.com.br", "status": "validating" }, "cnameTarget": "proxy.w8hub.com.br" }
```

Entregue à pessoa, com estas palavras:

> No painel do seu domínio (Registro.br, Cloudflare, GoDaddy…), crie um registro **CNAME**:
> **nome** `landing` (ou o subdomínio que você escolheu) e **valor** `proxy.w8hub.com.br`.
> Depois me avise — pode levar de alguns minutos a algumas horas para propagar.

### Conferir o apontamento

`POST /api/domains/:id/verify` → `{"data": …, "verified": true}`. Quando confirma, o domínio vira
`active` sozinho e a página pode ser publicada.

---

## Apoio

| Rota | Para quê |
|---|---|
| `GET /api/pipes` | funis com as etapas — para escolher o destino do lead |
| `GET /api/customfields` | campos personalizados da empresa |
| `POST /api/customfields` | criar campo: `{"name":"E-mail","context":"deal","type":"text"}` |
| `GET /api/me/modules` | módulos ativos da conta |

Tipos de campo personalizado: `text`, `number`, `selectbox` (exige `options: ["A","B"]`),
`datetime`, `city`, `state`. Contextos: `deal`, `organization`, `people`.

---

## Erros

| Código | O que fazer |
|---|---|
| 401 | chave errada ou ausente |
| 403 `Missing required scope: x:y` | falta permissão na chave — peça para a pessoa editar |
| 403 `Origem não autorizada` | você chamou um endpoint público de fora de uma página do cliente |
| 404 | id de outra empresa, ou caminho errado |
| 422 | corpo inválido, caminho ocupado, domínio inativo, script barrado ou capacidade esgotada |
| 429 | limite de taxa; espere o `Retry-After` |

A mensagem do 422 diz exatamente o que houve — leia antes de tentar de novo, e repita o motivo para
a pessoa em vez de esconder atrás de "deu erro".
