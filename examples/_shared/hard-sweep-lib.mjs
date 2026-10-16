// The pure parts of the cold sweep over a corpus of plain 9x9 grid strings
// (hard-sweep.mjs drives them): the document a grid becomes, which grids a
// shard owns, the row format a shard appends to, and the ranked table.

import { existsSync, readFileSync, truncateSync } from 'fs'

const CELLS = 81
const BLANKS = '.0'

// Swaps `grid`'s givens into `template`, a decoded grid_to_link document, so
// a 49k-grid sweep does not shell out to the Python codec once per grid.
// hard-sweep-lib.test.mjs holds the result equal to the document
// grid_to_link.py builds for the same grid, and refuses what its check_grid
// refuses, with the same reason.
export function gridToDoc (template, grid) {
  if (grid.length !== CELLS) throw new Error(`a grid is ${CELLS} characters, got ${grid.length}`)
  const bad = [...new Set(grid)].filter(ch => !(BLANKS + '123456789').includes(ch)).sort()
  if (bad.length) throw new Error(`a grid holds digits and . or 0, got ${JSON.stringify(bad)}`)
  const doc = structuredClone(template)
  doc.puzzle.cells = [...grid].map(ch => BLANKS.includes(ch) ? {} : { given: true, value: Number(ch) })
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
  if (!m || index >= count) throw new Error(`shard must be i/n with 0 <= i < n, got ${JSON.stringify(text)}`)
  return { index, count }
}

export const shardOwns = ({ index, count }, line) => line % count === index

export function formatRow ({ source, line, solutions, ms }) {
  return `${source}\t${line}\t${solutions}\t${ms.toFixed(2)}`
}

const ROW = /^([^\t]+)\t(\d+)\t(\d+)\t(\d+\.\d{2})$/

// A row as formatRow writes it, or a throw naming the text: a malformed row is
// never read as a number (an empty ms field is not 0 ms).
export function parseRow (text) {
  const m = ROW.exec(text)
  if (!m) throw new Error(`not a sweep row: ${JSON.stringify(text)}`)
  return { source: m[1], line: Number(m[2]), solutions: Number(m[3]), ms: Number(m[4]) }
}

// The rows of a shard file. Only a newline-terminated line is a row: a last
// line cut off by a kill is not, and `repair` truncates it off the file so the
// next append starts on a fresh line. Any other line that is not a row throws.
export function readRows (file, { repair = false } = {}) {
  if (!existsSync(file)) return []
  const text = readFileSync(file, 'utf8')
  const end = text.lastIndexOf('\n') + 1
  if (end < text.length) {
    if (!repair) throw new Error(`${file}: last line is cut off: ${JSON.stringify(text.slice(end))}`)
    truncateSync(file, Buffer.byteLength(text.slice(0, end)))
  }
  return text.slice(0, end).split('\n').slice(0, -1).map(parseRow)
}

// The `source\tline` keys already in a shard file, for a resumed run; a cut-off
// last line is truncated away first.
export function doneKeys (file) {
  return new Set(readRows(file, { repair: true }).map(r => `${r.source}\t${r.line}`))
}

// Slowest first; ties by source, then line.
export function rankRows (rows) {
  return [...rows].sort((a, b) =>
    b.ms - a.ms || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) || a.line - b.line)
}
