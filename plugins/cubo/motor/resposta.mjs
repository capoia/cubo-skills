// O bloco que o Claude copia na resposta depois de gerar a página: título, uma tabela com os fatos, os
// pontos de atenção em tabela e o caminho da página. Os fatos vêm daqui, prontos, para a resposta ter
// sempre a mesma cara e não depender de o Claude lembrar o formato. O que está entre ⟨ ⟩ é o Claude que
// completa.

const celula = (valor) => String(valor ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || '—'
const SELO = { erro: '🔴 Erro', aviso: '🟠 Atenção', nota: '⚪ Observação' }

export function tabela(cabecalho, linhas) {
  return [`| ${cabecalho.map(celula).join(' | ')} |`, `|${cabecalho.map(() => '---').join('|')}|`, ...linhas.map((l) => `| ${l.map(celula).join(' | ')} |`)].join('\n')
}

export function contagem(conta) {
  const partes = [conta.erro ? `🔴 ${conta.erro} ${conta.erro === 1 ? 'erro' : 'erros'}` : null, conta.aviso ? `🟠 ${conta.aviso} de atenção` : null, conta.nota ? `⚪ ${conta.nota} ${conta.nota === 1 ? 'observação' : 'observações'}` : null].filter(Boolean)
  return partes.length ? partes.join(' · ') : '🟢 nenhum'
}

// titulo: a linha de cima; fatos: { cabecalho, valores }; problemas: os do motor; arquivo: a página;
// proximo: a oferta do fim (ou null).
export function blocoDaResposta({ titulo, fatos, problemas, arquivo, proximo }) {
  const graves = problemas.filter((p) => p.gravidade !== 'nota')
  const notas = problemas.length - graves.length
  const linhas = graves.map((p) => [SELO[p.gravidade] ?? p.gravidade, p.onde, p.mensagem])
  return [
    'RESPOSTA PARA A PESSOA (copie o bloco entre as linhas, como está, e complete o que está entre ⟨ ⟩):',
    '────────',
    `### ${titulo}`,
    '',
    tabela(fatos.cabecalho, [fatos.valores]),
    '',
    '⟨o resumo, em 2 ou 3 frases curtas, sem número de nó⟩',
    '',
    '**Pontos de atenção**',
    '',
    tabela(['Tipo', 'Onde', 'O que acontece'], [...linhas, ['🔎 Leitura', '⟨onde⟩', '⟨cada ponto que você achou lendo o desenho e o motor não marcou, uma linha cada; sem nenhum, apague esta linha⟩']]),
    notas ? `\n_E ${notas} ${notas === 1 ? 'observação' : 'observações'} sem efeito no resultado, na página._` : null,
    '',
    `📄 **Página completa:** ${arquivo}`,
    proximo ? `\n👉 ${proximo}` : null,
    '────────',
    'Se não sobrar nenhuma linha na tabela de pontos de atenção, troque a tabela por "🟢 Nenhum ponto de atenção."',
  ]
    .filter((linha) => linha !== null)
    .join('\n')
}
