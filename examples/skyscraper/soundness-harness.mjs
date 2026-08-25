// Soundness fuzz for both Skyscraper components. Soundness = a component never
// removes a cell's TRUE value. Each case is a random full line (a permutation,
// so all-different holds) with its true clue. We seed random partial candidate
// states that still allow every true value, run the component to a fixpoint, and
// check the true values survived. A removed true value can make a real puzzle
// unsolvable.
//
//   node examples/skyscraper/soundness-harness.mjs

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng()

const N = 9
installGlobals(1, N)

const lineMod = load('SkyscraperComponent.js', ['setParams', 'update'])
const pairMod = load('SkyscraperPairComponent.js', ['setParams', 'update'])

function visible (vals) {
  let count = 0
  let max = 0
  for (const v of vals) if (v > max) { count++; max = v }
  return count
}

function shuffled () {
  const a = [...Array(N).keys()].map(i => i + 1)
  for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] }
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

// ---- Line component against random full lines ----
const CLUE = 100
const LINE = [...Array(N).keys()]
let lineTests = 0
let lineBad = 0
for (let iter = 0; iter < 20000; iter++) {
  const perm = shuffled()
  const truth = { [CLUE]: visible(perm) }
  for (const i of LINE) truth[i] = perm[i]
  const p = makePuzzle(truth, seeder)
  const inst = {}
  lineMod.setParams(inst, CLUE, LINE)
  const v = violates(lineMod, inst, p, truth)
  lineTests++
  if (v) { lineBad++; if (lineBad <= 5) console.log('LINE violation', v, 'perm', perm) }
}
console.log('line component:', lineTests, 'tests,', lineBad, 'violations')

// ---- Pair component: two clues on one line read from opposite ends ----
const CA = 100
const CB = 101
let pairTests = 0
let pairBad = 0
let pairFired = 0        // coverage: the unimodal (saturating) branch actually ran
for (let iter = 0; iter < 20000; iter++) {
  // half random lines, half forced unimodal so L + R == N + 1 fires often
  let perm
  if (iter % 2 === 0) {
    perm = shuffled()
  } else {
    const rest = shuffled().filter(v => v !== N)
    const peak = (rnd() * N) | 0
    const up = rest.slice(0, peak).sort((a, b) => a - b)
    const down = rest.slice(peak).sort((a, b) => b - a)
    perm = [...up, N, ...down]
  }
  const truth = { [CA]: visible(perm), [CB]: visible([...perm].reverse()) }
  for (const i of LINE) truth[i] = perm[i]
  const p = makePuzzle(truth, seeder)
  const inst = {}
  pairMod.setParams(inst, CA, CB, LINE)
  const minA = Math.min(...p.getCandidates(CA))
  const minB = Math.min(...p.getCandidates(CB))
  if (minA + minB === N + 1) pairFired++
  const v = violates(pairMod, inst, p, truth)
  pairTests++
  if (v) { pairBad++; if (pairBad <= 5) console.log('PAIR violation', v, 'perm', perm) }
}
console.log('pair component:', pairTests, 'tests,', pairBad, 'violations,', pairFired, 'unimodal firings')

const ok = lineBad === 0 && pairBad === 0 && pairFired > 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
