// As armadilhas que o CRM apontou no motor de automações e que a validação da API não pega. Cada uma
// diz onde está, o que acontece de verdade e o que fazer. Fonte: ledger do cubo-crm,
// `docs/superpowers/2026-10-14-api-catalogo-ledger.md`, "Achados no código". Quando o CRM corrigir uma
// delas, ela sai daqui.
import { TERMINAIS, arestasQueSaem, handleDaAresta, ligacoes, nosDoFluxo } from './modelo.mjs'

const CAMPOS_QUE_O_UPDATE_DEAL_GRAVA = new Set(['title', 'price', 'customfield', 'tags', 'status'])

export function armadilhas(fluxo, defs) {
  const achados = []
  const acha = (no, codigo, mensagem, oQueFazer, gravidade = 'aviso') => achados.push({ noId: no.id, tipo: no.type, titulo: no.data?.label ?? null, codigo, gravidade, mensagem, oQueFazer })

  for (const no of nosDoFluxo(fluxo)) {
    const data = no.data || {}
    const saem = arestasQueSaem(fluxo, no.id)

    if (no.type === 'end_flow' && saem.length) {
      acha(no, 'end_flow_segue', 'O passo “Encerrar conversa” não para o fluxo: o Cubo segue pela ligação que sai dele, e os passos seguintes rodam.', 'Se a ideia é parar aqui, tire a ligação que sai deste passo.')
    }
    if (no.type === 'end_flow') {
      acha(no, 'end_flow_status', '“Encerrar conversa” só manda a despedida e para o robô: a conversa continua aberta.', 'Para fechar a conversa de verdade, use “Mudar status” com “resolvida”.', 'nota')
    }
    if (no.type === 'change_status' && data.targetStatus === 'resolved' && saem.some((aresta) => handleDaAresta(aresta) === null)) {
      acha(no, 'resolved_encerra', 'Mudar a conversa para “resolvida” encerra o fluxo: os passos ligados depois deste nunca rodam.', 'Mova esses passos para antes do “Mudar status”, ou tire a ligação.')
    }
    if (no.type === 'ask_question') {
      const posicao = (handle) => saem.findIndex((aresta) => handleDaAresta(aresta) === handle)
      const esgotou = posicao('exhausted')
      const comum = posicao(null)
      if (esgotou !== -1 && (comum === -1 || esgotou < comum)) {
        acha(no, 'exhausted_captura', 'Quando o contato responde, o Cubo pega a primeira ligação que não é “sem resposta”: aqui é a de “lembretes esgotados”. A resposta normal pode ir pelo caminho errado.', 'Ligue primeiro a saída “Seguir” e depois a de “lembretes esgotados” (no editor: apague e refaça a ligação dos lembretes).', 'erro')
      }
    }
    if (no.type === 'condition' && data.field === 'hasProduct' && data.operator === 'is_empty') {
      acha(no, 'hasproduct_vazio', 'A condição “tem produto está vazio” nunca é verdadeira: o Cubo compara a contagem “0”, que não conta como vazio. O fluxo sempre vai pelo “Não”.', 'Use “tem produto” igual a 0 (ou “é falso”) no lugar de “está vazio”.', 'erro')
    }
    if (no.type === 'handoff_to_human' && /\{\{[^}]+\}\}/.test(String(data.message ?? ''))) {
      acha(no, 'handoff_literal', 'A mensagem da transferência para humano sai exatamente como está escrita: o {{…}} não é trocado pelo valor.', 'Tire a variável da mensagem, ou mande a mensagem num “Enviar mensagem” antes da transferência.')
    }
    if (no.type === 'update_deal' && data.fieldName && !CAMPOS_QUE_O_UPDATE_DEAL_GRAVA.has(data.fieldName)) {
      acha(no, 'update_deal_ignora', `“Atualizar negociação” não grava o campo “${data.fieldName}”: só título, valor, campo personalizado, tags e status. Os outros viram só uma anotação.`, 'Use um campo personalizado, ou outro passo próprio para isso.', 'erro')
    }
    if (TERMINAIS.has(no.type)) {
      const seguidas = saem.filter((aresta) => handleDaAresta(aresta) !== 'ocupada')
      if (seguidas.length) acha(no, 'terminal_com_saida', `${no.type === 'goto_node' ? '“Ir para o passo”' : '“Iniciar outro fluxo”'} termina aqui: as ligações que saem dele nunca são seguidas.`, 'Tire essas ligações, ou ponha os passos antes deste.')
    }
    if (!defs[no.type]) {
      acha(no, 'no_desconhecido', `O passo do tipo “${no.type}” não existe no catálogo do Cubo.`, 'Troque por um passo do catálogo.', 'erro')
      continue
    }
    // Ramo sem destino (menu, switch, condição): o fluxo para ali sem avisar.
    const { saidas } = ligacoes(fluxo, no, defs[no.type])
    const ramificado = saidas.filter((s) => !s.motor).length > 1
    if (ramificado && !TERMINAIS.has(no.type)) {
      const soltas = saidas.filter((s) => !s.motor && !s.destinos.length && s.handle !== 'timeout' && s.handle !== 'exhausted')
      const ligadas = saidas.filter((s) => !s.motor && s.destinos.length)
      if (soltas.length && ligadas.length) {
        acha(no, 'ramo_sem_destino', `As saídas ${soltas.map((s) => `“${s.rotulo}”`).join(', ')} não levam a nenhum passo: quem cair nelas fica parado, sem resposta.`, 'Ligue cada saída a um passo (nem que seja uma mensagem de “não entendi”).')
      }
    }
  }
  return achados
}
