# LEDGER — skill `migrar-conta`

Andamento do desenvolvimento da skill que copia a configuração de uma conta do Cubo para outra.
**Leia antes de mexer.** Atualize ao fechar cada etapa: o que foi feito, o que foi decidido e o que
ficou para depois. A data vai no formato AAAA-MM-DD.

Documentos irmãos:

- [`API-NECESSARIA.md`](API-NECESSARIA.md): o briefing que foi para o `cubo-crm` (rotas, `refs`, mapa
  de referências). É o contrato entre a skill e o CRM.
- `plugins/migrar-conta/`: a skill.
- `testes/migrar-conta.mjs`: a fumaça da skill, contra um Cubo de mentira que segue o briefing.

## Situação

| Frente | Onde | Situação |
| --- | --- | --- |
| Estudo do CRM e briefing da API | `docs/migrar-conta/API-NECESSARIA.md` | ✅ 2026-10-13 |
| Rotas + `refs` no CRM | `capoia/cubo-crm` (outra janela) | ⏳ em andamento |
| Esqueleto do plugin, ledger de execução, acesso às duas contas | `plugins/migrar-conta`, `conta.mjs`, `ledger.mjs` | ✅ 2026-10-13 |
| Plano (leitura da origem, dependências, usuários, já existentes) | `scripts/plano.mjs`, `decidir.mjs` | ✅ 2026-10-13 |
| Aplicar (troca de IDs, segunda passada, retomada) | `scripts/aplicar.mjs`, `refs.mjs` | ✅ 2026-10-13 |
| Conferência na conta nova (IDs + texto cortado por hash) | `scripts/conferir.mjs` | ✅ 2026-10-13 |
| Relatório HTML | `scripts/relatorio.mjs` | ✅ 2026-10-13 |
| Fumaça no CI (16 casos, Cubo de mentira com duas contas) | `testes/migrar-conta.mjs` | ✅ local; CI no PR |
| Ajustar o catálogo às rotas reais quando o CRM entregar | `scripts/areas.mjs` | ⏳ |
| Ambiente local com contas semeadas (slot do `cubo-crm`) | — | ⏳ depois das rotas |
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

## Premissas sobre a API (confirmar quando o CRM entregar)

O catálogo `scripts/areas.mjs` é o único lugar com rotas e escopos. Ajuste lá quando o CRM decidir.

- [ ] nomes das rotas: `/api/resolution-reasons`, `/api/transfer-reasons`, `/api/pause-reasons`,
      `/api/activity-trails`, `/api/knowledge-base-folders`, `/api/agent-folders`,
      `/api/automation-folders`, `/api/oauth-credentials`, `/api/mcp-connections`, `/api/whoami`,
      `/api/files/import-url`
- [ ] nomes dos escopos de cada recurso (o catálogo supõe um por rota, com `read`/`create`/`update`)
- [ ] `whoami` devolve `{ companyId, name, tenantId, user: { id, name, email, isAdmin }, scopes, modules, counts }`
- [ ] `?include=refs` em `index` e `show`; `?name=` exato
- [ ] POST aceita ref nula nos campos que a skill adia para a segunda passada (ex.: `start_flow`
      apontando para automação ainda não criada)
- [ ] POST de formulário devolve o `publicId` novo
- [ ] Landing do construtor: o que fazer com o `keycubo` (a skill hoje esvazia e deixa pendência)

## Pendências e ideias

- Testar com Haiku, Sonnet e Opus (o modelo segue o fluxo? pergunta com escolha clicável?).
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
