# Quando algo não sai como esperado

Nada se perde: o ledger (`migracao/ledger.json`) guarda cada item criado e o par de números
antigo→novo. Rodar o `aplicar.mjs` de novo **continua de onde parou e não duplica**. Se a conversa
cair, o `status.mjs` diz onde parou.

## Itens com ✘ (erro)

O motivo vem escrito. Os mais comuns:

- **"recusou os dados (422): … não pertence a esta conta"**: algum número não foi trocado. Isso não
  devia acontecer. Não tente contornar: mostre à pessoa e anote o item. Em geral, é tipo novo de
  configuração que o Cubo ainda não informa nos `refs`.
- **"recusou os dados (422): já existe / nome em uso"**: com "criar outro igual", a skill já põe
  " (migrado)" no fim do nome onde o Cubo exige nome único. Se ainda assim deu nome repetido (já
  existe um "(migrado)" de uma rodada anterior), pergunte de novo, com "usar" ou "pular"
  (`decidir.mjs existente <área:nº> usar`), e rode o `aplicar` de novo.
- **"tem N caracteres, e a conta nova aceita até 200.000"**: base de conhecimento grande demais
  para a conta nova. A pessoa divide em duas na conta antiga, e o `plano` roda de novo.
- **"espaço de arquivos da conta nova acabou (413)"**: o aplicar para. A pessoa libera espaço ou
  aumenta o plano da conta nova, e roda de novo.
- **"a conta nova pediu para ir mais devagar (429)"**: o Cubo aceita 240 escritas por minuto por
  chave. A skill já espera e repete sozinha; se mesmo assim aparecer, espere um minuto e rode de novo.
- **"sem par na conta nova para: …"**: o item usa algo que ficou sem correspondente. Normalmente é
  uma conexão MCP sem decisão, ou um formulário que deu erro antes. Resolva o item de cima e rode de
  novo.
- **"respondeu 500"**: falha do Cubo. Espere um pouco e rode de novo.

## Itens ⏳ (aguardando)

Esperam algo que só a pessoa pode fazer, ou outro item ficar pronto:

- **Canal**: o canal só nasce depois que a integração dele (WhatsApp, Instagram…) estiver conectada
  na conta nova. Pode ficar para depois: está no relatório. Quando a pessoa conectar, rode o
  `aplicar` de novo.
- **Domínio "tirar da conta antiga"**: a pessoa precisa excluir o domínio na conta antiga
  (Configurações → Domínios). O Cubo só deixa excluir domínio que nenhuma página ou formulário usa,
  **contando a lixeira**: antes, ela tira essas páginas do domínio (ou exclui e esvazia a lixeira).
  Depois, rode o `aplicar` de novo. As landing pages desse domínio esperam junto.
- **"espera X ficar pronto"**: resolva o X.

## A conferência acusou problemas

- **"é o número da CONTA ANTIGA, não foi trocado"**: a ligação continua apontando para a conta
  antiga. Não ligue a automação ou o agente desse item. Mostre a lista à pessoa. É defeito a
  corrigir (no Cubo ou na skill), não algo que a pessoa resolva.
- **"chegou CORTADO"**: o Cubo guardou o texto pela metade (prompt de agente, base de conhecimento,
  HTML). Diga quantos caracteres faltaram. A pessoa pode colar o texto completo na tela; o original
  está em `migracao/origem/<área>.json`.
- **"ainda usa um arquivo guardado na conta antiga"**: é aviso, não erro. A imagem funciona, mas
  depende da conta antiga continuar existindo.
- **Arquivo que "não pôde ser copiado"** (nome com acento, extensão que a pasta não aceita, mais de
  20 MB, apagado): ficou de fora do item, e está nas tarefas do relatório. A pessoa sobe de novo na
  tela.

## Nunca

- Não crie nem altere item pela API à mão para "consertar": o ledger perde o controle e a próxima
  rodada duplica.
- Não edite o `ledger.json`.
- Não diga que a migração terminou com a conferência acusando problema.
