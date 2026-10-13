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

// O caminho vem no formato do CRM (`joinPath`): ponto para chave simples, `[0]` para índice e
// `["45"]` (JSON) para chave que não é identificador, como um ID ou uma chave com ponto.
export function partesDoCaminho(caminho) {
  const partes = []
  const texto = String(caminho)
  let i = 0
  while (i < texto.length) {
    if (texto[i] === '.') {
      i++
      continue
    }
    if (texto[i] === '[') {
      if (texto[i + 1] === '"') {
        let fim = i + 2
        while (fim < texto.length && !(texto[fim] === '"' && texto[fim - 1] !== '\\')) fim++
        partes.push(JSON.parse(texto.slice(i + 1, fim + 1)))
        i = fim + 2
      } else {
        const fim = texto.indexOf(']', i)
        const dentro = texto.slice(i + 1, fim)
        partes.push(/^\d+$/.test(dentro) ? Number(dentro) : dentro)
        i = fim + 1
      }
      continue
    }
    let fim = i
    while (fim < texto.length && texto[fim] !== '.' && texto[fim] !== '[') fim++
    partes.push(texto.slice(i, fim))
    i = fim
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

  // Chaves de objeto por último, das mais fundas para as mais rasas (renomear muda o caminho de quem
  // está embaixo). As chaves do mesmo objeto trocam todas de uma vez, a partir do original: com
  // 12→40 e 40→55, trocar uma por uma faria a 12 sobrescrever a 40 e as duas virarem 55.
  const porObjeto = new Map() // caminho do objeto → [{ref, resposta}]
  for (const item of chaves) {
    const caminhoPai = JSON.stringify(partesDoCaminho(item.ref.path).slice(0, -1))
    if (!porObjeto.has(caminhoPai)) porObjeto.set(caminhoPai, [])
    porObjeto.get(caminhoPai).push(item)
  }
  const objetos = [...porObjeto.entries()].sort((a, b) => JSON.parse(b[0]).length - JSON.parse(a[0]).length)
  for (const [caminhoPai, itens] of objetos) {
    const partesPai = JSON.parse(caminhoPai)
    const recipiente = partesPai.length ? pai(copia, [...partesPai, null]) : copia
    if (recipiente == null || typeof recipiente !== 'object') continue
    const original = { ...recipiente }
    const renomeia = new Map() // chave antiga → chave nova (ou null para tirar)
    for (const { ref, resposta } of itens) {
      if (resposta.faltando) continue
      const chave = String(ref.token)
      if (!(chave in original)) continue
      if (resposta.remover || resposta.adiar) {
        renomeia.set(chave, null)
        continue
      }
      const anterior = renomeia.get(chave)
      const ids = [[ref.id, resposta.novo]]
      // Vários IDs na mesma chave: acumula a partir do original.
      if (anterior !== undefined && anterior !== null) renomeia.set(chave, { ids: [...anterior.ids, ...ids] })
      else renomeia.set(chave, { ids })
      resultado.trocas++
    }
    if (!renomeia.size) continue
    for (const chave of Object.keys(recipiente)) delete recipiente[chave]
    for (const [chave, valor] of Object.entries(original)) {
      if (!renomeia.has(chave)) {
        recipiente[chave] = valor
        continue
      }
      const troca = renomeia.get(chave)
      if (troca === null) continue
      recipiente[novoToken(chave, troca.ids)] = valor
    }
  }

  return resultado
}

// O campo de primeiro nível onde mora cada ref (é o que volta no PUT da 2ª passada).
export function campoRaiz(ref) {
  return String(partesDoCaminho(ref.path)[0])
}
