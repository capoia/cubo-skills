// As armadilhas que o CRM apontou no motor de automações e que a validação da API não pega. Cada uma
// diz onde está, o que acontece de verdade e o que fazer. Fonte: ledger do cubo-crm,
// `docs/superpowers/2026-10-14-api-catalogo-ledger.md`, "Achados no código". Quando o CRM corrigir uma
// delas, ela sai daqui.
import { TERMINAIS, arestasQueSaem, handleDaAresta, ligacoes, nosDoFluxo } from './modelo.mjs'

// O campo aceita null? Só diz que não quando o catálogo garante (tipo sem "null"); sem tipo, não se sabe.
function aceitaNull(prop) {
  if (!prop || typeof prop !== 'object') return true
  if (prop.anyOf || prop.oneOf) return (prop.anyOf || prop.oneOf).some(aceitaNull)
  if (prop.type === undefined) return true
  return [].concat(prop.type).includes('null')
}

const CAMPOS_QUE_O_UPDATE_DEAL_GRAVA = new Set(['title', 'price', 'customfield', 'tags', 'status'])

// Passos que só mandam algo e seguem, sem esperar resposta.
const SO_FALAM = new Set(['send_message', 'send_media', 'send_whatsapp_template'])

export function armadilhas(fluxo, defs) {
  const achados = []
  const porId = new Map(nosDoFluxo(fluxo).map((no) => [no.id, no]))
  const acha = (no, codigo, mensagem, oQueFazer, gravidade = 'aviso') => achados.push({ noId: no.id, tipo: no.type, titulo: no.data?.label ?? null, codigo, gravidade, mensagem, oQueFazer })

  for (const no of nosDoFluxo(fluxo)) {
    const data = no.data || {}
    const saem = arestasQueSaem(fluxo, no.id)

    // O editor do Cubo grava null quando alguém apaga um texto opcional, e o motor de automações recusa
    // null em campo de texto: o passo para com erro quando o fluxo chega nele. A validação da API não pega.
    const propriedades = defs[no.type]?.configSchema?.properties || {}
    for (const [campo, valor] of Object.entries(data)) {
      if (valor !== null || aceitaNull(propriedades[campo])) continue
      acha(no, 'campo_null', `O campo “${campo}” está vazio de um jeito que o Cubo não aceita (null): quando o fluxo chegar neste passo, ele para com erro.`, `Tire o campo com /cubo:editar-fluxo (configurar “${campo}” com null tira o campo), ou escreva algo nele no editor. Acontece quando um texto opcional é apagado no editor do Cubo.`, 'erro')
    }

    // Agente logo depois de uma mensagem do próprio fluxo: entra sem o contato ter dito nada e responde ao
    // histórico, cuja última fala costuma ser um pedido que o fluxo já atendeu (o PDF do fluxo 1147).
    if (no.type === 'agent_call' && (fluxo.flowData?.edges || []).some((aresta) => aresta.target === no.id && SO_FALAM.has(porId.get(aresta.source)?.type))) {
      acha(no, 'agente_sem_pergunta', 'O agente entra logo depois de uma mensagem do próprio fluxo, sem o contato ter dito nada: ele responde ao histórico (a última coisa que o contato pediu) e pode repetir o pedido, prometer o que o fluxo já fez ou passar para uma pessoa.', 'Troque a mensagem de antes por “Fazer pergunta” (ela espera a resposta), para o agente entrar com a pergunta do contato. E diga no prompt do agente o que o fluxo já mandou (ex.: “o PDF já foi enviado nesta conversa; nunca diga que vai enviar”).')
    }
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
        const varias = soltas.length > 1
        acha(no, 'ramo_sem_destino', `${varias ? 'As saídas' : 'A saída'} ${soltas.map((s) => `“${s.rotulo}”`).join(', ')} não ${varias ? 'levam' : 'leva'} a nenhum passo: quem cair ${varias ? 'nelas' : 'nela'} termina o fluxo ali${(defs[no.type]?.requires || []).includes('conversation') ? ', sem resposta na conversa' : ''}.`, 'Confira se é isso mesmo; se não, ligue a saída a um passo.', 'nota')
      }
    }
  }
  return achados
}
