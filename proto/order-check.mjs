// Does rank order match value order exactly, and do tied ranks mean
// digit-identical windows? The premise behind a cross-clue deduction.
//
//   node proto/order-check.mjs [nGrids]

import { ranks, windowList, windowValue } from './quadrank-lib.mjs'
import { randomGrids } from './random-grids.mjs'

const N = 9
const grids = randomGrids(N, [3, 3], parseInt(process.argv[2] || '300', 10), 20260908)
let pairs = 0; let ltMismatch = 0; let eqMismatch = 0; let notIdentical = 0; let ties = 0
for (const g of grids) {
  const rk = ranks(g)
  const wins = windowList(N, N)
  for (let i = 0; i < wins.length; i++) {
    for (let j = i + 1; j < wins.length; j++) {
      const a = wins[i]; const b = wins[j]
      const ra = rk.get(a.id); const rb = rk.get(b.id)
      const va = windowValue(g, a); const vb = windowValue(g, b)
      pairs++
      if ((ra < rb) !== (va < vb)) ltMismatch++
      if ((ra === rb) !== (va === vb)) eqMismatch++
      if (ra === rb) {
        ties++
        const same = g[a.r - 1][a.c - 1] === g[b.r - 1][b.c - 1] &&
          g[a.r - 1][a.c] === g[b.r - 1][b.c] &&
          g[a.r][a.c - 1] === g[b.r][b.c - 1] &&
          g[a.r][a.c] === g[b.r][b.c]
        if (!same) notIdentical++
      }
    }
  }
}
console.log(`grids ${grids.length}  window pairs ${pairs}`)
console.log(`rank(a)<rank(b) XOR value(a)<value(b): ${ltMismatch}`)
console.log(`rank(a)==rank(b) XOR value(a)==value(b): ${eqMismatch}`)
console.log(`tied pairs ${ties}, of which NOT digit-identical: ${notIdentical}`)
