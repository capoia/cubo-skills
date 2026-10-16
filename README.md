# Skills do Cubo para o Claude Code

Marketplace do Claude Code para quem trabalha com o Cubo (Cubo Suite / Cubo CRM). Um plugin só, o
`cubo`, traz todas as skills, e cada uma é chamada como `/cubo:<skill>`.

## Instalar

No Claude Code:

```
/plugin marketplace add capoia/cubo-skills
/plugin install cubo@cubo-skills
```

e reinicie o Claude Code. No Claude Desktop (Cowork), o mesmo catálogo aparece em **Customize →
Browse plugins**.

## Skills

| Comando | O que faz |
| --- | --- |
| [`/cubo:criar-landing-html`](plugins/cubo/skills/criar-landing-html/README.md) | Cria, publica e edita landing page em HTML no Cubo: identidade do site do cliente, entrevista, formulário que gera negociação, domínio, SEO e PageSpeed. Também dispara sozinha quando você pede uma landing page. |
| [`/cubo:migrar-conta`](plugins/cubo/skills/migrar-conta/README.md) | Copia a configuração de uma conta do Cubo para outra (funis, campos, formulários, landing pages, automações, agentes de IA…), trocando todos os IDs internos, com conferência e relatório. Só roda quando chamada pelo comando. |
| [`/cubo:explicar-fluxo`](plugins/cubo/skills/explicar-fluxo/README.md) | Explica em linguagem simples o que uma automação faz, com uma página com o desenho, e lista os problemas para o suporte. Não muda nada. Também dispara sozinha. |
| [`/cubo:explicar-agente`](plugins/cubo/skills/explicar-agente/README.md) | Explica um agente de IA (prompt, ferramentas, lembretes, onde é usado), com conversas de exemplo opcionais (simulação, gasta tokens). Não muda nada. Também dispara sozinha. |
| [`/cubo:investigar-teste`](plugins/cubo/skills/investigar-teste/README.md) | Descobre por que uma automação ou um agente não funcionou no teste, lendo a conversa pela API (sem print) e cruzando com o fluxo e o prompt. Não muda nada. Também dispara sozinha ("testei e não funcionou"). |
| [`/cubo:criar-fluxo`](plugins/cubo/skills/criar-fluxo/README.md) | Cria uma automação a partir de uma entrevista, com prévia. Nasce rascunho e desligada. Pergunta antes de gravar. |
| [`/cubo:criar-agente`](plugins/cubo/skills/criar-agente/README.md) | Cria um agente de IA a partir de uma entrevista, com prévia e conversas de teste. Pergunta antes de criar. |
| [`/cubo:editar-fluxo`](plugins/cubo/skills/editar-fluxo/README.md) | Muda uma automação pela conversa, com cópia de segurança, prévia, publicar e ligar separados, e desfazer. Pergunta antes de gravar. |
| [`/cubo:editar-agente`](plugins/cubo/skills/editar-agente/README.md) | Muda um agente de IA pela conversa, com cópia, antes → depois, onde é usado, teste e desfazer. Pergunta antes de gravar. |

> **Fluxos e agentes:** as skills ajudam a criar, editar e entender, mas não substituem a revisão
> humana. O Cubo não se responsabiliza pelos resultados de fluxos e agentes criados ou alterados com
> elas. Revise e teste tudo antes de publicar ou ligar.

## Atualizar

Quem instalou **não recebe versão nova sozinho**. No terminal:

```
claude plugin marketplace update cubo-skills
claude plugin update cubo@cubo-skills
```

e reinicie o Claude Code.

### Vindo das versões antigas

Até a 3.0.1, cada skill era um plugin (`criar-landing-html`, `migrar-conta`) num marketplace chamado
`cubo`. O `update` não acha os nomes novos; rode uma vez, no terminal:

```
claude plugin uninstall criar-landing-html@cubo
claude plugin uninstall migrar-conta@cubo
claude plugin marketplace remove cubo
claude plugin marketplace add capoia/cubo-skills
claude plugin install cubo@cubo-skills
```

(o `uninstall` de um plugin que você não tem só avisa e segue) e reinicie o Claude Code. O acesso ao
Cubo (`.cubo.env`, na pasta de trabalho) continua valendo.

## Estrutura

```
.claude-plugin/marketplace.json   o catálogo: o plugin cubo
plugins/cubo/                     o plugin: manifesto e uma pasta por skill (SKILL.md, referências, scripts, README)
plugins/cubo/motor/               os scripts compartilhados pelas skills de fluxo e agente
plugins/cubo/referencias/         as referências compartilhadas por elas
testes/                           os testes, que o CI roda em Windows, macOS e Linux
```
