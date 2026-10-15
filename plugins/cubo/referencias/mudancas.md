# Lista de mudanças do fluxo

Você **nunca** escreve o fluxo inteiro. Escreve a lista do que muda num arquivo `.json` e passa com
`@arquivo`. O motor aplica numa cópia, preserva o que não foi tocado, posiciona os nós novos no
desenho e diz em português o que fez.

## Antes de escrever

1. `node "<motor>/catalogo.mjs" resumo`: os nós e gatilhos que existem.
2. `node "<motor>/catalogo.mjs" no <tipo>` para **cada** nó que vai usar: o `configSchema` diz os
   campos (`required` é o que o passo precisa), `defaults` é o que já vem, `outputs` são as saídas,
   `example` é um nó pronto. Para gatilho: `catalogo.mjs gatilho <tipo>`.
3. `node "<motor>/catalogo.mjs" regras --so=variables` antes de usar `{{variável}}` em mensagem.
4. Número de etapa, tag, agente, template…: **nunca invente**. Ache com
   `node "<motor>/itens.mjs" buscar <tipo> [nome]`. O que não existir, veja [itens.md](itens.md).

IDs no `triggerConfig` vão como **número** (`"pipeIds": [30]`, não `["30"]`).

## As operações

| Operação | Campos | O que faz |
| --- | --- | --- |
| `por` | `tipo`, `id`?, `titulo`?, `dados`? | põe um nó solto (ligue depois) |
| `inserir` | `tipo`, `id`?, `titulo`?, `dados`?, `depoisDe`, `saida`? | põe no meio: `depoisDe` —saída→ novo → quem vinha depois |
| `tirar` | `no`, `religar`? | tira o nó e as ligações dele; `religar: true` liga quem chegava nele ao seguinte |
| `configurar` | `no`, `dados`?, `titulo`? | junta no `data` do nó; `null` apaga a chave |
| `ligar` | `de`, `saida`?, `para` | liga uma saída a um nó |
| `desligar` | `de`, `saida`?, `para`? | tira ligações |
| `gatilho` | `acao` (`por`/`tirar`/`configurar`), `tipo`?, `id`?, `config`? | mexe nos gatilhos do início |
| `renomear` | `nome` | muda o nome do fluxo |

- `no`, `de`, `para`, `depoisDe`: o **id** do nó (o roteiro mostra) ou o **título** exato.
- `saida`: o handle (`yes`, `no`, `timeout`, o `targetHandle` da opção do menu, o `id` do caso do
  switch) ou o rótulo ("Sim", "Sem resposta"). Vazio é a saída comum ("Seguir"). Se errar, o motor
  diz quais saídas o nó tem.
- O nó do início tem id `start`.
- `goto_node` e `start_flow` terminam o caminho: não ligue nada saindo deles.

## Exemplo

```json
[
  { "op": "gatilho", "acao": "por", "tipo": "deal_created", "config": { "pipeIds": [30] } },
  { "op": "por", "id": "boas-vindas", "tipo": "send_message", "titulo": "Boas-vindas", "dados": { "message": "Oi, {{people.name}}!" } },
  { "op": "ligar", "de": "start", "para": "boas-vindas" },
  { "op": "inserir", "tipo": "tag_conversation", "titulo": "Marca quente", "dados": { "tagIds": [40] }, "depoisDe": "Quer proposta?", "saida": "Sim" }
]
```

## Quando a prévia acusa

- **"NÃO DÁ PARA GRAVAR"**: erro que o Cubo recusa (ID de outra conta, formato). Corrija a lista.
- **"dá para GRAVAR, mas NÃO para PUBLICAR"**: o rascunho pode ser salvo, mas não vai ao ar até
  corrigir. Diga isso à pessoa antes de perguntar se grava.
- **Armadilhas** (as do motor, com "O que fazer"): não são recusadas pelo Cubo, mas mudam o
  resultado. Corrija as que você mesmo criou; as que já estavam, mostre à pessoa.
- Depois de 3 voltas sem acertar, pare e mostre o problema à pessoa.
