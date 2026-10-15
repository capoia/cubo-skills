#!/usr/bin/env node
// Cópias de segurança antes de editar: `cubo/copias/<fluxo|agente>-<id>-<data e hora>.json`. Nunca
// são apagadas sozinhas. O `desfazer` usa a mais recente; `copias.mjs listar` mostra todas.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { argumentos, carimbo, ehPrincipal, falha, gravarJson, lerJson, pasta } from './lib.mjs'

export function guardarCopia(tipo, id, conteudo) {
  const arquivo = pasta('copias', `${tipo}-${id}-${carimbo()}.json`)
  gravarJson(arquivo, { tipo, id, guardadaEm: new Date().toISOString(), ...conteudo })
  return arquivo
}

export function listarCopias(tipo = null, id = null) {
  const dir = pasta('copias')
  return readdirSync(dir)
    .filter((nome) => nome.endsWith('.json'))
    .map((nome) => ({ nome, arquivo: join(dir, nome), m: nome.match(/^(fluxo|agente)-(\d+)-(.+)\.json$/) }))
    .filter((c) => c.m && (!tipo || c.m[1] === tipo) && (!id || c.m[2] === String(id)))
    .map((c) => ({ arquivo: c.arquivo, tipo: c.m[1], id: Number(c.m[2]), quando: c.m[3] }))
    .sort((a, b) => (a.quando < b.quando ? 1 : -1))
}

// A mais recente, ou a escolhida pelo nome do arquivo.
export function pegarCopia(tipo, id, escolhida = null) {
  const copias = listarCopias(tipo, id)
  const copia = escolhida ? copias.find((c) => c.arquivo.endsWith(escolhida)) : copias[0]
  if (!copia) falha(escolhida ? `não achei a cópia ${escolhida}. Veja as cópias: copias.mjs listar ${tipo} ${id}` : `não há cópia de segurança do ${tipo} ${id} nesta pasta. Sem cópia, não dá para desfazer daqui.`, 2)
  return { ...copia, conteudo: lerJson(copia.arquivo) }
}

if (ehPrincipal(import.meta.url)) {
  const { posicionais } = argumentos(process.argv.slice(2))
  const [comando, tipo, id] = posicionais
  if (comando !== 'listar') falha('uso: copias.mjs listar [fluxo|agente] [id]', 2)
  const copias = listarCopias(tipo, id)
  if (!copias.length) console.log('Nenhuma cópia de segurança nesta pasta.')
  for (const c of copias) console.log(`${c.tipo} #${c.id} — ${c.quando.replace('T', ' ')}  (${c.arquivo})`)
}
