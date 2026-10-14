# Briefing para o `cubo-crm`: copiar os segredos na migração

Pedido da skill `migrar-conta`. Contexto: a skill serve para **franqueadoras replicarem uma conta
modelo**. A maior parte dos segredos é de serviço de fora (Cal.com, OpenAI, o ERP chamado pelo nó
HTTP, o webhook do cliente), e uma chave do Cal.com funciona igual em qualquer conta do Cubo. Hoje a
leitura esconde todos eles (CFG-031, CFG-047), e a pessoa digita tudo de novo em cada franquia. A
escrita já aceita esses campos (B3, B4, B6): falta só a leitura entregar.

## O que pedimos

1. **Permissão nova `secrets: ['read']`**, rótulo "Segredos (chaves de integrações, cabeçalhos e
   senhas)", grupo `config`.
   - **Fica de fora do acesso total.** `*:*`, chave antiga e chave de extensão **não** a ganham: só
     quem marcar explicitamente. Senão, toda chave de acesso total que já existe passa a vazar
     segredo sem ninguém ter decidido isso.
   - Exige chave de **administrador** (403 com usuário comum, como funil e etapa).
   - O `whoami` mostra a permissão em `apiKey.scopes.secrets`, como as outras.

2. **`?include=secrets`** (combinável: `?include=refs,secrets`) no **detalhe** de:

   | Recurso | O que passa a sair | Formato |
   | --- | --- | --- |
   | `GET /api/integrations/:id` | `token`, `apiKey`, `config.webhook.headers` (valores), `config.verdata.password`, `config.facebookCapi.accessToken`; URL do webhook e `baseURL` do Verdata **com** `usuario:senha@` | o mesmo que o `POST /api/integrations` aceita |
   | `GET /api/intents/:id` | `headers` (valores) e `secrets` | o mesmo que o `POST /api/intents` aceita |
   | `GET /api/automations/:id` | no nó HTTP: `headers` (valores), `url` com credencial, `testVariables` | o mesmo que o `POST /api/automations` aceita |
   | `GET /api/oauth-credentials/:id` | `clientSecret` | o mesmo que o `POST /api/oauth-credentials` aceita |

   - Sem a permissão, `include=secrets` responde **403** dizendo qual permissão falta (não ignora
     calado: a skill precisa saber que não veio).
   - Na listagem, `include=secrets` responde 422 (como `refs` em landing e automação): segredo sai
     item a item.
   - **Continua não saindo:** o que nasce de login e é preso à conta ou ao número: token de acesso e
     de renovação do OAuth, conexão do WhatsApp oficial, Instagram, Z-API, Google (refresh token),
     Facebook Lead Ads, e a sessão das conexões MCP. Esses se reconectam na tela, e está certo.

3. **Registro de auditoria**: cada leitura com `include=secrets` grava quem leu, qual chave e qual
   recurso. É leitura de segredo em massa; a conta precisa conseguir ver que aconteceu.

4. **Testes** no inventário (`docs/testing/behaviors/api-configuracao.md`):
   - `*:*` sem `secrets:read` não lê segredo (403);
   - com `secrets:read`, o corpo do GET volta pelo POST e a integração/intenção/automação nova fica
     com o mesmo segredo (ida e volta);
   - usuário comum, 403; outra conta, 404;
   - o que nasce de login nunca sai, nem com a permissão.

## O que a skill faz com isso (já implementado, contra o Cubo de mentira)

- A conferência de acesso exige `secrets:read` na chave da conta antiga **quando** a escolha tem
  integrações, automações, agentes (intents) ou credenciais OAuth. Sem ela, ✘ com o caminho na tela.
- O plano lê esses detalhes com `?include=refs,secrets`.
- Os segredos vão no POST da conta nova, como vieram. A tarefa manual ("preencher os cabeçalhos",
  "digitar o client secret") só aparece para o que não veio.
- Os segredos ficam na pasta `migracao/` de quem roda (a mesma das chaves), que o relatório manda
  apagar no fim. Nunca aparecem na conversa nem no relatório.
