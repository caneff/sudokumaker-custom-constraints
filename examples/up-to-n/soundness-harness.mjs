// Soundness fuzz for UpToNComponent. Soundness = the component never removes a
// cell's TRUE value. Each state is a line whose digits satisfy the clue, seeded
// with random candidate sets that keep every true digit; the component runs to
// a fixpoint and every true digit must survive.
//
//   node examples/up-to-n/soundness-harness.mjs
//
// The rule is defined on any line (docs/line-contract.md), so the pools cover
// every kind at each shipped size: a full house (a row of the grid), a house
// shorter than the digit count, and a bare line whose digits repeat -- one
// pool of those carries the target digit more than once, so the FIRST one is
// the one that has to count. A clue is only true of a line that holds its
// target, so a line with the target absent has no true state to seed; the
// agreement check below covers it instead, where `validate` must refuse such a
// line and `update` must kill it.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, makeSeeder, housesOf, total, violates, fixpoint } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng(368)
const mod = load('UpToNComponent.js', ['setParams', 'update', 'validate'])

// The rule, stated a third time (CODING_STANDARDS.md, "The rule has one
// home"): the sum of the digits strictly before the first `target`, or null
// when the line never holds it. It must agree with the component and
// with build_size.py's `up_to_n` and its CP-SAT model.
function upToN (digits, target) {
  let sum = 0
  for (const d of digits) {
    if (d === target) return sum
    sum += d
  }
  return null
}

const ITERS = 20000
const SIZES = [4, 6, 9]

const seeder = D => makeSeeder(rnd, Array.from({ length: D }, (_, i) => i + 1))

// A line of the kind asked for that holds `target` at least once (`atLeast`
// times for the repeated-target pool).
function lineWith (kind, n, D, target, atLeast = 1) {
  for (;;) {
    const digits = makeLine(rnd, kind, n, D)
    if (atLeast > 1) {
      // Plant the extra copies at random positions: a uniform bare line rarely
      // repeats a given digit on its own.
      for (let k = 0; k < atLeast; k++) digits[(rnd() * n) | 0] = target
    }
    if (digits.filter(d => d === target).length >= atLeast) return digits
  }
}

function fuzz (label, { kind, D, n, atLeast = 1 }) {
  installGlobals(1, D)
  const cells = Array.from({ length: n }, (_, i) => i)
  let bad = 0
  let fired = 0
  for (let iter = 0; iter < ITERS; iter++) {
    const target = 1 + ((rnd() * D) | 0)
    const digits = lineWith(kind, n, D, target, atLeast)
    const clue = upToN(digits, target)
    const truth = {}
    for (let i = 0; i < n; i++) truth[i] = digits[i]
    const p = makePuzzle(truth, seeder(D), { houses: housesOf(kind, cells) })
    const inst = {}
    mod.setParams(inst, cells, target, clue)
    const before = total(p)
    const v = violates(mod, inst, p, truth)
    if (total(p) < before) fired++
    if (v) {
      bad++
      if (bad <= 5) console.log(label, 'violation', v, 'line', digits.join(''), 'N', target, 'clue', clue)
    }
  }
  console.log(`${label.padEnd(28)}`, ITERS, 'tests,', bad, 'violations,', fired, 'states pruned')
  return { bad, fired }
}

let bad = 0
for (const D of SIZES) {
  const pools = [
    [`full house ${D}`, { kind: 'fullHouse', D, n: D }],
    [`house ${D - 1} of ${D}`, { kind: 'house', D, n: D - 1 }],
    [`bare ${D}, repeats`, { kind: 'bare', D, n: D }],
    [`bare ${D}, target twice`, { kind: 'bare', D, n: D, atLeast: 2 }]
  ]
  for (const [label, opts] of pools) {
    const r = fuzz(label, opts)
    bad += r.bad
    assert.ok(r.fired > 0, `${label}: the component never pruned, so the pool proves nothing`)
  }
}

// ---- `update` and `validate` agree on a filled line ----
//
// Pinned to its digits, a line is a finished assignment. `validate` accepts it
// exactly when the clue holds, and `update` must then leave it whole; when the
// clue fails -- a wrong sum, or no target at all -- `update` must empty a cell
// or stop, so the solver drops the branch rather than trusting `validate`
// alone. Clues range over every reachable sum, 0 included, not only the true
// one.
let disagree = 0
let runs = 0
for (const D of SIZES) {
  installGlobals(1, D)
  const cells = Array.from({ length: D }, (_, i) => i)
  for (let iter = 0; iter < 4000; iter++) {
    const kind = pick(['bare', 'fullHouse'])
    const digits = makeLine(rnd, kind, D, D)
    const target = 1 + ((rnd() * D) | 0)
    const clue = (rnd() * D * D) | 0
    const truth = {}
    for (let i = 0; i < D; i++) truth[i] = digits[i]
    const inst = {}
    mod.setParams(inst, cells, target, clue)
    const accepted = mod.validate(inst, makePuzzle(truth, (c, v) => [v], { houses: housesOf(kind, cells) }))
    const p = makePuzzle(truth, (c, v) => [v], { houses: housesOf(kind, cells) })
    fixpoint(mod, inst, p)
    const killed = p._stopped !== null || [...p._cand.values()].some(s => s.size === 0)
    const holds = upToN(digits, target) === clue
    runs++
    if (accepted !== holds || killed === holds) {
      disagree++
      if (disagree <= 5) console.log('disagree on', digits.join(''), 'N', target, 'clue', clue, { accepted, killed, holds })
    }
  }
}
console.log('update/validate agreement on filled lines:', runs, 'lines,', disagree, 'disagreements')

// A dead line's stop names its marker: the line's first cell, the border cell
// the clue is read from, even when that is the line's highest cell id.
{
  installGlobals(1, 4)
  const inst = {}
  mod.setParams(inst, [3, 2, 1, 0], 4, 1)
  const p = makePuzzle({ 0: 1, 1: 2, 2: 3, 3: 4 }, (c, v) => [v], { houses: [[0, 1, 2, 3]] })
  fixpoint(mod, inst, p)
  // cell 3 is R1C4 on the mock's 9-wide naming; the lowest cell id, 0, is R1C1.
  assert.match(String(p._stopped), /R1C4/, 'the stop names the marker, not the lowest cell id')
}

console.log('UpToNComponent:', bad, 'violations')
assert.strictEqual(bad, 0)
assert.strictEqual(disagree, 0)
console.log('PASS')
