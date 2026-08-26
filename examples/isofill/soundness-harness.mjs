// Soundness fuzz for the ISOFILL component. Soundness = a component never
// removes a cell's TRUE value. We seed random partial states in which every
// cell still allows its true value, run the component to a fixpoint, and check
// the true value survived.
//
//   node examples/isofill/soundness-harness.mjs
//
// The fixture is a valid ISOFILL solution: row r holds digit r, so each digit
// is one orthogonally connected ten-cell region. The count floor never reads
// region shape, so a plain fixture covers it.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng()

installGlobals(0, 9)

const mod = load('IsofillComponent.js', ['setParams', 'update'])

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const truth = {}
for (const c of CELLS) truth[c] = Math.floor(c / N)
const ALL = Array.from({ length: N }, (_, d) => d)

// A random candidate seed for a cell: pinned, full, or a subset that keeps true.
function seeder (c, v) {
  const mode = pick(['pin', 'full', 'subset'])
  if (mode === 'pin') return [v]
  if (mode === 'full') return ALL
  const s = new Set([v])
  for (const d of ALL) if (rnd() < 0.5) s.add(d)
  return [...s]
}

// ---- Fuzz: true values survive ----
let tests = 0
let bad = 0
for (let iter = 0; iter < 20000; iter++) {
  const p = makePuzzle(truth, seeder)
  const inst = {}
  mod.setParams(inst, CELLS)
  const v = violates(mod, inst, p, truth)
  tests++
  if (v) { bad++; if (bad <= 5) console.log('violation', v) }
}
console.log('isofill component:', tests, 'tests,', bad, 'violations')

// ---- Cap: digit 0 fills row 0, so no other cell may keep 0 ----
const capP = makePuzzle(truth, (c, v) => (v === 0 ? [v] : ALL))
const capInst = {}
mod.setParams(capInst, CELLS)
const capOk = !violates(mod, capInst, capP, truth) && CELLS.slice(N).every(c => !capP.getCandidates(c).has(0))

// ---- Force: digit 0 has exactly ten open cells (row 0), so they must be 0 ----
const forceP = makePuzzle(truth, (c, v) => (v === 0 ? ALL : ALL.slice(1)))
const forceInst = {}
mod.setParams(forceInst, CELLS)
const forceOk = !violates(mod, forceInst, forceP, truth) && CELLS.slice(0, N).every(c => forceP.getCandidates(c).size === 1)

console.log('cap fired:', capOk, '| force fired:', forceOk)

const ok = bad === 0 && capOk && forceOk
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
