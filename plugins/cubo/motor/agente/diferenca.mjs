// Antes → depois do prompt, por linha (LCS). Prompt de agente cabe: até alguns milhares de linhas.

export function diferencaDeLinhas(antes, depois) {
  const a = String(antes ?? '').split(/\r?\n/)
  const b = String(depois ?? '').split(/\r?\n/)
  // Corta o começo e o fim iguais: o meio é o que mudou, e o LCS fica pequeno.
  let inicio = 0
  while (inicio < a.length && inicio < b.length && a[inicio] === b[inicio]) inicio++
  let fimA = a.length
  let fimB = b.length
  while (fimA > inicio && fimB > inicio && a[fimA - 1] === b[fimB - 1]) {
    fimA--
    fimB--
  }
  const meioA = a.slice(inicio, fimA)
  const meioB = b.slice(inicio, fimB)
  const n = meioA.length
  const m = meioB.length
  if (n * m > 25_000_000) return [...meioA.map((texto) => ({ tipo: '-', texto })), ...meioB.map((texto) => ({ tipo: '+', texto }))]
  const tabela = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) tabela[i][j] = meioA[i] === meioB[j] ? tabela[i + 1][j + 1] + 1 : Math.max(tabela[i + 1][j], tabela[i][j + 1])
  const saida = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && meioA[i] === meioB[j]) {
      saida.push({ tipo: '=', texto: meioA[i] })
      i++
      j++
    } else if (j < m && (i === n || tabela[i][j + 1] >= tabela[i + 1][j])) saida.push({ tipo: '+', texto: meioB[j++] })
    else saida.push({ tipo: '-', texto: meioA[i++] })
  }
  return [...a.slice(0, inicio).map((texto) => ({ tipo: '=', texto })), ...saida, ...a.slice(fimA).map((texto) => ({ tipo: '=', texto }))]
}

// Só os trechos que mudaram, com até 2 linhas de contexto.
export function diferencaEmTexto(antes, depois, contexto = 2) {
  const linhas = diferencaDeLinhas(antes, depois)
  const mudou = linhas.map((l) => l.tipo !== '=')
  if (!mudou.some(Boolean)) return '(o prompt não muda)'
  const mostrar = linhas.map((_, k) => mudou.slice(Math.max(0, k - contexto), k + contexto + 1).some(Boolean))
  const saida = []
  let pulou = false
  linhas.forEach((l, k) => {
    if (!mostrar[k]) {
      if (!pulou) saida.push('  …')
      pulou = true
      return
    }
    pulou = false
    saida.push(`${l.tipo === '=' ? ' ' : l.tipo} ${l.texto}`)
  })
  return saida.join('\n')
}

export function diferencaDeConfig(antes, depois, ignorar = ['systemPrompt']) {
  const chaves = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})])
  const mudancas = []
  for (const chave of chaves) {
    if (ignorar.includes(chave)) continue
    const a = JSON.stringify(antes?.[chave] ?? null)
    const b = JSON.stringify(depois?.[chave] ?? null)
    if (a !== b) mudancas.push({ chave, antes: antes?.[chave] ?? null, depois: depois?.[chave] ?? null })
  }
  return mudancas
}
