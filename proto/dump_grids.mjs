// Emits random sudoku solutions plus their true window ranks, straight from
// the oracle in quadrank-lib.mjs. The CP-SAT probe reads this rather than
// recomputing ranks in Python, so the oracle stays the single definition.
//
//   node proto/dump_grids.mjs 9 20 1 > /tmp/grids9.json

import { randomGrids } from './random-grids.mjs'
import { ranks, windowList } from './quadrank-lib.mjs'

const n = Number(process.argv[2] ?? 9)
const count = Number(process.argv[3] ?? 20)
const seed = Number(process.argv[4] ?? 1)
const box = { 4: [2, 2], 6: [2, 3], 9: [3, 3] }[n]

const out = randomGrids(n, box, count, seed).map(grid => {
  const rk = ranks(grid)
  return { grid, ranks: windowList(n, n).map(w => ({ r: w.r, c: w.c, rank: rk.get(w.id) })) }
})
process.stdout.write(JSON.stringify({ n, box, grids: out }))
