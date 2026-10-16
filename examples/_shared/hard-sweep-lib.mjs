// The pure parts of the cold sweep over a corpus of plain 9x9 grid strings
// (hard-sweep.mjs drives them): the document a grid becomes, which grids a
// shard owns, the row format a shard appends to, and the ranked table.

import { existsSync, readFileSync } from 'fs'

const CELLS = 81

// Swaps `grid`'s givens into `template`, a decoded grid_to_link document, so
// a 49k-grid sweep does not shell out to the Python codec once per grid.
// hard-sweep-lib.test.mjs holds the result equal to the document
// grid_to_link.py builds for the same grid.
export function gridToDoc (template, grid) {
  if (grid.length !== CELLS) throw new Error(`a grid is ${CELLS} characters, got ${grid.length}`)
  const doc = structuredClone(template)
  doc.puzzle.cells = [...grid].map(ch => ch === '.' || ch === '0' ? {} : { given: true, value: Number(ch) })
  return doc
}

// The grids of a corpus file with their 1-based line numbers: the first
// 81-character token of each non-blank line (the line number survives blank
// lines, so a table row points at its line of the committed file).
export function readGrids (file) {
  const grids = []
  readFileSync(file, 'utf8').split('\n').forEach((text, i) => {
    const token = text.trim().split(/\s+/)[0]
    if (token) grids.push({ line: i + 1, grid: token })
  })
  return grids
}

// `i/n`: shard i of n, 0-based.
export function parseShard (text) {
  const m = /^(\d+)\/(\d+)$/.exec(text)
  const index = m && Number(m[1])
  const count = m && Number(m[2])
  if (!m || count < 1 || index >= count) throw new Error(`shard must be i/n with 0 <= i < n, got ${JSON.stringify(text)}`)
  return { index, count }
}

export const shardOwns = ({ index, count }, line) => line % count === index

export function formatRow ({ source, line, solutions, ms }) {
  return `${source}\t${line}\t${solutions}\t${ms.toFixed(2)}`
}

export function parseRow (text) {
  const [source, line, solutions, ms] = text.split('\t')
  return { source, line: Number(line), solutions: Number(solutions), ms: Number(ms) }
}

// The `source\tline` keys already in a shard file, for a resumed run. A last
// line cut off by a kill has fewer than four fields and is not a key.
export function doneKeys (file) {
  const keys = new Set()
  if (!existsSync(file)) return keys
  for (const text of readFileSync(file, 'utf8').split('\n')) {
    const f = text.split('\t')
    if (f.length === 4) keys.add(`${f[0]}\t${f[1]}`)
  }
  return keys
}

// Slowest first; ties by source, then line.
export function rankRows (rows) {
  return [...rows].sort((a, b) =>
    b.ms - a.ms || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) || a.line - b.line)
}
