// Derive the rank -> top-left-digit table from data, over a spread sample of
// 6x6 grids. #323 reported a fixed table; this rebuilds it from the oracle so
// the deduction rests on measurement, not on a claim.
//
//   node proto/derive_table.mjs [nGrids]

import { sampleGrids, ranks, windowList } from './quadrank-lib.mjs'

const size = 6
const n = parseInt(process.argv[2] || '400', 10)
const { kept } = sampleGrids(size, n)
console.log(`sampled ${kept.length} grids of ${size}x${size}`)

// rank -> set of top-left digits seen at that rank
const seen = new Map()
let tiedGrids = 0
let tiedWindows = 0
let maxRank = 0

for (const grid of kept) {
  const rk = ranks(grid)
  const counts = new Map()
  for (const v of rk.values()) counts.set(v, (counts.get(v) || 0) + 1)
  let gridHasTie = false
  for (const [, c] of counts) if (c > 1) { gridHasTie = true; tiedWindows += c }
  if (gridHasTie) tiedGrids++
  for (const w of windowList(size, size)) {
    const r = rk.get(w.id)
    maxRank = Math.max(maxRank, r)
    const tl = grid[w.r - 1][w.c - 1]
    if (!seen.has(r)) seen.set(r, new Set())
    seen.get(r).add(tl)
  }
}

console.log(`ties: ${tiedGrids}/${kept.length} grids carry one; ${tiedWindows} tied windows; max rank seen ${maxRank}`)
console.log('\nrank -> possible top-left digits')
let pinned = 0
for (let r = 1; r <= maxRank; r++) {
  const s = seen.get(r)
  if (!s) { console.log(`  ${String(r).padStart(2)}: (never seen)`); continue }
  const ds = [...s].sort((a, b) => a - b)
  if (ds.length === 1) pinned++
  console.log(`  ${String(r).padStart(2)}: ${ds.join(',')}${ds.length === 1 ? '   <- pins' : ''}`)
}
console.log(`\n${pinned} of ${maxRank} ranks pin the top-left cell to exactly one digit`)
