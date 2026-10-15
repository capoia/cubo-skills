# Skills de fluxo e agente — plano de implementação

> Spec: `docs/superpowers/specs/2026-10-15-skills-fluxo-agente-design.md`. Execução nativa, nesta sessão,
> por pedido do Wellington ("implantar todas as skills e testar localmente"). Cada tarefa termina com
> o caso na fumaça `testes/fluxo-agente.mjs` verde e um commit.

**Objetivo:** seis skills (`explicar-`, `criar-` e `editar-` × `fluxo` e `agente`) sobre um motor
compartilhado em `plugins/cubo/motor/`, só Node 20.9+, sem dependência.

## Restrições globais

- Só Node 20.9+; nada de shell, `curl`, dependência. Windows, macOS, Linux.
- Texto em pt-BR; identificador em inglês ou pt conforme o padrão da migração (`api`, `falha`, `pasta`…).
- A chave nunca passa pela conversa (`cubo/.cubo.env`, aberto no editor).
- O Claude nunca chama a API à mão: só pelos scripts do motor.
- Skills que escrevem: `disable-model-invocation: true`.
- `SKILL.md` curto; detalhe em `references/`; `<motor>` nas referências.
- `import()` de caminho absoluto com `pathToFileURL`.
- Nada de prettier.

## Arquivos

```
plugins/cubo/motor/
  lib.mjs          pasta cubo/, argumentos, JSON, abrir no sistema, ler @arquivo
  api.mjs          acesso (.cubo.env), cliente (ETag, If-Match, 304, 412, 422, 429), todos(), detalhe()
  acesso.mjs       CLI: abrir · conferir --para=<skill> [--simular]
  catalogo.mjs     cache com If-None-Match; CLI: resumo · no · gatilho · chip
  nomes.mjs        refs → nomes da conta ("Proposta (funil Vendas)")
  usos.mjs         varredura: quem usa o agente, quem chama o fluxo
  buscar.mjs       CLI: acha itens da conta pelo nome (sem acento/maiúscula)
  itens.mjs        tabela do que se cria pela API + criar com reuso (cubo/criados.json); CLI
  copias.mjs       guardar/listar/pegar cópias de segurança
  pagina.mjs       HTML único (CSS + SVG dentro) da explicação
  desenho.mjs      SVG do fluxo (posições do editor ou camadas)
  fluxo/
    modelo.mjs     saídas efetivas do nó (when, handlesFrom, ocupada), arestas, terminais
    descrever.mjs  fluxo + catálogo + nomes → passos ordenados, gatilhos, roteiro em texto
    armadilhas.mjs as armadilhas que a validação não pega
    caminhos.mjs   3 a 5 percursos do desenho
    mudancas.mjs   aplica a lista de mudanças (pôr, tirar, configurar, ligar, desligar, gatilho)
    explicar.mjs   CLI: preparar <id|nome> · pagina <id>
    editar.mjs     CLI: ler · previa · gravar · publicar · ligar · desfazer
    criar.mjs      CLI: previa · gravar
  agente/
    chips.mjs      lê e descreve os chips do prompt
    explicar.mjs   CLI: preparar · pagina
    simular.mjs    CLI: <id> @situacoes.json
    editar.mjs     CLI: ler · previa · gravar · desfazer
    criar.mjs      CLI: modelos · previa · gravar
plugins/cubo/skills/{explicar,criar,editar}-{fluxo,agente}/SKILL.md, README.md, references/
testes/fluxo-agente.mjs   Cubo de mentira + casos
```

## Tarefas

1. **Base do motor** (`lib`, `api`, `acesso`) + esqueleto da fumaça + CI. Casos: sem acesso ensina a
   abrir; `conferir --para` acusa permissão e módulo que faltam; 429 espera; 412 explica.
2. **Catálogo** com cache. Casos: 2ª leitura manda `If-None-Match` e usa o 304; agentes por conta.
3. **Nomes e usos.** Casos: etapa vira "Proposta (funil Vendas)"; sem permissão vira "#id" + aviso;
   quem usa o agente (canal, automação, outro agente); quem chama o fluxo.
4. **Fluxo: modelo, descrever, armadilhas, caminhos.** Casos: saídas com `when`/`handlesFrom`;
   ordem a partir dos gatilhos; cada armadilha acusada; órfão; caminhos param no terminal.
5. **Página e desenho.** Caso: HTML sem nenhuma URL externa, com SVG e todos os passos.
6. **explicar-fluxo** (CLI + skill). Casos: por nome ambíguo sai 3 com a lista; publicado com
   rascunho diferente aponta a diferença; validação junta com armadilhas.
7. **Agente: chips, explicar, simular** (CLI + skill). Casos: chip vira frase com nomes; validação +
   usos; simulação roda uma por vez e guarda custo; 429 da simulação espera.
8. **Itens que faltam** (`buscar`, `itens`). Casos: parecido vira pergunta; cria uma vez só e reusa
   do `criados.json`; recusa tipo sem API com o caminho na tela.
9. **editar-fluxo.** Casos: lista de mudanças preserva o resto; prévia com antes → depois; 412 relê e
   reaplica; publicar e ligar; desfazer volta à cópia.
10. **criar-fluxo.** Casos: fluxo do zero com layout; nasce rascunho desligado.
11. **editar-agente e criar-agente.** Casos: corpo sem campos removidos; 412 não regrava; desfazer;
    criar com `enabledTools: []`.
12. **Docs e versão:** `CLAUDE.md` (regra do motor), `README.md`, manifestos 4.2.0,
    `claude plugin validate`, `claude plugin details cubo`, rodada contra CRM local.
