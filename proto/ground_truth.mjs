// Ground truth for a quad-rank puzzle: enumerate every sudoku completion of the
// givens and keep the ones whose clued windows carry the clued ranks, using the
// oracle in quadrank-lib.mjs. No component involved -- this is what the app's
// solution count must match.
//
//   node proto/ground_truth.mjs proto/board6_puzzle.json

import { readFileSync } from 'fs'
import { ranks } from './quadrank-lib.mjs'

const p = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const N = p.grid.length
const [BR, BC] = N === 9 ? [3, 3] : [2, 3]
const g = Array.from({ length: N }, () => new Array(N).fill(0))
for (const [r, c] of p.givens) g[r][c] = p.grid[r][c]
const fixed = new Set(p.givens.map(([r, c]) => r * N + c))

const ok = (r, c, v) => {
  for (let i = 0; i < N; i++) if (g[r][i] === v || g[i][c] === v) return false
  const br = r - (r % BR); const bc = c - (c % BC)
  for (let i = 0; i < BR; i++) for (let j = 0; j < BC; j++) if (g[br + i][bc + j] === v) return false
  return true
}

let sudokuSolutions = 0
let matching = 0
const rec = (k) => {
  if (k === N * N) {
    sudokuSolutions++
    const rk = ranks(g)
    if (p.clues.every(([r, c, rank]) => rk.get(`R${r + 1}C${c + 1}`) === rank)) matching++
    return
  }
  const r = (k / N) | 0; const c = k % N
  if (fixed.has(k)) { rec(k + 1); return }
  for (let v = 1; v <= N; v++) {
    if (!ok(r, c, v)) continue
    g[r][c] = v; rec(k + 1); g[r][c] = 0
  }
}
rec(0)
console.log(`sudoku completions: ${sudokuSolutions}`)
console.log(`satisfying every quad-rank clue: ${matching}`)
