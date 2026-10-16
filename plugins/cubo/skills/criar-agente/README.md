# Criar agente no Cubo

Cria um agente de IA novo no Cubo a partir de uma entrevista: para que serve, o tom, o que ele pode fazer, quando passa para uma pessoa, lembretes e modelo. Mostra a prévia antes de criar e roda conversas de teste (simulação, com a sua confirmação). O agente nasce **sem ninguém usando**: liga-se a um canal ou fluxo depois.

A API do Cubo não apaga agente: se desistir, é pela tela.

> **Atenção:** estas skills ajudam a criar, editar e entender fluxos e agentes, mas não substituem a
> revisão humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou
> alterados com elas. Revise e teste tudo antes de publicar ou ligar.

## Antes de usar

| O quê | Como conseguir |
| --- | --- |
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Chave de API do Cubo** | no Cubo, com um administrador: **Configurações → Chaves de API → Nova chave**. Chave de **administrador**: leitura, criação e edição em tudo, e **"Agentes de IA: simular"** para os testes. A conta precisa do módulo Agentes de IA e de uma integração de IA (OpenAI, Google AI ou OpenRouter). |

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
/cubo:criar-agente
```

Também dispara sozinha quando você pede ("cria um agente que…"), e nada é gravado sem a sua confirmação.

As outras skills de fluxo e agente: `/cubo:explicar-fluxo`, `/cubo:explicar-agente`,
`/cubo:criar-fluxo`, `/cubo:criar-agente`, `/cubo:editar-fluxo`, `/cubo:editar-agente`.
