// The leading-digit law is size-generic, and 4x4 has only 288 solutions -- so
// at that size it can be checked exhaustively rather than sampled. Every window
// of every 4x4 solution, against allowedTopLeft.
import { sampleGrids, ranks, windowList } from './quadrank-lib.mjs'
import { allowedTopLeft } from './leading-digit.mjs'

const n = 4
const { kept, seen } = sampleGrids(n, 288, 1)
let tests = 0; let violations = 0; let pinned = 0; let removed = 0
const rankDigits = new Map()
for (const grid of kept) {
  const rk = ranks(grid)
  for (const w of windowList(n, n)) {
    const rank = rk.get(w.id); const trueDigit = grid[w.r - 1][w.c - 1]
    const allowed = allowedTopLeft(n, rank)
    tests++
    if (!allowed.includes(trueDigit)) violations++
    if (allowed.length === 1) pinned++
    removed += n - allowed.length
    if (!rankDigits.has(rank)) rankDigits.set(rank, new Set())
    rankDigits.get(rank).add(trueDigit)
  }
}
console.log(`4x4: ${kept.length} of ${seen} solutions walked (exhaustive: ${kept.length === 288})`)
console.log(`window tests ${tests}, violations ${violations}, pins ${pinned} (${(100 * pinned / tests).toFixed(1)}%), candidates removed ${removed}`)
console.log('observed rank -> top-left digits vs predicted:')
for (const r of [...rankDigits.keys()].sort((a, b) => a - b)) {
  const obs = [...rankDigits.get(r)].sort((a, b) => a - b)
  const pred = allowedTopLeft(n, r)
  const tight = obs.join(',') === pred.join(',')
  console.log(`  rank ${r}: observed {${obs}}  predicted {${pred}} ${tight ? '(tight)' : '(predicted is looser -- still sound)'}`)
}
process.exit(violations === 0 ? 0 : 1)
