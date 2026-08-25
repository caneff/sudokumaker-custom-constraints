// Soundness fuzz for the Hit Counts component. Soundness = the component never
// removes a cell's TRUE value. We seed random partial states in which every cell
// still allows its true value, run the component to a fixpoint, and check the
// true value survived. A removed true value is a bug that can make a real puzzle
// unsolvable.
//
//   node examples/hit-counts/soundness-harness.mjs
//
// Lines are synthetic random permutations of 1..9 read in a random direction, so
// the clue ranges over 0..9. We also force in the identity (clue 9) and a
// derangement (clue 0) to exercise both extremes on every run.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { read, load } = makeIo(HERE)
const { rnd } = makeRng()

installGlobals(0, 9)

const mod = load('HitCountsComponent.js', ['setParams', 'update', 'initialize', 'scan', 'matchingBounds'])
const sideMod = load('SideSumComponent.js', ['setParams', 'update'])
const pairMod = load('HitCountsPairComponent.js', ['setParams', 'update'])

// A random candidate seed keeping the true value. `hi` bounds the range: line
// cells use 1..9, the clue cell uses 0..9 (it can be 0).
function seeder (lo, hi) {
  return (c, v) => {
    const mode = [1, 2, 3][(rnd() * 3) | 0]
    if (mode === 1) return [v]                       // pinned
    const s = new Set([v])
    for (let d = lo; d <= hi; d++) if (rnd() < 0.5) s.add(d)   // subset keeping truth
    return [...s]
  }
}

const CLUE = 100
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a }
const hits = perm => perm.reduce((k, x, i) => k + (x === i + 1 ? 1 : 0), 0)

// A pool of lines: many random permutations plus the two forced extremes.
const lines = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 1]]   // identity (9), derangement (0)
for (let i = 0; i < 400; i++) lines.push(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]))

const LINE9 = [0, 1, 2, 3, 4, 5, 6, 7, 8]
let tests = 0
let bad = 0
let pruned8 = 0
let matchBeat = 0    // states where the matching bound is tighter than the naive tally
const seenClues = new Set()
for (let iter = 0; iter < 40000; iter++) {
  const perm = lines[iter % lines.length]
  const clueVal = hits(perm)
  seenClues.add(clueVal)
  const truth = { [CLUE]: clueVal }
  for (let i = 0; i < 9; i++) truth[i] = perm[i]
  const lineSeed = seeder(1, 9)
  const clueSeed = seeder(0, 9)
  const p = makePuzzle(truth, (c, v) => (c === CLUE ? clueSeed : lineSeed)(c, v))
  const inst = {}
  mod.setParams(inst, CLUE, LINE9)
  const naive = mod.scan(p, LINE9)                   // naive [forced, possible]
  const mbds = mod.matchingBounds(p, LINE9)          // matching [min, max]
  if (mbds && (mbds.min > naive.forced || mbds.max < naive.possible)) matchBeat++
  const had8 = p.getCandidates(CLUE).has(8)          // n - 1 = 8 for a line of 9
  for (const _ of mod.initialize(inst, p)) { /* one-time n-1 prune */ }
  if (had8 && !p.getCandidates(CLUE).has(8)) pruned8++
  const v = violates(mod, inst, p, truth)
  tests++
  if (v) { bad++; if (bad <= 5) console.log('violation', v, 'clue', clueVal) }
}
console.log('hit-counts component:', tests, 'tests,', bad, 'violations,', pruned8, 'n-1 prunes,', matchBeat, 'matching-tighter')
console.log('clue values exercised:', [...seenClues].sort((a, b) => a - b).join(' '))

// ---- Side-sum component: n clues on a side sum to exactly n ----
// A side is nine clue cells whose true values sum to 9 (a random composition of
// 9 into nine parts, each 0..9). The component must never remove a true value.
const N = 9
const SIDE = [200, 201, 202, 203, 204, 205, 206, 207, 208]
function composition () {
  const v = new Array(N).fill(0)
  for (let h = 0; h < N; h++) v[(rnd() * N) | 0]++   // drop nine hits into nine slots
  return v
}
let sideTests = 0
let sideBad = 0
for (let iter = 0; iter < 20000; iter++) {
  const vals = composition()
  const truth = {}
  for (let i = 0; i < N; i++) truth[SIDE[i]] = vals[i]
  const p = makePuzzle(truth, seeder(0, 9))
  const inst = {}
  sideMod.setParams(inst, SIDE, N)
  const v = violates(sideMod, inst, p, truth)
  sideTests++
  if (v) { sideBad++; if (sideBad <= 5) console.log('SIDE violation', v, 'vals', vals) }
}
console.log('side-sum component:', sideTests, 'tests,', sideBad, 'violations')

// ---- Pair component: opposite clues cap each other; the extreme pins each cell ----
// A fixed line at the A + B == cap extreme: identity with its two ends swapped, so
// every cell is a left hit (value j+1) or a right hit (value n-j). The component
// must never remove a true value, and the extreme branch must actually fire.
const PA = 300
const PB = 301
const PLINE = [10, 11, 12, 13, 14, 15, 16, 17, 18]
const pairLine = [9, 2, 3, 4, 5, 6, 7, 8, 1]
const nP = pairLine.length
const capP = nP + (nP % 2 === 1 ? 1 : 0)
const trueA = pairLine.reduce((k, v, j) => k + (v === j + 1 ? 1 : 0), 0)
const trueB = pairLine.reduce((k, v, j) => k + (v === nP - j ? 1 : 0), 0)
let pairTests = 0
let pairBad = 0
let pairFired = 0     // coverage: the extreme (every-cell-a-hit) branch ran
for (let iter = 0; iter < 20000; iter++) {
  const truth = { [PA]: trueA, [PB]: trueB }
  for (let i = 0; i < nP; i++) truth[PLINE[i]] = pairLine[i]
  const lineSeed = seeder(1, 9)
  const clueSeed = seeder(0, 9)
  const p = makePuzzle(truth, (c, v) => (c === PA || c === PB ? clueSeed : lineSeed)(c, v))
  const inst = {}
  pairMod.setParams(inst, PA, PB, PLINE)
  const minA = Math.min(...p.getCandidates(PA))
  const minB = Math.min(...p.getCandidates(PB))
  if (minA + minB === capP) pairFired++
  const v = violates(pairMod, inst, p, truth)
  pairTests++
  if (v) { pairBad++; if (pairBad <= 5) console.log('PAIR violation', v) }
}
console.log('pair component:', pairTests, 'tests,', pairBad, 'violations,', pairFired, 'extreme firings')

// ---- Pair over random permutations: exercise the dynamic cap ----
// Random lines usually have cells that hit neither way, so the cap A + B <= (cells
// that can still hit) drops below the static n (+1). Clue A counts fixed points,
// clue B counts fixed points of the reverse. Truth is always consistent, so any
// removed true value is a bug.
const rev = a => a.slice().reverse()
let dynTests = 0
let dynBad = 0
for (let iter = 0; iter < 40000; iter++) {
  const perm = lines[iter % lines.length]
  const truth = { [PA]: hits(perm), [PB]: hits(rev(perm)) }
  for (let i = 0; i < 9; i++) truth[PLINE[i]] = perm[i]
  const lineSeed = seeder(1, 9)
  const clueSeed = seeder(0, 9)
  const p = makePuzzle(truth, (c, v) => (c === PA || c === PB ? clueSeed : lineSeed)(c, v))
  const inst = {}
  pairMod.setParams(inst, PA, PB, PLINE)
  const v = violates(pairMod, inst, p, truth)
  dynTests++
  if (v) { dynBad++; if (dynBad <= 5) console.log('DYN PAIR violation', v) }
}
console.log('pair dynamic-cap:', dynTests, 'tests,', dynBad, 'violations')

// ---- Deterministic guard: the pin branch skips a cell that can hit neither ----
// n = 4. Cell L0 is pinned to 2 (a miss: 2 is neither its left target 1 nor its
// right target 4). The cap drops to 3; clues A = 0, B = 3 force the extreme. The
// three can-hit cells must be pinned to their pairs, and L0 must be left untouched
// (never emptied). Truth is a consistent state with A = 0, B = 3.
const G = { 400: 0, 401: 3, 20: 2, 21: 3, 22: 2, 23: 1 }   // clueA, clueB, L0..L3
const gCand = new Map([
  [400, new Set([0])], [401, new Set([3])],
  [20, new Set([2])], [21, new Set([1, 2, 3, 4])],
  [22, new Set([1, 2, 3, 4])], [23, new Set([1, 2, 3, 4])]
])
const gp = {
  _cand: gCand,
  getCandidates: c => gCand.get(c),
  removeCandidateFromCell: (d, c) => { gCand.get(c).delete(d) },
  removeCandidatesFromCell: (s, c) => { const set = gCand.get(c); for (const d of s) set.delete(d) }
}
const gInst = {}
pairMod.setParams(gInst, 400, 401, [20, 21, 22, 23])
for (const _ of pairMod.update(gInst, gp)) { /* drain */ }
let guardBad = 0
for (const [c, v] of Object.entries(G)) {
  if (!gCand.get(+c).has(v)) { guardBad++; console.log('GUARD lost', c, v) }
  if (gCand.get(+c).size === 0) { guardBad++; console.log('GUARD emptied', c) }
}
if (gCand.get(20).size !== 1) { guardBad++; console.log('GUARD touched the miss cell L0') }
console.log('pair guard:', guardBad === 0 ? 'OK' : 'FAIL')

// ---- Matching guard: the per-line bound sees co-existence, the naive tally does not ----
// n = 3, arc-consistent for all-different, yet only one hit is reachable:
//   L0 in {1,3}   L1 in {2,3}   L2 in {1,2}
// The naive possible = 2 (L0 can be a 1, L1 can be a 2), but placing both strands
// L2 on a 3 it does not hold. Both legal permutations, 1 3 2 and 3 2 1, hit exactly
// once, so the clue is forced to 1. The naive bound leaves {0,1,2}; matching pins 1.
const mCand = new Map([
  [500, new Set([0, 1, 2])],
  [30, new Set([1, 3])], [31, new Set([2, 3])], [32, new Set([1, 2])]
])
const mp = {
  hasValue: c => mCand.get(c).size === 1,
  getValue: c => [...mCand.get(c)][0],
  getCandidates: c => mCand.get(c),
  removeCandidateFromCell: (d, c) => { mCand.get(c).delete(d) },
  removeCandidatesFromCell: (s, c) => { const set = mCand.get(c); for (const d of s) set.delete(d) }
}
const mInst = {}
mod.setParams(mInst, 500, [30, 31, 32])
for (let pass = 0; pass < 10; pass++) { for (const _ of mod.update(mInst, mp)) { /* drain */ } }
let matchBad = 0
const clueLeft = [...mCand.get(500)].sort((a, b) => a - b).join(',')
if (clueLeft !== '1') { matchBad++; console.log('MATCH guard: clue left', clueLeft, 'expected 1') }
console.log('matching guard:', matchBad === 0 ? 'OK' : 'FAIL')

const ok = bad === 0 && sideBad === 0 && pairBad === 0 && dynBad === 0 &&
  guardBad === 0 && matchBad === 0 && pairFired > 0 && pruned8 > 0 && matchBeat > 0 &&
  !seenClues.has(8) && seenClues.has(0) && seenClues.has(9)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
