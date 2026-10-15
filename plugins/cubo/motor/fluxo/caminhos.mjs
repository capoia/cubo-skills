// Automação não tem simulação no Cubo. Para dar exemplos, o motor percorre o desenho: cada caminho é
// uma sequência de passos e as saídas escolhidas. São caminhos LIDOS DO DESENHO, não execuções.
const ESPECIAIS = new Set(['timeout', 'exhausted', 'ocupada'])
const LIMITE_DE_PASSOS = 30
const LIMITE_DE_CAMINHOS = 300

// descricao: a saída do `descrever`. Devolve até `maximo` caminhos que, juntos, passam pelo maior
// número de passos, preferindo os caminhos comuns (sem "sem resposta" nem "conversa ocupada").
export function caminhos(descricao, maximo = 5) {
  const porNumero = new Map(descricao.passos.map((p) => [p.n, p]))
  const inicio = descricao.passos.find((p) => p.tipo === 'start')
  if (!inicio) return []
  const primeiros = inicio.saidas.flatMap((s) => s.destinos)
  const todos = []

  const anda = (n, trilha, vistos) => {
    if (todos.length >= LIMITE_DE_CAMINHOS) return
    const passo = porNumero.get(n)
    if (!passo) return todos.push({ trilha, fim: 'passo inexistente' })
    if (vistos.has(n)) return todos.push({ trilha: [...trilha, { n, volta: true }], fim: `volta ao passo ${n}` })
    if (trilha.length >= LIMITE_DE_PASSOS) return todos.push({ trilha, fim: 'caminho longo: parei aqui' })
    const aqui = { n, tipo: passo.tipo, rotulo: passo.titulo || passo.rotuloTipo }
    const novosVistos = new Set(vistos).add(n)
    if (passo.irPara) return anda(passo.irPara, [...trilha, { ...aqui, saida: 'vai para' }], novosVistos)
    if (passo.terminal) return todos.push({ trilha: [...trilha, aqui], fim: passo.tipo === 'start_flow' ? 'passa para outro fluxo' : 'fim' })
    const saidas = passo.saidas.filter((s) => s.destinos.length && !s.motor)
    if (!saidas.length) return todos.push({ trilha: [...trilha, aqui], fim: 'fim' })
    for (const saida of saidas) for (const destino of saida.destinos) anda(destino, [...trilha, { ...aqui, saida: saida.rotulo, especial: ESPECIAIS.has(saida.handle) }], novosVistos)
  }
  for (const n of primeiros) anda(n, [], new Set())

  const escolhidos = []
  const cobertos = new Set()
  while (escolhidos.length < maximo && todos.length) {
    let melhor = -1
    let nota = -Infinity
    todos.forEach((c, i) => {
      const novos = new Set(c.trilha.map((t) => t.n).filter((n) => !cobertos.has(n))).size
      const especiais = c.trilha.filter((t) => t.especial).length
      const valor = novos * 10 - especiais * 15 - c.trilha.length * 0.1
      if (valor > nota) {
        nota = valor
        melhor = i
      }
    })
    if (melhor === -1 || (escolhidos.length && nota <= 0)) break
    const [c] = todos.splice(melhor, 1)
    c.trilha.forEach((t) => cobertos.add(t.n))
    escolhidos.push(c)
  }
  return escolhidos
}

export function caminhoEmTexto(caminho) {
  return `${caminho.trilha.map((t) => (t.volta ? `(volta ao ${t.n})` : `${t.n}. ${t.rotulo}${t.saida ? ` —[${t.saida}]→` : ''}`)).join(' ')} ⇒ ${caminho.fim}`
}
