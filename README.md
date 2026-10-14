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
testes/                           os testes, que o CI roda em Windows, macOS e Linux
```
