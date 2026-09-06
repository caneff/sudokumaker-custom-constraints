// Does the leading-digit law hold at 9x9, and does it still prune enough?
//
//   node proto/sweep9x9.mjs [nGrids]
import { ranks, windowList } from './quadrank-lib.mjs'
import { randomGrids } from './random-grids.mjs'
import { allowedTopLeft } from './leading-digit.mjs'

const n = 9
const want = parseInt(process.argv[2] || '2000', 10)
const grids = randomGrids(n, [3, 3], want, 20260904)

let tests = 0; let violations = 0; let pinned = 0; let removed = 0
let tiedGrids = 0
const observed = new Map()

for (const grid of grids) {
  const rk = ranks(grid)
  const counts = new Map()
  for (const v of rk.values()) counts.set(v, (counts.get(v) || 0) + 1)
  if ([...counts.values()].some(c => c > 1)) tiedGrids++
  for (const w of windowList(n, n)) {
    const rank = rk.get(w.id); const trueDigit = grid[w.r - 1][w.c - 1]
    const allowed = allowedTopLeft(n, rank)
    tests++
    if (!allowed.includes(trueDigit)) {
      violations++
      if (violations <= 3) console.log(`VIOLATION ${w.id} rank ${rank} true ${trueDigit} allowed {${allowed}}`)
    }
    if (allowed.length === 1) pinned++
    removed += n - allowed.length
    if (!observed.has(rank)) observed.set(rank, new Set())
    observed.get(rank).add(trueDigit)
  }
}

console.log(`9x9: ${grids.length} random grids, ${tests} window tests`)
console.log(`violations: ${violations}`)
console.log(`ties: ${tiedGrids}/${grids.length} grids carry at least one`)
console.log(`candidates removed: ${removed} (${(removed / tests).toFixed(2)} per clue, of ${n - 1} removable)`)
console.log(`clues that pin the top-left outright: ${pinned} (${(100 * pinned / tests).toFixed(1)}%)`)
const loose = [...observed.keys()].sort((a, b) => a - b)
  .filter(r => [...observed.get(r)].length < allowedTopLeft(n, r).length)
console.log(`ranks where the predicted set is looser than observed: ${loose.length ? loose.join(',') : 'none (bound is tight everywhere seen)'}`)
process.exit(violations === 0 ? 0 : 1)
