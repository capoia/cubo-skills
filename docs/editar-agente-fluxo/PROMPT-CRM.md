# Prompt para o `cubo-crm`: API para uma IA criar e editar agentes e automações

> Cole o texto abaixo (a partir de "Contexto") numa sessão do Claude Code no `capoia/cubo-crm`.
> Estudo feito em 2026-10-14 sobre a `main` em `83c87be5a`. Os caminhos citados são desse commit.

---

## Contexto

O `capoia/cubo-skills` vai ganhar duas skills do Claude Code, usadas por gente não técnica (dono de
franquia, agência), sempre pela API pública com chave:

- **`/cubo:editar-agente`**: cria e edita agentes de IA. Prompt, chips, follow-up, bases, modelo.
- **`/cubo:editar-fluxo`**: cria e edita automações. Nós, arestas, gatilhos, variáveis.

O problema é o mesmo que resolvemos com os `refs` na migração, só que mais fundo. Os nós de
automação e os chips do agente mudam o tempo todo:

- desde julho, foram 61 commits nos executores e 20 nas microfunções;
- aparece um tipo novo a cada duas ou três semanas, e algum tipo some;
- a forma da configuração muda toda semana.

Se a skill trouxer uma lista fixa de nós e chips, ela envelhece em dias e passa a escrever
configuração que o motor ignora calado. **A skill precisa aprender, na hora, com o próprio CRM**: que
nós e chips existem, o formato de cada um, para onde cada aresta pode ir, e se o que ela escreveu
vai funcionar. Isso pede três coisas que a API não tem hoje: **catálogo**, **validação** e
**teste**.

Siga as convenções da API de configuração (`docs/superpowers/2026-10-13-api-configuracao-ledger.md`):
- escopo na primeira linha do controller;
- trabalho numa Action compartilhada com a tela;
- OpenAPI com `ConfigIndex`/`ConfigShow`;
- testes CFG-xxx no inventário `docs/testing/behaviors/api-configuracao.md`;
- uma fase por PR, em produção antes da próxima.

## O que o estudo achou

### Automações

- **Não há catálogo único de nós.** O tipo aparece em uns oito mapas: `STEP_EXECUTORS`
  (`step_registry.ts`), `STEP_REQUIREMENTS`, `CONTEXT_PROVIDERS`, `TARGET_SLOTS`/`ENTITY_PUBLISHERS`
  (`entity_target.ts`) e `NODE_REFS` (`app/refs/automation_refs.ts`); e, no front,
  `NODE_TYPE_LABELS`/`ALL_NODE_CATEGORIES` (`inertia/components/automation/const.ts`), `NODE_INFO`
  (`node_info.ts`) e `node_components.ts`. Hoje são 41 tipos com executor.
- **O formato do `data` de cada nó não está escrito em lugar legível por máquina:**
  - só 8 executores validam com zod (`switch`, `agent_call`, `analyze_deal`, `tag_conversation`,
    `handoff_to_human`, `set_variable`, `regex_extract`, `end_flow`);
  - os outros 33 leem `node.data.x` direto, e o formato só existe nos `config/*Config.vue`;
  - os valores padrão também moram no Vue (`NODE_DEFAULT_DATA` só cobre `find_deal`);
  - o exemplo mais completo de `data` por tipo é o FIXTURE de `tests/unit/refs/automation_refs.spec.ts`.
- **As saídas (handles) de cada nó não têm registro.** Estão espalhadas entre Vue e executores:
  `yes/no`, `encontrada/nao_encontrada`, `case_xxxxxxxx` + `default`, `option_*`,
  `respondeu/nao_respondeu`, e os opcionais `timeout`, `exhausted` e `ocupada`. Várias dependem do
  `data` (por exemplo, `timeout` só quando `timeoutMinutes > 0`).
- **Gatilhos:** `TRIGGER_REGISTRY` já tem rótulo, categoria e entidades. O formato de `triggerConfig`
  só existe em tipos TS (`app/types/automation_trigger.ts`, `ChatbotTriggerConfig`,
  `TriggerConfig` do `dispatch_automation`), e os rótulos estão duplicados no front.
- **Variáveis:**
  - `VARIABLE_CATALOG`, `CUSTOMFIELD_ALIASES` e `TEMPLATE_FUNCTIONS` estão no backend;
  - as variáveis do próprio fluxo (perguntas, HTTP, IA, `set_variable`, `regex`, `trigger.*`,
    `<resultVariable>.*`) só são listadas no front (`inertia/lib/variable_groups.ts`).
- **Validação:**
  - **No POST/PUT**, o `prepareApiFlowData` confere só o formato do grafo, e o `FindForeignRefsAction`
    confere os IDs. Tipo desconhecido, configuração inválida e handle inexistente são gravados sem
    erro.
  - **No publish**, o `activation_gate` pega o tipo desconhecido, o contexto e o `ask_question` vazio,
    mas **para no primeiro erro**. As regras de campo obrigatório por nó só existem na tela
    (`context_warning.ts/describeConfigProblem`).
- **Leitura do rascunho:** o GET (e a resposta do PUT) devolve o `flowData` da **última versão
  publicada**, não o rascunho (`automation_api_transformer.ts`). Quem edita por API não consegue reler
  o que gravou.
- Não há dry-run nem execução de teste.

### Agentes

- **Os chips são** `{{tool:nome}}` ou `{{tool:nome(k=v,k2="texto")}}` (`CHIP_REGEX` em
  `app/services/ai/prompt_parser_service.ts`).
  - O registro é bom: `app/services/ai/microfunctions/*` com `MicroFunctionDefinition` (`name`,
    `category`, `kind`, `label`, `description`, `configFields[{key, source, dependsOn, required}]`,
    `schemaFor(locked)`, `supportsFollowUp`).
  - Os dinâmicos são `intent_<id>` e `mcp_<connId>_<tool>`.
  - O modelo vê o chip como `nome_<ids ordenados como texto>`.
- **O catálogo já existe, mas só para quem está logado na tela:**
  - prop `microfunctionsCatalog` em `agents_controller.ts:206-256`, com intents e `supportsFollowUp`;
  - `GET /api/agent-microfunctions`, por sessão, uma cópia parcial sem intents;
  - `GET /api/agent-allowlist-sources` e `GET /api/integrations/:id/ai-models`, por sessão.
- **Não há nenhuma validação de chip na escrita**, nem pela API nem pela tela. Fica gravado sem erro:
  - chip com nome que não existe;
  - `stageId` de outra conta, ou de outro funil que não o do `pipeId`;
  - parâmetro obrigatório faltando;
  - intent desligada;
  - MCP desconectado ou ferramenta que a conexão não tem.

  Tudo isso cai calado quando o agente roda (`build_agent_toolset_action.ts:72`, `if (!def) continue`).
  Um `)` dentro de um valor quebra a regex.
- **Campos que não fazem mais nada:**
  - `enabledTools` e `enabledMcpConnections`: a tela não grava mais;
  - `handoffTargets`: é gravado, mas não vira ferramenta desde `f44a187b3`;
  - `allowKnowledgeWriting`: cita `update_knowledge_base`, que não está no toolset.

  Uma IA que preencha esses campos acredita ter configurado algo que não roda.
- **Outras regras que hoje só estão no código:**
  - a chave de `followUpConfig.fields` (`name`, `phone`, `custom_<id>`, `deal_custom_<id>`) só
    está no `PromptEditor.vue`;
  - `model` é texto livre, sem conferência;
  - a intent criada pela API nasce desligada.
- **O teste de agente** (playground) é só por sessão (`POST /agents/playground/run`, resposta por SSE).
  O motor já tem dry-run com mutação simulada (`isDryRun && !allowMutations`).

## Princípio

**O catálogo é dado do backend, mora junto do executor ou da microfunção, e um teste impede que
saia um tipo sem ele.** É o mesmo desenho do `NODE_REFS`, que hoje é o mapa mais confiável justamente
porque o REF-032 cobra um registro por executor. Assim, nó ou chip novo já nasce descrito para a IA,
sem ninguém lembrar de atualizar a skill.

O ideal, em fase posterior, é o editor da tela ler o mesmo catálogo (rótulo, categoria, descrição,
saídas e valores padrão), e as duplicações do front somem. Isso não bloqueia as fases abaixo.

## O que pedimos

### Fase C1: catálogos por chave (só leitura)

**`GET /api/automations/catalog`** (escopo `automations:read`, módulo `automations`):

```jsonc
{
  "version": "sha curto do conteúdo",  // a skill guarda e só relê quando muda
  "nodes": [{
    "type": "move_stage",
    "label": "Mover etapa",
    "category": "deal",                 // a mesma da paleta
    "description": "…", "whenToUse": "…", // hoje em NODE_INFO, que vira backend
    "requires": ["deal"],               // STEP_REQUIREMENTS
    "provides": [{ "context": "deal", "handle": "encontrada" }], // CONTEXT_PROVIDERS / ENTITY_PUBLISHERS
    "targets": ["deal"],                // TARGET_SLOTS
    "configSchema": { /* JSON Schema do data, com required e default */ },
    "defaults": { /* data de um nó recém-criado */ },
    "outputs": [                        // as saídas, com a condição em que existem
      { "handle": null, "label": "seguir" },
      { "handle": "timeout", "when": "data.timeoutMinutes > 0" },
      { "handle": "ocupada", "when": "conversa ocupada" },
      { "handleFrom": "data.cases[].id", "pattern": "^case_[a-f0-9]{8}$" }
    ],
    "refs": { "pipeId": "pipe", "stageId": "stage" }, // NODE_REFS, declarativo
    "resultVariable": { "field": "resultVariable", "exposes": ["…"] },
    "example": { /* data completo, do FIXTURE */ },
    "deprecated": false,                // create_deal_from_chat: true, alias de create_deal
    "inPalette": true                   // send_whatsapp_group_invite hoje fica fora
  }],
  "triggers": [{ "type": "deal_created", "label": "…", "category": "…", "entities": ["deal"],
                 "configSchema": { }, "refs": { "pipeIds": "pipe" }, "guarantees": [] }],
  "edges": { "targetHandles": [null, "target-left"], "reservedHandles": ["timeout", "ocupada"] },
  "variables": {
    "catalog": [ /* VARIABLE_CATALOG: key, aliases, label, group */ ],
    "customfields": "cf.<deal|people|organization>.<id> (e os aliases)",
    "functions": [ /* TEMPLATE_FUNCTIONS */ ],
    "fallback": "{{var||padrão}}",
    "fromFlow": [ /* regras de variable_groups.ts que viram backend: perguntas, HTTP, IA, set_variable, regex, trigger.*, <resultVariable>.* */ ]
  },
  "limits": { "flowDataBytes": 2097152, "triggerConfigBytes": 65536, "nodeIdMaxLength": 50 }
}
```

**`GET /api/agents/catalog`** (escopo `agents:read`, módulo `ai-agents`):

```jsonc
{
  "version": "…",
  "chipSyntax": {
    "regex": "\\{\\{tool:([a-zA-Z0-9_]+)(?:\\(([^)]*)\\))?\\}\\}",
    "quoting": "valor com vírgula, espaço ou aspas vai entre aspas; \\\" escapa; ')' não pode",
    "renderedName": "nome + '_' + ids numéricos ordenados como texto"
  },
  "chips": [{
    "name": "move_deal_stage", "category": "deal", "kind": "write",
    "label": "…", "description": "…", "supportsFollowUp": false,
    "params": [{ "key": "pipeId", "label": "…", "required": true, "source": "pipes",
                 "refKind": "pipe", "listFrom": "/api/pipes" },
               { "key": "stageId", "required": true, "source": "stagesByPipe",
                 "dependsOn": "pipeId", "refKind": "stage", "listFrom": "/api/stages?pipe={pipeId}" },
               { "key": "useWhen", "required": false, "type": "string" }],
    "modelInputSchema": { /* JSON Schema de schemaFor({}): o que o modelo manda */ }
  }],
  "dynamicChips": {
    "intents": [{ "chip": "intent_12", "name": "…", "enabled": true, "inputSchema": { } }],
    "mcp": [{ "chip": "mcp_3_list_events", "connectionId": 3, "status": "connected", "description": "…" }]
  },
  "followUp": {
    "fieldKeys": "name | phone | person_register | deal_file | custom_<cfId> | deal_custom_<cfId>",
    "exhaustedActions": ["handoff_to_human", "call_agent", "start_flow", "end_conversation"],
    "schema": { /* agent_followup_validator em JSON Schema */ }
  },
  "fields": {
    "ranges": { "temperature": [0, 2], "maxTokens": [50, 65536] },
    "defaults": { },
    "inert": ["enabledTools", "enabledMcpConnections", "handoffTargets", "allowKnowledgeWriting"]
  },
  "aiIntegrationTypes": ["openai", "google_ai", "openrouter"]
}
```

Junto com o catálogo:
- **`GET /api/integrations/:id/ai-models` por chave** (hoje só por sessão). Devolve
  `toolsUnsupported` dos modelos do OpenRouter: um agente com chips num modelo sem ferramentas roda
  sem nenhuma.
- **O catálogo de agente sai de uma Action só**, usada pela tela e pela API. Hoje há duas cópias, e a
  de `agent_microfunctions_controller.ts` está incompleta.
- **Teste de cobertura**, nos moldes do REF-032:
  - todo executor registrado tem entrada no catálogo, com `configSchema`, `outputs` e `example`
    válido contra o schema;
  - todo gatilho tem `configSchema`;
  - toda microfunção tem `params` e `modelInputSchema`.

**Os 33 nós sem zod são o grosso do trabalho.** Sugestão: escrever o schema junto do executor (zod,
convertido com `zod-to-json-schema`) e passar a validar o `data` na execução também, como os 8 que já
fazem.

### Fase C2: validação que diz tudo de uma vez

- **Validar sem gravar.** `POST /api/automations/validate` e `POST /api/agents/validate` (ou
  `?dryRun=true` no POST/PUT; vocês escolhem) recebem o mesmo corpo da escrita e devolvem **todos** os
  problemas, sem gravar nada:

  ```jsonc
  { "ok": false,
    "errors":   [{ "path": "flowData.nodes.3.data.stageId", "code": "foreign_ref", "message": "…" }],
    "warnings": [{ "path": "flowData.nodes.7", "code": "orphan_node", "message": "…" }] }
  ```

- **Automação.** A validação passa a incluir:
  - tipo de nó desconhecido;
  - `data` contra o `configSchema`;
  - `sourceHandle` que o nó não tem;
  - nó sem caminho a partir do `start`;
  - o que o `activation_gate` já confere, **acumulando** os erros em vez de parar no primeiro.

  O rascunho continua podendo ficar incompleto. O POST/PUT grava e devolve os mesmos `warnings`, e o
  publish recusa com a lista inteira.
- **Agente.** O POST/PUT passa a recusar (422):
  - chip com nome que não existe;
  - parâmetro obrigatório faltando;
  - ID de outra conta;
  - `stageId` fora do funil do `pipeId`;
  - `)` dentro de valor.

  E avisa (`warnings`):
  - intent desligada;
  - MCP desconectado, ou ferramenta que a conexão não tem;
  - modelo sem suporte a ferramentas;
  - campo inerte preenchido.

  Antes de ligar a recusa, contem nos dados de produção quantos agentes ela pegaria, para não travar a
  edição de quem já tem prompt quebrado. Se forem muitos, o PUT só avisa sobre o chip que já estava lá
  e recusa só o chip novo.

### Fase C3: ler o rascunho e não pisar na edição de outro

- **`GET /api/automations/:id?version=draft`** devolve o `flowData` do rascunho. O PUT devolve o
  rascunho que acabou de gravar.
- **Concorrência.** O GET devolve `updatedAt` (ou um `ETag`), e o PUT aceita `If-Match` (ou
  `expectedUpdatedAt`): se alguém editou pela tela no meio, a resposta é 409, em vez de sobrescrever.
  Isso vale para automação e para agente, porque a skill faz ler → mudar → gravar, e o dono pode
  estar com o editor aberto.

### Fase C4: testar antes de ligar

- **`POST /api/agents/:id/simulate`**: `{ messages: [{ role, content }], allowMutations: false }`
  - roda o agente em dry-run, como o playground, e devolve a resposta, as ferramentas chamadas (com
    argumentos) e os erros;
  - tem que ser síncrono (ou com `GET` para buscar o resultado), porque a skill não ouve SSE;
  - custa token da integração da conta: escopo próprio (`agents:test`?) e um teto por minuto.
- **Automação (pode ficar para depois):** `POST /api/automations/:id/simulate` com uma entidade de
  exemplo (`dealId`), devolvendo o caminho percorrido e o que cada nó faria, sem executar nada.
  Mesmo um "seco" que só resolve condições e variáveis já ajuda muito.

## Fora deste pedido

- O editor da tela ler o catálogo: é desejável, mas não bloqueia.
- Os campos inertes do agente: decidam se removem, se avisam, ou se religam (o `handoffTargets`
  sem ferramenta parece regressão do `f44a187b3`; confiram). O catálogo só precisa dizer a verdade
  sobre eles.

## Perguntas para vocês decidirem

1. **Validação:** rota `validate` à parte ou `?dryRun=true`? (A skill aceita qualquer uma; prefira a
   que reaproveita mais.)
2. **`configSchema`:** zod junto do executor convertido para JSON Schema, ou declarado à parte? Vale
   o que for mais difícil de esquecer num nó novo.
3. **Chip quebrado nos agentes de produção:** recusa no PUT ou só aviso, dependendo da contagem.
4. **Simulação:** escopo novo ou `agents:update`? Qual teto?

## Ordem e entrega

**C1 → C2 → C3 → C4**, uma por PR, cada uma em produção antes da próxima, como na API de
configuração. A skill começa a ser escrita com a C1 no ar. A C2 e a C3 são o que a deixam segura para
editar automação de cliente, e sem a C3 a skill de fluxo não sai. Mandem o resultado de cada fase no
formato dos itens do ledger (o que mudou, o que a skill precisa saber), como no B7.
