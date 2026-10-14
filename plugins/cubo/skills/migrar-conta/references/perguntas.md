# As perguntas da migração

O `decidir.mjs listar` mostra cada pergunta com um código entre colchetes, por exemplo
`[usuario:11]`. Faça cada uma pela pergunta clicável e grave a resposta com o comando da tabela.
Faça até 4 perguntas por vez.

| Tipo | Opções para mostrar | Grava com |
| --- | --- | --- |
| `usuario:<nº>` | até 3 usuários da conta nova (os de nome mais parecido) + "O dono da chave da conta nova". Pelo "Outro", a pessoa digita outro nome; ache o número no `listar` | `decidir.mjs usuario <nº> <nºNovo|dono>` |
| `existente:<área:nº>` | Usar o que já existe (recomendado) · Criar outro igual · Pular | `decidir.mjs existente <área:nº> usar|criar|pular` |
| `dominio:<nº>` | Usar outro domínio na conta nova (recomendado) · Usar o mesmo (você exclui na conta antiga) · Pular | `decidir.mjs dominio <nº> outro:<domínio>|trocar|pular` |
| `mcp:<nº>` | Vou conectar na conta nova (aí rode o `plano` de novo) · Seguir sem ela | `decidir.mjs mcp <nº> remover` (só no "seguir sem") |
| `chave-formulario` | não é clicável: peça a chave separada do formulário, como em [acesso.md](acesso.md) | `conta.mjs conferir-formulario` |

## Muitos itens que já existem

Com mais de 4 perguntas `existente`, pergunte antes: "N itens já existem na conta nova com o mesmo
nome. Quer a mesma resposta para todos?". As opções são "Usar os que já existem em todos
(recomendado)", "Responder um por um" e "Criar outro igual em todos". Para todos de uma vez:
`decidir.mjs existentes-todos usar`. Isso vale também para os que aparecerem durante o `aplicar`.

## Explicando cada uma

- **Usuário**: "Na conta antiga, a Bia é responsável por funis e filtros. Ela não tem usuário na
  conta nova. Quem fica no lugar dela?". Usuário não se cria pela migração: se a pessoa quiser a Bia
  na conta nova, ela precisa ser cadastrada no Cubo antes, e aí o `plano` roda de novo.
- **Já existe**: "Usar o que já existe" liga tudo ao item da conta nova sem mexer nele. "Criar outro"
  cria uma cópia; onde o Cubo exige nome único, a cópia ganha um nome livre, e o relatório diz qual.
  Diga isso ao perguntar:
  - " (migrado)" no fim do nome: categorias, produtos, motivos, etapas, campos, formulários,
    agentes, bases, pastas e filtros (" (migrado 2)" se já houver);
  - "_migrado" no fim: intents e templates, cujo nome é um identificador;
  - "-migrado" no fim do endereço: landing page no mesmo domínio e endereço.

  Não vira pergunta: campo de cidade ou de estado (a conta só pode ter um de cada, então a cópia usa
  o que já existe) e dois itens da conta antiga com o mesmo nome (cada um ganha a sua cópia).
- **Domínio**: o mesmo domínio não pode estar nas duas contas. "Tirar da conta antiga" deixa as
  páginas dele fora do ar até a conta nova verificar o domínio, e quem tira é a pessoa, na tela
  (Configurações → Domínios), porque a migração não altera a conta antiga. "Outro domínio" é mais
  seguro: a pessoa troca depois.
- **MCP**: a conexão nasce de um login, então não dá para copiar. Se a pessoa conectar na conta nova
  com o mesmo nome e rodar o `plano` de novo, a ligação é feita sozinha.
