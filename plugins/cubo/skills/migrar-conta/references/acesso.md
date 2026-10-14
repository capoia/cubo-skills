# Acesso às duas contas

A migração precisa de **duas chaves de API**: uma criada dentro da conta antiga e outra dentro da
conta nova. As duas precisam ser criadas por um **administrador** (ou o dono) da conta. Com usuário
comum, o Cubo esconde parte da configuração (por exemplo, os funis de que ele não participa).

## O que dizer à pessoa (pronto para copiar)

> Para eu copiar a configuração, preciso de uma chave de acesso de cada conta. Ela é como uma senha
> só para mim, e você pode apagar quando terminarmos.
>
> **Na conta antiga:**
> 1. Entre no Cubo com um usuário administrador.
> 2. Vá em **Configurações → Chaves de API → Nova chave**.
> 3. Dê o nome "Migração" e, no campo **Usuário (opcional)**, escolha **você mesmo** (ou outro
>    administrador). Aqui ele não é opcional: sem usuário, a chave não traz as senhas e chaves.
> 4. Marque permissão de **leitura** em tudo. Marque também **"Segredos"**: é o que traz junto as
>    chaves dos serviços de fora (Cal.com, OpenAI, o sistema chamado pelas automações), para você não
>    precisar digitar tudo de novo. Ela não vem marcada nem com "acesso total", e só funciona em
>    chave com usuário administrador. Não precisa de mais nada: eu não vou mudar nada nessa conta.
> 5. Copie a chave (começa com `sk_`).
>
> Agora digite aqui, exatamente assim, e aperte Enter:
>
> `! node "<scripts>/conta.mjs" abrir origem`
>
> Vai abrir um arquivo no bloco de notas. Cole o endereço do seu Cubo (o que aparece no navegador,
> ex.: `https://app.cubosuite.com.br`) na linha `CUBO_BASE_URL=` e a chave na linha `CUBO_API_KEY=`.
> Salve (Ctrl+S), feche e me avise.

Para a conta nova é o mesmo caminho, com duas diferenças. A chave precisa de permissão de
**leitura, criação e edição**. E o comando é `! node "<scripts>/conta.mjs" abrir destino`.

Troque `<scripts>` pelo caminho completo dos scripts antes de mandar.

## O que o `conferir` confere

- se os dois arquivos existem e estão preenchidos;
- se cada chave conecta (o Cubo responde e reconhece a chave);
- se cada chave é de um administrador;
- se cada chave tem as permissões das áreas escolhidas: leitura na antiga (mais "Segredos", quando a
  escolha tem integrações, automações, agentes ou credenciais OAuth); leitura, criação e
  edição na nova (domínio só leitura e criação; MCP só leitura), mais "Arquivos: criação" na nova
  (para copiar imagens); e a leitura de usuários nas duas;
- se a conta nova tem ligados os módulos das áreas escolhidas (Agentes de IA, Automações, Canais,
  Integrações). Módulo se liga com o suporte do Cubo, ou a pessoa tira a área da escolha;
- quando há "Segredos": lê de verdade um item com segredo da conta antiga. É o único jeito de saber
  se a chave serve, porque o Cubo só entrega segredo para chave com **usuário definido**, ativo e
  administrador, e a chave sem usuário aparece no `whoami` como se fosse do dono. A leitura fica
  registrada na página da chave, no Cubo (é o que o Cubo faz com toda leitura de segredo);
- se as duas chaves não são da mesma conta.

## A terceira chave: a do formulário das landing pages

Só aparece quando o plano acha landing page do construtor com formulário (pergunta
`chave-formulario`). Esse formulário manda os contatos com uma chave escrita **na própria página**,
que qualquer visitante vê. Por isso não pode ser a chave da migração. Diga:

> As suas páginas do construtor têm formulário, e ele precisa de uma chave da conta nova que fica
> escrita na página. Por segurança, ela é separada e só pode criar contatos.
>
> No Cubo da **conta nova**: **Configurações → Chaves de API → Nova chave**, nome "Formulário das
> páginas", e marque **só** "Negócios: criação" e "Negócios: edição". Copie a chave.
>
> Agora digite aqui, e aperte Enter:
>
> `! node "<scripts>/conta.mjs" abrir formulario`
>
> Cole a chave na linha `CUBO_API_KEY=`, salve, feche e me avise.

Depois rode `node "<scripts>/conta.mjs" conferir-formulario`. Ele recusa chave de outra conta, a
chave da migração e chave com qualquer permissão além de negócios. Repita até "TUDO CERTO".

Cada ✘ vem com o que fazer. Repasse o texto em palavras simples e peça para a pessoa corrigir no
Cubo (ou no arquivo, com o mesmo comando `abrir`). Depois confira de novo.

## Se der errado

- **"recusou a chave (401)"**: a chave foi colada pela metade, com espaço, ou foi apagada. Abra o
  arquivo de novo e cole outra vez.
- **"não consegui falar com …"**: o endereço está errado. Ele tem que ser o do navegador, começando
  com `https://`, sem nada depois do domínio.
- **"não conhece GET /api/whoami (404)"**: o Cubo dessa conta ainda não tem a versão com as rotas da
  migração. Não há o que a pessoa possa fazer; avise que precisa atualizar o Cubo.
- **A pessoa colou a chave no chat**: não repita a chave e não grave por ela. Peça para colar no
  arquivo e sugira apagar essa chave no Cubo depois e criar outra.
