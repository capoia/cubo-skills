# Migrar conta do Cubo

Copia a configuração de uma conta do Cubo para outra: funis, estágios, filtros, categorias,
produtos, landing pages, formulários, templates, campos personalizados, departamentos, credenciais
OAuth, tags, motivos, canais, trilhas de atividade, automações, agentes de IA, base de conhecimento,
MCPs e integrações.

O difícil de migrar não é copiar, é **trocar os números**. Uma automação guarda o número do funil, o
prompt de um agente guarda o número do campo personalizado, e na conta nova esses números são outros.
A skill troca todos e, no fim, relê tudo na conta nova para provar que nenhum número da conta antiga
sobrou.

> **Estado:** em teste (0.2). As rotas de leitura e de criação já estão no Cubo; falta rodar a skill
> inteira contra contas de verdade.

## Antes de usar

| O quê | Como conseguir |
| --- | --- |
| **Node.js 20.9 ou mais novo** | Windows: `winget install OpenJS.NodeJS.LTS` no PowerShell (ou o instalador LTS de https://nodejs.org). macOS: instalador LTS de https://nodejs.org. Depois, **feche e abra o Claude Code**. |
| **Chave de API da conta antiga** | no Cubo da conta antiga, com um administrador: **Configurações → Chaves de API**, com o campo **"Usuário"** preenchido com um administrador. Leitura, e **"Segredos"** para trazer as chaves dos serviços de fora (marcada à parte: não vem no acesso total). |
| **Chave de API da conta nova** | no Cubo da conta nova, com um administrador: leitura, criação e edição, e "Arquivos: criação" (para copiar as imagens). |
| **Chave do formulário** (só se houver landing page do construtor com formulário) | no Cubo da conta nova: uma chave separada, só com "Negócios: criação" e "Negócios: edição". Ela fica escrita na página. |

Não há mais nada para instalar.

## Instalar

A skill vem no plugin `cubo`, junto com as outras do Cubo:

```
/plugin marketplace add capoia/cubo-skills
/plugin install cubo@cubo-skills
```

e reinicie o Claude Code.

## Usar

Abra o Claude Code numa pasta vazia (é onde a migração guarda o andamento) e digite:

```
/cubo:migrar-conta
```

A skill **só roda quando chamada assim**: ela escreve numa conta, então o Claude nunca dispara
sozinho.

Ela vai:

1. pedir as duas chaves. Você cola cada uma num arquivo que ela abre no bloco de notas, e a chave
   não passa pela conversa. Depois ela confere se cada chave conecta, se é de administrador, se tem
   as permissões certas e se as contas são diferentes. Não deixa seguir enquanto faltar algo;
2. perguntar o que migrar (tudo, ou marcar as partes);
3. ler a conta antiga e mostrar o plano, **sem mudar nada**: o que vai ser criado, o que vem junto
   porque outro item usa, o que já existe na conta nova;
4. perguntar o que só você pode decidir: quem fica no lugar de um usuário que não existe na conta
   nova, o que fazer com o que já existe, o domínio;
5. criar na conta nova, avisando cada passo. **A conta antiga nunca é alterada.** Automações,
   landing pages, canais, integrações e intents nascem desligados;
6. conferir tudo na conta nova;
7. abrir um relatório com o que foi feito e a lista do que você precisa fazer à mão.

Se algo cair no meio, é só chamar `/cubo:migrar-conta` de novo na mesma pasta: ela continua de onde parou
e não cria nada duas vezes.

## O que não dá para copiar

As chaves de serviços de fora **vêm junto**: Cal.com, OpenAI e as outras IAs, os cabeçalhos das
automações que chamam outros sistemas, os segredos dos intents de agente e o client secret das
credenciais OAuth. Elas funcionam igual em qualquer conta.

O que nasce de um login e fica preso à conta não sai. Na conta nova, você reconecta:

- WhatsApp, Z-API e Instagram;
- Google e Facebook Lead Ads;
- o login das credenciais OAuth (o client secret já vem; falta clicar em Conectar);
- as conexões MCP.

O relatório traz essa lista, com caixas de marcar.

Usuários também não são criados: quem precisar existir na conta nova tem que ser cadastrado antes.
E o mesmo domínio não pode ficar nas duas contas ao mesmo tempo: para usar o mesmo, você exclui na
conta antiga (a migração nunca mexe lá).

## Onde fica o andamento

Na pasta `migracao/`, onde você abriu o Claude Code:

| Arquivo | O que é |
| --- | --- |
| `origem.env`, `destino.env`, `formulario.env` | as chaves. **São segredo**: não envie para ninguém |
| `LEDGER.md` | o andamento, para ler: etapas, o que foi criado, o que falta |
| `ledger.json` | o mesmo, para a skill |
| `origem/` | a foto da conta antiga lida no plano, **com as chaves dos serviços de fora**: segredo também |
| `relatorio.html` | o relatório final |

Quando terminar, apague no Cubo as duas chaves "Migração" (a da conta antiga e a da conta nova) e
apague a pasta `migracao/`, que guarda as chaves dos serviços de fora. **A chave do formulário fica**:
as páginas usam.
