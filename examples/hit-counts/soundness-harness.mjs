// Soundness fuzz for the Hit Counts components. Soundness = a component never
// removes a cell's TRUE value. We seed random partial states in which every cell
// still allows its true value, run the component to a fixpoint, and check the
// true value survived. A removed true value is a bug that can make a real puzzle
// unsolvable.
//
//   node examples/hit-counts/soundness-harness.mjs
//
// The line component is fuzzed on all three line kinds (docs/line-contract.md):
// a bare line an author drew, a house, and a full house. The count bounds are
// sound on every kind; the no-n-1 rule needs a full house whose digit set is
// {1..n}, so each pool carries a line whose true clue IS n - 1 — on a bare
// line, on a house, and on a nine-cell house of {0..8}. Ungated, the rule
// removes that true clue value and the run goes red.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng()

installGlobals(0, 9)

const mod = load('HitCountsComponent.js', ['setParams', 'update', 'initialize', 'validate'])
const sideMod = load('SideSumComponent.js', ['setParams', 'update'])
const pairMod = load('HitCountsPairComponent.js', ['setParams', 'update'])

// A random candidate seed keeping the true value. `hi` bounds the range: line
// cells use 1..9, the clue cell uses 0..9 (it can be 0).
function seeder (lo, hi) {
  return (c, v) => {
    const mode = [1, 2, 3][(rnd() * 3) | 0]
    if (mode === 1) return [v] // pinned
    const s = new Set([v])
    for (let d = lo; d <= hi; d++) if (rnd() < 0.5) s.add(d) // subset keeping truth
    return [...s]
  }
}

const CLUE = 100
const hits = line => line.reduce((k, x, i) => k + (x === i + 1 ? 1 : 0), 0)

// One line-kind fuzz. `kind` is what the mock answers for
// `getCellsCanHaveRepeats`, declared per case and never inferred from the
// digits. `lo`/`hi` bound the line's digits, `clueHi` the clue's. Returns the
// violation count, the clue values seen, and how often the n - 1 prune fired.
function fuzzLines (label, { kind, lines, lo, hi, clueHi, iters }) {
  let tests = 0
  let bad = 0
  let prunes = 0
  const seen = new Set()
  for (let iter = 0; iter < iters; iter++) {
    const line = lines[iter % lines.length]
    const cells = line.map((_, i) => i)
    const clueVal = hits(line)
    seen.add(clueVal)
    const truth = { [CLUE]: clueVal }
    for (let i = 0; i < line.length; i++) truth[i] = line[i]
    const lineSeed = seeder(lo, hi)
    const clueSeed = seeder(0, clueHi)
    const p = makePuzzle(truth, (c, v) => (c === CLUE ? clueSeed : lineSeed)(c, v), { kind, digitCount: 9 })
    const inst = {}
    mod.setParams(inst, CLUE, cells)
    const nMinus1 = line.length - 1
    // Bracket `initialize` alone: it runs the no-n-1 rule and nothing else, so
    // this counts that rule's firings. Over the whole fixpoint the bare count
    // bounds also take n - 1 in plenty of states, which says nothing about the
    // gate.
    const had = p.getCandidates(CLUE).has(nMinus1)
    Array.from(mod.initialize(inst, p))
    if (had && !p.getCandidates(CLUE).has(nMinus1)) prunes++
    const v = violates(mod, inst, p, truth)
    tests++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'clue', clueVal, 'line', line.join('')) }
  }
  console.log(`${label}:`, tests, 'tests,', bad, 'violations,', prunes, 'n-1 prunes')
  return { bad, prunes, seen }
}

// ---- full house: a permutation of 1..9, plus the two forced extremes ----
const fullLines = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 1]] // identity (9), derangement (0)
for (let i = 0; i < 400; i++) fullLines.push(makeLine(rnd, 'fullHouse', 9, 9))
const full = fuzzLines('hit-counts line, full house', { kind: 'fullHouse', lines: fullLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
console.log('clue values exercised:', [...full.seen].sort((a, b) => a - b).join(' '))

// ---- bare: an author-drawn line, digits may repeat and n - 1 hits is legal ----
const bareLines = [[1, 2, 3, 4, 5, 6, 7, 8, 1]] // eight hits on nine cells: clue 8 = n - 1
for (let i = 0; i < 400; i++) bareLines.push(makeLine(rnd, 'bare', 9, 9))
const bare = fuzzLines('hit-counts line, bare      ', { kind: 'bare', lines: bareLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })

// ---- house: six distinct digits out of nine, so n - 1 hits is legal ----
const houseLines = [[1, 2, 3, 4, 5, 9]] // five hits on six cells: clue 5 = n - 1
for (let i = 0; i < 400; i++) houseLines.push(makeLine(rnd, 'house', 6, 9))
const house = fuzzLines('hit-counts line, house     ', { kind: 'house', lines: houseLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })

// ---- minDigit 0: a nine-cell house of {0..8}, all different but not {1..9} ----
// The board runs minDigit 0 for the clue ring. A line whose live digits are
// {0..8} passes the full-house count (nine digits over nine cells) yet can hit
// n - 1 times, so the no-n-1 rule must check the digit set itself.
const zeroLines = [[1, 2, 3, 4, 5, 6, 7, 8, 0]] // eight hits: clue 8 = n - 1
for (let i = 0; i < 400; i++) {
  const l = makeLine(rnd, 'fullHouse', 9, 9).map(d => d - 1) // a permutation of 0..8
  zeroLines.push(l)
}
const zero = fuzzLines('hit-counts line, {0..8}    ', { kind: 'fullHouse', lines: zeroLines, lo: 0, hi: 8, clueHi: 8, iters: 40000 })

// ---- the gate re-opens once the cage removes 0 ----
// On a hit-counts board 0 is live on the inner grid at the first update and a
// cage takes it away during solving. While 0 is live the line is not a full
// house of {1..9} and the no-n-1 rule must stand down; once 0 goes, the SAME
// instance must notice and prune n - 1.
const RETEST_LINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const retestTruth = { [CLUE]: 0 }
for (let i = 0; i < 9; i++) retestTruth[i] = ((i + 1) % 9) + 1 // a derangement of 1..9: clue 0
const rp = makePuzzle(retestTruth, () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], { kind: 'fullHouse', digitCount: 9 })
const rInst = {}
mod.setParams(rInst, CLUE, RETEST_LINE)
Array.from(mod.initialize(rInst, rp))
Array.from(mod.update(rInst, rp))
const heldWhileZeroLive = rp.getCandidates(CLUE).has(8)
for (const c of RETEST_LINE) rp._cand.get(c).delete(0) // the cage bites
Array.from(mod.update(rInst, rp))
const prunedAfterCage = !rp.getCandidates(CLUE).has(8)
const retestOk = heldWhileZeroLive && prunedAfterCage
console.log('minDigit 0 re-test:', retestOk ? 'OK' : `FAIL (held ${heldWhileZeroLive}, pruned after cage ${prunedAfterCage})`)

// ---- a full house of the wrong digit set does not lock the gate shut ----
// Nine cells holding {0..8} are nine digits over nine cells, so the line counts
// as a full house while its digit set is still wrong. Cache the answer on the
// kind there and the gate would stay shut for good. It must keep asking: once
// the digits settle on {1..9} the same instance prunes n - 1.
const wp = makePuzzle(retestTruth, () => [0, 1, 2, 3, 4, 5, 6, 7, 8], { kind: 'fullHouse', digitCount: 9 })
const wInst = {}
mod.setParams(wInst, CLUE, RETEST_LINE)
Array.from(mod.update(wInst, wp))
const heldOnWrongSet = wp.getCandidates(CLUE).has(8)
for (const c of RETEST_LINE) { wp._cand.get(c).delete(0); wp._cand.get(c).add(9) }
Array.from(mod.update(wInst, wp))
const wrongSetOk = heldOnWrongSet && !wp.getCandidates(CLUE).has(8)
console.log('{0..8} full house re-test:', wrongSetOk ? 'OK' : `FAIL (held ${heldOnWrongSet})`)

// ---- validate gates on the same fact ----
// A clue of n - 1 is illegal only on a full house of {1..n}. On a bare line it
// is a legal state and validate must accept it.
function validateAt (kind) {
  const truth = { [CLUE]: 8 }
  for (let i = 0; i < 9; i++) truth[i] = i + 1
  const p = makePuzzle(truth, c => (c === CLUE ? [8] : [1, 2, 3, 4, 5, 6, 7, 8, 9]), { kind, digitCount: 9 })
  const inst = {}
  mod.setParams(inst, CLUE, [0, 1, 2, 3, 4, 5, 6, 7, 8])
  return mod.validate(inst, p)
}
const validateOk = validateAt('bare') === true && validateAt('fullHouse') === false
console.log('validate gate:', validateOk ? 'OK' : 'FAIL')

// ---- Side-sum component: n clues on a side sum to exactly n ----
// The proof regroups the side's hits by the perpendicular line each lands on:
// every such line holds its own digit exactly once, so it contributes one hit,
// n in all. The component therefore gets the n perpendicular lines and fires
// only while each is a full house of {1..n}.
const N = 9
const SIDE = [200, 201, 202, 203, 204, 205, 206, 207, 208]
const PERP = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => 1000 + i * N + j))
function composition () {
  const v = new Array(N).fill(0)
  for (let h = 0; h < N; h++) v[(rnd() * N) | 0]++ // drop nine hits into nine slots
  return v
}
// A Latin square: every perpendicular line holds 1..9 exactly once.
const perpValue = (i, j) => ((i + j) % N) + 1

// `sums` decides the clue truths: full-house perpendiculars come with a side
// that really does sum to N; the bare run uses clues that do not, which the
// gate must leave alone.
function fuzzSide (label, { kind, sums, iters }) {
  let tests = 0
  let bad = 0
  let fired = 0
  for (let iter = 0; iter < iters; iter++) {
    const vals = sums()
    const truth = {}
    for (let i = 0; i < N; i++) truth[SIDE[i]] = vals[i]
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) truth[PERP[i][j]] = perpValue(i, j)
    const clueSeed = seeder(0, 9)
    const p = makePuzzle(truth, (c, v) => (c >= 1000 ? [v] : clueSeed(c, v)), { kind, digitCount: 9 })
    const before = [...p._cand.values()].reduce((s, x) => s + x.size, 0)
    const inst = {}
    sideMod.setParams(inst, SIDE, N, PERP)
    const v = violates(sideMod, inst, p, truth)
    const after = [...p._cand.values()].reduce((s, x) => s + x.size, 0)
    if (after < before) fired++
    tests++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'vals', vals.join('')) }
  }
  console.log(`${label}:`, tests, 'tests,', bad, 'violations,', fired, 'states pruned')
  return { bad, fired }
}

const sideFull = fuzzSide('side-sum, full-house perpendiculars', { kind: 'fullHouse', sums: composition, iters: 20000 })
// Bare perpendiculars: the clues need not sum to N at all, so any pruning the
// component does is unsound. It must stay silent.
const sideBare = fuzzSide('side-sum, bare perpendiculars      ', {
  kind: 'bare',
  sums: () => Array.from({ length: N }, () => 1 + ((rnd() * 9) | 0)),
  iters: 20000
})

// ---- Pair component: opposite clues cap each other; the extreme pins each cell ----
// A bare rule (docs/line-contract.md): the cap argument needs no house, so the
// pair component has no gate and is fuzzed on plain permutations.
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
let pairFired = 0 // coverage: the extreme (every-cell-a-hit) branch ran
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
  const perm = fullLines[iter % fullLines.length]
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
const G = { 400: 0, 401: 3, 20: 2, 21: 3, 22: 2, 23: 1 } // clueA, clueB, L0..L3
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
Array.from(pairMod.update(gInst, gp)) // drain
let guardBad = 0
for (const [c, v] of Object.entries(G)) {
  if (!gCand.get(+c).has(v)) { guardBad++; console.log('GUARD lost', c, v) }
  if (gCand.get(+c).size === 0) { guardBad++; console.log('GUARD emptied', c) }
}
if (gCand.get(20).size !== 1) { guardBad++; console.log('GUARD touched the miss cell L0') }
console.log('pair guard:', guardBad === 0 ? 'OK' : 'FAIL')

const ok = full.bad === 0 && bare.bad === 0 && house.bad === 0 && zero.bad === 0 &&
  sideFull.bad === 0 && sideBare.bad === 0 && pairBad === 0 && dynBad === 0 &&
  guardBad === 0 && pairFired > 0 && retestOk && wrongSetOk && validateOk &&
  full.prunes > 0 && bare.prunes === 0 && house.prunes === 0 && zero.prunes === 0 &&
  sideFull.fired > 0 && sideBare.fired === 0 &&
  !full.seen.has(8) && full.seen.has(0) && full.seen.has(9)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
