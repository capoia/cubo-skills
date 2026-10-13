// Troca de IDs a partir dos `refs` que o CRM devolve (`?include=refs`). Função pura: recebe o
// registro, os refs e quem decide o destino de cada ref; devolve uma cópia trocada e o que não deu.
//
// Ref: { path, kind, id, token? }
//   - sem token: o valor em `path` É o ID → troca o valor;
//   - com token e `path` apontando para texto: o ID está DENTRO do texto, no trecho `token` → troca
//     só esse trecho, numa passada só (trocar em cadeia faria o 12 virar 120);
//   - com token e `path` apontando para uma CHAVE de objeto (ex.: customfieldValues.45): renomeia
//     a chave.
//
// `decidir(ref)` devolve uma das respostas:
//   { novo }      troca pelo novo ID;
//   { adiar }     ainda não existe na conta nova: zera agora (texto fica como está) e volta na 2ª passada;
//   { remover }   tira (valor vira null; trecho de texto some);
//   { faltando }  não sei o par: deixa como está e avisa (quem chama decide se pode seguir).

export function partesDoCaminho(caminho) {
  const partes = []
  for (const pedaco of String(caminho).match(/[^.[\]]+|\[\d+\]/g) || []) {
    partes.push(/^\[\d+\]$/.test(pedaco) ? Number(pedaco.slice(1, -1)) : pedaco)
  }
  return partes
}

function pai(objeto, partes) {
  let atual = objeto
  for (const parte of partes.slice(0, -1)) {
    if (atual == null) return undefined
    atual = atual[parte]
  }
  return atual
}

export function ler(objeto, caminho) {
  const partes = partesDoCaminho(caminho)
  const recipiente = pai(objeto, partes)
  return recipiente == null ? undefined : recipiente[partes.at(-1)]
}

function escrever(objeto, caminho, valor) {
  const partes = partesDoCaminho(caminho)
  const recipiente = pai(objeto, partes)
  if (recipiente != null) recipiente[partes.at(-1)] = valor
}

const escapa = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const PALAVRA = 'A-Za-z0-9_'

// Padrão de um trecho com bordas: "12" não casa dentro de "120" nem de "a12".
function comBordas(trecho) {
  const antes = new RegExp(`^[${PALAVRA}]`).test(trecho) ? `(?<![${PALAVRA}])` : ''
  const depois = new RegExp(`[${PALAVRA}]$`).test(trecho) ? `(?![${PALAVRA}])` : ''
  return `${antes}${escapa(trecho)}${depois}`
}

// Troca vários trechos num texto de uma vez só. Os mais longos primeiro, para "frm_ab" não roubar
// o lugar de "frm_abc".
export function trocarTrechos(texto, trocas) {
  const trechos = Object.keys(trocas).filter((trecho) => trecho !== '')
  if (!trechos.length) return texto
  trechos.sort((a, b) => b.length - a.length)
  const padrao = new RegExp(trechos.map(comBordas).join('|'), 'g')
  return texto.replace(padrao, (achado) => trocas[achado] ?? achado)
}

// Dentro de um token, troca os IDs (pode haver mais de um: move_deal_stage_304416_320170). Ali o
// número vem grudado em "_" (mcp_1201_list), então a borda de um ID numérico é só "não ser dígito".
function novoToken(token, idsTrocados) {
  const trocas = new Map(idsTrocados.map(([antigo, novo]) => [String(antigo), String(novo)]))
  const padrao = [...trocas.keys()]
    .sort((a, b) => b.length - a.length)
    .map((id) => (/^\d+$/.test(id) ? `(?<!\\d)${id}(?!\\d)` : comBordas(id)))
    .join('|')
  return token.replace(new RegExp(padrao, 'g'), (achado) => trocas.get(achado) ?? achado)
}

export function aplicarRefs(registro, refs, decidir) {
  const copia = structuredClone(registro)
  const resultado = { registro: copia, trocas: 0, adiados: [], removidos: [], faltando: [] }

  const porTexto = new Map() // path → [{ref, resposta}]
  const chaves = [] // refs que renomeiam chave de objeto

  for (const ref of refs || []) {
    const resposta = decidir(ref) || { faltando: true }
    const ehChave = ref.token != null && String(partesDoCaminho(ref.path).at(-1)) === String(ref.token)

    if (resposta.faltando) resultado.faltando.push(ref)
    if (resposta.adiar) resultado.adiados.push(ref)
    if (resposta.remover) resultado.removidos.push(ref)

    if (ehChave) {
      chaves.push({ ref, resposta })
      continue
    }
    if (ref.token != null) {
      if (!porTexto.has(ref.path)) porTexto.set(ref.path, [])
      porTexto.get(ref.path).push({ ref, resposta })
      continue
    }
    if (resposta.faltando) continue
    if (resposta.adiar || resposta.remover) {
      escrever(copia, ref.path, null)
      continue
    }
    const atual = ler(copia, ref.path)
    escrever(copia, ref.path, typeof atual === 'string' ? String(resposta.novo) : resposta.novo)
    resultado.trocas++
  }

  // Textos: junta os refs de cada campo e troca tudo numa passada.
  for (const [caminho, itens] of porTexto) {
    const texto = ler(copia, caminho)
    if (typeof texto !== 'string') {
      for (const { ref } of itens) if (!resultado.faltando.includes(ref)) resultado.faltando.push(ref)
      continue
    }
    const porToken = new Map()
    for (const { ref, resposta } of itens) {
      if (!porToken.has(ref.token)) porToken.set(ref.token, [])
      porToken.get(ref.token).push({ ref, resposta })
    }
    const trocas = {}
    for (const [token, lista] of porToken) {
      if (lista.some(({ resposta }) => resposta.remover)) {
        trocas[token] = ''
        continue
      }
      const ids = lista.filter(({ resposta }) => resposta.novo !== undefined).map(({ ref, resposta }) => [ref.id, resposta.novo])
      if (ids.length) {
        trocas[token] = novoToken(token, ids)
        resultado.trocas += ids.length
      }
    }
    escrever(copia, caminho, trocarTrechos(texto, trocas))
  }

  // Chaves de objeto por último, das mais fundas para as mais rasas: renomear muda o caminho de quem
  // está embaixo.
  chaves.sort((a, b) => partesDoCaminho(b.ref.path).length - partesDoCaminho(a.ref.path).length)
  for (const { ref, resposta } of chaves) {
    if (resposta.faltando) continue
    const partes = partesDoCaminho(ref.path)
    const recipiente = pai(copia, partes)
    if (recipiente == null || !(partes.at(-1) in recipiente)) continue
    const valor = recipiente[partes.at(-1)]
    delete recipiente[partes.at(-1)]
    if (resposta.remover || resposta.adiar) continue
    recipiente[novoToken(String(ref.token), [[ref.id, resposta.novo]])] = valor
    resultado.trocas++
  }

  return resultado
}

// O campo de primeiro nível onde mora cada ref (é o que volta no PUT da 2ª passada).
export function campoRaiz(ref) {
  return String(partesDoCaminho(ref.path)[0])
}
