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
> 3. Dê o nome "Migração" e marque permissão de **leitura** em tudo. Não precisa de mais nada:
>    eu não vou mudar nada nessa conta.
> 4. Copie a chave (começa com `sk_`).
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
- se cada chave tem as permissões das áreas escolhidas: leitura na antiga; leitura, criação e
  edição na nova; e a leitura de usuários nas duas;
- se as duas chaves não são da mesma conta.

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
