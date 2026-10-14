# Briefing para o cubo-crm: API de configuração com `refs`

> Para quem vai implementar no `cubo-crm`. Escrito a partir de um estudo do código (main de
> 2026-10-13). Os caminhos de arquivo são do `cubo-crm`; confira antes de mexer, porque o código anda.

## Contexto

Vamos ter uma skill do Claude Code, a `migrar-conta` (repositório `capoia/cubo-skills`), que copia
**toda a configuração** de uma conta do Cubo para outra: funis, estágios, filtros, categorias,
produtos, landing pages, formulários, templates, campos personalizados, departamentos, credenciais
OAuth, tags, motivos (perda, resolução, transferência e pausa), canais, trilhas de atividade,
automações, agentes de IA, base de conhecimento, MCPs e integrações.

Ela usa **só a API pública por chave de API**: duas chaves, uma da conta de origem e uma da conta
nova. Quem usa é leigo. A skill lê a origem, mostra o plano, cria tudo na conta nova trocando os IDs
e, no fim, confere se sobrou algum ID da conta antiga.

**Conta = company.** Toda a configuração é escopada por `company_id`. Origem e destino podem estar no
mesmo tenant ou em tenants diferentes.

O que este briefing pede:

1. **Rotas REST de leitura e escrita** (GET/POST/PUT) para cada recurso da lista, no grupo de chave de
   API. Rotas normais, que servem para clientes e integrações, não só para a migração.
2. **`refs`**: no GET, a lista de onde aquele recurso guarda ID de outro recurso. É o ponto central
   deste briefing.
3. Uma rota para a chave se identificar (`whoami`).
4. Alguns ajustes pontuais (landing do construtor, domínio, arquivos, automação).

Hoje a API por chave quase só lê. Das 20 áreas, só formulários, landings em HTML, templates, campos
personalizados e tags têm escrita.

O export/import da tela (`/exports`, `/imports`, `app/actions/transfer/*`) **continua sendo do
usuário** e não é usado pela skill. A lógica dele pode ser reaproveitada por dentro (o que um agente
copia, como recriar pastas), mas a política de não trocar IDs fica onde está.

---

## 1. `refs`: o que são e para que servem

### O problema

Na conta nova os IDs são outros: o funil 12 da origem vira 301. Todo lugar que guarda o ID 12
precisa passar a guardar 301. Esses lugares não são só colunas de chave estrangeira. Estão espalhados
por dentro de JSON e de texto:

- no `flow_data` das automações (uns 40 caminhos diferentes, conforme o tipo de nó e de gatilho);
- no **texto** do prompt dos agentes, em chips como `{{tool:move_deal_stage(pipeId=12,stageId=40)}}`;
- em tokens como `{{cf.deal.45}}` em templates, mensagens e webhooks;
- no `link` dos filtros salvos (uma query string);
- em `pipes.primary_field` (uma string);
- no HTML das landings (o `frm_…` do formulário, e no construtor até a chave de API).

Um ID que não for trocado não dá erro. O agente perde a ferramenta calado
(`build_agent_toolset_action.ts:196-199`), a automação move o lead para um funil que não existe e o
formulário só falha quando o lead não entra.

### A ideia

**Quem sabe onde estão os IDs é o CRM**, porque é ele que cria esses campos. Então o GET de cada
recurso, quando pedido, devolve junto a lista dessas posições:

```
GET /api/automations/88?include=refs
{
  "id": 88,
  "name": "Boas-vindas",
  "flowData": { ... },
  "refs": [
    { "path": "flowData.nodes[3].data.pipeId",  "kind": "pipe",        "id": 12 },
    { "path": "flowData.nodes[3].data.stageId", "kind": "stage",       "id": 40 },
    { "path": "flowData.nodes[5].data.message", "kind": "customfield", "id": 45, "token": "{{cf.deal.45}}" },
    { "path": "flowData.nodes[9].data.agentId", "kind": "agent",       "id": 7 }
  ]
}
```

A skill usa assim:

1. lê o recurso na origem com `refs`;
2. para cada ref, procura o par no mapa dela (funil 12 → 301). Ref com `token` é troca **dentro do
   texto**, só daquele trecho;
3. ref sem par faz a skill parar: ela cria a dependência antes ou pergunta à pessoa;
4. `POST` na conta nova com o corpo já trocado;
5. **confere**: `GET` do recurso novo com `?include=refs` e verifica que todo `id` existe **na conta
   nova**. É isso que garante que nada passou.

Os `refs` também servem fora da migração: "o que usa este funil" antes de excluir, impacto de
lixeira, auditoria. Hoje esse conhecimento está espalhado e incompleto em três lugares
(`app/actions/get_deletion_impact.ts`, `app/actions/trash/trash_catalog.ts`,
`app/helpers/automation_flow_refs.ts`). O ideal é que eles passem a usar os extratores novos, mas
isso pode ficar para depois.

### Formato

```ts
type Ref = {
  path: string        // caminho no JSON devolvido pelo GET: "flowData.nodes[3].data.pipeId"
  kind: RefKind       // o tipo do recurso apontado
  id: number | string // o ID como aparece no dado
  token?: string      // quando o ID está DENTRO de um texto: o trecho exato que o contém
}

type RefKind =
  // configuração: a skill troca
  | 'pipe' | 'stage' | 'customfield' | 'tag' | 'product' | 'category' | 'department'
  | 'lost_reason' | 'resolution_reason' | 'transfer_reason' | 'pause_reason'
  | 'template' | 'activity_trail' | 'channel' | 'integration' | 'oauth_credential'
  | 'mcp_connection' | 'custom_intent' | 'agent' | 'agent_folder' | 'knowledge_base'
  | 'knowledge_base_folder' | 'automation' | 'automation_folder' | 'form' | 'landing'
  | 'domain' | 'filter'
  | 'user'            // a skill casa por e-mail ou pergunta o par
  | 'file'            // id = URL do arquivo no storage da conta; a skill recopia
  | 'form_public_id'  // id = 'frm_…'
  | 'apikey'          // ex.: keycubo no HTML do construtor; a skill troca pela da conta nova
  // dados: não dá para trocar; a skill tira e avisa
  | 'deal' | 'people' | 'organization'
```

Regras:

- `path` aponta para o **corpo do GET**, no mesmo formato que o POST/PUT aceitam. A skill lê, troca e
  manda de volta. Se o GET e o POST tiverem formatos diferentes, o `path` não serve.
- Quando o mesmo texto tem vários IDs, vem **um ref por ocorrência**, cada um com o seu `token`.
- ID que é **chave de objeto** (ex.: `customfieldValues: { "45": "x" }`, `follow_up_config.fields.custom_45`)
  vem com `path` apontando para a chave e `token` com a chave inteira (`"45"`, `"custom_45"`).
- Valor que pode ser ID **ou** variável (ex.: `fields.pipeId.value` em `create_deal`): só vira ref
  quando for ID.
- Chaves locais do grafo de automação **não** são refs: `node.id`, `edge.*`, `targetNodeId`,
  `targets.*.nodeId`, `cases[].id`, `__out.<nodeId>.*`, `__trigger.*`.
- O identificador do **próprio** recurso não é ref: o `publicId` de um formulário, o `id` do
  registro. Ref é só o que aponta para OUTRO recurso.
- Dentro de um `token`, o ID pode vir grudado em `_` (`mcp_1201_list`, `move_deal_stage_304416_320170`):
  a skill troca o número pela borda de dígito. Não é preciso separar.
- Ausente ou vazio, quando não houver referências: `"refs": []`.

### Como implementar

Um **extrator por recurso**, num lugar só (sugestão: `app/refs/<recurso>_refs.ts` mais um registro),
que recebe o objeto serializado e devolve `Ref[]`. O `?include=refs` no `show` e no `index` chama o
extrator. Para textos, **um parser de tokens só** para o sistema inteiro. Hoje existem dois que
divergem: `app/helpers/template_variable_refs.ts` não reconhece `cf.deal.<id>` nem
`custom_field.<id>`, e o completo é `app/actions/template/template_required_context.ts:41-56`.
Nenhum dos dois olha dentro de `{{fn(...)}}`.

### Manutenção: o que mantém os `refs` certos

Os `refs` só valem se acompanharem o código. **Toda vez que mudar a forma como uma automação ou um
agente guarda configuração, o extrator tem que mudar junto.** Em especial:

- **tipo de nó ou de gatilho de automação novo**, ou campo novo num existente que guarde ID;
- **microfunção nova de agente**, ou parâmetro travado novo (`configFields`) que guarde ID;
- formato novo de variável em texto (`{{…}}`);
- campo novo com ID em `follow_up_config`, `form.settings`, configs de integração ou `pipes.*`.

Para não depender de memória, o código tem que **obrigar**:

1. **Automação:** cada executor registrado com `registerStepExecutor` e cada gatilho do
   `trigger_registry.ts` **declara** os campos que guardam ID e o `kind` de cada um (ou declara
   explicitamente que não tem nenhum). O extrator lê dessas declarações. Um teste percorre os
   registros e **falha** se algum tipo não declarou.
2. **Agente:** cada parâmetro em `configFields` das microfunções (`app/services/ai/microfunctions/*`)
   ganha um `refKind` quando é ID. O extrator dos chips lê daí. O mesmo teste falha se um parâmetro
   com nome terminado em `Id`/`Ids` não tiver `refKind` nem uma marcação explícita de que não é ID.
3. **Teste de fixture:** uma automação com **todos** os tipos de nó e gatilho preenchidos, e um agente
   com todas as microfunções, `follow_up_config`, MCP e intent. O teste confere que o extrator acha
   cada ID. Tipo novo entra na fixture.
4. Um aviso no `CLAUDE.md` do CRM, na parte de automações e agentes: "campo novo que guarda ID →
   declarar o `kind`; o teste de refs vai cobrar".

---

## 2. Rotas

Todas no grupo `middleware.apiKey()` de `start/routes/api.ts`, seguindo os padrões que já existem
ali:

- validação com Vine e `request.validateUsing(validator, { meta: { companyId } })`;
- index com `NormalizeApiQueryParams`;
- paginação `page`/`perPage` (máximo 100) com `{ data, meta }`;
- erros no formato `{ errors: [{ message }] }`;
- `@foadonis/openapi` nos controllers;
- rotas estáticas antes de `/:id`, com `.where('id', /^\d+$/)`.

**Escopos.** Cada recurso ganha `read`, `create` e `update` em `APIKeyScope` (`app/models/apikey.ts:19-45`),
no `scopeSchema` (`app/validators/apikey.ts:3-29`) e no editor da tela
(`inertia/components/apikey/const.ts`, `types.ts`, `ScopesEditor.vue`, `inertia/schemas/apikey.ts`,
com os specs). Hoje cada controller confere à mão com `ValidateApiKey.checkScope`; siga o padrão.

**Padrão de todo recurso:**

- `GET /api/<recurso>`: lista paginada **com a configuração completa** (não um resumo), sem itens na
  lixeira. Aceita `?include=refs` e `?name=` (busca **exata** pelo nome; ver §4).
- `GET /api/<recurso>/:id`: o mesmo objeto, com `?include=refs`.
- `POST /api/<recurso>`: aceita o mesmo formato que o GET devolve (sem `id`, contadores e datas).
- `PUT /api/<recurso>/:id`: atualização parcial no mesmo formato.
- **Segredos nunca saem no GET.** Entram só por POST/PUT. O GET diz se o segredo está preenchido
  (ex.: `hasClientSecret: true`).
- **Nascer desligado** o que pode agir sozinho: automação `draft`, landing `deactivated`, intent
  `enabled: false`. A pessoa liga no fim, depois de revisar.
- Usuário que o recurso referencia (`userId`, membros, dono) é aceito **explicitamente** no corpo.
  Hoje muita rota de tela usa o usuário logado (ex.: filtros), e o usuário de uma chave é o dono da
  chave.

A chave tem que ser de usuário **admin/owner**: com usuário comum, `/api/pipes` devolve só os funis
de que ele é membro (`api/pipe_controller.ts`). O `whoami` precisa dizer isso.

### 2.1 Identificação

| Rota | Devolve |
| --- | --- |
| `GET /api/whoami` | `companyId`, nome da conta, `tenantId`, usuário da chave (id, nome, e-mail, **se é admin/owner**), **os escopos da chave**, módulos ativos (o mesmo de `GET /api/me/modules`) e quantos itens a conta tem de cada recurso da lista |

Hoje não existe rota que devolva os escopos nem o `companyId`. A skill precisa disso para não deixar
avançar com chave sem permissão e para recusar origem = destino. Não pedir escopo para essa rota.

### 2.2 O que existe e o que falta, por recurso

"Refs" diz se o recurso precisa de `?include=refs` (se guarda ID de outro recurso).

| Recurso | Hoje | Falta | Refs |
| --- | --- | --- | --- |
| Funis `pipes` | `GET /api/pipes` (escopo `pipes:read`), já com estágios e usuários | POST, PUT; trazer usuários **inativos** do pivô; imagens de `proposalSettings` por **URL** (hoje é upload) | sim |
| Estágios `stages` | só dentro de `/api/pipes`, sem os campos por estágio | GET, POST, PUT com `customfieldIds[]`, `lostReasonIds[]` e `orderNr`; `PUT /api/pipes/:id/stages-order` | sim |
| Filtros `filters` | — | GET (de **todos** os usuários da conta), POST e PUT com `userId` explícito | sim |
| Categorias `categories` | só dentro de produtos (as sem produto não aparecem) | GET, POST, PUT | não |
| Produtos `products` | `GET /api/products` | POST, PUT com `categoriesIds`, `showCard`, `externalId` e imagens por URL | sim |
| Tags `tags` | GET, POST (sem checar nome repetido) | PUT (cor, emoji, descrição) | não |
| Motivos de perda `lostreasons` | `GET /api/lostreasons` (escopo `pipes:read`) | POST, PUT; escopo próprio | não |
| Motivos de resolução, transferência e pausa | — | GET, POST, PUT dos três | não |
| Departamentos `departments` | — | GET com membros e papel, POST, PUT, membros (`userIds[]`, `role`) | sim |
| Campos personalizados `customfields` | GET, POST, PUT | `GET /:id`; `options` como lista de texto | não |
| Templates `templates` | GET, POST, PUT | `GET /:id`; rota de sincronizar com a Meta | sim |
| Trilhas `activity-trails` | — | GET, POST, PUT com os itens aninhados | não |
| Canais `channels` | GET | POST, PUT | sim |
| Integrações `integrations` | — | GET (sem segredos), POST, PUT por tipo, com pivôs (funis, estágios, landings) e `fields[]` | sim |
| Credenciais OAuth `oauth-credentials` | POST e connect, mas **por sessão** (`api.ts:432-441`) | GET, POST, PUT por chave; `client_secret` só de escrita | não |
| MCP `mcp-connections` | — | só GET (id, nome, tipo, status, ferramentas). Não dá para criar por API: a conexão nasce de OAuth no navegador, e o calcom está fechado para conexão nova (`config/mcp_providers.ts:57-77`) | não |
| Intents `intents` | GET | POST, PUT; `headers` e `secrets` só de escrita | sim |
| Base de conhecimento `knowledge-bases` | — | GET (com `content`), POST, PUT; pastas com hierarquia (`knowledge-base-folders`) | sim |
| Agentes `agents` | — | GET completo, POST, PUT; `PUT /:id/handoff-targets`; `PUT /:id/follow-up`; vínculo com KB e `strategy`; pastas (`agent-folders`) | sim |
| Automações `automations` | — | GET, POST, PUT, pastas (`automation-folders`), publicar, ligar/desligar | sim |
| Formulários `forms` | GET, POST, PUT | validar a posse de `fields[].id` | sim |
| Landings `landings` | GET, POST, PUT (só HTML) | campos do construtor | sim |
| Domínios `domains` | GET, POST, verify | `GET /:id`, DELETE | não |
| Usuários `users` | GET (com e-mail), PUT | nada: usuário não se cria pela skill | — |

### 2.3 Detalhes por recurso

**Funis e estágios.** O GET do funil precisa trazer os `customfieldIds` de cada estágio
(`stage_customfield`) e os `lostReasonIds` (`stage_lost_reason`); hoje traz só os motivos. Não
copiar `pipe_user.count` (contador do rodízio). `pipes.primary_field` é string: o ID de um campo
personalizado ou o literal `peoplePhone`.

**Filtros.** `filters.link` é query string. As chaves que são IDs estão no mapa da §3. As que apontam
para **dados** (`peoples`, `organizations`, `ids`) viram ref de `deal`/`people`/`organization`, e a
skill tira e avisa.

**Campos personalizados.** O ID de **opção** não é referenciado em lugar nenhum: o valor gravado é o
texto da opção, e o update apaga e recria as opções (`update_customfield.ts:23-25`). Basta
`options: string[]`.

**Templates.** `template_integrations` é estado da sincronização com a Meta: não vai no POST. Ele é
recriado sincronizando depois que o WhatsApp estiver conectado na conta nova. Falta a rota de
sincronizar por chave. Bug encontrado: o `templateUpdateValidator` (`app/validators/template.ts:73-88`)
confere o nome único com JOIN em `pipes`, e template sem funil escapa.

**Formulários.** O `public_id` (`frm_…`) é gerado no `beforeCreate` e sempre muda. O POST devolve o
novo, e a skill troca nas landings. `app/validators/form.ts:26-63` não confere se `fields[].id` e
`fields[].customfield.id` são da conta (o `form_ownership_rules.ts` só olha o `settings`). Precisa
conferir: hoje o ID errado só aparece quando o lead não entra.

**Landings: o construtor continua editável** (decisão tomada).

- `GET /:id` passa a devolver `assets`, `components`, `styles`, `css`, `templateId` e `integrations[]`.
- `POST/PUT` passam a aceitar `builderVersion` `'1'`/`'2'` com esses campos. Hoje o POST força
  `'html'` (`landing_controller.ts:166`), e a landing do construtor chegaria sem poder ser editada no
  construtor.
- **O construtor publica a chave de API da conta em texto puro no HTML** (`keycubo` do widget
  `cubosuite-form`, também no `components`). Vira ref `apikey`. Vale avaliar trocar esse mecanismo,
  independentemente da migração.
- A checagem de `<script src>` (`landing_controller.ts:66-88`) aceita o `sdk/form.js` só do host da
  requisição. Ela precisa aceitar também o `custom_domain` do tenant.

**Arquivos.** As URLs de arquivo trazem o ID da company de origem (`companies/<id>/…`) e continuam
públicas, mas ficam na cota e na limpeza da conta antiga (`cleanup_deleted_files_job.ts`). Rota
nova: `POST /api/files/import-url { url, purpose }` que baixa e grava no storage da conta da chave,
devolvendo a URL nova. Serve para landing (todas as URLs em `html`, `head`, `assets`, `components`,
`styles`, `favicon`), imagens de produto e de proposta, `mediaUrl` de automação e
`hostedPage.*Url` de formulário. Hoje o `MigrateLandingAssets` só olha a lista `assets`.

**Domínios.** O domínio é único no sistema todo (`app/validators/domain.ts:8-15`) e no W8: não pode
existir nas duas contas ao mesmo tempo. Faltam `DELETE /api/domains/:id` (soft delete +
`DeleteW8DomainAction`, como a tela faz em `web/domain_controller.ts:184-207`) e `GET /:id`. A skill
pergunta à pessoa se tira o domínio da origem ou usa um temporário na conta nova.

**Canais.** O canal só é criado depois que a integração estiver conectada na conta nova, porque o
`phone_number_id` vem dela (`app/channels/resolve_channel_identity.ts`). `default_agent_id` e
`default_automation_id` entram por PUT, numa segunda passada.

**Integrações e OAuth.** O GET nunca devolve segredo. A skill cria a integração como casca
(configuração e mapeamentos) e a pessoa reconecta na tela. A lista do que precisa reconectar está na
§5.

**Base de conhecimento.** O conteúdo é só texto (`content`, até 500k). A reindexação acontece sozinha
depois do POST (job com 30s de atraso). O transfer atual recria as pastas sem hierarquia, e a rota
nova precisa respeitar o `parent_id`.

**Agentes.**

- GET completo: `systemPrompt` inteiro, pasta, `integrationId`, `model`, `enabledMcpConnections`,
  `followUpConfig`, handoffs, KBs com `strategy`.
- **Limite do prompt:** `agent_validator.ts:24,71` corta em 40.000 caracteres com `.trim()`, e o banco
  aceita mediumtext. A rota tem que aceitar o que o banco aceita ou **recusar com erro**. Nunca cortar
  calado: a skill confere por hash e vai acusar.
- Salvar o agente sincroniza `agent_knowledge` a partir dos chips `answer_from_kb`
  (`sync_knowledge_from_prompt_action.ts`), então a KB tem que existir antes. Os handoffs e o
  `follow_up_config` que apontam para agentes ou automações entram por PUT numa segunda passada.
- O agente não tem status: ele só "liga" quando um canal, uma automação ou um handoff aponta para
  ele.

**Automações.**

- O GET devolve o `flowData` da **última versão publicada** (é ela que roda: `dispatch_automation.ts:274`;
  `automations.flow_data` é o rascunho). Junto, `status`, `reentryPolicy` (o transfer atual esquece),
  `debounceMs`, `resetKeywords`, `type`, `entity` e a pasta.
- POST e PUT aceitam o `flowData` inteiro e sincronizam nós **e gatilhos**: chamar
  `SyncAutomationNodesAction` e `syncAutomationTriggers`. Hoje o `update` da tela não sincroniza os
  gatilhos.
- `POST /api/automations/:id/publish` e `/toggle-status`, para a pessoa ligar no fim.
- `start_flow`, `flowIds` e `exhaustedAction.automationId` apontam para outras automações e entram
  numa segunda passada, por PUT.

---

## 3. Mapa de referências (o que os extratores têm que achar)

Cada linha vira um ref. **(texto)** = o ID está dentro de uma string e o ref leva `token`.

### Tokens de campo personalizado em texto

Valem para todo texto: templates, mensagens de automação, `payloadTemplate` de webhook, títulos e
anotações.

- `{{cf.deal.<id>}}`, `{{cf.people.<id>}}`, `{{cf.organization.<id>}}`, `{{cf.<id>}}`
- `{{customfield.deal.<id>}}`, `{{customfield.people.<id>}}`, `{{customfield.organization.<id>}}`
- `{{custom_field.<id>}}`
- `{{trigger.deal.customfield.<id>}}`, `{{trigger.oldDeal.customfield.<id>}}`
- `{{<variavel>.customfield.<id>}}`

Todos com `||padrão` opcional e podendo estar dentro de `{{fn(...)}}`. Referência:
`app/actions/variables/build_variable_map.ts`, `entity_variables.ts`, `trigger_entity_variables.ts`.

### Funis, estágios, cadastros
- `pipes.primary_field` → customfield (string, ou `peoplePhone`)
- `pipes.proposal_settings.{logo,frontImage,coverImage,backImage,backCoverImage}` → file
- `pipes.users[].id` (pivô `pipe_user`) → user
- `stages.pipe_id` → pipe · `stages.customfieldIds[]` → customfield · `stages.lostReasonIds[]` → lost_reason
- `products.categoriesIds[]` → category · `products.{urlImage,urlThumbnail}` → file
- `departments.members[].userId` → user

### Filtros
- `filters.{userId, pipeId, channelId}` → user, pipe, channel
- `filters.link` **(texto, query string)**:
  - contexto negócio:
    - `pipe` → pipe; `stage` → stage; `lostreason` → lost_reason
    - `users`, `createdBy` → user
    - `products` → product; `tags` → tag
    - `customfields`, `peopleCustomfields`, `organizationCustomfields` em pares `campoId:valor` → customfield
    - `peoples`, `organizations`, `ids` → dado
  - contexto pessoa:
    - `tags` → tag; `customfields`, `dealCustomfields` → customfield
    - `dealUsers` → user; `channel` → channel
    - `organizations`, `ids` → dado
  - contexto conversa:
    - `channelId`/`channel` → channel; `assigneeId(s)` → user
    - `tagIds` → tag; `departmentIds` → department
    - `dealPipeId` → pipe; `dealStageIds` → stage
  - Fonte: `app/models/filters/{deal,people,conversation}.ts` e `app/actions/parse_filter_link_action.ts`.

### Templates
- `templates.pipe_id` → pipe
- `templates.{body, components.body.text, components.header.text, variable_mapping[].variable}` **(texto)**
- `templates.components.header.mediaUrl` → file

### Formulários e landings
- `forms.settings.destination.{pipeId, stageId}` → pipe, stage
- `forms.settings.destination.allowed[].pipeId` → pipe · `.allowed[].stageIds[]` → stage
- `forms.settings.lgpd.customfieldId` → customfield · `forms.settings.tracking.utm[].customfieldId` → customfield
- `forms.settings.hostedPage.{faviconUrl, logoUrl}` → file
- `forms.fields[].id` (quando numérico) e `forms.fields[].customfield.id` → customfield
- `forms.metaIntegrationId` → integration · `forms.domainId` → domain
- `landings.domainId` → domain · `landings.integrations[]` → integration · `landings.templateId` → galeria global, **não é ref**
- `landings.html` (HTML puro) **(texto)**:
  - `form: 'frm_…'` → form_public_id
  - `landingId: N` → landing
- `landings.{html, components}` (construtor) **(texto)**:
  - `form` → form; `pipe` → pipe; `stage` → stage
  - inputs `name="<id>"` → customfield
  - `keycubo` → apikey
- URLs `companies/<id>/…` em `html`, `head`, `assets`, `components`, `styles`, `favicon` → file

### Canais, integrações, OAuth
- `channels.{integrationId, transcriptionIntegrationId}` → integration
- `channels.departmentId` → department
- `channels.defaultAutomationId` → automation · `channels.defaultAgentId` → agent
- `integrations.pipes[]`, `integrations.stages[]`, `integrations.landings[]` (pivôs) → pipe, stage, landing
- `integrations.verdata_config.pipes[].pipeId` → pipe · `.financialApprovalStageId` → stage
- `integrations.facebook_capi_config.fieldMappings[].customfieldId` → customfield
- `integrations.google_config.fieldMappings[].customfieldId` e `.emailCustomfieldId` → customfield
- `integrations.webhook_config.auth.credentialId` → oauth_credential
- `integrations.webhook_config.payloadTemplate` **(texto)**
- `integrations.fields[].customfieldId` (`field_integrations`) → customfield
- `integrations.users[].userId` (`user_integrations`) → user
- `google_customer_match_lists.{pipeId, filterId}` → pipe, filter
- `intents.authCredentialId` → oauth_credential

### Agentes, base de conhecimento, MCP
- `agents.{integrationId, folderId}` → integration (de IA), agent_folder
- `agents.systemPrompt` **(texto)**, chips `{{tool:nome(param=valor,…)}}` (`app/services/ai/prompt_parser_service.ts:10`):
  - `intent_<id>` → custom_intent
  - `mcp_<id>_<ferramenta>` → mcp_connection
  - `create_deal`, `move_deal_stage`: `pipeId` → pipe, `stageId` → stage
  - `search_deals_by_person`: `pipeId` → pipe
  - `set_deal_customfield`, `set_person_customfield`: `customfieldId` → customfield
  - `add_deal_tag`, `add_person_tag`, `add_conversation_tag`: `tagId` → tag
  - `add_deal_product`: `productId` → product
  - `forward_to_department`: `departmentId` → department
  - `transfer_to_human`: `targetUserId` → user
  - `mark_deal_lost`: `lostReasonId` → lost_reason
  - `answer_from_kb`: `knowledgeBaseId` → knowledge_base
  - `calcom_*`: `integrationId` → integration
- `agents.systemPrompt` **(texto livre)**: a pessoa às vezes copia para o prompt o nome que o modelo
  vê, como `move_deal_stage_304416_320170` (`prompt_parser_service.ts:58-70`). Padrão:
  `\b<microfunção>_(\d+(?:_\d+)*)\b`, um ref por número.
- `agents.enabledMcpConnections[].connectionId` → mcp_connection
- `agents.followUpConfig`:
  - `exhaustedAction.agentId` → agent; `exhaustedAction.automationId` → automation (no topo e em cada `fields.<k>`)
  - `fields.<k>.templateIdFallback` → template
  - **chaves** `custom_<id>` e `deal_custom_<id>` de `fields` → customfield
  - Fonte: `app/types/follow_up.ts:85-108`.
- `agents.handoffTargets[].targetAgentId` → agent · `agents.knowledgeBases[].id` → knowledge_base
- `knowledgeBases.folderId` → knowledge_base_folder · pastas `parentId` → a própria pasta

### Automações

Gatilhos, em `flowData.nodes[type=start].data.triggers[].triggerConfig` (e `trigger_config`, legado):

| Gatilho | Campos |
| --- | --- |
| `deal_*`, `activity_*`, `proposal_*`, `deal_tag_added`, `deal_processed_by_integration` | `pipeIds[]`, `stageIds[]`, `tagIds[]`, `integrationIds[]`; `changedFields[]` = `customfield_<id>` (texto) |
| `message_received`, `conversation_started`, `keyword_match`, `conversation_tag_added`, `inactivity_since_last_message` | `channelIds[]`, `tagIds[]`; `filters[].value` quando `field` é `conversation.tags`/`.assignee`/`.department` (tag/user/department); `filters[].field` = `person.customfield.<id>` (texto) |
| `time_after_flow_completed` | `flowIds[]` → automation |
| `deal_stuck_in_stage` | `pipeId`, `stageIds[]` |
| `customfield_date` | `customfieldId`, `pipeIds[]`, `stageIds[]` |
| `flow_call`, `calcom_*` | nenhum |

Nós, em `flowData.nodes[].data` (executores em `app/actions/automation/steps/`):

| Nó | Campos |
| --- | --- |
| `move_stage`, `find_deal` | `pipeId`, `stageId`, `stageIds[]`, `customfieldId` |
| `create_deal`, `create_deal_from_chat`, `duplicate_deal` | `fields.{pipeId,stageId,userId}.value` (quando ID), `tags[]`, **chaves** de `customfieldValues`, `peopleId` (dado) |
| `create_person` | `organizationId` (dado), chaves de `customfieldValues` |
| `assign_user` | `userId` |
| `activity_trail` | `trailId`, `userId` |
| `add_product` | `productId` |
| `mark_lost` | `lostReasonId` |
| `update_deal` | `tagIds[]`, `customfieldId`, `lostReasonId` |
| `update_person`, `update_organization`, `wait` | `customfieldId` |
| `condition` | `customfieldId`; `value` quando `field` ∈ {stageId, pipeId, userId, lostReasonId}; `value` em CSV `"1,2"` quando `field = tags` |
| `switch` | `customfieldId`; `cases[].value` quando `field` ∈ {userId, pipeId, stageId} |
| `send_whatsapp_template` | `templateId`, `integrationId`, `defaultUserId`, `phoneCustomfieldId` |
| `send_message`, `send_media` | `fallbackTemplateId`, `mediaUrl` (file) |
| `send_meta_conversion` | `integrationId`; `eventId` é ID dentro da integração |
| `send_whatsapp_group_invite` | `integrationId` |
| `handoff_to_human` | `departmentId`, `assigneeId` |
| `tag_conversation` | `tagIds[]` |
| `agent_call`, `analyze_deal` | `agentId` |
| `update_knowledge_base` | `knowledgeBaseId` |
| `start_flow` | `automationId` |
| `menu_options`, `ask_question` | `followUp.attempts[].templateId`, `followUp.exhaustedAction.{agentId, automationId}` |
| `http_request` | `auth.credentialId` |
| `set_variable`, `regex_extract`, `cooldown_check`, `pause_bot`, `end_flow`, `change_status`, `mark_won`, `add_observation`, `split_assign`, `goto_node` | nenhum |
| qualquer string de `data` | tokens `{{cf…}}` (texto) |

**Atenção:** o `app/helpers/automation_flow_refs.ts` atual reconhece só parte disso. Ele perde os
plurais (`pipeIds`, `stageIds`, `channelIds`, `flowIds`), os valores `{mode, value}`, as chaves de
`customfieldValues`, `condition.value`, `switch.cases[].value`, `productId`, `trailId`,
`knowledgeBaseId`, `automationId`, `integrationId(s)`, `fallbackTemplateId`, `defaultUserId`,
`phoneCustomfieldId` e os tokens. Além disso, para de descer ao achar uma chave. Não use como base
sem reescrever.

---

## 4. Duplicidade

Sem tabela de vínculo. A skill confere **pelo nome** antes de criar e, se já existir na conta nova,
pergunta à pessoa o que fazer (usar o que existe, criar outro, pular). Para isso, todo `index` aceita
`?name=` com busca **exata**, sem diferenciar maiúsculas de minúsculas.

Chaves de nome usadas hoje:

| Recurso | Chave |
| --- | --- |
| Estágio | `(pipe, name)` |
| Filtro | `(user, context, name)` |
| Campo personalizado | `(name, context)` |
| Landing | `(domain, url)` |
| Pasta | `(parent, name)` |
| Domínio | `domain` |
| Todos os outros | `name` |

---

## 5. O que fica fora (a skill orienta, a pessoa faz na tela)

- **Conexões e segredos:**
  - WhatsApp oficial: login Meta, PIN e sincronizar templates
  - Z-API: instância e token, mais QR code
  - Instagram
  - Google Ads: consentimento e recriar as listas
  - Facebook Lead Ads
  - RD
  - chaves digitadas: OpenAI, Google AI, OpenRouter, CAPI, Cal.com, Cubo Email, Verdata
  - `client_secret` e consentimento das credenciais OAuth
  - cabeçalhos secretos de webhook
  - segredos de intents
  - conexões MCP
- **Usuários:** não se criam pela API. A skill casa por e-mail e pergunta o par do resto (o e-mail é
  único por tenant: contas no mesmo tenant não têm a mesma pessoa).
- **`frm_…` em site fora do Cubo:** muda, e a pessoa atualiza à mão.
- **Dados:** negociações, pessoas, conversas, execuções, logs, valores de campo, filas, histórico de
  KB e fixtures de avaliação de agente.

## 6. Ordem em que a skill cria (para priorizar a implementação)

1. Tags, categorias, motivos (4), departamentos, campos personalizados
2. Produtos → funis → estágios
3. Credenciais OAuth e integrações (casca) → MCP (só leitura, para casar)
4. Templates → trilhas → pastas e bases de conhecimento → intents
5. Agentes (sem handoffs e sem follow-up que aponte para agente ou automação)
6. Domínios → formulários → landings (desligadas)
7. Pastas e automações (rascunho)
8. Canais
9. Segunda passada: handoffs, follow-up, `start_flow`/`flowIds`/`exhaustedAction`,
   `defaultAgentId`/`defaultAutomationId`
10. Filtros
11. Conferência com `?include=refs` em tudo que foi criado → relatório → a pessoa revisa e liga

**Sugestão de entrega:** `whoami` + o extrator de refs + os GETs primeiro, recurso por recurso. Com
isso a skill já lê a origem, monta o plano e mostra tudo o que vai mudar. Depois, os POST/PUT na
ordem acima.

## 7. Outros problemas achados no caminho

1. O transfer de automação esquece `reentryPolicy` e não liga entre si as automações do mesmo arquivo.
2. O transfer de KB recria as pastas sem hierarquia.
3. `docs/form-sdk/GUIA-PAGINA-HTML.md:251` diz que a API não aceita `status` e que publicar é
   `POST /:id/publish`. O código aceita `status`, e essa rota não existe.
4. Só `POST /messages/send` tem limite de requisições no grupo por chave. Vale pôr limite nas rotas
   de escrita novas.
