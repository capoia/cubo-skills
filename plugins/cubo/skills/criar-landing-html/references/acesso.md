# Acesso ao Cubo

Duas coisas: **o endereço do CRM** e **uma chave de API**.

## O endereço do CRM

É o domínio em que a pessoa entra no Cubo. Pode ser o padrão (`https://app.cubosuite.com.br`,
`https://next.cubosuite.com.br`) ou um domínio próprio, se ela usa a plataforma por um parceiro
(`https://crm.empresadela.com.br`). Peça para ela copiar da barra do navegador, sem o caminho.

Não invente: em marca branca, cada parceiro tem o seu, e a chave só vale no dele.

## A chave de API

Instrução para passar à pessoa, com estas palavras:

> No Cubo, abra **Configurações → Chaves de API** (ou o endereço `<seu-crm>/apikeys`) e clique em
> **Nova chave**. Dê um nome que você reconheça depois, por exemplo "Landing pages".
>
> Nas permissões, marque:
>
> - **Landing pages** — leitura, criar, atualizar
> - **Formulários** — leitura, criar, atualizar
> - **Domínios** — leitura, criar
> - **Campos personalizados** — leitura, criar
> - **Funis e motivos de perda** — leitura (para escolher o funil em que o lead vai cair)
> - **Negócios** — leitura (só para o teste final conferir a negociação que o lead de teste criou)
>
> Salve e **copie a chave** (começa com `sk_`). Ela aparece inteira na tela de criação; depois dá
> para revelar de novo pelo botão de mostrar.

Se a versão do Cubo dela ainda não mostrar "Landing pages" na lista de permissões, o recurso não
está disponível nesse CRM — pare e avise, em vez de tentar chamar a API e colecionar 403.

## Onde guardar

Num arquivo `.cubo.env` na pasta onde a pessoa está trabalhando. **Não** em variável de ambiente: no
Claude Code ela não sobrevive de um comando para o outro, e o acesso sumiria no passo seguinte.

```bash
node "<scripts>/cubo.mjs" configurar --base=https://crm.empresadela.com.br --chave=sk_...
```

O script grava o arquivo com permissão só do dono, tira a barra do fim do endereço e, se a pasta for
um repositório git, acrescenta `.cubo.env` ao `.gitignore`. Diga à pessoa que a chave ficou salva
nesse arquivo, naquela pasta — é um segredo em disco, e ela precisa saber onde está.

Nunca escreva a chave no HTML da página, num commit, num comentário, ou de volta no chat. Ela dá
acesso de escrita ao CRM inteiro dentro dos escopos marcados.

## Conferir

```bash
node "<scripts>/cubo.mjs" check
```

O script responde os módulos ativos e quais permissões a chave tem. Se disser
que falta alguma, peça para a pessoa editar a chave — é mais rápido que descobrir com um 403 no
meio da publicação.

Falhas comuns:

| O que aparece | O que é |
|---|---|
| `401 API key inválida ou ausente` | chave errada, ou colada com espaço no fim |
| `403 Missing required scope: landings:create` | falta marcar a permissão na chave |
| `403 Missing required scope: pipes:read` | falta marcar **Funis e motivos de perda — leitura** na chave |
| `404` em tudo | endereço do CRM errado (domínio de outro parceiro, ou com `/` sobrando) |
| `402`/mensagem de assinatura | a conta está bloqueada por cobrança; quem resolve é a pessoa |
