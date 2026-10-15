# Conversas de exemplo (simulação do agente)

O Cubo roda o agente **como está gravado** numa conversa de mentira. **Gasta tokens** da integração
de IA da conta (uns centavos por fala). Ferramenta que escreve só simula (nada muda na conta); a que
lê, lê de verdade. Ferramentas que dependem de uma conversa real (passar para humano, mandar arquivo)
falham, e os lembretes não aparecem.

## Antes: pergunte (clicável)

> Posso rodar 4 conversas de exemplo com o agente? Cada fala do cliente gasta tokens da sua
> integração de IA (uns centavos cada). Nada muda na sua conta.

Opções: "Sim, rodar (recomendado)" · "Não precisa". Só rode com sim. Confira antes a permissão:
`acesso.mjs conferir --para=<skill> --simular`.

## Montar as situações

De 3 a 5, a partir do prompt:

- 2 ou 3 do caminho principal (o que o prompt mais espera);
- **1 fora do roteiro** (pergunta que o prompt não cobre, ou pedido que ele deveria recusar);
- na **edição**: as situações que testam **o que mudou**, mais **1 do que não deveria mudar**.

Cada situação tem até 6 falas do cliente, escritas como um cliente de verdade escreveria:

```json
[
  { "titulo": "Pede proposta", "objetivo": "deve mover para Proposta", "mensagens": ["Oi", "Quero uma proposta do plano Pro"] },
  { "titulo": "Fora do roteiro", "objetivo": "deve dizer que não sabe e oferecer uma pessoa", "mensagens": ["Vocês vendem pizza?"] }
]
```

```
node "<motor>/agente/simular.mjs" <id> @situacoes.json
```

Ele espera sozinho no limite de 10 por minuto e guarda tudo em
`cubo/explicacoes/agente-<id>.exemplos.json`, que a página usa.

## Depois

Para cada situação, diga em uma frase se o agente fez o que o `objetivo` pedia. Não esconda resposta
ruim: é para isso que o exemplo existe. Diga o custo total que o script imprimiu.
