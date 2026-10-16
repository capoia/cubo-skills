# Acesso ao Cubo

As seis skills de fluxo e agente usam **uma chave de API** só, guardada em `.cubo.env`, na pasta
onde a pessoa abriu o Claude Code — o mesmo arquivo da skill de landing page. Quem já configurou uma
skill do Cubo nessa pasta não cola a chave de novo: no máximo, marca permissões a mais na chave.

## O Node (antes de tudo)

Os scripts rodam com o Node 20.9 ou mais novo. Se `node --version` responder "command not found",
"não é reconhecido como comando" ou uma versão mais velha (o `acesso.mjs` também avisa), **resolva
com a pessoa antes de seguir**. Quem pede quase nunca é técnico: faça você o que der, e peça só o que
precisa dela.

1. Diga, em uma frase: "Para eu trabalhar no seu Cubo, falta um programa chamado Node.js. É gratuito
   e leva uns 2 minutos."
2. Pergunte (clicável): **"Instalo para você?"** ("Sim, instale (recomendado)" / "Prefiro instalar
   eu"). Com o sim, conforme o sistema:
   - **Windows**: rode
     `winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-source-agreements --accept-package-agreements`.
     Avise antes: "Vai aparecer uma janela do Windows pedindo permissão: clique em **Sim**." Sem o
     `winget`, abra a página de download (`start https://nodejs.org/pt/download`) e diga: "Baixe o
     instalador **LTS** para Windows, abra e clique em Avançar até o fim."
   - **macOS**: com Homebrew (`brew --version` responde), rode `brew install node`. Sem ele, abra a
     página (`open https://nodejs.org/pt/download`) e diga: "Baixe o instalador **LTS** para macOS
     (arquivo .pkg), abra e clique em Continuar até o fim."
   - **Linux (Ubuntu/Debian)**: precisa da senha do computador, então a pessoa digita:
     `! curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`
3. **Depois de instalar, o Claude Code precisa ser reaberto**: o que já estava aberto não enxerga o
   Node novo. Diga, pronto para copiar:

   > Pronto, instalado! Agora feche o Claude Code e abra de novo **nesta mesma pasta**. Depois me
   > peça de novo o que você queria, e eu continuo daqui.

Não siga para a chave nem para os outros passos enquanto o Node não responder.

## O que dizer à pessoa (pronto para copiar)

> Para eu ler e mexer nos seus fluxos e agentes, preciso de uma chave de acesso do Cubo. Ela funciona
> como uma senha só para mim, e você pode apagar quando quiser.
>
> 1. Entre no Cubo com um usuário **administrador**.
> 2. Vá em **Configurações → Chaves de API → Nova chave** e dê o nome "Claude".
> 3. Marque as permissões:
>    - para **só explicar**: **leitura** em tudo;
>    - para **criar e editar**: **leitura, criação e edição** em tudo;
>    - para os **exemplos de conversa do agente**: marque também **"Agentes de IA: simular"**.
> 4. Copie a chave (começa com `sk_`).
>
> Agora digite aqui, exatamente assim, e aperte Enter:
>
> `! node "<motor>/acesso.mjs" abrir`
>
> Vai abrir um arquivo no bloco de notas. Cole a chave na linha `CUBO_API_KEY=`, salve (Ctrl+S),
> feche e me avise.

Troque `<motor>` pelo caminho completo antes de mandar.

## Conferir

```
node "<motor>/acesso.mjs" conferir --para=<skill> [--simular]
```

`<skill>` é o nome da skill em uso (`explicar-fluxo`, `editar-agente`…). Use `--simular` antes de
rodar exemplos de conversa do agente. Repita até "TUDO CERTO".

O `!` (atenção) não trava: sem leitura de funis, tags etc., a explicação mostra o número no lugar do
nome. Diga isso à pessoa.

## Se der errado

- **"recusou a chave (401)"**: a chave foi colada pela metade, com espaço, ou foi apagada. Abra o
  arquivo de novo (`acesso.mjs abrir`) e cole outra vez.
- **"não tem a permissão …"**: a pessoa edita a chave no Cubo (Configurações → Chaves de API →
  editar) e marca a permissão. Não precisa criar outra.
- **"não é administrador"**: agente só se grava com chave de administrador. A pessoa cria a chave
  entrando no Cubo com um usuário administrador.
- **"módulo Agentes de IA"**: a conta não tem o módulo. Quem liga é o dono da conta ou o suporte do
  Cubo.
- **A pessoa colou a chave no chat**: não repita a chave e não grave por ela. Peça para colar no
  arquivo e sugira apagar essa chave no Cubo e criar outra.
