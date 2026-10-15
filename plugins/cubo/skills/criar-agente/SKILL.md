---
name: criar-agente
description: Cria um agente de IA novo no Cubo a partir de uma entrevista — para que serve, tom, ferramentas (chips), lembretes, modelo — com prévia antes de criar e conversas de teste (simulação). Nasce sem ninguém usando. Cria pela API as tags, etapas e intents que faltarem.
disable-model-invocation: true
---

# Criar agente no Cubo

Você monta um agente de IA novo com a pessoa. Quem pede quase nunca é técnico.

Os scripts do motor ficam em:

```
${CLAUDE_PLUGIN_ROOT}/motor
```

Nas referências esse caminho aparece como `<motor>`. **Escreva-o por inteiro em todo comando.**

## Comece pelo aviso (copie para a pessoa)

> **Atenção:** esta skill ajuda a criar, editar e entender fluxos e agentes, mas não substitui a
> revisão humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou
> alterados com ela. Revise e teste tudo antes de publicar ou ligar.

## Regras

1. **Use sempre os scripts.** Nunca chame a API à mão.
2. **A chave nunca passa pela conversa** ([acesso](${CLAUDE_PLUGIN_ROOT}/referencias/acesso.md)).
   Agente só se cria com chave de **administrador**.
3. **Chips só do catálogo, números só da conta** ([chips.md](${CLAUDE_PLUGIN_ROOT}/referencias/chips.md),
   [itens.md](${CLAUDE_PLUGIN_ROOT}/referencias/itens.md)).
4. **Toda pergunta com opções é clicável**, até 4 por vez.
5. **Pergunte antes de criar** (com o aviso). **Simulação gasta tokens: pergunte antes.**

## Passos

1. **Acesso.** `node "<motor>/acesso.mjs" conferir --para=criar-agente`.
2. **Entrevista** (clicável): para que serve o agente; o tom; o que ele pode fazer (cada resposta
   vira um chip: mostre as opções de `catalogo.mjs resumo agentes`); quando passa para uma pessoa; se
   cobra resposta (lembretes) e o que fazer quando eles acabam.
3. **Modelo.** `node "<motor>/agente/criar.mjs" modelos`. Recomende um que use ferramentas.
4. **Escrever o prompt** num arquivo ([chips.md](${CLAUDE_PLUGIN_ROOT}/referencias/chips.md)) e,
   se houver lembretes, a configuração num JSON (`{ "followUpConfig": … }`). Itens que faltam: plano
   com `--so-plano`.
5. **Prévia.** `node "<motor>/agente/criar.mjs" previa --nome="<nome>" --integracao=<id> --modelo=<id> --prompt=@<arquivo> [--config=@<arquivo>]`.
   Corrija o que ela acusar (até 3 voltas).
6. **Confirmar** com a página da prévia: "Posso criar?".
7. **Criar.** Itens primeiro, depois `criar.mjs gravar`. O agente nasce **sem ninguém usando**.
8. **Testar** (pergunte, com custo): [simulacao.md](${CLAUDE_PLUGIN_ROOT}/referencias/simulacao.md).
   Não gostou: `/cubo:editar-agente`.
9. **Fechar.** O número do agente e como ligá-lo: num canal (Canais → o canal → Agente padrão) ou
   num fluxo (passo "Chamar agente", com `/cubo:editar-fluxo`). A API não apaga agente: desistindo,
   é na tela.
