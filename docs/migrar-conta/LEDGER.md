# LEDGER — skill `migrar-conta`

Andamento do desenvolvimento da skill que copia a configuração de uma conta do Cubo para outra.
**Leia antes de mexer.** Atualize ao fechar cada etapa: o que foi feito, o que foi decidido e o que
ficou para depois. A data vai no formato AAAA-MM-DD.

Documentos irmãos:

- [`API-NECESSARIA.md`](API-NECESSARIA.md): o briefing que foi para o `cubo-crm` (rotas, `refs`, mapa
  de referências). É o contrato entre a skill e o CRM.
- `plugins/cubo/skills/migrar-conta/`: a skill.
- `testes/migrar-conta.mjs`: a fumaça da skill, contra um Cubo de mentira que segue o briefing.

## Situação

| Frente | Onde | Situação |
| --- | --- | --- |
| Estudo do CRM e briefing da API | `docs/migrar-conta/API-NECESSARIA.md` | ✅ 2026-10-13 |
| Rotas de **leitura** + `refs` no CRM (A0–A6) | `capoia/cubo-crm` #419–#431 | ✅ 2026-10-13, em produção |
| Rotas de **criação/edição** no CRM (B1–B6) | `capoia/cubo-crm` #433, #438–#442 | ✅ 2026-10-14 |
| **Segredos** no CRM (B7: `secrets:read`, `?include=secrets`) | `capoia/cubo-crm` #444 | ✅ 2026-10-14, testado no slot |
| Escrita da skill ajustada ao CRM real | `aplicar.mjs`, `areas.mjs`, `conta.mjs`, `lib.mjs` | ✅ 2026-10-14 |
| Leitura da skill ajustada ao CRM real | `lib.mjs`, `conta.mjs`, `plano.mjs`, `refs.mjs`, `areas.mjs` | ✅ 2026-10-13 |
| Esqueleto do plugin, ledger de execução, acesso às duas contas | `plugins/cubo/skills/migrar-conta`, `conta.mjs`, `ledger.mjs` | ✅ 2026-10-13 |
| Plano (leitura da origem, dependências, usuários, já existentes) | `scripts/plano.mjs`, `decidir.mjs` | ✅ 2026-10-13 |
| Aplicar (troca de IDs, segunda passada, retomada) | `scripts/aplicar.mjs`, `refs.mjs` | ✅ 2026-10-13 |
| Conferência na conta nova (IDs + texto cortado por hash) | `scripts/conferir.mjs` | ✅ 2026-10-13 |
| Relatório HTML | `scripts/relatorio.mjs` | ✅ 2026-10-13 |
| Fumaça no CI (25 casos, Cubo de mentira com duas contas no formato real do CRM, leitura e escrita) | `testes/migrar-conta.mjs` | ✅ |
| Ambiente local com contas semeadas (slot do `cubo-crm`) | slot 4, `../cubo-crm-wt-migrar-conta-teste` (porta 3337, banco `crm_wt4`) | ✅ 2026-10-14 — ver "Teste contra o CRM real" |
| Evals (conta vazia, nome repetido, referência inexistente) | `evals/evals.json` | ⏳ depois do ambiente |

## Decisões

| Data | Decisão | Por quê |
| --- | --- | --- |
| 2026-10-09 | Um plugin por skill no marketplace `cubo`; plugin autocontido | escolha no `/plugin`; o Claude Code copia cada plugin isolado |
| 2026-10-13 | A skill usa **rotas REST normais** (GET/POST/PUT por recurso), não o import/export da tela | a API serve a clientes e a outras coisas; o import/export continua sendo do usuário |
| 2026-10-13 | **O CRM devolve `refs`** (`?include=refs`) dizendo onde cada recurso guarda ID de outro; a skill troca por script | o catálogo de onde estão os IDs mora ao lado do código que cria os campos; tipo novo de nó/microfunção é cobrado por teste no CRM |
| 2026-10-13 | A conferência final relê o que foi criado com `?include=refs` e exige que todo ID seja da conta nova | um ID não trocado não dá erro no Cubo: a ferramenta do agente some calada |
| 2026-10-13 | **Sem tabela de vínculo origem→destino.** Confere pelo nome; se já existir, a pessoa escolhe (usar, criar outro, pular) | mais simples; o mapa de IDs da execução fica no ledger da pasta de trabalho |
| 2026-10-13 | Usuários: casa por e-mail; quem não tiver par a skill pergunta; sem resposta, cai no dono da chave da conta nova | e-mail é único por tenant; usuário não se cria pela API |
| 2026-10-13 | Landing do construtor continua editável no construtor (o CRM vai aceitar `components`/`styles`) | migrar como HTML tiraria a edição |
| 2026-10-13 | Domínio: a pessoa escolhe entre tirar da origem (fora do ar até verificar) e um domínio temporário | não existe nas duas contas ao mesmo tempo |
| 2026-10-13 | Chave da origem só lê; a skill **nunca escreve na conta de origem** | migração errada não pode estragar a conta que está funcionando |
| 2026-10-14 | **Os segredos vêm junto** (chave do Cal.com, das IAs, cabeçalho do nó HTTP e do webhook, segredos de intent, client secret OAuth). Pedido ao CRM: `secrets:read` + `?include=secrets` ([SEGREDOS-CRM.md](SEGREDOS-CRM.md)) | o uso é franqueadora replicando uma conta modelo; são chaves de serviço de fora, que funcionam em qualquer conta. O que nasce de login (WhatsApp, Instagram, Google, MCP) continua se reconectando |
| 2026-10-14 | A permissão `secrets` **não** vem com o acesso total; a skill exige marcada à parte na chave da origem | senão toda chave `*:*` que já existe passaria a vazar segredo |
| 2026-10-14 | Formulário do construtor: a skill pede uma **terceira chave**, da conta nova, só com `deals:create`/`deals:update`, e troca o `keycubo` por ela. Só quando há landing assim | a chave fica visível na página; o construtor chama `POST /api/deals` e `PUT /api/deals/:id`. A da migração (com escrita) nunca vai para página |
| 2026-10-14 | Módulos conferidos no acesso (`whoami.modules.activeSlugs`): agentes (`ai-agents`), automações, canais, integrações | descobrir no meio deixa metade criada |
| 2026-10-14 | A skill não exclui o domínio da conta antiga, mesmo com `domains:delete` existindo; a pergunta diz que, para usar o mesmo, a pessoa exclui lá | a regra "nunca escrever na origem" vale também aqui. Raramente vão querer o mesmo |
| 2026-10-14 | "Criar outro igual" em área de nome único põe " (migrado)" no nome | o Cubo recusa o repetido com 422; perguntar de novo cansaria a pessoa |
| 2026-10-14 | Automação publicada na origem é publicada no destino depois da 2ª passada; nunca ligada | publicar não liga nada; o PUT troca o rascunho, então publicar antes perderia as ligações |
| 2026-10-14 | Arquivo copiado por **finalidade** (`produto|url`), uma vez só | imagem de produto só vale na pasta de produto; o `import-url` não deduplica e conta na cota |
| 2026-10-13 | Skill com `disable-model-invocation: true` | escreve em conta de cliente: só roda quando a pessoa chama `/migrar-conta` |
| 2026-10-13 | Scripts **sem dependência** (só Node 20.9+, `fetch` nativo) | nada para instalar na máquina de leigo |

## Como a skill funciona (resumo para quem chega)

Tudo fica numa pasta de trabalho `migracao/` onde a pessoa abriu o Claude Code:

```
migracao/
  origem.env, destino.env   acesso às duas contas (segredo; permissão só do dono)
  ledger.json               o estado da execução: etapas, itens, mapa de IDs, decisões, pendências
  LEDGER.md                 o mesmo, para gente ler (regerado a cada passo)
  origem/<area>.json        a foto da conta de origem lida no plano (com refs)
  relatorio.html            o relatório final
```

Etapas: acesso → escolha → plano → decisões → aplicar → segunda passada → conferência → relatório.
Todo script lê e grava o `ledger.json`; rodar de novo **continua de onde parou** e nunca cria o que
já foi criado. Quando aparece algo que só a pessoa pode decidir (usuário sem par, item que já existe,
domínio), o `aplicar` para e lista as perguntas; o Claude pergunta com escolha clicável, grava com o
`decidir.mjs` e roda de novo.

## Premissas sobre a API

O catálogo `scripts/areas.mjs` é o único lugar com rotas e escopos. Ajuste lá quando o CRM mudar.
Fonte da verdade da leitura, no `cubo-crm`: `start/routes/api.ts`, `app/refs/*`,
`app/constants/api_key_scopes.ts`, `app/actions/api/describe_api_key.ts` e
`docs/testing/behaviors/api-configuracao.md`.

**Confirmado na leitura (2026-10-13):**

- [x] rotas: as do catálogo, todas com `GET /api/<recurso>` e `GET /api/<recurso>/:id`
- [x] escopos de leitura: um por área, com os nomes do catálogo; etapa e motivo de perda aceitam
      também `pipes:read` (`escopoTambem`); `*:*` e chave antiga chegam com `apiKey.fullAccess: true`
- [x] `whoami` → `{ data: { company: { id, name }, user: { id, name, email, type, isAdmin },
      apiKey: { scopes, fullAccess }, modules, counts } }`. Sem tenant
- [x] listagem `{ data, metadata: { lastPage } }`, `page`/`perPage`/`limit` (teto 500); parâmetro
      desconhecido = 422
- [x] detalhe devolve o objeto direto, menos formulário e landing (`{ data }`): `lib.detalhe` trata
- [x] `?include=refs` na listagem, menos landing e automação (422). Essas duas e a base de
      conhecimento (o `content` só vem no detalhe) leem item a item (`detalhe: true` no catálogo)
- [x] `path` no formato do `joinPath` do CRM: `a.b`, `a[0]`, `a["45"]`
- [x] refs do mesmo `path` aplicados de uma vez, sobre o original (CSV com `token` = valor inteiro,
      chaves de objeto que cruzam o mapa)

**Confirmado na escrita (2026-10-14):**

- [x] escopos de `create`/`update` em todas as áreas, menos domínio (`read`/`create`) e MCP (`read`);
      `files:create` para o `import-url`. Funil, etapa, credencial, agente e base exigem admin
- [x] POST responde 201 com o objeto direto; tag, formulário, landing e template seguem com `{ data }`
      (`idDe` trata os dois). PUT é parcial
- [x] `POST /api/files/import-url` `{ url, purpose }` → `{ url, path, copied }`; `purpose` por área
      (`proposito` no catálogo); 422 tira o arquivo do item, 413 para tudo
- [x] funil nasce sem etapas; ordem final por `PUT /api/pipes/:id/stages-order` com todas as etapas
- [x] nascem desligados: integração, intenção, canal, automação (rascunho). Landing: a skill manda
      `status: deactivated`
- [x] o Cubo apara as pontas dos textos e grava `""` como `null`: a impressão digital é do texto aparado
- [x] SDK da página só do endereço da conta: o `preparar` da landing troca o host do `sdk/form.js`
- [x] teto de 240 escritas/min por chave: 429 numa escrita é repetido (o Cubo recusou sem executar)
- [x] base de conhecimento acima de ~200 mil caracteres: 422 — a skill barra antes, com o que fazer

**Ainda sem teste contra o CRM de verdade:** tudo acima foi lido no código do CRM e reproduzido no
Cubo de mentira. O que pode surpreender: campos do GET que o validador recusa (em vez de ignorar),
a ordem de criação diante das conferências de posse, e módulos desligados na conta nova.

## Teste contra o CRM real (2026-10-14)

**Ambiente:** worktree `../cubo-crm-wt-migrar-conta-teste` (slot 4, `pnpm dev:docker`, porta 3337,
banco `crm_wt4`), criado com `scripts/backlog-worktree-setup.sh`. Origem = "Teste Pagante" (nº 9,
3 usuários), destino = "Teste Bonificada" (nº 15, 1 usuário). No `.env.docker` do slot:
`APP_URL=http://localhost:3337` (o SDK da página só é aceito do endereço da conta) e
`W8_TOKEN=desligado-no-slot` (o slot herdava o token de produção do W8). Chaves gravadas direto em
`apikeys`; a da origem com `secrets:read` marcado (o CRM ainda ignora). Módulos de canais, automações
e agentes ligados na conta destino por um seeder local (`99_migrar_conta_modulos_seeder.ts`, não
versionado). A origem foi semeada **pela própria API**, com referência cruzada em todas as áreas.

**Resultado:** `todos` → 67 itens; 59 criados, 3 reaproveitados, 5 canais aguardando a conexão do
WhatsApp (esperado). Conferência: nenhum ID da conta antiga. Conferido também por fora: membros,
campo em destaque e ordem das etapas do funil; chips, nome de ferramenta, handoff, follow-up e base
do agente; gatilho, nós e ciclo A↔B das automações (publicadas, desligadas); chave do formulário,
funil, formulário e input da landing do construtor; `frm_` e SDK da landing em HTML; filtro,
webhook, produto, departamento. Rodar o `aplicar` de novo não duplicou nada. Nenhuma chave no
relatório nem no ledger.

**Defeitos achados e corrigidos na skill:**

- lista com o mesmo usuário repetido (três usuários da origem → o dono) → 422. `semRepetidos`;
- etapa com `rottenDays: 0` → 422 (a leitura devolve 0, a criação exige ≥1). `preparar` manda null;
- aviso de número sem ref no prompt não disparava: exigia 3 dígitos e contava como coberto o número
  do chip. Agora olha o trecho do ref;
- textos: pergunta de "já existe" mostrava o domínio antigo; avisa quando o repetido é cópia da
  própria migração; "espera X, X"; plural de 1 pergunta; "agentes de ia".

**Para o CRM:**

- `GET /api/stages` devolve `rottenDays: 0` que o `POST` recusa (mín. 1). Normalizar (0 → null) num
  dos lados;
- `scripts/backlog-worktree-setup.sh` não sobrescreve `W8_*`: todo slot fala com o W8 de produção.
  Aqui um `POST /api/domains` do teste chegou lá (recusado por ser `.local`);
- `PUT /api/filters`: aceitou `users=25%2C25` (repetido) no `link`.

### 2ª rodada: segredos (B7) e migrar de novo para a mesma conta

Slot atualizado para a `main` do CRM com o B7 (#444), migração `api_secret_reads` rodada. A intent
da origem ganhou `secrets: { CEP_TOKEN }` e `{{CEP_TOKEN}}` na URL. Pasta nova (`teste3/`), mesma
conta destino, que já tinha a 1ª cópia: `existentes-todos criar`.

**Resultado:** 61 criados, 1 reaproveitado (o domínio escolhido), 5 canais aguardando; conferência
limpa. Por fora, com `include=secrets` dos dois lados: chave do Cal.com, cabeçalho do webhook,
segredo e cabeçalho da intent (com o `{{CEP_TOKEN}}`), cabeçalho do nó HTTP e client secret do OAuth
**iguais na conta nova**; integrações nascem `deactivated`, OAuth `disconnected`. Pendência certa:
"a chave veio junto" em vez de "preencher". Segredo só nos `migracao/origem/*.json` (a pasta que o
relatório manda apagar); nada no relatório nem no `LEDGER.md`.

**Defeitos achados e corrigidos:**

- a chave de origem do teste tinha `secrets:read` mas **nenhum usuário** → 403 em todo segredo. O
  `whoami` mostra o dono nesse caso, então a conferência agora **lê um item de verdade** com
  `include=secrets` e explica o campo "Usuário (opcional)". O passo a passo da chave pede o usuário;
- "criar outro" para todos não dava sufixo ao que só se descobre repetido no `aplicar` (pastas,
  filtro): 422 "já existe". Agora `nomeLivre` acha "X (migrado)", "X (migrado 2)"… e guarda o nome no
  item para a retomada;
- intent também tem nome único (identificador em minúsculas): sufixo `_migrado`;
- domínio escolhido que já existe na conta nova era recriado (422): agora é sempre reaproveitado;
- `conferir-formulario` respondia a última pergunta mas deixava a etapa "Decisões" em andamento;
- segredo de intent com nome fora de `MAIUSCULAS_COM_SUBLINHADO` (o B7 avisa que sai assim e o
  POST recusa): vira o nome no formato e o `{{nome}}` da URL e dos cabeçalhos acompanha, com
  pendência para testar. Só na fumaça (o CRM não deixa gravar um assim hoje).

**Para o CRM:**

- `whoami` não diz se a chave tem usuário: a sem usuário aparece como do dono, e só a leitura de
  segredo revela. Um `apiKey.userId` (null quando cai no dono) bastaria;
- a maioria das áreas não tem `DELETE` pela chave (integração, intent…): não dá para desfazer uma
  migração errada pela API. Não é pedido, é registro.

### 3ª rodada: canais, arquivos, cota cheia e o 429

Slot na `main` com o #445 (rottenDays null no GET, link do filtro sem repetido, W8 falso nos slots
novos). Pastas `teste3` a `teste6`.

- **Canais:** "conectado" o WhatsApp na conta nova copiando `whatsapp_business_config` da origem no
  banco (é o que o login na Meta grava). Rodar o `aplicar` de novo criou os 3 canais com a integração
  nova, o mesmo número e desligados. Os 2 canais da semeadura do CRM presos à integração da OpenAI
  esperariam para sempre.
- **Arquivos:** imagem de verdade no MinIO, no produto e no `<img>` da landing em HTML. As duas foram
  copiadas para `companies/15/…`, que existem, e a página e o produto apontam para a cópia.
- **Cota cheia:** `storage_used_bytes` lá em cima na conta nova. Para chave de API o CRM responde
  **422** com `code: E_STORAGE_QUOTA_EXCEEDED` (413 só na tela), e a skill tratava como "arquivo
  ruim": criava o produto sem a imagem. Agora para tudo, com o texto certo. Depois de liberar a cota,
  a retomada copiou os arquivos.
- **429:** teto do slot baixado para 30/min (só no slot, desfeito depois). Migração inteira: uma
  pausa de 60 s, avisada na tela, e seguiu sozinha. Sem nenhum erro.

**Defeitos achados e corrigidos:**

- cota cheia (422 com `code`) não parava: produto criado sem imagem;
- formulário reaproveitado ("usar") não mapeava o `frm_`: a landing em HTML falhava;
- landing em HTML dava erro, em vez de esperar, quando o formulário dela ainda não estava pronto;
- "criar outra" landing no mesmo domínio e endereço: 422. A cópia vai para `/endereco-migrado`, com
  pendência dizendo o endereço;
- formulário, campo personalizado e template também têm nome único (levantado no CRM: agora todas
  as áreas com `.unique` no validador estão cobertas);
- campo de cidade e de estado: só um por conta. A cópia usa o que já existe, com aviso;
- canal preso a integração que não é de canal: agora é pulado, com pendência para criar na tela;
- o "conecte e rode de novo" ficava depois que o canal saía; tarefa de item reaproveitado também;
- o 429 esperava calado: agora avisa quanto tempo.

**Para o CRM:**

- `import-url` na **mesma conta** devolve o caminho de origem sem copiar (`tmp/…`), e o produto
  recusa esse caminho ("importe antes por import-url"): não há como pôr um upload temporário no
  produto pela API. Só se contorna importando de outra conta;
- no slot, `POST /api/files/tmp` devolve o endereço do MinIO (`localhost:9000/dodofiles/…`), que o
  `import-url` não reconhece (só o `SPACES_DOMAIN`). Em produção os dois batem: é só ambiente.

**Fora do alcance de um slot:** conexão real com a Meta (simulada no banco) e o storage de produção.

## Pendências e ideias

- Testar com Haiku, Sonnet e Opus (o modelo segue o fluxo? pergunta com escolha clicável?).
- Cota de formulários, landings e domínios na conta nova: o CRM reserva por unidade; uma conta nova
  com cota menor que o número de páginas da antiga falha no meio. Conferir no plano (se o `whoami`
  passar a dar a cota).
- `send_meta_conversion.eventId` é ID dentro da config da integração, não ref: só funciona se a
  integração da conta nova tiver os mesmos eventos. Avisar no relatório.
- Evals com `skill-creator` depois que houver ambiente.

## Como o código está organizado

| Script | Faz |
| --- | --- |
| `lib.mjs` | acesso às contas (`migracao/<conta>.env`), cliente da API com erro que ensina (401/403/404/422), GET com nova tentativa (escrita nunca repete às cegas), abrir arquivo no sistema |
| `areas.mjs` | **o catálogo**: rota, escopo, ordem de criação, chave de nome, campos que não vão no POST, estado de nascimento (desligado), pendência manual de cada área; os grupos da escolha |
| `refs.mjs` | a troca de IDs, pura e testada: valor, trecho de texto (uma passada, com borda), vários IDs no mesmo trecho, chave de objeto; adiar/remover/faltando |
| `ledger.mjs` | estado (`ledger.json`) e versão para gente (`LEDGER.md`), etapas, mapa de IDs, pendências |
| `conta.mjs` | `abrir` (modelo + editor) e `conferir` (conexão, admin, escopos das áreas, contas diferentes) |
| `plano.mjs` | lê a origem com refs, fecha dependências (inclusive formulário pelo `frm_…`), casa usuário por e-mail e MCP por nome, acha o que já existe, monta perguntas; não escreve |
| `decidir.mjs` | grava respostas: usuário, já existe (um a um ou todos), domínio, MCP |
| `aplicar.mjs` | cria na ordem do catálogo; dentro da área, pais antes (pastas); `enviando` antes do POST para retomar sem duplicar; adia ref para área posterior ou do mesmo tipo; 2ª passada por PUT dos campos adiados; guarda hash dos textos grandes |
| `conferir.mjs` | relê cada item criado com refs e exige todo ID na conta nova; compara hash dos textos grandes |
| `status.mjs` | onde parou e o comando que continua |
| `relatorio.mjs` | HTML autocontido: situação, números, tarefas manuais com caixa de marcar, conferência, por área, item a item |

Códigos de saída: 0 ok · 1 parou (acesso, rede, conferência com problema) · 2 uso errado ·
3 perguntas em aberto · 4 itens com erro ou aguardando.

## Histórico

- **2026-10-13** — Estudo do `cubo-crm` (6 frentes) e briefing `API-NECESSARIA.md`. Decisões acima.
  Começo do plugin `migrar-conta` na branch `feat/migrar-conta`.
- **2026-10-13** — Plugin `migrar-conta` 0.1.0: scripts, SKILL.md, referências (acesso, escolha,
  perguntas, problemas), README, fumaça com 16 casos. Achado no caminho: dentro de chip o ID vem
  grudado em `_` (`mcp_1201_list`); a borda de palavra não servia, agora é borda de dígito. Briefing
  ganhou duas regras: o identificador do próprio recurso não é ref, e o ID dentro de token pode vir
  grudado em `_`.
- **2026-10-13** — O CRM entregou a leitura (A0–A6, #419–#431, em produção). Skill ajustada ao
  formato real: paginação em `metadata`, `whoami` novo (sem tenant; `fullAccess`), detalhe item a
  item para landing/automação/base, `escopoTambem` (`pipes:read`), `options` do campo como lista de
  textos, `members` no lugar de `users` no funil. Troca de IDs: lê caminho `["45"]` e troca as chaves
  de um mesmo objeto de uma vez (12→40 e 40→55 não colidem). Plano avisa número de ferramenta sem
  ref no prompt do agente e deixa pendência dos cabeçalhos do nó HTTP. Fumaça: 17 casos. De
  carona, `criar-landing-html` 3.0.1 lê os domínios com `perPage=500`.
- **2026-10-14** — O CRM entregou a escrita (B1–B6, #433, #438–#442). Skill 0.2.0: permissões por
  área (domínio sem edição, MCP só leitura, `files:create`), 429 repetido na escrita, `import-url` por
  finalidade com par guardado, " (migrado)" em nome único, ordem das etapas, publicação das
  automações, host do SDK trocado, limite da base, hash do texto aparado, funis trazem as etapas.
  Fumaça cobre tudo isso (17 casos). Próximo: ambiente local com contas semeadas.
- **2026-10-14** — Decisões do Wellington: segredos vêm junto (briefing [SEGREDOS-CRM.md](SEGREDOS-CRM.md)
  para o CRM), chave separada do formulário do construtor (`conta.mjs abrir formulario` e
  `conferir-formulario`), módulos conferidos no acesso, domínio continua sem exclusão pela skill.
  Relatório ganhou "Para fechar" (apagar as chaves da migração e a pasta). Fumaça: 19 casos.
- **2026-10-14** — Teste contra o CRM real (slot 4): 59 criados, conferência limpa. Quatro defeitos
  corrigidos (repetidos, `rottenDays: 0`, aviso do prompt, textos); três achados para o CRM. Fumaça: 20 casos.
- **2026-10-14** — O CRM entregou os segredos (B7, #444). Skill 0.3.0. Testado no slot: os cinco tipos chegam
  iguais na conta nova. A conferência lê um item com `include=secrets` (chave sem usuário passa no
  `whoami` e falha no segredo). Segunda migração para a mesma conta achou e corrigiu: sufixo de nome
  único no que só se descobre repetido, intent com nome único, domínio já existente reaproveitado,
  etapa de decisões presa. Fumaça: 22 casos.
- **2026-10-14** — Testado o que faltava no slot: canais (WhatsApp simulado no banco), arquivos de
  verdade no MinIO, cota cheia e 429 (teto baixado no slot). Nove defeitos corrigidos, entre eles a
  cota cheia que criava produto sem imagem e o `frm_` do formulário reaproveitado. Fumaça: 25 casos.
