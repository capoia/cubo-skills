# O que precisa estar instalado

A skill roda em **Windows, macOS e Linux**, numa instalação limpa do Claude Code, sem nenhum MCP. O
que ela precisa, e só isso:

| O quê | Para quê | Obrigatório? |
|---|---|---|
| **Node.js 20.9 ou mais novo** | roda todos os scripts da skill | sim |
| **Endereço do Cubo + chave de API** | criar formulário, página e domínio | sim ([acesso.md](acesso.md)) |
| **Chave do PageSpeed** (grátis) | medir a nota no fim | na prática, sim — sem ela a medição falha quase todo dia |
| Chrome ou Edge | tirar as capturas das páginas | não: o Edge já vem no Windows, e sem nenhum dos dois a skill baixa um navegador sozinha |

O resto (conversão de imagem e de vídeo, navegador para captura) o `requisitos.mjs` instala sozinho
na primeira vez, sem pedir senha de administrador.

## Conferir

```bash
node --version
node "<scripts>/requisitos.mjs"
```

O primeiro diz se o Node existe. O segundo confere todo o resto e responde com uma lista: `ok`,
`FALTA` (resolva antes de começar) ou `aviso` (dá para começar, mas vai faltar no fim).

## Se o Node não estiver instalado

`node --version` responde "command not found", "não é reconhecido como comando" ou algo parecido.
Passe para a pessoa, com estas palavras, só o trecho do sistema dela:

> **Windows** — abra o **PowerShell** e rode:
>
> ```
> winget install OpenJS.NodeJS.LTS
> ```
>
> Se o `winget` não existir, baixe o instalador **LTS** em https://nodejs.org e clique em avançar
> até o fim.

> **macOS** — baixe o instalador **LTS** em https://nodejs.org (arquivo `.pkg`) e abra. Se você
> usa Homebrew, `brew install node` também serve.

> **Linux (Ubuntu/Debian)** — a versão do `apt` costuma ser velha demais. Use:
>
> ```
> curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
> sudo apt install -y nodejs
> ```

> Depois de instalar, **feche e abra o Claude Code de novo** — o terminal que já estava aberto não
> enxerga o programa novo.

Não siga sem o Node: sem ele não há como preparar imagem, pré-visualizar nem medir, e o resultado
seria uma página sem nenhuma das travas que protegem quem não é da área.

## A chave do PageSpeed

O Google mede a nota por uma API. Sem chave, ela usa uma cota pública dividida com o mundo inteiro,
que **acaba todo dia** — a medição do fim da entrega falha, justo na hora de entregar. A chave é
grátis, não pede cartão e leva dois minutos. Passe para a pessoa:

> 1. Entre em https://console.cloud.google.com com a sua conta Google.
> 2. No topo, clique no seletor de projeto → **Novo projeto** → dê um nome ("Landing pages") →
>    **Criar**.
> 3. Com o projeto selecionado, abra
>    https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com e clique em
>    **Ativar**.
> 4. Vá em **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
> 5. Na janela que abre:
>    - **Nome**: qualquer um ("Landing pages");
>    - **Selecionar restrições da API**: abra a lista e marque **PageSpeed Insights API** (é a única
>      que precisa; se ela não aparecer na lista, o passo 3 não foi feito — volte e clique em
>      **Ativar**);
>    - **Restrições do aplicativo**: deixe **Nenhum**;
>    - clique em **Criar**.
> 6. Copie a chave (começa com `AIza`) e me mande.

Passe **o passo a passo inteiro**, com o 5 — quem nunca abriu o Google Cloud trava na janela de
restrições, que pede uma escolha obrigatória e não diz qual.

Guarde com:

```bash
node "<scripts>/cubo.mjs" configurar --pagespeed=AIza...
```

## No Linux, o navegador pode pedir bibliotecas

Se o `requisitos.mjs` disser que o navegador não abriu, ele mesmo imprime o comando que instala o
que falta (precisa de `sudo`). No Windows e no macOS isso não acontece.

## Espaço em disco

~110 MB para as dependências, dentro da pasta da skill (o conversor de vídeo, o `ffmpeg`, é a maior
parte). Se a máquina não tiver Chrome nem Edge, mais
~150 MB do navegador que a skill baixa — esse vai para a pasta padrão do Playwright no perfil do
usuário (`%LOCALAPPDATA%\ms-playwright` no Windows, `~/Library/Caches/ms-playwright` no macOS,
`~/.cache/ms-playwright` no Linux), e fica lá entre uma atualização e outra da skill.
