// Soundness harness for the leading-digit deduction (#324).
//
// The one rule that fails silently: `update` must never remove a candidate the
// true solution needs. So for a spread sample of real 6x6 grids, take EVERY
// window's true rank from the oracle and assert the true top-left digit still
// survives allowedTopLeft(). A single violation sinks the deduction.
//
// It also reports how much the deduction actually removes -- a sound rule that
// prunes nothing is inert, which is the other half of the ticket.
//
//   node proto/soundness-harness.mjs [nGrids]

import { sampleGrids, ranks, windowList } from './quadrank-lib.mjs'
import { allowedTopLeft, rankInRange } from './leading-digit.mjs'

const n = 6
const want = parseInt(process.argv[2] || '2000', 10)
const { kept } = sampleGrids(n, want)

let tests = 0
let violations = 0
let removed = 0
let pinned = 0
const firstFailures = []

for (const grid of kept) {
  const rk = ranks(grid)
  for (const w of windowList(n, n)) {
    const rank = rk.get(w.id)
    const trueDigit = grid[w.r - 1][w.c - 1]
    tests++
    if (!rankInRange(n, rank)) {
      violations++
      if (firstFailures.length < 5) firstFailures.push({ w, rank, trueDigit, reason: 'rank out of range' })
      continue
    }
    const allowed = allowedTopLeft(n, rank)
    if (!allowed.includes(trueDigit)) {
      violations++
      if (firstFailures.length < 5) firstFailures.push({ w, rank, trueDigit, allowed, grid })
    }
    removed += n - allowed.length
    if (allowed.length === 1) pinned++
  }
}

console.log(`grids: ${kept.length}   window tests: ${tests}`)
console.log(`violations: ${violations}`)
console.log(`candidates removed from top-left cells: ${removed} (${(removed / tests).toFixed(2)} per clue, of ${n - 1} removable)`)
console.log(`clues that pin the top-left outright: ${pinned} (${(100 * pinned / tests).toFixed(1)}%)`)
for (const f of firstFailures) {
  console.log('VIOLATION', JSON.stringify({ id: f.w.id, rank: f.rank, trueDigit: f.trueDigit, allowed: f.allowed, reason: f.reason }))
  if (f.grid) for (const row of f.grid) console.log('   ' + row.join(' '))
}
process.exit(violations === 0 ? 0 : 1)
