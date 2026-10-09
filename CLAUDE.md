# CLAUDE.md

Orientação para o Claude Code trabalhando **neste repositório** (desenvolvendo as skills). Não
confundir com os `plugins/*/skills/*/SKILL.md`, que são a instrução para a skill **em uso**.

## O que é este repositório

O **marketplace de plugins do Claude Code do Cubo** (Cubo Suite / Cubo CRM): `capoia/cubo-skills`,
que até a 2.4.2 se chamava `capoia/cubo-lp-skill` e só tinha a skill de landing page. Cada skill é
um **plugin separado** em `plugins/<nome>/`, listado no `.claude-plugin/marketplace.json` — é o
que deixa a pessoa escolher o que instalar no `/plugin` (várias skills num plugin só é tudo ou
nada). Por isso não há skill "instaladora": a tela do `/plugin` já pergunta.

| Plugin | Skill |
| --- | --- |
| `criar-landing-html` | criar, publicar e editar landing page em HTML no Cubo, pela API, com entrevista, SEO e PageSpeed |

Próxima: migração entre contas, que espera a API do `cubo-crm` exportar e importar agentes de IA e
automações.

Quem instala roda:

```
/plugin marketplace add capoia/cubo-skills
/plugin install criar-landing-html@cubo
```

O nome do marketplace é `cubo` (e não o do repositório): é o que vem depois do `@`.

O repositório é **público** desde 2026-09-23 — é o que permite instalar sem dar acesso ao GitHub. A
skill não vai para tenant: quem precisar, copia ou forka. Não há nada de interno aqui dentro (só
documentação de API pública e os scripts), e a varredura antes de abrir confirmou: nenhuma chave,
nenhum host interno.

## Estrutura

```
.claude-plugin/marketplace.json   o catálogo; cada entrada aponta para "./plugins/<nome>"
plugins/criar-landing-html/
  .claude-plugin/plugin.json      nome, versão, descrição — o que aparece na instalação
  README.md                       requisitos, instalação e uso, para quem instala
  skills/criar-landing-html/
    SKILL.md           o FLUXO, curto de propósito
    references/*.md    o detalhe, lido sob demanda
    scripts/*.mjs      Node: requisitos, cliente da API, raio-x da marca, anúncios, imagem, vídeo, ícone, teste final,
                       prévia, backup e medição (package.json com sharp, playwright e ffmpeg-static)
testes/fumaca.mjs    teste dos scripts contra um Cubo de mentira
.github/workflows/   o CI que roda a fumaça em Windows, macOS e Linux
```

**Cada plugin é autocontido.** O Claude Code copia cada plugin isolado para o cache, então nada de
pasta `shared/` nem de caminho que saia de `plugins/<nome>/`. Se duas skills precisarem do mesmo
cliente da API, cada uma tem a sua cópia.

Skill nova: `plugins/<nome>/` com o próprio `plugin.json` e `README.md`, entrada no
`marketplace.json`, linha nas tabelas daqui e do `README.md` da raiz, e `caso` na fumaça. Skill que
**escreve** na conta do cliente leva `disable-model-invocation: true` no frontmatter: só roda
quando a pessoa chama pelo `/comando`.

## Quem usa a skill, e o que isso exige

Quem instala **não é de desenvolvimento, e quase sempre está no Windows**, numa instalação limpa do
Claude Code, **sem nenhum MCP**. Decisão de 2026-09-23. Daí as regras dos scripts:

- **só Node** (20.9+). Nada de `bash`, `python3`, `cwebp`, `sips`, `timeout`, `stat -f`, `curl` em
  script — nenhum deles existe (ou se comporta igual) nos três sistemas;
- dependência nova entra no `scripts/package.json`, com versão fixa, e o `requisitos.mjs` instala;
- **todo requisito novo aparece no `requisitos.mjs` e no `references/requisitos.md`** — descobrir no
  meio da entrega que falta algo é o que mais frustra quem usa;
- a skill "olha" as páginas por **captura** (Playwright): é o único olho que existe sem MCP.

**O `SKILL.md` fica curto e os `references/` carregam sob demanda.** Não é preferência de estilo: o
`SKILL.md` entra em **toda** sessão de quem tem o plugin instalado (~163 tokens hoje), enquanto os
arquivos de referência só entram quando a skill precisa deles (~2,8k por invocação). Engordar o
`SKILL.md` cobra de todo mundo, o tempo inteiro. Detalhe novo vai para `references/`, e o `SKILL.md`
ganha no máximo um ponteiro.

Confira o custo depois de mexer:

```bash
claude plugin details criar-landing-html
```

## Regras de escrita

- **Texto em pt-BR**, incluindo comentário de script. Quem lê é o Wellington e os clientes dele.
- **Identificador em inglês** quando houver (nome de arquivo, variável). O conteúdo é que é pt-BR.
- **A skill fala com quem não é técnico.** Nas partes que viram fala com o cliente (instrução de
  CNAME, pedido da chave de API), escreva o texto pronto para ser copiado, não uma descrição do que
  dizer.
- **Nada de promessa que o código não cumpre.** Se uma trava do CRM é contornável, a referência diz
  que é contornável — foi assim com a checagem de `<script src>`. Skill que mente sobre a garantia
  faz o agente confiar onde não devia.

## As regras que mais importam moram no `SKILL.md`

Medido por terceiros na Hallmark (ablação com `claude-haiku-4-5`, 2026): regras que ficavam **só**
nos arquivos de referência **nunca foram abertas** pelo modelo em 28 execuções. Por isso as sete
regras contra a "cara de IA" estão no próprio `SKILL.md`, e as referências trazem o porquê e as
fontes. Não mova essas regras para fora para "economizar" o `SKILL.md`. Medido com Haiku — vale
conferir se o Opus se comporta igual.

A pesquisa que fundamentou a 2.0 (16 skills avaliadas, fontes de CRO) está resumida em
`references/conversao.md` e nos créditos do README.

## A fonte da verdade da API é o CRM, não este repositório

`references/api.md` e `references/formulario.md` descrevem endpoints que vivem em
`capoia/cubo-crm`. Quando a API mudar, **quem manda é o CRM**:

| O que você quer saber | Onde está, no `cubo-crm` |
| --- | --- |
| Endpoints, corpo aceito, escopos | `app/controllers/api/{landing,form,domain}_controller.ts` e `app/validators/landing.ts` |
| O que a página em HTML pode e não pode ter | `docs/form-sdk/GUIA-PAGINA-HTML.md` |
| Formulário: campos, `settings`, LGPD, rastreamento | `docs/form-sdk/README.md` e `app/types/form_settings.ts` |
| Andamento e decisões do projeto | `docs/form-sdk/LEDGER.md` |
| Opções do SDK na página | `capoia/cubo-form-sdk`, `README.md` e `src/types.ts` |

Antes de escrever que a API aceita um campo, **confirme no validador**. Já aconteceu de a referência
prometer `status` e `css`, que a API recusa de propósito.

## Como testar uma mudança

1. **Valide os manifestos** (o catálogo e cada plugin) — pega erro de JSON e de frontmatter antes de instalar:

   ```bash
   claude plugin validate .
   claude plugin validate plugins/criar-landing-html
   ```

2. **Instale a partir da pasta local**, sem passar pelo GitHub:

   ```
   /plugin marketplace add /Users/wellingtoncapoia/Documents/Repositories/cubo-suite/cubo-lp-skill
   /plugin install criar-landing-html@cubo
   ```

   Precisa de sessão nova para carregar. Para voltar à versão do GitHub, remova o marketplace local
   (`/plugin marketplace remove cubo`) e adicione `capoia/cubo-skills` de novo.

3. **Rode a fumaça**, que sobe um Cubo de mentira e exercita todos os scripts:

   ```bash
   node testes/fumaca.mjs
   ```

   O CI roda a mesma coisa em Windows, macOS e Linux, com Node 20 e 22, em todo PR. **É a única
   prova de que funciona no Windows** — não dá para dizer "funciona" sem ele verde. Script novo ou
   comportamento novo ganha um `caso` lá, visto falhando antes.

   Contra um CRM de verdade, um slot de worktree do `cubo-crm` (`pnpm dev:docker`) serve bem:

   ```bash
   node plugins/criar-landing-html/skills/criar-landing-html/scripts/cubo.mjs configurar --base=http://127.0.0.1:3336 --chave=sk_...
   node plugins/criar-landing-html/skills/criar-landing-html/scripts/cubo.mjs check
   ```

4. **Rode a skill inteira uma vez** antes de dar por pronta. Ler o `SKILL.md` não mostra o que
   trava: o que trava é a entrevista longa demais, a referência que não responde a pergunta que
   apareceu, o endpoint que devolve um erro que o texto não previu.

## Publicar uma versão

1. suba `version` nos **dois** manifestos (`plugin.json` e a entrada do `marketplace.json`) — eles
   precisam concordar;
2. commite e empurre a `main`;
3. opcionalmente, marque a versão: `claude plugin tag plugins/<plugin>` cria `<plugin>--v<versão>` conferindo
   que os dois manifestos batem.

Quem já instalou atualiza com `/plugin update <plugin>` (ou `claude plugin update`).

## Armadilhas já pagas

- **Não rode `prettier` neste repositório.** Não há configuração aqui; o padrão dele reformata tudo
  com aspas duplas e ponto e vírgula, e vira um diff de mil linhas em cima de nada.
- **`${CLAUDE_PLUGIN_ROOT}` só existe no TEXTO do `SKILL.md`**, onde o Claude Code o substitui pelo
  caminho absoluto. No terminal a variável **está vazia** (medido), e os `references/` são lidos sem
  substituição. Por isso o `SKILL.md` dá o caminho uma vez e as referências escrevem `<scripts>`.
  Comando com `"${CLAUDE_PLUGIN_ROOT}/…"` num `references/*.md` vira `"/skills/…"` e falha — foi
  assim da 1.0 à 1.3.
- **Variável de shell não sobrevive entre comandos do Claude Code.** Nem `S=…` num comando para usar
  no seguinte, nem `!export CUBO_API_KEY=…` — o acesso mora no `.cubo.env` (`cubo.mjs configurar`).
- **Corpo grande vai por arquivo** (`@pagina.json`). A linha de comando do Windows corta perto de 32
  mil caracteres; uma landing passa disso. O `backup.mjs` chama a API no mesmo processo por isso.
- **Quem instalou não recebe versão nova sozinho** — a cópia desta máquina ficou na 1.0.0 enquanto o
  repositório estava na 1.3.0. Toda versão que muda requisito ou rota diz no README como atualizar
  (`claude plugin marketplace update cubo` + `claude plugin update <plugin>@cubo` + reiniciar).
- **A cota pública do PageSpeed acaba todo dia** — sem chave, a primeira chamada de uma tarde já
  voltou 429. Por isso a chave está no `requisitos.mjs`.
- **Página de construtor não termina de carregar.** O Chrome headless puro com
  `--virtual-time-budget` travou para sempre na LP da RD Station. O Playwright com
  `domcontentloaded` + prazo curto para o `load` é o que funciona.
- **Foto de fundo de construtor vem com degradê por cima**: `linear-gradient(...), url(...)`. Quem
  procura só `url(` no começo perde a foto principal da página.
- **Cor base costuma estar no `html`/`body`**, e o `querySelectorAll('*')` do `body` não os inclui.
- **Marcação da prévia não pode usar `::before`/`::after`** no elemento marcado: a página usa os
  dois, as regras se fundem, e um selo laranja cobriu a foto inteira de um arco. A marcação é uma
  camada à parte, criada por script.
- **Captura de página inteira não rola**: imagem com `loading="lazy"` sai vazia se ninguém rolar
  antes. E no modo celular o navegador **alarga a janela até caber o conteúdo**, então medir rolagem
  lateral com `innerWidth` nunca acusa nada — a régua é a largura pedida.
- **No teste, `spawnSync` congela o Cubo de mentira** que roda no mesmo processo. A fumaça usa
  `spawn` assíncrono de propósito.
- **`sharp` 0.35 mudou a entrada para `dist/`.** Não importe caminho interno de pacote; resolva pelo
  nome (`createRequire(...)('sharp')`).

## Repositórios irmãos

| Repositório | Papel |
| --- | --- |
| `capoia/cubo-crm` | o CRM: API, telas, e o `landing.edge` que serve a página |
| `capoia/cubo-form-sdk` | o `@cubosuite/form`, o bundle que desenha o formulário na página |
| `gitlab.com/weellingtonc/landing-server` | quem serve a landing publicada, lendo `landings.html` do banco |
