# Investigar teste no Cubo

Você testou uma automação ou um agente de IA e algo deu errado: não respondeu, respondeu errado,
parou no meio ou passou para uma pessoa sem motivo. A skill lê a conversa do teste pela API, **sem
você mandar print nem contar o que aconteceu**, monta a linha do tempo (o que o contato disse, o que o
robô respondeu, quando o robô começou e terminou, se transferiu) e cruza com o fluxo e com o prompt
do agente para achar a causa. No fim, mostra a correção e, se você quiser, corrige com
`/cubo:editar-fluxo` e `/cubo:editar-agente`, sempre com prévia antes de gravar.

Não muda nada na conta. A API do Cubo ainda não mostra a execução por dentro (por onde o fluxo passou,
o que o agente decidiu): a skill diz o que é certeza (está na conversa) e o que é dedução.

> **Atenção:** estas skills ajudam a criar, editar e entender fluxos e agentes, mas não substituem a
> revisão humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou
> alterados com elas. Revise e teste tudo antes de publicar ou ligar.

## Antes de usar

| O quê | Como conseguir |
| --- | --- |
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Chave de API do Cubo** | no Cubo, com um administrador: **Configurações → Chaves de API → Nova chave**. Leitura em tudo, **inclusive Conversas**. |

A chave fica em `.cubo.env`, na pasta onde você abriu o Claude Code, e serve para todas as skills do
Cubo nessa pasta.

## Instalar

As skills vêm no plugin `cubo`:

```
/plugin marketplace add capoia/cubo-skills
/plugin install cubo@cubo-skills
```

e reinicie o Claude Code. Para atualizar: `claude plugin marketplace update cubo-skills` +
`claude plugin update cubo@cubo-skills` e reinicie.

## Usar

```
/cubo:investigar-teste canal 1, testei agora e o agente não respondeu
```

Também dispara sozinha quando você diz "testei e não funcionou".
