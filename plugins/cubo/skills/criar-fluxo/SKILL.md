---
name: criar-fluxo
description: Cria uma automação (fluxo) nova no Cubo a partir de uma entrevista — gatilho, passos, mensagens, condições — com prévia antes de criar. Nasce rascunho e desligada; publicar e ligar são perguntas à parte. Cria pela API as tags, etapas e campos que faltarem. Use quando pedirem para criar ou montar uma automação ou fluxo no Cubo. Pergunta antes de criar.
---

# Criar fluxo no Cubo

Você monta uma automação nova com a pessoa. Quem pede quase nunca é técnico.

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

1. **Use sempre os scripts.** Nunca chame a API à mão, nunca escreva o fluxo inteiro: só a **lista
   de mudanças** a partir do vazio ([mudancas.md](${CLAUDE_PLUGIN_ROOT}/referencias/mudancas.md)).
2. **A chave nunca passa pela conversa** ([acesso](${CLAUDE_PLUGIN_ROOT}/referencias/acesso.md)).
3. **Nenhum número inventado.** Item que falta: [itens.md](${CLAUDE_PLUGIN_ROOT}/referencias/itens.md).
4. **Toda pergunta com opções é clicável**, até 4 por vez.
5. **Pergunte antes de criar, de publicar e de ligar**, separados, com "Agora não" recomendado em
   publicar e ligar, e o aviso de responsabilidade junto.

## Passos

1. **Node e acesso.** `node --version` (sem Node, ou abaixo da 20.9: siga “O Node” em
   [acesso.md](${CLAUDE_PLUGIN_ROOT}/referencias/acesso.md), que instala junto com a pessoa). Depois
   `node "<motor>/acesso.mjs" conferir --para=criar-fluxo`.
2. **Entrevista curta** (clicável): o que faz o fluxo começar (veja os gatilhos em
   `catalogo.mjs resumo`), o que deve acontecer, onde termina. Pergunte o texto das mensagens se a
   pessoa tiver; senão, proponha e mostre.
3. **Montar** a lista com o catálogo (`catalogo.mjs no <tipo>` de cada nó) e o plano dos itens que
   faltam (`itens.mjs criar … --so-plano`).
4. **Prévia.** `node "<motor>/fluxo/criar.mjs" previa @mudancas.json --nome="<nome>"`. Corrija o que
   ela acusar (até 3 voltas).
5. **Confirmar** com a página da prévia, os itens que vão ser criados e os problemas: "Posso criar?".
6. **Criar.** Itens primeiro (`itens.mjs criar`), depois `node "<motor>/fluxo/criar.mjs" gravar`.
   O fluxo nasce **rascunho e desligado**: nada roda ainda.
7. **Publicar?** e **Ligar?** (clicáveis, "Agora não" recomendado):
   `node "<motor>/fluxo/editar.mjs" publicar <id>` · `… ligar <id>`.
8. **Fechar.** O número do fluxo, o que ficou para a pessoa fazer e o caminho no Cubo
   (Automações) para revisar antes de ligar.
