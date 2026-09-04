// Soundness fuzz for every skyscraper component. Soundness = a component never
// removes a cell's TRUE value. Each case is a random line with its true clues,
// one per clued end. We seed random partial candidate states that still allow
// every true value, run the component to a fixpoint, and check the true values
// survived. A removed true value can make a real puzzle unsolvable.
//
// Both DPs claim more than soundness -- each is a decision procedure for the
// line it reads -- so each is also held to a brute-force oracle at n=5.
//
//   node examples/skyscraper/soundness-harness.mjs            # 2,000 cases
//   FUZZ=20000 node examples/skyscraper/soundness-harness.mjs # deep run before a ship

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, violates, fixpoint } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { read, load, loadSource } = makeIo(HERE)
const { rnd, pick } = makeRng()
const FUZZ = Number(process.env.FUZZ) || 2000

const N = 9
installGlobals(1, N)

const mod = load('SkyscraperLineComponent.js', ['setParams', 'update', 'validate'])

// ---------------------------------------------------------------------------
// The one-sided DP: the LOCAL line component, one clue at one end of a drawn
// line. It claims soundness on every line kind (docs/line-contract.md), so it
// meets all three, and twice over: the ALLOW_TIES constant at the top of the
// file decides whether a building tied with the tallest so far is hidden
// (false) or counted (true), and both readings must be sound.
// ---------------------------------------------------------------------------

const ONE_SIDED_FILE = 'SkyscraperOneSidedComponent.js'
const ONE_SIDED_SRC = read(ONE_SIDED_FILE)
const TIES_FLAG = /^const ALLOW_TIES = (?:true|false)$/m
if (!TIES_FLAG.test(ONE_SIDED_SRC)) throw new Error(`${ONE_SIDED_FILE} has no 'const ALLOW_TIES = ...' line to flip`)

// The component as it would read with the constant set either way. The app
// pastes the file as its own segment, so a flag is a source edit, not a
// parameter: the harness makes the same edit.
function loadOneSided (allowTies) {
  return loadSource(ONE_SIDED_SRC.replace(TIES_FLAG, `const ALLOW_TIES = ${allowTies}`), ['setParams', 'update', 'validate'])
}

// The truth clue for one line of digits: buildings visible reading it inward.
// A fourth statement of the rule (CODING_STANDARDS.md, "The rule has one
// home") -- it must agree with the component, build_size.sky, and add_visibility.
function visibleWith (allowTies, vals) {
  let count = 0
  let max = -1
  for (const v of vals) {
    if (allowTies ? v >= max : v > max) count++
    if (v > max) max = v
  }
  return count
}

const ONE_SIDED_CLUE = 200

// The first cell where the candidates left standing differ from the oracle's,
// or null when every cell agrees. Both exactness checks below compare the same
// way and only differ in what they enumerate, so the comparison lives here once.
function disagreement (p, oracle) {
  for (const [c, want] of oracle) {
    const got = p._cand.get(c)
    if (got.size !== want.size || [...want].some(d => !got.has(d))) {
      return { cell: c, kept: [...got].sort(), want: [...want].sort() }
    }
  }
  return null
}
const oneSidedTotal = p => { let n = 0; for (const set of p._cand.values()) n += set.size; return n }
function fuzzOneSided (label, { allowTies, kind, n, iters }) {
  const oneSidedMod = loadOneSided(allowTies)
  const cells = Array.from({ length: n }, (_, i) => i)
  let bad = 0
  let fired = 0
  for (let iter = 0; iter < iters; iter++) {
    const digits = makeLine(rnd, kind, n, N)
    const truth = { [ONE_SIDED_CLUE]: visibleWith(allowTies, digits) }
    for (let i = 0; i < n; i++) truth[i] = digits[i]
    const p = makePuzzle(truth, seeder, { kind, digitCount: N })
    const inst = {}
    oneSidedMod.setParams(inst, ONE_SIDED_CLUE, cells)
    const before = oneSidedTotal(p)
    const v = violates(oneSidedMod, inst, p, truth)
    if (oneSidedTotal(p) < before) fired++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'line', digits.join('')) }
  }
  console.log(`${label}:`, iters, 'tests,', bad, 'violations,', fired, 'states pruned')
  return { bad, fired }
}

// `validate` is the component's last word on a filled line, and it reads the
// same tie flag `update` does. A filled line, its true clue, and that clue off
// by one: the first must pass and the second must fail, under both readings.
let oneSidedValidateBad = 0
for (const allowTies of [false, true]) {
  const oneSidedMod = loadOneSided(allowTies)
  for (const [kind, n] of [['bare', 7], ['house', 6], ['fullHouse', N]]) {
    const digits = makeLine(rnd, kind, n, N)
    const cells = digits.map((_, i) => i)
    const clue = visibleWith(allowTies, digits)
    const inst = {}
    oneSidedMod.setParams(inst, ONE_SIDED_CLUE, cells)
    const filledWith = k => {
      const truth = { [ONE_SIDED_CLUE]: k }
      for (let i = 0; i < n; i++) truth[i] = digits[i]
      return makePuzzle(truth, (c, v) => [v], { kind, digitCount: N })
    }
    const wrong = clue === 1 ? clue + 1 : clue - 1
    if (!oneSidedMod.validate(inst, filledWith(clue))) { oneSidedValidateBad++; console.log('validate rejected the true clue', clue, 'on', digits.join('')) }
    if (oneSidedMod.validate(inst, filledWith(wrong))) { oneSidedValidateBad++; console.log('validate accepted the clue', wrong, 'on', digits.join(''), 'whose count is', clue) }
  }
}
console.log('one-sided validate:', oneSidedValidateBad, 'wrong verdicts')

let oneSidedBad = 0
let oneSidedSilent = 0
for (const allowTies of [false, true]) {
  const tag = allowTies ? 'ties visible' : 'ties hidden '
  // A bare line is shorter than the digit count and may repeat; a house is
  // six distinct digits out of nine; a full house is a permutation of 1..9.
  for (const [kind, n] of [['bare', 7], ['house', 6], ['fullHouse', N]]) {
    const r = fuzzOneSided(`one-sided, ${kind.padEnd(9)} ${tag}`, { allowTies, kind, n, iters: 20000 })
    oneSidedBad += r.bad
    if (r.fired === 0) oneSidedSilent++
  }
}
console.log('one-sided:', oneSidedBad, 'violations,', oneSidedSilent, 'pools that never pruned')

// Soundness only asks that no true value is dropped, which a do-nothing
// component passes. The one-sided rule claims more: a drawn line's cells are
// tied to nothing but their own candidates, so a DECISION PROCEDURE for one
// clue and one line must keep a value EXACTLY when some fill of the line
// consistent with the candidates and the clue uses it. At n=5 over 5 digits
// that is 3,125 fills, so brute force gives the check a real verdict.
const EXACT_N = 5
let oneSidedExactBad = 0
let oneSidedExactRuns = 0
for (const allowTies of [false, true]) {
  const oneSidedMod = loadOneSided(allowTies)
  installGlobals(1, EXACT_N)
  const cells = [...Array(EXACT_N).keys()]
  const inst = {}
  oneSidedMod.setParams(inst, ONE_SIDED_CLUE, cells)
  for (let iter = 0; iter < 1000; iter++) {
    const digits = makeLine(rnd, 'bare', EXACT_N, EXACT_N)
    const truth = { [ONE_SIDED_CLUE]: visibleWith(allowTies, digits) }
    for (let i = 0; i < EXACT_N; i++) truth[i] = digits[i]
    const p = makePuzzle(truth, (c, v) => {
      const s = new Set([v])
      for (let d = 1; d <= EXACT_N; d++) if (rnd() < 0.5) s.add(d)
      return [...s]
    }, { kind: 'bare', digitCount: EXACT_N })
    const start = new Map([...p._cand].map(([c, s]) => [c, new Set(s)]))
    // Every fill the starting candidates and the clue allow, by brute force.
    const oracle = new Map([...start.keys()].map(c => [c, new Set()]))
    const fill = new Array(EXACT_N)
    const walk = i => {
      if (i === EXACT_N) {
        const k = visibleWith(allowTies, fill)
        if (!start.get(ONE_SIDED_CLUE).has(k)) return
        oracle.get(ONE_SIDED_CLUE).add(k)
        for (let j = 0; j < EXACT_N; j++) oracle.get(j).add(fill[j])
        return
      }
      for (const d of start.get(i)) { fill[i] = d; walk(i + 1) }
    }
    walk(0)
    if (oracle.get(ONE_SIDED_CLUE).size === 0) continue // no valid fill: anything may stay
    oneSidedExactRuns++
    fixpoint(oneSidedMod, inst, p)
    const d = disagreement(p, oracle)
    if (d !== null) {
      oneSidedExactBad++
      if (oneSidedExactBad <= 3) console.log('one-sided not exact at cell', d.cell, 'kept', d.kept, 'oracle', d.want, 'line', digits.join(''))
    }
  }
  installGlobals(1, N)
}
console.log('one-sided exactness vs brute force (n=5):', oneSidedExactRuns, 'states,', oneSidedExactBad, 'disagreements')

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
// The DP is a full-house rule and gates on the kind the mock declares
// (docs/line-contract.md), so every state built around a permutation says so.
const FULL = { kind: 'fullHouse', digitCount: N }
let bad = 0
let fired = 0 // coverage: the prune removed something, so the DP actually ran
const total = p => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }
for (let iter = 0; iter < FUZZ; iter++) {
  const perm = shuffled()
  const truth = { [CA]: visible(perm), [CB]: visible([...perm].reverse()) }
  for (const i of LINE) truth[i] = perm[i]
  const p = makePuzzle(truth, seeder, FULL)
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
const copyOf = q => { const r = makePuzzle({}, () => [], FULL); for (const [c, s] of q._cand) r._cand.set(c, new Set(s)); return r }

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
  const start = makePuzzle(truth, seeder, FULL)

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
  }, { kind: 'fullHouse', digitCount: M })
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
  const d = disagreement(p, oracle)
  if (d !== null) {
    exactBad++
    if (exactBad <= 3) console.log('not exact at cell', d.cell, 'kept', d.kept, 'oracle', d.want, 'perm', perm)
  }
}
installGlobals(1, N)
console.log('exactness vs brute force (n=5):', exactRuns, 'states,', exactBad, 'disagreements')

// ---------------------------------------------------------------------------
// The DP's gate. The DP reads the line as a permutation of 1..n, so it needs a
// full house whose digit set is {1..n} and it asks for that inside `update`
// (docs/line-contract.md). Three things to prove: it stands down on a bare
// line, it stands down on a full house of the wrong digit set, and it re-tests
// until the gate opens rather than caching the first, shut answer.
// ---------------------------------------------------------------------------

// A bare line an author drew: nine cells that may repeat. Ungated, the DP
// would read them as a permutation and prune what the line needs.
const bareInst = {}
mod.setParams(bareInst, CA, CB, LINE)
let bareRemovals = 0
let bareRepeats = 0
for (let iter = 0; iter < 2000; iter++) {
  const digits = makeLine(rnd, 'bare', N, N)
  if (new Set(digits).size < digits.length) bareRepeats++
  const truth = { [CA]: visible(digits), [CB]: visible([...digits].reverse()) }
  for (const i of LINE) truth[i] = digits[i]
  const bp = makePuzzle(truth, seeder, { kind: 'bare', digitCount: N })
  const before = total(bp)
  fixpoint(mod, bareInst, bp)
  bareRemovals += before - total(bp)
}
console.log('bare line:', bareRemovals, 'candidates removed,', bareRepeats, 'of 2000 lines repeat a digit')

// A full house of the WRONG digit set: nine cells holding {0..8} on a 0..9
// board. Every cell is distinct and the line is as long as maxDigit, so a gate
// that only counts digits opens here -- and the DP would then rule out the
// ascending line, whose left clue is the count 9 and right clue the count 1.
// Both readings are checked, with the clue cells unclued and with them pinned.
installGlobals(0, 9)
const zeroLine = [...Array(9).keys()]
const zeroInst = {}
mod.setParams(zeroInst, CA, CB, zeroLine)
const unclued = [...Array(10).keys()]
const zeroOpts = { kind: 'fullHouse', digitCount: 10 }
let zeroRemovals = 0
for (const pinClues of [false, true]) {
  const truth = { [CA]: 9, [CB]: 1 }
  for (const i of zeroLine) truth[i] = i
  const zp = makePuzzle(truth, c => (c === CA || c === CB ? (pinClues ? [truth[c]] : unclued) : [truth[c]]), zeroOpts)
  const before = total(zp)
  fixpoint(mod, zeroInst, zp)
  const gone = before - total(zp)
  zeroRemovals += gone
  if (gone) console.log('zero-based board,', pinClues ? 'clued' : 'unclued', 'removed', gone, 'candidates')
}
console.log('zero-based board:', zeroRemovals, 'candidates removed')

// `validate` judges a line the DP never gated, so it stands down behind the
// same gate.
const filled = { [CA]: 9, [CB]: 1 }
for (const i of zeroLine) filled[i] = i
const zeroValidates = mod.validate(zeroInst, makePuzzle(filled, (c, v) => [v], zeroOpts))
console.log('validate on a zero-based board:', zeroValidates ? 'stands down' : 'JUDGES THE LINE')

// The re-test path. Same 0..9 board, but the line is a permutation of 1..9
// with the 0 still live on every cell: the gate is shut on the first update
// because the digit set is {0..9}, and must open once the 0 goes. An instance
// that cached the first answer would stay silent for good.
const liveZeroInst = {}
const permOf19 = [4, 1, 7, 2, 9, 3, 8, 5, 6]
mod.setParams(liveZeroInst, CA, CB, zeroLine)
const liveTruth = { [CA]: visible(permOf19), [CB]: visible([...permOf19].reverse()) }
for (const i of zeroLine) liveTruth[i] = permOf19[i]
const openLine = [...Array(10).keys()] // every digit of the 0..9 board
const withZero = makePuzzle(liveTruth, (c, v) => (c === CA || c === CB ? [v] : openLine), zeroOpts)
const zeroLiveBefore = total(withZero)
fixpoint(mod, liveZeroInst, withZero)
const shutWhileZeroLive = total(withZero) === zeroLiveBefore
for (const i of zeroLine) withZero._cand.get(i).delete(0)
const afterZeroGone = total(withZero)
fixpoint(mod, liveZeroInst, withZero)
const opensAfterZeroGoes = total(withZero) < afterZeroGone
console.log('0 live on the first update:', shutWhileZeroLive ? 'gate shut' : 'GATE OPEN',
  '/ after the 0 goes:', opensAfterZeroGoes ? 'gate opens' : 'STAYS SHUT')

// One instance across a backtrack (#336). The app shares the component object
// across every search node, so a gate cached open deep in a branch is still
// open after the search returns to a parent state where the line has regained
// its 0. Same zero-based board as above, judged by an instance that saw a
// {1..9} line first.
const latchInst = {}
mod.setParams(latchInst, CA, CB, zeroLine)
const deepOpen = makePuzzle(liveTruth, (c, v) => (c === CA || c === CB ? [v] : [1, 2, 3, 4, 5, 6, 7, 8, 9]), zeroOpts)
fixpoint(mod, latchInst, deepOpen) // a {1..9} line: the gate opens here
const backTruth = { [CA]: 9, [CB]: 1 }
for (const i of zeroLine) backTruth[i] = i
const backP = makePuzzle(backTruth, (c, v) => (c === CA || c === CB ? unclued : [v]), zeroOpts)
const lineLatchBad = violates(mod, latchInst, backP, backTruth)
console.log('line gate after a backtrack:', lineLatchBad === null ? 'gate re-shuts' : `STAYS OPEN ${JSON.stringify(lineLatchBad)}`)
installGlobals(1, N)

// ---------------------------------------------------------------------------
// One 1 per side. A clue of 1 says the cell next to it tops its whole line, and
// on a frame the cells next to one side are a house, so exactly one clue on
// that side is a 1. The rule needs every line of the side to be a full house of
// {1..n} AND the nearest rank to be one, so the component asks for both in
// `update`. Fixture: a 5x5 Latin square read from the left, its five rows as
// the lines and its first column as the rank -- then the same states again with
// the mock reporting bare lines, where the component must go quiet.
// ---------------------------------------------------------------------------

const sideMod = load('SkyscraperSideComponent.js', ['setParams', 'update', 'validate'])
const S = 5
const SIDE_CLUE = 300 // clue cells are SIDE_CLUE + row

// A Latin square whose first column is a permutation too: row r reads the digit
// relabelling from its own start, so no column repeats.
function latinSquare () {
  const digits = [...Array(S).keys()].map(i => i + 1)
  for (let i = S - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [digits[i], digits[j]] = [digits[j], digits[i]] }
  const starts = [...Array(S).keys()]
  for (let i = S - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [starts[i], starts[j]] = [starts[j], starts[i]] }
  return starts.map(start => Array.from({ length: S }, (_, c) => digits[(start + c) % S]))
}

function fuzzSide (label, kind, iters) {
  const clues = Array.from({ length: S }, (_, r) => SIDE_CLUE + r)
  const lines = Array.from({ length: S }, (_, r) => Array.from({ length: S }, (_, c) => r * S + c))
  let bad = 0
  let fired = 0
  for (let iter = 0; iter < iters; iter++) {
    const rows = latinSquare()
    const truth = {}
    for (let r = 0; r < S; r++) {
      truth[clues[r]] = visible(rows[r])
      for (let c = 0; c < S; c++) truth[lines[r][c]] = rows[r][c]
    }
    const p = makePuzzle(truth, (c, v) => {
      const set = new Set([v])
      for (let d = 1; d <= S; d++) if (rnd() < 0.4) set.add(d)
      return [...set]
    }, { kind, digitCount: S })
    const inst = {}
    sideMod.setParams(inst, clues, lines)
    const before = total(p)
    const v = violates(sideMod, inst, p, truth)
    if (total(p) < before) fired++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v) }
  }
  console.log(`${label}:`, iters, 'tests,', bad, 'violations,', fired, 'states pruned')
  return { bad, fired }
}

installGlobals(1, S)
const sideFull = fuzzSide('side component, full house', 'fullHouse', 5000)
const sideBare = fuzzSide('side component, bare      ', 'bare', 5000)
installGlobals(1, N)

// The side gate across a backtrack (#336), same shape. Deep node: every line
// holds {1..5}, so the gate opens. Parent: a six-digit board where each line
// can still hold {1..6}, so two lines can each start with their own tallest
// building and two clues are legally 1 -- rows 0 and 1 below both read 1. A
// latched gate pins the side's single 1 on the first clue and takes the true
// 1 off the second.
installGlobals(1, 6)
const sideRows = [[6, 1, 2, 3, 4], [5, 1, 2, 3, 4], [4, 6, 1, 2, 3], [3, 6, 1, 2, 4], [2, 6, 1, 3, 4]]
const sideClues = Array.from({ length: S }, (_, r) => SIDE_CLUE + r)
const sideLines = Array.from({ length: S }, (_, r) => Array.from({ length: S }, (_, c) => r * S + c))
const sideTruth = {}
for (let r = 0; r < S; r++) {
  sideTruth[sideClues[r]] = visible(sideRows[r])
  for (let c = 0; c < S; c++) sideTruth[sideLines[r][c]] = sideRows[r][c]
}
const sideState = fill => makePuzzle(sideTruth, (c, v) => (c === sideClues[0] ? [1] : c >= SIDE_CLUE ? [1, 2, 3, 4, 5, 6] : fill), { kind: 'fullHouse', digitCount: 6 })
const sideLatchInst = {}
sideMod.setParams(sideLatchInst, sideClues, sideLines)
fixpoint(sideMod, sideLatchInst, sideState([1, 2, 3, 4, 5])) // deep node: the gate opens here
const sideLatchBad = violates(sideMod, sideLatchInst, sideState([1, 2, 3, 4, 5, 6]), sideTruth)
console.log('side gate after a backtrack:', sideLatchBad === null ? 'gate re-shuts' : `STAYS OPEN ${JSON.stringify(sideLatchBad)}`)
installGlobals(1, N)

const ok = bad === 0 && fired > 0 && interleaveBad === 0 && exactBad === 0 && exactRuns > 0 &&
  oneSidedBad === 0 && oneSidedSilent === 0 && oneSidedValidateBad === 0 &&
  oneSidedExactBad === 0 && oneSidedExactRuns > 0 &&
  bareRemovals === 0 && bareRepeats > 0 &&
  zeroRemovals === 0 && zeroValidates && shutWhileZeroLive && opensAfterZeroGoes &&
  lineLatchBad === null && sideLatchBad === null &&
  sideFull.bad === 0 && sideFull.fired > 0 && sideBare.fired === 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
