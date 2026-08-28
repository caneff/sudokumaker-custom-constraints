// Soundness fuzz for SkyscraperLineComponent. Soundness = a component never
// removes a cell's TRUE value. Each case is a random full line (a permutation,
// so all-different holds) with its two true clues, one per end. We seed random
// partial candidate states that still allow every true value, run the component
// to a fixpoint, and check the true values survived. A removed true value can
// make a real puzzle unsolvable.
//
// It also asserts the DP is EXACT, not merely sound, against a brute-force
// oracle at n=5 -- see the last block.
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

const mod = load('SkyscraperLineComponent.js', ['setParams', 'update', 'validate'])

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

// Soundness only asks that no true value is dropped, which a do-nothing
// component passes. The DP claims more: tracking the digit subset makes it a
// DECISION PROCEDURE for a line, so a value must survive EXACTLY when some full
// line assignment consistent with the candidates and both clues uses it. At
// n=5 that set is brute-forceable over all 120 permutations, so the check has a
// real verdict: a DP that merges its states by position rather than by digit
// subset keeps values the oracle rules out, and fails this on about two thirds
// of the states below.
const M = 5
installGlobals(1, M)
const PERMS = []
const permute = (a, rest) => {
  if (rest.length === 0) { PERMS.push(a); return }
  for (const d of rest) permute([...a, d], rest.filter(x => x !== d))
}
permute([], [1, 2, 3, 4, 5])
const smallLine = [...Array(M).keys()]
const smallInst = {}
mod.setParams(smallInst, CA, CB, smallLine)
let exactBad = 0
let exactRuns = 0
const EXACT = 2000
for (let iter = 0; iter < EXACT; iter++) {
  const perm = PERMS[(rnd() * PERMS.length) | 0]
  const truth = { [CA]: visible(perm), [CB]: visible([...perm].reverse()) }
  for (const i of smallLine) truth[i] = perm[i]
  const p = makePuzzle(truth, (c, v) => {
    const s = new Set([v])
    for (let d = 1; d <= M; d++) if (rnd() < 0.5) s.add(d)
    return [...s]
  })
  const start = new Map([...p._cand].map(([c, s]) => [c, new Set(s)]))
  // Every line the STARTING candidates and both clues allow, by brute force.
  const oracle = new Map([...start.keys()].map(c => [c, new Set()]))
  for (const q of PERMS) {
    const a = visible(q)
    const b = visible([...q].reverse())
    if (!start.get(CA).has(a) || !start.get(CB).has(b)) continue
    if (smallLine.some(i => !start.get(i).has(q[i]))) continue
    oracle.get(CA).add(a)
    oracle.get(CB).add(b)
    for (const i of smallLine) oracle.get(i).add(q[i])
  }
  if (oracle.get(CA).size === 0) continue // no valid line: the DP may leave anything
  exactRuns++
  while (Array.from(mod.update(smallInst, p)).length > 0) { /* to fixpoint */ }
  for (const [c, want] of oracle) {
    const got = p._cand.get(c)
    if (got.size !== want.size || [...want].some(d => !got.has(d))) {
      exactBad++
      if (exactBad <= 3) console.log('not exact at cell', c, 'kept', [...got].sort(), 'oracle', [...want].sort(), 'perm', perm)
      break
    }
  }
}
installGlobals(1, N)
console.log('exactness vs brute force (n=5):', exactRuns, 'states,', exactBad, 'disagreements')

// A line is a full house only when it holds every digit once, so the guard has
// to compare the line's length to the DIGIT COUNT, not to maxDigit. On a board
// with minDigit 0 the two differ: 0..9 is ten digits, so a nine-cell line is
// not a full house and the component must leave it alone. The line below is
// pinned to 0..8 -- a real line on such a board -- and every pinned value must
// survive.
installGlobals(0, 9)
const shortLine = [...Array(9).keys()]
const shortTruth = { [CA]: 9, [CB]: 1 }
for (const i of shortLine) shortTruth[i] = i
const shortP = makePuzzle(shortTruth, (c, v) => [v])
const shortInst = {}
mod.setParams(shortInst, CA, CB, shortLine)
const guardV = violates(mod, shortInst, shortP, shortTruth)
const guardBad = guardV ? 1 : 0
if (guardV) console.log('short-line guard violation', guardV)
console.log('short line on a 0-9 board:', guardBad, 'violations')

// The same board, now with a line as long as the digit count: ten cells over
// 0..9 is a full house, so the DP runs and every mask shifts by minDigit. A
// clue holds a visible count, and this board's digits stop at 9, so a line
// whose count reaches 10 has no clue the board can express -- those are not
// states a real puzzle reaches, and the fuzz skips them.
const ZN = 10
// `visible` starts its running max at 0, which suits a 1..N board. Here a
// building of height 0 is a real building and the first cell always sees it.
const visibleFromZero = vals => {
  let count = 0
  let max = -1
  for (const v of vals) if (v > max) { count++; max = v }
  return count
}
const zeroLine = [...Array(ZN).keys()]
const zeroInst = {}
mod.setParams(zeroInst, CA, CB, zeroLine)
const zeroSeed = (c, v) => {
  const mode = pick(['pin', 'full', 'subset'])
  if (mode === 'pin') return [v]
  if (mode === 'full') return [...Array(ZN).keys()]
  const set = new Set([v])
  for (let d = 0; d < ZN; d++) if (rnd() < 0.5) set.add(d)
  return [...set]
}
let zeroBad = 0
let zeroFired = 0
let zeroRuns = 0
for (let iter = 0; iter < FUZZ; iter++) {
  const perm = [...Array(ZN).keys()]
  for (let i = ZN - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
  const a = visibleFromZero(perm)
  const b = visibleFromZero([...perm].reverse())
  if (a > 9 || b > 9) continue // no clue digit on a 0..9 board carries a count of 10
  zeroRuns++
  const truth = { [CA]: a, [CB]: b }
  for (const i of zeroLine) truth[i] = perm[i]
  const zp = makePuzzle(truth, zeroSeed)
  const before = total(zp)
  const v = violates(mod, zeroInst, zp, truth)
  if (total(zp) < before) zeroFired++
  if (v) { zeroBad++; if (zeroBad <= 5) console.log('zero-based violation', v, 'perm', perm) }
}
console.log('full house on a 0-9 board:', zeroRuns, 'tests,', zeroBad, 'violations,', zeroFired, 'prune firings')

// `validate` is the correctness backstop and counts the visible buildings
// itself, so its running max has to start below the lowest digit. On a board
// starting at 0 the first cell is visible whatever it holds: this line's true
// clues are 2 and 3, and a max that starts at 0 misses the leading 0 and
// rejects a true solution.
const vPerm = [0, 9, 1, 8, 2, 7, 3, 6, 4, 5]
const vTruth = { [CA]: visibleFromZero(vPerm), [CB]: visibleFromZero([...vPerm].reverse()) }
for (const i of zeroLine) vTruth[i] = vPerm[i]
const validP = makePuzzle(vTruth, (c, v) => [v])
const validateOk = mod.validate(zeroInst, validP)
console.log('validate on a filled 0-9 line:', validateOk ? 'accepts the true solution' : 'REJECTS the true solution')

// A line longer than the mask width must be refused whatever the board's
// lowest digit is: a seventeen-cell line needs a visible count of 17, which no
// Uint16Array state can hold.
installGlobals(0, 16)
const wideLine = [...Array(17).keys()]
const wideTruth = { [CA]: 17, [CB]: 1 }
for (const i of wideLine) wideTruth[i] = i
const wideP = makePuzzle(wideTruth, (c, v) => [v])
const wideInst = {}
mod.setParams(wideInst, CA, CB, wideLine)
const wideV = violates(mod, wideInst, wideP, wideTruth)
const wideBad = wideV ? 1 : 0
if (wideV) console.log('over-wide line violation', wideV)
console.log('seventeen-cell line:', wideBad, 'violations')

installGlobals(1, N)

const ok = bad === 0 && fired > 0 && interleaveBad === 0 && exactBad === 0 && exactRuns > 0 && guardBad === 0 && zeroBad === 0 && zeroFired > 0 && zeroRuns > 0 && wideBad === 0 && validateOk
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
