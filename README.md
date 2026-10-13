# Skills do Cubo para o Claude Code

Marketplace de plugins do Claude Code para quem trabalha com o Cubo (Cubo Suite / Cubo CRM). Cada
skill é um plugin separado: você adiciona o marketplace uma vez e instala só o que for usar.

## Instalar

No Claude Code:

```
/plugin marketplace add capoia/cubo-skills
/plugin
```

O `/plugin` lista as skills deste marketplace; marque as que quiser. No Claude Desktop (Cowork), o
mesmo catálogo aparece em **Customize → Browse plugins**.

Para instalar uma direto, sem a lista:

```
/plugin install criar-landing-html@cubo
```

## Skills

| Plugin | O que faz |
| --- | --- |
| [`criar-landing-html`](plugins/criar-landing-html/README.md) | Cria, publica e edita landing page em HTML no Cubo: identidade do site do cliente, entrevista, formulário que gera negociação, domínio, SEO e PageSpeed. |
| [`migrar-conta`](plugins/migrar-conta/README.md) | Copia a configuração de uma conta do Cubo para outra (funis, campos, formulários, landing pages, automações, agentes de IA…), trocando todos os IDs internos, com conferência e relatório. Em construção. |

## Atualizar

Quem instalou **não recebe versão nova sozinho**. No terminal:

```
claude plugin marketplace update cubo
claude plugin update <plugin>@cubo
```

e reinicie o Claude Code.

## Estrutura

```
.claude-plugin/marketplace.json   o catálogo: um plugin por skill
plugins/<plugin>/                 cada plugin, autocontido (manifesto, skill, scripts, README)
testes/                           os testes, que o CI roda em Windows, macOS e Linux
```
