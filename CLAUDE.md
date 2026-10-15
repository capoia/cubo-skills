# CLAUDE.md

Orientação para o Claude Code trabalhando **neste repositório** (desenvolvendo as skills). Não
confundir com os `plugins/*/skills/*/SKILL.md`, que são a instrução para a skill **em uso**.

## O que é este repositório

O **marketplace de plugins do Claude Code do Cubo** (Cubo Suite / Cubo CRM): `capoia/cubo-skills`,
que até a 2.4.2 se chamava `capoia/cubo-lp-skill` e só tinha a skill de landing page. O marketplace
se chama `cubo-skills` e tem **um plugin só, o `cubo`**, em `plugins/cubo/`, com uma pasta por skill.

| Comando | Skill |
| --- | --- |
| `/cubo:criar-landing-html` | criar, publicar e editar landing page em HTML no Cubo, pela API, com entrevista, SEO e PageSpeed |
| `/cubo:migrar-conta` | copiar a configuração de uma conta do Cubo para outra, trocando os IDs pelos `refs` da API. **Leia `docs/migrar-conta/LEDGER.md` antes de mexer** |
| `/cubo:explicar-fluxo` · `/cubo:explicar-agente` | explicar uma automação ou um agente de IA em linguagem simples, com página e lista de problemas para o suporte; não mudam nada |
| `/cubo:criar-fluxo` · `/cubo:criar-agente` · `/cubo:editar-fluxo` · `/cubo:editar-agente` | criar e editar automações e agentes pela API, com prévia, cópia de segurança, desfazer e os itens que faltam criados pela API. Spec em `docs/superpowers/specs/2026-10-15-skills-fluxo-agente-design.md` |

Quem instala roda:

```
/plugin marketplace add capoia/cubo-skills
/plugin install cubo@cubo-skills
```

**Por que um plugin só** (decisão de 2026-10-14, na 4.0): o Claude Code chama a skill de plugin
sempre como `/<plugin>:<skill>`, e nenhum campo tira esse prefixo. Com um plugin por skill, o
comando virava `/migrar-conta:migrar-conta`; com o plugin `cubo`, vira `/cubo:migrar-conta` — o
mesmo padrão de `stripe`, `superpowers` e dos plugins `design`/`engineering` da Anthropic. O nome do
marketplace só aparece na instalação (depois do `@`), por isso ele é `cubo-skills` e não `cubo`:
`cubo@cubo` ficava estranho. O preço: quem instala leva todas as skills (antes dava para escolher).
Até a 3.0.1 eram os plugins `criar-landing-html` e `migrar-conta` no marketplace `cubo`.

O repositório é **público** desde 2026-09-23 — é o que permite instalar sem dar acesso ao GitHub. A
skill não vai para tenant: quem precisar, copia ou forka. Não há nada de interno aqui dentro (só
documentação de API pública e os scripts), e a varredura antes de abrir confirmou: nenhuma chave,
nenhum host interno.

## Estrutura

```
.claude-plugin/marketplace.json   o catálogo: o plugin cubo, apontando para "./plugins/cubo"
plugins/cubo/
  .claude-plugin/plugin.json      nome, versão, descrição — o que aparece na instalação
  skills/criar-landing-html/
    README.md          requisitos, instalação e uso, para quem instala
    SKILL.md           o FLUXO, curto de propósito
    references/*.md    o detalhe, lido sob demanda
    scripts/*.mjs      Node: requisitos, cliente da API, raio-x da marca, anúncios, imagem, vídeo, ícone, teste final,
                       prévia, backup e medição (package.json com sharp, playwright e ffmpeg-static)
  skills/migrar-conta/            mesma forma; scripts sem dependência nenhuma
  skills/{explicar,criar,editar}-{fluxo,agente}/   só SKILL.md e README.md: o trabalho é do motor
  motor/               os scripts compartilhados pelas seis skills de fluxo e agente (só Node, sem dependência)
  referencias/         as referências compartilhadas por elas (acesso, mudanças, itens, chips, simulação, escrita)
docs/migrar-conta/               LEDGER do desenvolvimento e o briefing da API para o cubo-crm
testes/fumaca.mjs    teste dos scripts da landing contra um Cubo de mentira
testes/migrar-conta.mjs          o mesmo para a migração (Cubo de mentira com duas contas)
testes/fluxo-agente.mjs          o mesmo para as skills de fluxo e agente (catálogos, If-Match/412, simulate)
.github/workflows/   o CI que roda as duas fumaças em Windows, macOS e Linux
```

**Nada de caminho que saia de `plugins/cubo/`.** O Claude Code copia o plugin isolado para o cache.

**Landing e migração são autocontidas** (cada uma com os próprios scripts, mesmo que repitam o
cliente da API). **As seis de fluxo e agente são finas e dividem um motor** (`plugins/cubo/motor/`)
e as referências (`plugins/cubo/referencias/`): o `SKILL.md` delas aponta para
`${CLAUDE_PLUGIN_ROOT}/motor` e `${CLAUDE_PLUGIN_ROOT}/referencias/…`. Decisão de 2026-10-15: são seis
skills sobre o mesmo catálogo, a mesma leitura e a mesma gravação com trava; seis cópias divergiriam
no primeiro conserto. Não junte landing e migração ao motor sem motivo: elas funcionam e têm teste.

**Fluxos e agentes têm aviso de responsabilidade** (pedido do Wellington, 2026-10-15): o texto mora em
`motor/aviso.mjs` e aparece no começo das quatro skills que escrevem, nas confirmações, nas páginas e
nos READMEs. Não tire.

A exceção é o **`plugins/cubo/cubo.json`**, a configuração que vale para todas as skills: hoje, o
endereço do Cubo (`https://next.cubosuite.com.br`). A pessoa **não informa o endereço**: a chave de
API é que diz a conta, e a API responde no mesmo endereço para todas (inclusive as de marca branca).
Mudou o endereço, muda aqui e sobe a versão; quem forkar para outro Cubo troca este arquivo. Os
scripts leem com `new URL('../../../cubo.json', import.meta.url)`. `CUBO_BASE_URL` no arquivo de
acesso continua aceito, só para teste (um slot local) e para o SDK de conta de marca branca.

Skill nova: `plugins/cubo/skills/<nome>/` com `SKILL.md`, `README.md`, referências e scripts; linha
nas tabelas daqui e do `README.md` da raiz; versão do plugin `cubo` subida; e `caso` na fumaça. Skill que
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
`SKILL.md` (a descrição de cada skill) entra em **toda** sessão de quem tem o plugin instalado, enquanto os
arquivos de referência só entram quando a skill precisa deles (~2,8k por invocação). Engordar o
`SKILL.md` cobra de todo mundo, o tempo inteiro. Detalhe novo vai para `references/`, e o `SKILL.md`
ganha no máximo um ponteiro.

Confira o custo depois de mexer:

```bash
claude plugin details cubo
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
   claude plugin validate plugins/cubo
   ```

2. **Instale a partir da pasta local**, sem passar pelo GitHub:

   ```
   /plugin marketplace add /Users/wellingtoncapoia/Documents/Repositories/cubo-suite/cubo-skills
   /plugin install cubo@cubo-skills
   ```

   Precisa de sessão nova para carregar. Para voltar à versão do GitHub, remova o marketplace local
   (`/plugin marketplace remove cubo-skills`) e adicione `capoia/cubo-skills` de novo.

3. **Rode a fumaça**, que sobe um Cubo de mentira e exercita todos os scripts:

   ```bash
   node testes/fumaca.mjs
   node testes/migrar-conta.mjs
   node testes/fluxo-agente.mjs
   ```

   O CI roda a mesma coisa em Windows, macOS e Linux, com Node 20 e 22, em todo PR. **É a única
   prova de que funciona no Windows** — não dá para dizer "funciona" sem ele verde. Script novo ou
   comportamento novo ganha um `caso` lá, visto falhando antes.

   Contra um CRM de verdade, um slot de worktree do `cubo-crm` (`pnpm dev:docker`) serve bem:

   ```bash
   node plugins/cubo/skills/criar-landing-html/scripts/cubo.mjs configurar --base=http://127.0.0.1:3336 --chave=sk_...   # --base só no teste
   node plugins/cubo/skills/criar-landing-html/scripts/cubo.mjs check
   ```

4. **Rode a skill inteira uma vez** antes de dar por pronta. Ler o `SKILL.md` não mostra o que
   trava: o que trava é a entrevista longa demais, a referência que não responde a pergunta que
   apareceu, o endpoint que devolve um erro que o texto não previu.

## Publicar uma versão

1. suba `version` nos **dois** manifestos (`plugin.json` e a entrada do `marketplace.json`) — eles
   precisam concordar;
2. commite e empurre a `main`;
3. opcionalmente, marque a versão: `claude plugin tag plugins/cubo` cria `cubo--v<versão>` conferindo
   que os dois manifestos batem.

A versão é uma só para todas as skills: mexeu em qualquer uma, sobe a do `cubo`. Quem já instalou
atualiza com `claude plugin marketplace update cubo-skills` + `claude plugin update cubo@cubo-skills`.

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
  (`claude plugin marketplace update cubo-skills` + `claude plugin update cubo@cubo-skills` + reiniciar).
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
- **`import()` de caminho absoluto quebra no Windows** (`D:\…` vira o protocolo `d:`). Use
  `pathToFileURL(caminho).href`. Pego pelo CI na primeira rodada do `migrar-conta`.
- **`sharp` 0.35 mudou a entrada para `dist/`.** Não importe caminho interno de pacote; resolva pelo
  nome (`createRequire(...)('sharp')`).

## Repositórios irmãos

| Repositório | Papel |
| --- | --- |
| `capoia/cubo-crm` | o CRM: API, telas, e o `landing.edge` que serve a página |
| `capoia/cubo-form-sdk` | o `@cubosuite/form`, o bundle que desenha o formulário na página |
| `gitlab.com/weellingtonc/landing-server` | quem serve a landing publicada, lendo `landings.html` do banco |
