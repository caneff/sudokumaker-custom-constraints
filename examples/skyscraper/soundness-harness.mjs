// Soundness fuzz for SkyscraperLineComponent. Soundness = a component never
// removes a cell's TRUE value. Each case is a random full line (a permutation,
// so all-different holds) with its two true clues, one per end. We seed random
// partial candidate states that still allow every true value, run the component
// to a fixpoint, and check the true values survived. A removed true value can
// make a real puzzle unsolvable.
//
//   node examples/skyscraper/soundness-harness.mjs            # 2,000 cases
//   FUZZ=20000 node examples/skyscraper/soundness-harness.mjs # deep run before a ship

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng()
const FUZZ = Number(process.env.FUZZ) || 2000

const N = 9
installGlobals(1, N)

const mod = load('SkyscraperLineComponent.js', ['setParams', 'update'])

function visible (vals) {
  let count = 0
  let max = 0
  for (const v of vals) if (v > max) { count++; max = v }
  return count
}

function shuffled () {
  const a = [...Array(N).keys()].map(i => i + 1)
  for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// A random candidate seed for a cell: pinned, full, or a subset that keeps true.
function seeder (c, v) {
  const mode = pick(['pin', 'full', 'subset'])
  if (mode === 'pin') return [v]
  if (mode === 'full') return [...Array(N).keys()].map(i => i + 1)
  const s = new Set([v])
  for (let d = 1; d <= N; d++) if (rnd() < 0.5) s.add(d)
  return [...s]
}

const CA = 100
const CB = 101
const LINE = [...Array(N).keys()]
let bad = 0
for (let iter = 0; iter < FUZZ; iter++) {
  const perm = shuffled()
  const truth = { [CA]: visible(perm), [CB]: visible([...perm].reverse()) }
  for (const i of LINE) truth[i] = perm[i]
  const p = makePuzzle(truth, seeder)
  const inst = {}
  mod.setParams(inst, CA, CB, LINE)
  const v = violates(mod, inst, p, truth)
  if (v) { bad++; if (bad <= 5) console.log('violation', v, 'perm', perm) }
}
console.log('line component:', FUZZ, 'tests,', bad, 'violations')
console.log(bad === 0 ? 'PASS' : 'FAIL')
process.exit(bad === 0 ? 0 : 1)
