# A entrevista

Seis blocos. Pergunte em rodadas de 3 a 4 perguntas, com opções prontas sempre que a resposta for
escolha e não texto livre — é o que faz a pessoa responder em vez de travar. Um bloco de cada vez, e
repita de volta o que entendeu antes de seguir.

**Pule o que já sabe.** Se a pessoa entregou um briefing, uma página antiga, um anúncio ou um site,
leia primeiro — e rode o raio-x da marca nos endereços ([marca.md](marca.md)) — e pergunte só o que
ficou faltando. Perguntar o que já está na mesa cansa.

**Se ela travar numa pergunta,** proponha uma resposta plausível e peça só o "sim" ou "não é isso".
Chute fundamentado é melhor que página vaga.

---

## Bloco 1 — O essencial (nunca pule)

1. **O que está sendo oferecido?** Produto, serviço, evento, material, consulta, orçamento.
2. **Para quem?** Não "empresários": *dono de clínica odontológica com 2 a 5 cadeiras, na capital*.
   Quanto mais estreito, melhor a página.
3. **Qual é a ÚNICA ação que a página pede?** Preencher para ser chamado no WhatsApp, agendar,
   baixar, se inscrever, pedir orçamento. Uma só. Página com duas ações converte menos que as duas
   somadas.
4. **De onde vem o tráfego?** Anúncio no Instagram, Google, e-mail, QR code num balcão, link na bio.
   Quem vem de anúncio já viu uma promessa — a página tem que continuar aquela conversa, não
   recomeçar.

## Bloco 2 — A oferta

5. **Qual é a promessa em uma frase?** O que a pessoa ganha, não o que o produto tem.
6. **Qual é a dor hoje?** O que dói agora, antes de comprar.
7. **Por que acreditar?** Números, anos de casa, quantidade de clientes, depoimento (peça o texto e
   o nome), caso com resultado, certificação, garantia, logotipo de cliente conhecido.
   **Insista aqui.** É o que separa uma página que converte de um panfleto bonito.
   Pergunte também **onde os clientes falam deles** (Google, Reclame Aqui, comentários): é de lá que
   sai a linguagem da página ([marca.md](marca.md), "a linguagem do cliente final").
8. **Quais são as três objeções mais ouvidas?** Preço, prazo, "será que funciona pra mim", "já tentei
   e não deu certo". Cada objeção vira um trecho da página.
9. **Preço e condição** aparecem na página, ou é "sob consulta"?
10. **Tem prazo ou limite de verdade?** Turma que fecha, vagas, data. **Só use urgência real** —
    contador falso queima a marca e a pessoa percebe.

## Bloco 3 — A conversão

11. **Quais dados pedir?** Padrão que funciona: nome + WhatsApp. Cada campo a mais derruba a
    conversão; só peça o que alguém vai usar na próxima hora. Pergunta de qualificação (faixa de
    investimento, cidade) só se o comercial descarta lead por ela — explique o custo
    ([conversao.md](conversao.md), "formulário").
12. **Para qual funil e etapa** o lead vai? Liste os funis (`GET /api/pipes`) e deixe ela escolher.
13. **O que acontece depois de enviar?** Mensagem de obrigado na própria página, ou redirecionar
    para outro endereço (página de obrigado, WhatsApp, agenda)? Se for WhatsApp, peça o número e o
    texto que deve vir preenchido.
14. **Precisa do aceite da política de privacidade** (LGPD)? Se sim, peça o endereço da política.

## Bloco 4 — Marca e referência

Se o raio-x rodou, **mostre o que ele achou e peça só a confirmação** dos itens 15 a 17 e 21.

15. **Logotipo** — o do site serve (o raio-x traz); senão, peça o arquivo. Sem logotipo, a página
    parece de ninguém.
16. **Cores da marca** — as que o raio-x mediu; senão, em hexadecimal se ela tiver, ou tiradas do
    logotipo e confirmadas.
17. **Tipografia** — a do site, se houver. Senão você escolhe, e explica a escolha.
18. **Referências e concorrentes** — 1 a 3 endereços de páginas que ela acha boas, **e o que gosta
    em cada uma** ("o jeito que apresenta o preço", "a foto grande logo no começo"). E os 2 ou 3
    **concorrentes** com quem o cliente final compara. Rode o raio-x em todos e olhe antes de
    desenhar ([marca.md](marca.md), "concorrentes").
19. **O que ela NÃO quer.** Pergunta curta, resposta valiosa: "muito colorido", "cara de template",
    "parecido com o concorrente X".
20. **Tom de voz** — próximo e direto, técnico, institucional, divertido. Combine com o público do
    bloco 1, não com o gosto de quem está pedindo.
21. **Gente de verdade** — **peça ativamente**, não espere oferecerem: foto de quem atende, da
    fundadora ou do dono, da equipe, do lugar funcionando, de clientes reais (com o depoimento e a
    autorização deles). É a imagem que o olho procura primeiro ([conversao.md](conversao.md)).
    Procure também nas fontes que já existem: site, LP antiga, matérias na imprensa (o `imagem.mjs`
    baixa pelo endereço). Do Instagram, peça os arquivos — ele exige login. Pergunte se imagem com
    cara de render é foto real ou projeto.
    Foto de banco genérica continua proibida. Sem nenhuma foto de gente, **diga que isso custa
    conversão** e deixe a página mais curta, em vez de compensar com cartões e números.

## Bloco 5 — SEO e compartilhamento

22. **Busca importa** nesta página? Página de anúncio muitas vezes não quer ser indexada. Se não
    importa, use `robots` bloqueando e pule o resto do bloco.
23. **Termo que a pessoa buscaria** para chegar aqui.
24. **Título da aba e descrição** — você propõe, ela aprova. Regras em [seo.md](seo.md).
25. **Favicon** — arquivo ou endereço.
26. **Imagem de compartilhamento** — a que aparece ao colar o link no WhatsApp.

## Bloco 6 — Publicação

27. **Qual domínio?** Liste os cadastrados (`GET /api/domains`). Se o que ela quer não existe,
    cadastre e entregue o CNAME.
28. **Qual caminho?** `/promo`, `/turma-marco`. Curto, sem acento, com hífen. Se estiver ocupado, a
    criação volta 422 dizendo — aí proponha outro.
29. **Publicar assim que aprovar, ou deixar pronto e fora do ar?** (`status` `active` ou
    `deactivated` na criação.)

---

## Quando parar de perguntar

Você tem o suficiente quando consegue escrever, sem inventar: a promessa principal, três motivos
para acreditar, a resposta para as três objeções, o que a pessoa ganha ao enviar o formulário, e
para onde o lead vai. Sobrando, pare e mostre o plano.

Faltando, pergunte **uma vez**. Se a pessoa não tiver a resposta ("o cliente não mandou"), não
trave: siga com rascunho e deixe o buraco marcado ([rascunho.md](rascunho.md)). Só o destino do lead
(funil e etapa) e o domínio são indispensáveis antes de criar qualquer coisa no Cubo.
