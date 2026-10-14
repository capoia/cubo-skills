# Landing page no Cubo — skill do Claude Code

Skill que faz a landing page inteira: lê o site do cliente para pegar a identidade, entrevista,
escreve a página, cria o formulário que gera a negociação no funil, publica no domínio e mede o
PageSpeed. Tudo pela API do Cubo — nada de copiar e colar HTML no painel.

Funciona em **Windows, macOS e Linux**, numa instalação limpa do Claude Code, sem nenhum MCP.

## Antes de instalar: o que você precisa ter

| O quê | Como conseguir |
|---|---|
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Cubo** com os módulos de landing pages, formulários e domínios | a sua conta do Cubo |
| **Chave de API do Cubo** com permissões de landing pages, formulários, domínios, campos personalizados e funis | no Cubo, **Configurações → Chaves de API** — a skill ensina o passo a passo e confere as permissões |
| **Chave do PageSpeed** (grátis, sem cartão) | a skill ensina a pegar em 2 minutos. Sem ela, a nota final falha quase todo dia |
| um **domínio** apontado para o Cubo, ou vontade de apontar um | a skill cadastra e entrega o CNAME |

O resto — conversão de imagem e de vídeo, navegador para as capturas — a skill instala sozinha na primeira vez,
sem pedir senha de administrador. Chrome ou Edge ajudam (o Edge já vem no Windows); sem nenhum dos
dois, ela baixa um navegador (~150 MB).

Na primeira conversa, a skill roda uma conferência e diz exatamente o que falta, antes de fazer
qualquer pergunta.

## Instalar

A skill vem no plugin `cubo`, junto com as outras do Cubo:

```
/plugin marketplace add capoia/cubo-skills
/plugin install cubo@cubo-skills
```

e reinicie o Claude Code.

## Atualizar

Quem instalou uma versão anterior **não recebe as novas sozinho**. No terminal:

```
claude plugin marketplace update cubo-skills
claude plugin update cubo@cubo-skills
```

e **reinicie o Claude Code** — a versão nova só vale depois disso.

A 4.0 junta as skills do Cubo num plugin só: o plugin `criar-landing-html` virou a skill
`/cubo:criar-landing-html` do plugin `cubo`, e o marketplace passou de `cubo` para `cubo-skills`. O
`update` não acha o nome novo; quem tem a 3.x roda uma vez:

```
claude plugin uninstall criar-landing-html@cubo
claude plugin marketplace remove cubo
claude plugin marketplace add capoia/cubo-skills
claude plugin install cubo@cubo-skills
```

e reinicia o Claude Code. Quem ainda está na 2.x (plugin `cubo-landing`) troca a primeira linha por
`claude plugin uninstall cubo-landing@cubo`. O acesso ao Cubo (`.cubo.env`, na pasta de trabalho)
continua valendo.

A 3.0.1 lê os domínios com `perPage=500`: o Cubo passou a paginar `GET /api/domains`, e quando o
padrão cair para 10 por página, a 3.0.0 deixa de enxergar quem tem mais de 10 domínios.

A 2.0 muda o que a skill precisa (Node no lugar de `cwebp`/`python3`) e para de usar rotas do Cubo
que não existem mais: **as versões 1.x falham ao publicar**.

## Usar

Depois de instalada, basta pedir:

> cria uma landing page pra captar leads do curso de inglês — o site da escola é escoladeingles.com.br

Ou chamar direto: `/cubo:criar-landing-html`.

A skill vai:

1. **conferir os requisitos** e pedir o acesso ao Cubo, ensinando onde criar a chave;
2. **montar o dossiê**: lê o site e a página antiga do cliente, os concorrentes, os anúncios que a
   categoria está rodando na Meta e as melhores páginas do ramo; tira capturas, mede cores, fontes,
   logotipo e fotos, e mostra a identidade e a oportunidade que encontrou;
3. **entrevistar**, perguntando só o que o briefing e o site não responderam;
4. **propor o plano** — três estruturas de página bem diferentes para você escolher (e não o molde
   de sempre), a direção visual e a promessa principal;
5. **escrever e pré-visualizar** na sua máquina, olhando a página no celular e no computador. O que
   depende do cliente (depoimento, número a confirmar, prazo) fica **marcado como rascunho** e vira
   uma lista de pendências — nunca é inventado;
6. **publicar e medir** — cria formulário e página no Cubo, confere o domínio e devolve as notas do
   PageSpeed, consertando o que derrubar a nota.

Também edita página que já existe: `edita a landing /promo, troca a chamada principal` — e, antes
de mexer, **guarda a versão atual na sua máquina**, para desfazer com um comando.

## Por que a página fica guardada no Cubo

Porque é o que faz ela ter, de graça, tudo que uma landing do construtor tem: Pixel, PageView
deduplicado com a API de Conversões, GTM, GA4, Clarity, enriquecimento de dados, aviso de cookies,
metatags, favicon e robots. A skill escreve só o corpo da página e o formulário — e **nunca** escreve
rastreamento, porque isso faria o evento contar duas vezes.

## De onde vieram as ideias

A skill adapta, reescritas para landing page de captação em português, ideias destes projetos:

- [frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design), da
  Anthropic (Apache-2.0) — a lista do visual genérico e o "gaste a ousadia em um lugar só";
- [Hallmark](https://github.com/Nutlope/hallmark) (MIT) — escolher a estrutura da página inteira
  entre opções bem diferentes, antes de qualquer cor; e o acabamento: par de fontes, escalas de
  tipo e espaço, formatos de rodapé e a checagem antes de entregar;
- [Impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) — a lista objetiva do que
  recusar, e o cuidado com o que o navegador pinta sozinho;
- [marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT) — achar a linguagem do
  cliente final em avaliações e comentários.
- [Lucide](https://lucide.dev) (ISC) — os ícones que o `icone.mjs` entrega prontos.

As regras de conversão citam a pesquisa de onde vêm, em `references/conversao.md`.

## Estrutura

```
plugins/cubo/skills/criar-landing-html/
  SKILL.md            o fluxo
  references/         requisitos, acesso, dossiê, marca, questionário, estruturas, conversão,
                      rascunho, design, acabamento, movimento, riqueza, crítica, html, formulário, api,
                      seo, pagespeed
  scripts/            Node: requisitos, cubo (API), marca (raio-x), anuncios (Biblioteca
                      de Anúncios da Meta), imagem, video, icone (Lucide), previa, teste-final
                      (lead de teste pela página publicada), entrega (checklist final), backup
                      e pagespeed
testes/fumaca.mjs   teste dos scripts, que o CI roda em Windows, macOS e Linux
```

Os arquivos de `references/` são lidos sob demanda: o `SKILL.md` fica curto e o detalhe só entra no
contexto quando é preciso.
