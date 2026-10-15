# Editar agente do Cubo

Muda um agente de IA do Cubo pela conversa: prompt, ferramentas (chips), modelo e lembretes. Guarda uma cópia de segurança, mostra o antes → depois e onde o agente é usado, e roda conversas de teste (simulação, com a sua confirmação).

**Agente não tem rascunho no Cubo: o que for gravado vale na hora.** Por isso a skill pergunta antes e desfaz com um comando.

> **Atenção:** estas skills ajudam a criar, editar e entender fluxos e agentes, mas não substituem a
> revisão humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou
> alterados com elas. Revise e teste tudo antes de publicar ou ligar.

## Antes de usar

| O quê | Como conseguir |
| --- | --- |
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Chave de API do Cubo** | no Cubo, com um administrador: **Configurações → Chaves de API → Nova chave**. Chave de **administrador**: leitura, criação e edição em tudo, e **"Agentes de IA: simular"** para os testes. A conta precisa do módulo Agentes de IA. |

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
/cubo:editar-agente SDR
```

Só roda quando você chama pelo comando.

As outras skills de fluxo e agente: `/cubo:explicar-fluxo`, `/cubo:explicar-agente`,
`/cubo:criar-fluxo`, `/cubo:criar-agente`, `/cubo:editar-fluxo`, `/cubo:editar-agente`.
