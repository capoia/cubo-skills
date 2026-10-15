# Explicar agente do Cubo

Explica em linguagem simples o que um agente de IA do Cubo faz: o prompt, cada ferramenta (chip) com os nomes da conta, os lembretes e onde o agente é usado (canais, automações, outros agentes). Opcionalmente, roda de 3 a 5 conversas de exemplo no Cubo (simulação). No fim, a lista de problemas para o suporte.

Não muda nada na conta. **A simulação gasta tokens** da sua integração de IA (uns centavos por fala): a skill pergunta antes.

> **Atenção:** estas skills ajudam a criar, editar e entender fluxos e agentes, mas não substituem a
> revisão humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou
> alterados com elas. Revise e teste tudo antes de publicar ou ligar.

## Antes de usar

| O quê | Como conseguir |
| --- | --- |
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Chave de API do Cubo** | no Cubo, com um administrador: **Configurações → Chaves de API → Nova chave**. Leitura em tudo; para os exemplos, também **"Agentes de IA: simular"**. |

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
/cubo:explicar-agente SDR
```

Também dispara sozinha quando você pergunta "o que faz o agente SDR?".

As outras skills de fluxo e agente: `/cubo:explicar-fluxo`, `/cubo:explicar-agente`,
`/cubo:criar-fluxo`, `/cubo:criar-agente`, `/cubo:editar-fluxo`, `/cubo:editar-agente`.
