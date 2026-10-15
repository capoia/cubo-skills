// Os chips do prompt: `{{tool:nome}}` ou `{{tool:nome(chave=valor,chave2="texto, com vírgula")}}`.
// A regra de escrita vem do catálogo (`chipSyntax`); aqui só se lê e se descreve.

export const CHIP_REGEX_PADRAO = '\\{\\{tool:([a-zA-Z0-9_]+)(?:\\(([^)]*)\\))?\\}\\}'

// `a=1,b="x, y",c=\"z\"` → { a: '1', b: 'x, y', c: '"z"' }
export function lerParametros(texto) {
  const params = {}
  let i = 0
  const s = String(texto ?? '')
  while (i < s.length) {
    while (s[i] === ',' || s[i] === ' ') i++
    const igual = s.indexOf('=', i)
    if (igual === -1) break
    const chave = s.slice(i, igual).trim()
    i = igual + 1
    let valor = ''
    if (s[i] === '"') {
      i++
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && s[i + 1] === '"') {
          valor += '"'
          i += 2
          continue
        }
        valor += s[i++]
      }
      i++ // a aspa de fechar
    } else {
      while (i < s.length && s[i] !== ',') valor += s[i++]
      valor = valor.trim()
    }
    if (chave) params[chave] = valor
  }
  return params
}

// [{ token, nome, params, inicio }]
export function lerChips(prompt, regex = CHIP_REGEX_PADRAO) {
  const re = new RegExp(regex, 'g')
  return [...String(prompt ?? '').matchAll(re)].map((m) => ({ token: m[0], nome: m[1], params: lerParametros(m[2]), inicio: m.index }))
}

// Monta o chip na sintaxe do Cubo, com aspas onde precisa.
export function escreverChip(nome, params = {}) {
  const partes = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => {
      const valor = String(v)
      if (valor.includes(')')) throw new Error(`o valor de ${k} não pode ter “)”: o Cubo não aceita.`)
      return /[,\s"]/.test(valor) ? `${k}="${valor.replace(/"/g, '\\"')}"` : `${k}=${valor}`
    })
  return partes.length ? `{{tool:${nome}(${partes.join(',')})}}` : `{{tool:${nome}}}`
}

// Cada chip com o rótulo do catálogo, os parâmetros com nome e o estado (desconhecido, intent
// desligada, MCP desconectado…).
export function descreverChips(prompt, { porNome, nomes, regex }) {
  const vistos = new Map()
  for (const chip of lerChips(prompt, regex)) {
    if (vistos.has(chip.token)) {
      vistos.get(chip.token).vezes++
      continue
    }
    const def = porNome[chip.nome]
    const params = Object.entries(chip.params)
      .filter(([chave]) => chave !== 'useWhen')
      .map(([chave, valor]) => {
        const p = def?.params?.find((x) => x.key === chave)
        const nome = p?.refKind && /^\d+$/.test(valor) ? nomes.nome(p.refKind, valor) : valor
        return { chave, rotulo: p?.label ?? chave, valor, nome, existe: p?.refKind && /^\d+$/.test(valor) ? nomes.existe(p.refKind, valor) : null }
      })
    let estado = 'ok'
    if (!def) estado = 'desconhecido'
    else if (def.dinamico === 'intent' && !def.enabled) estado = 'intent desligada'
    else if (def.dinamico === 'mcp' && def.status !== 'connected') estado = 'MCP desconectado'
    else if (def.dinamico === 'mcp' && !def.enabled) estado = 'ferramenta MCP desligada'
    else if (params.some((p) => p.existe === false)) estado = 'aponta para item que não existe'
    vistos.set(chip.token, {
      token: chip.token,
      nome: chip.nome,
      rotulo: def?.label ?? chip.nome,
      descricao: def?.description ?? null,
      tipo: def?.dinamico ?? def?.kind ?? null,
      quandoUsar: chip.params.useWhen ?? null,
      params,
      estado,
      vezes: 1,
    })
  }
  return [...vistos.values()]
}

export function fraseDoChip(chip) {
  const params = chip.params.map((p) => `${p.rotulo}: ${p.nome}`).join('; ')
  return `${chip.rotulo}${params ? ` (${params})` : ''}${chip.quandoUsar ? ` — quando: ${chip.quandoUsar}` : ''}${chip.estado !== 'ok' ? ` [${chip.estado.toUpperCase()}]` : ''}`
}

// O prompt com cada chip seguido do que ele faz, para o Claude ler sem consultar o catálogo.
export function promptAnotado(prompt, chips) {
  let saida = String(prompt ?? '')
  for (const chip of chips) saida = saida.split(chip.token).join(`${chip.token} ⟦${fraseDoChip(chip)}⟧`)
  return saida
}
