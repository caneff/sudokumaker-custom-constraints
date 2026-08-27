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
let fired = 0 // coverage: the prune removed something, so the DP actually ran
const total = p => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }
for (let iter = 0; iter < FUZZ; iter++) {
  const perm = shuffled()
  const truth = { [CA]: visible(perm), [CB]: visible([...perm].reverse()) }
  for (const i of LINE) truth[i] = perm[i]
  const p = makePuzzle(truth, seeder)
  const inst = {}
  mod.setParams(inst, CA, CB, LINE)
  const before = total(p)
  const v = violates(mod, inst, p, truth)
  if (total(p) < before) fired++
  if (v) { bad++; if (bad <= 5) console.log('violation', v, 'perm', perm) }
}
console.log('line component:', FUZZ, 'tests,', bad, 'violations,', fired, 'prune firings')

// The component's DP runs in one buffer shared by every instance, so a line's
// removals must be read out of it before the first yield. The solver may run
// another line's update between two of ours; this replays that interleaving
// and asserts each line still removes exactly what it removes on its own.
const CA2 = 102
const CB2 = 103
const LINE2 = LINE.map(i => i + 10)
const instA = {}
mod.setParams(instA, CA, CB, LINE)
const instB = {}
mod.setParams(instB, CA2, CB2, LINE2)
const state = q => [...q._cand].map(([c, s]) => c + ':' + [...s].sort().join('')).sort().join('|')
const copyOf = q => { const r = makePuzzle({}, () => []); for (const [c, s] of q._cand) r._cand.set(c, new Set(s)); return r }

let interleaveBad = 0
const PAIRS = 500
for (let iter = 0; iter < PAIRS; iter++) {
  const permA = shuffled()
  const permB = shuffled()
  const truth = {
    [CA]: visible(permA),
    [CB]: visible([...permA].reverse()),
    [CA2]: visible(permB),
    [CB2]: visible([...permB].reverse())
  }
  for (const i of LINE) truth[i] = permA[i]
  for (let i = 0; i < N; i++) truth[LINE2[i]] = permB[i]
  const start = makePuzzle(truth, seeder)

  // Serial: drain A fully, then B.
  const serial = copyOf(start)
  Array.from(mod.update(instA, serial))
  Array.from(mod.update(instB, serial))
  // Interleaved: take A's first change, run all of B, then finish A.
  const mixed = copyOf(start)
  const genA = mod.update(instA, mixed)
  genA.next()
  Array.from(mod.update(instB, mixed))
  Array.from(genA)

  if (state(mixed) !== state(serial)) {
    interleaveBad++
    if (interleaveBad <= 3) console.log('interleave diff\n mixed ', state(mixed), '\n serial', state(serial))
  }
}
console.log('interleaved yields:', PAIRS, 'pairs,', interleaveBad, 'differences')

const ok = bad === 0 && fired > 0 && interleaveBad === 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
