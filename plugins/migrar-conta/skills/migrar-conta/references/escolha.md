# Escolher o que migrar

A pergunta clicável aceita no máximo 4 opções por pergunta e 4 perguntas por vez. Por isso a
escolha vai em duas rodadas.

## Rodada 1: tudo ou escolher

Uma pergunta, sem `multiSelect`:

- **Tudo (recomendado)**: copia toda a configuração da conta.
- **Escolher**: marcar só algumas partes.

Se a pessoa escolher "Tudo", use `--areas=todos` e pule a rodada 2.

## Rodada 2: as partes

Cinco perguntas com `multiSelect: true`. Como cabem só 4 por vez, faça uma chamada com as quatro
primeiras e outra com a última. Em cada pergunta, diga que dá para não marcar nada.

| Pergunta | Opções (rótulo → chave) |
| --- | --- |
| Comercial | Funis → `funis` · Estágios → `estagios` · Motivos (perda, resolução, transferência e pausa) → `motivos` · Produtos → `produtos` |
| Cadastros | Campos personalizados → `campos` · Tags → `tags` · Categorias → `categorias` · Departamentos → `departamentos` |
| Captação | Landing pages → `landing-pages` · Formulários → `formularios` · Templates → `templates` · Filtros → `filtros` |
| Automação e IA | Automações → `automacoes` · Agentes de IA → `agentes` · Base de conhecimento → `base-de-conhecimento` · Trilhas de atividade → `trilhas` |
| Conexões | Canais → `canais` · Integrações → `integracoes` · Credenciais OAuth → `credenciais-oauth` · MCPs → `mcps` |

Junte as chaves marcadas, separadas por vírgula: `--areas=automacoes,agentes,canais`.

## Avise sobre o que vem junto

Ao montar o plano, o script **puxa junto** tudo o que um item escolhido usa. Por exemplo: uma
automação que move o lead para o funil "Vendas" traz o funil e os estágios dele. Se aquilo já existe
na conta nova com o mesmo nome, vira uma pergunta. Diga isso antes, para a pessoa não estranhar a
lista do plano: "Algumas coisas vêm junto porque são usadas pelo que você escolheu".

Credenciais, integrações e canais **não levam junto as conexões**: o WhatsApp, as contas do Google
e as chaves digitadas precisam ser reconectados na conta nova. O relatório lista o que fazer.
