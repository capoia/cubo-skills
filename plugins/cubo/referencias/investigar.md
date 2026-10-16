# Investigar um teste

O `conversa.mjs linha` dá a linha do tempo e os sintomas. Aqui está, para cada sintoma, o que
costuma causá-lo e como confirmar. Quem fala na linha do tempo:

- **contato**: quem testou;
- **robô**: a automação ou o agente; a API não diz qual dos dois, mas o que vem depois de "Qualquer
  dúvida…" e com o fluxo já em outro passo costuma ser o agente;
- **pessoa (Nome)**: alguém da equipe, pela tela;
- **sistema**: "Bot X iniciado", "finalizado" (terminou certo), "**encerrado**" (falhou ou foi
  cancelado), "Transferido para atendimento humano. Resumo: …", "Conversa devolvida ao bot".

## Sintomas

### `robo_parou`: o robô terminou como "encerrado"

A execução falhou ou foi cancelada. O passo que falhou é o que vem **depois** da última mensagem do
robô.

- Rode o `explicar-fluxo preparar` e procure o erro `campo_null` nesse passo: um texto opcional
  apagado no editor vira `null`, e o Cubo recusa (com "Configuração inválida do nó …"). A correção é
  tirar o campo com `/cubo:editar-fluxo` (configurar o campo com `null` tira a chave).
- Agente apontando para algo que não existe (`ref_inexistente`), integração de IA desligada (no
  `explicar-agente`).
- Alguém assumiu a conversa no meio ("Conversa assumida por atendimento humano"): não é erro.

### `transferiu`: passou para uma pessoa

Leia o **resumo** que o robô deixou e a **última fala do contato** antes. Compare com a seção "Quando
passar para uma pessoa" do prompt.

- **Agente chamado sem pergunta** (aviso `agente_sem_pergunta` no fluxo): o fluxo manda uma
  mensagem e chama o agente na hora. O agente responde ao histórico; se a última fala do contato foi um
  pedido que o fluxo já atendeu (mandar um PDF), ele acha que falta e transfere. Correção: trocar a
  mensagem de antes do agente por "Fazer pergunta" (espera a resposta) e dizer no prompt o que o fluxo
  já fez ("o PDF já foi enviado nesta conversa; nunca diga que vai enviar").
- O prompt manda transferir num caso largo demais ("pergunta que a proposta não responde"): estreitar.

### `sem_resposta`: a fala do contato ficou sem resposta

- **"nenhum robô estava rodando nem começou depois"**: o gatilho não casou (a frase, o canal, o
  "só uma vez por contato"), ou a conversa estava com uma pessoa (`com_pessoa`): o robô não entra
  enquanto ninguém devolver ao bot.
- Logo depois de um `robo_parou`: é o mesmo erro; o agente nunca entrou.
- O fluxo terminou e o agente não ficou na conversa: confira `conversationalMode` do agente (o
  `explicar-agente` mostra) e se o fluxo chamou o agente de fato.

### `com_pessoa`: a conversa está esperando ou com uma pessoa

Robô e agente não respondem. Para testar de novo, a pessoa devolve a conversa ao bot na tela, ou
manda a palavra que reinicia.

### `resposta_sem_robo`

Resposta do robô sem fluxo aberto: é o agente que ficou na conversa (modo conversacional). Se a
resposta foi ruim, a causa está no prompt ou na base de conhecimento; o `/cubo:explicar-agente` com
simulação reproduz a conversa.

## O que a API ainda não mostra

A execução passo a passo da automação (por onde passou, o erro de cada passo) e o que o agente recebeu
e decidiu (histórico, ferramentas chamadas). Por isso a causa é deduzida da linha do tempo. Diga isso
à pessoa, e diga qual parte é certeza (está na linha do tempo) e qual é dedução.
