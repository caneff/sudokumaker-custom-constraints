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
import { installGlobals, makeIo, makeRng, makePuzzle, violates, fixpoint } from '../_shared/harness-lib.mjs'

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

// The component only holds on a board whose digits start at 1 -- the head
// comment of SkyscraperLineComponent.js says why -- so on any other board it
// must remove nothing at all.
//
// The line below is the shape that reaches the DP on a 0..9 board: nine cells,
// as long as maxDigit, so the full-house guard lets it through, but ten digits
// exist and the line is not a full house. It ascends 0..8, so its left clue is
// the count 9 and its right clue the count 1. Both readings are checked, with
// the clue cells unclued and with them pinned to those counts.
installGlobals(0, 9)
const zeroLine = [...Array(9).keys()]
const zeroInst = {}
mod.setParams(zeroInst, CA, CB, zeroLine)
const unclued = [...Array(10).keys()]
let zeroRemovals = 0
for (const pinClues of [false, true]) {
  const truth = { [CA]: 9, [CB]: 1 }
  for (const i of zeroLine) truth[i] = i
  const zp = makePuzzle(truth, c => (c === CA || c === CB ? (pinClues ? [truth[c]] : unclued) : [truth[c]]))
  const before = total(zp)
  fixpoint(mod, zeroInst, zp)
  const gone = before - total(zp)
  zeroRemovals += gone
  if (gone) console.log('zero-based board,', pinClues ? 'clued' : 'unclued', 'removed', gone, 'candidates')
}
console.log('zero-based board:', zeroRemovals, 'candidates removed')

// `validate` counts the visible buildings itself and its running max starts at
// 0, so on this board it would miss the leading 0 and reject a filled line the
// component never judged. It has to stand down with `update`.
const filled = { [CA]: 9, [CB]: 1 }
for (const i of zeroLine) filled[i] = i
const zeroValidates = mod.validate(zeroInst, makePuzzle(filled, (c, v) => [v]))
console.log('validate on a zero-based board:', zeroValidates ? 'stands down' : 'JUDGES THE LINE')
installGlobals(1, N)

const ok = bad === 0 && fired > 0 && interleaveBad === 0 && exactBad === 0 && exactRuns > 0 && zeroRemovals === 0 && zeroValidates
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
