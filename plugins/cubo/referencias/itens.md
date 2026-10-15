# Itens que faltam

Regra: **o que tem API, a skill cria; o que não tem, a skill ensina a fazer na tela.**

```
node "<motor>/itens.mjs" tipos                      o que se cria pela API e o que é na tela
node "<motor>/itens.mjs" buscar <tipo> [nome]       achar o número de um item
node "<motor>/itens.mjs" criar @itens.json --so-plano
node "<motor>/itens.mjs" criar @itens.json [--criar-mesmo=2,3]
node "<motor>/itens.mjs" listar-criados
```

## Como fazer

1. Monte a lista do que o fluxo ou agente usa e não existe:

   ```json
   [
     { "tipo": "funil", "nome": "Pós-venda" },
     { "tipo": "etapa", "nome": "Boas-vindas", "funil": "Pós-venda" },
     { "tipo": "tag", "nome": "Cliente novo" },
     { "tipo": "campo", "nome": "Plano", "campos": { "context": "deal", "type": "selectbox", "options": ["Básico", "Pro"] } }
   ]
   ```

   `campos` leva o resto do corpo que a API pede (veja os tipos abaixo).
2. Rode com `--so-plano`. Ele não cria nada e diz, item a item:
   - **USAR**: já existe com esse nome (sem diferenciar maiúscula e acento);
   - **PERGUNTAR**: há um parecido ("Proposta enviada" para "Proposta"). Pergunte à pessoa pelas
     opções clicáveis: "usar o que existe" (troque o nome na lista pelo nome exato) ou "criar outro"
     (rode com `--criar-mesmo=<nºs>`). **Nunca crie parecido sem perguntar**;
   - **CRIAR**: vai criar;
   - **NA TELA**: não tem API; repasse o texto pronto à pessoa.
3. Mostre o que vai ser criado **na mesma confirmação** do "Posso gravar?": "vou criar também: a tag
   *Cliente novo* e a etapa *Boas-vindas* no funil *Pós-venda*".
4. Com o sim, rode sem `--so-plano`. Ele cria antes do fluxo ou agente e anota em `cubo/criados.json`:
   rodar de novo usa o que já foi criado, sem duplicar. Use os números que ele imprimir.
5. Repasse as **pendências** (template de WhatsApp precisa da aprovação da Meta; intent nasce
   desligada).

## Tipos

| Tipo | Exige (em `campos`) |
| --- | --- |
| `tag` | — (a cor vem padrão; `color` muda) |
| `funil` · `etapa` | etapa: `funil` (nome ou número). Os dois só com chave de administrador |
| `campo` | `context` (`deal`, `people`, `organization`; padrão `deal`), `type` (`text`, `number`, `selectbox`, `datetime`, `city`, `state`); `options` no `selectbox` |
| `produto` · `categoria` · `departamento` | — |
| `motivo-perda` · `motivo-resolucao` · `motivo-transferencia` · `motivo-pausa` | — |
| `template` | `type` `whatsapp` (nome em minúsculas e `_`, e `components: { header: { type: "none" }, body: { text } , footer: {} }`) ou `email` (`subject` e `body`) |
| `trilha` | `items`: `[{ title, type, delayMinutes, order }]` |
| `base` | `content` (o texto); só com chave de administrador |
| `intent` | `name` (minúsculas e `_`), `description`, `whenToUse`, `method`, `url`, `inputSchema`. Nasce desligada |
| `pasta-automacoes` · `pasta-agentes` | — |

**Na tela**: usuário, conectar canal, login de integração e de credencial OAuth, MCP, aprovação da
Meta. **Agente ou fluxo que falta no meio de outro** também não nasce de passagem: pause, sugira
`/cubo:criar-agente` ou `/cubo:criar-fluxo`, e retome depois.

## Desfazer não apaga

A API não apaga tag, funil, etapa, campo nem intent. O `desfazer` volta o fluxo ou agente, e os itens
criados ficam (item que ninguém usa não muda nada). `listar-criados` mostra quais são, para a pessoa
apagar na tela se quiser.
