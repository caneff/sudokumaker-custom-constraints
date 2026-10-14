// The screen for a cheap-bound idea: the shipped component and each variant
// solve the 19 frozen timing fixtures offline, and the screen prints
// per-fixture nodes, passes and time against the baseline. A bound that cannot
// show a gain here has no mechanism worth the live clock (`just time`, about
// two minutes a board).
//
//   node examples/fillomino/bound-screen.mjs [--reps N]
//
// Time is the best of N reps (default 5, a positive integer) of one whole
// solve; about 3 min on one core. Nodes and passes are deterministic, so a
// variant that changes neither can only differ in time. A variant's verdict
// and grid must equal the baseline's; the screen exits 1 otherwise.
//
// To screen another idea, add a source patch and a key to `loadVariants` in
// bound-screen-lib.mjs; the columns follow its keys.

import { parseArgs } from 'node:util'
import { loadVariants, fixtureBoards, runScreen } from './bound-screen-lib.mjs'

const HERE = import.meta.dirname
const { values } = parseArgs({ options: { reps: { type: 'string', default: '5' } } })
const variants = loadVariants(HERE)
const NAMES = Object.keys(variants)

let screen
try {
  screen = runScreen(fixtureBoards(HERE), variants, Number(values.reps))
} catch (err) {
  console.error(err.message)
  process.exit(2)
}

const SUMS = Object.fromEntries(NAMES.map(n => [n, { nodes: 0, passes: 0, ms: 0 }]))
const RATIOS = NAMES.slice(1)
console.log(['fixture', ...NAMES.flatMap(n => [`${n}.nodes`, `${n}.passes`, `${n}.ms`]), ...RATIOS.map(n => `${n}/baseline`)].join('\t'))
for (const row of screen.rows) {
  for (const n of NAMES) { SUMS[n].nodes += row[n].nodes; SUMS[n].passes += row[n].passes; SUMS[n].ms += row[n].ms }
  console.log([row.name,
    ...NAMES.flatMap(n => [row[n].nodes, row[n].passes, row[n].ms.toFixed(1)]),
    ...RATIOS.map(n => (row[n].ms / row.baseline.ms).toFixed(2))].join('\t'))
}
console.log(['TOTAL',
  ...NAMES.flatMap(n => [SUMS[n].nodes, SUMS[n].passes, SUMS[n].ms.toFixed(1)]),
  ...RATIOS.map(n => (SUMS[n].ms / SUMS.baseline.ms).toFixed(2))].join('\t'))
if (screen.bad) console.error(`${screen.bad} variant answer(s) differ from the baseline`)
process.exit(screen.bad ? 1 : 0)
