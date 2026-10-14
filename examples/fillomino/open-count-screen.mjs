// The screen for a cheap-bound idea (#327), the committed form of the local
// bench #312 ran as a scratch script: the shipped component and each variant
// solve the 19 frozen timing fixtures offline, through hunt-lib's
// propagate-and-branch search, and the screen prints per-fixture nodes,
// passes and time against the baseline. A bound that cannot show a gain here
// has no mechanism worth the live clock (`just time`, ~2 min a board).
//
//   node examples/fillomino/open-count-screen.mjs [--reps N]
//
// Time is the best of N reps (default 5) of one whole solve. Nodes and passes
// are deterministic, so a variant that changes neither can only differ in
// time. A variant's verdict and grid must equal the baseline's; the screen
// exits 1 otherwise.
//
// To screen another idea, add a source patch to open-count-lib.mjs's
// `loadVariants` and a column here.

import { parseArgs } from 'node:util'
import { score } from './hunt-lib.mjs'
import { loadVariants, fixtureBoards } from './open-count-lib.mjs'

const HERE = import.meta.dirname
const { values } = parseArgs({ options: { reps: { type: 'string', default: '5' } } })
const REPS = Number(values.reps)
const variants = loadVariants(HERE)
const NAMES = Object.keys(variants)

function measure (mod, board) {
  let best = Infinity
  let result
  for (let r = 0; r < REPS; r++) {
    const t0 = process.hrtime.bigint()
    result = score(mod, board)
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6)
  }
  return { ...result, ms: best }
}

const boards = fixtureBoards(HERE)
console.log(['fixture', ...NAMES.flatMap(n => [`${n}.nodes`, `${n}.passes`, `${n}.ms`]), ...NAMES.slice(1).map(n => `${n}/baseline`)].join('\t'))
const sums = Object.fromEntries(NAMES.map(n => [n, { nodes: 0, passes: 0, ms: 0 }]))
let bad = 0
for (const board of boards) {
  const rows = {}
  for (const n of NAMES) rows[n] = measure(variants[n], board)
  for (const n of NAMES) {
    sums[n].nodes += rows[n].nodes; sums[n].passes += rows[n].passes; sums[n].ms += rows[n].ms
    if (rows[n].verdict !== rows.baseline.verdict || JSON.stringify(rows[n].grid) !== JSON.stringify(rows.baseline.grid)) {
      console.error(`${board.name}: ${n} answers differently from the baseline`)
      bad++
    }
  }
  console.log([board.name,
    ...NAMES.flatMap(n => [rows[n].nodes, rows[n].passes, rows[n].ms.toFixed(1)]),
    ...NAMES.slice(1).map(n => (rows[n].ms / rows.baseline.ms).toFixed(2))].join('\t'))
}
console.log(['TOTAL',
  ...NAMES.flatMap(n => [sums[n].nodes, sums[n].passes, sums[n].ms.toFixed(1)]),
  ...NAMES.slice(1).map(n => (sums[n].ms / sums.baseline.ms).toFixed(2))].join('\t'))
process.exit(bad ? 1 : 0)
