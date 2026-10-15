# Editar fluxo do Cubo

Muda uma automação do Cubo pela conversa: pôr, tirar, ligar e configurar passos e gatilhos. Guarda uma cópia de segurança, mostra a prévia antes de gravar e só mexe no **rascunho**: o que está no ar só muda quando você publicar. Publicar e ligar são perguntas à parte. Tag, etapa, campo e o que mais faltar e tiver API, a skill cria (com a sua confirmação); o resto, ela explica como fazer na tela.

Para voltar atrás: a skill desfaz com um comando (rascunho, publicado e ligado/desligado voltam ao da cópia).

> **Atenção:** estas skills ajudam a criar, editar e entender fluxos e agentes, mas não substituem a
> revisão humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou
> alterados com elas. Revise e teste tudo antes de publicar ou ligar.

## Antes de usar

| O quê | Como conseguir |
| --- | --- |
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Chave de API do Cubo** | no Cubo, com um administrador: **Configurações → Chaves de API → Nova chave**. Leitura, criação e edição em tudo. |

Não há mais nada para instalar. A chave fica em `.cubo.env`, na pasta onde você abriu o Claude Code
(o mesmo arquivo da skill de landing page), e serve para todas as skills do Cubo nessa pasta.

## Instalar

As skills vêm no plugin `cubo`:

```
/plugin marketplace add capoia/cubo-skills
/plugin install cubo@cubo-skills
```

e reinicie o Claude Code. Para atualizar: `claude plugin marketplace update cubo-skills` +
`claude plugin update cubo@cubo-skills` e reinicie.

## Usar

Abra o Claude Code numa pasta (é onde a skill guarda a chave, as cópias e as páginas) e digite:

```
/cubo:editar-fluxo 42
```

Só roda quando você chama pelo comando.

As outras skills de fluxo e agente: `/cubo:explicar-fluxo`, `/cubo:explicar-agente`,
`/cubo:criar-fluxo`, `/cubo:criar-agente`, `/cubo:editar-fluxo`, `/cubo:editar-agente`.
