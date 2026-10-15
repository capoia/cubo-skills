# Explicar fluxo do Cubo

Explica em linguagem simples o que uma automação do Cubo faz: o que a faz começar, cada passo, os caminhos possíveis e quem a chama. No fim, a lista de problemas para o suporte (passo solto, saída sem destino, item que não existe mais, e as armadilhas conhecidas do motor). Gera uma página com o desenho do fluxo.

Não muda nada na conta. Como automação não tem simulação no Cubo, os caminhos de exemplo são lidos do desenho.

> **Atenção:** estas skills ajudam a criar, editar e entender fluxos e agentes, mas não substituem a
> revisão humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou
> alterados com elas. Revise e teste tudo antes de publicar ou ligar.

## Antes de usar

| O quê | Como conseguir |
| --- | --- |
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Chave de API do Cubo** | no Cubo, com um administrador: **Configurações → Chaves de API → Nova chave**. Leitura em tudo. |

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
/cubo:explicar-fluxo 42
```

Também dispara sozinha quando você pergunta "o que faz o fluxo Boas-vindas?".

As outras skills de fluxo e agente: `/cubo:explicar-fluxo`, `/cubo:explicar-agente`,
`/cubo:criar-fluxo`, `/cubo:criar-agente`, `/cubo:editar-fluxo`, `/cubo:editar-agente`.
