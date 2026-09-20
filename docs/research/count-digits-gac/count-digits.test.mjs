// Worked examples for CountDigitsGacComponent: one hand-computed case per
// deduction the component makes, so a rule that stops firing fails here
// rather than only showing up as a strength number in the fuzz.
//
//   node docs/research/count-digits-gac/count-digits.test.mjs
//
// Every expected candidate set below is worked out by hand from the rule
// ("the counter cell holds the number of target cells whose digit is in the
// set"), not read back off the component.

import assert from 'assert'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makePuzzle } from '../../../examples/_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
installGlobals(1, 9)

const mod = load('CountDigitsGacComponent.js', ['getAffectedCells', 'setParams', 'update', 'validate'])

const COUNTER = 0
const TARGETS = [1, 2, 3, 4]
const ONE_OR_TWO = (1 << 1) | (1 << 2)

// A puzzle over the five cells, each with the candidate list given. `truth` is
// unused by the component; makePuzzle only wants a cell set to build.
function puzzleOf (candidatesByCell) {
  const truth = Object.fromEntries(Object.keys(candidatesByCell).map(c => [c, candidatesByCell[c][0]]))
  return makePuzzle(truth, cell => candidatesByCell[cell])
}

function run (candidatesByCell, { digits = ONE_OR_TWO, targets = TARGETS } = {}) {
  const p = puzzleOf(candidatesByCell)
  const instance = { name: 'count' }
  mod.setParams(instance, digits, COUNTER, targets)
  Array.from(mod.update(instance, p))
  const got = {}
  for (const [cell, set] of p._cand) got[cell] = [...set].sort((a, b) => a - b)
  return { p, got }
}

// Two cells certainly hold a 1 or a 2, one certainly does not, one may: the
// count is 2 or 3, and nothing else is possible for the counter.
{
  const { got } = run({ 0: [1, 2, 3, 4, 5, 6, 7, 8, 9], 1: [1], 2: [2], 3: [5], 4: [1, 5] })
  assert.deepStrictEqual(got[0], [2, 3], 'counter narrowed to [definite, possible]')
  assert.deepStrictEqual(got[4], [1, 5], 'an open target keeps both readings')
}

// The counter is pinned to the definite count, so the open target cannot be a
// hit as well: its in-set digits go.
{
  const { got } = run({ 0: [2], 1: [1], 2: [2], 3: [5], 4: [1, 5] })
  assert.deepStrictEqual(got[4], [5], 'a maxed-out count forces the open target out of the set')
}

// The counter is pinned to the possible count, so every cell that could be a
// hit must be one.
{
  const { got } = run({ 0: [3], 1: [1], 2: [2], 3: [5], 4: [1, 5] })
  assert.deepStrictEqual(got[4], [1], 'a count at its ceiling forces the open target into the set')
}

// A counter that cannot reach the possible count kills the branch.
{
  const { p } = run({ 0: [5], 1: [1], 2: [2], 3: [5], 4: [1, 5] })
  assert.notStrictEqual(p._stopped, null, 'a counter above the possible count stops the branch')
}

// ... and one below the definite count does too.
{
  const { p } = run({ 0: [1], 1: [1], 2: [2], 3: [5], 4: [1, 5] })
  assert.notStrictEqual(p._stopped, null, 'a counter below the definite count stops the branch')
}

// validate is the backstop: it refuses the same impossible states without
// removing anything.
{
  const p = puzzleOf({ 0: [5], 1: [1], 2: [2], 3: [5], 4: [1, 5] })
  const instance = { name: 'count' }
  mod.setParams(instance, ONE_OR_TWO, COUNTER, TARGETS)
  assert.strictEqual(mod.validate(instance, p), false, 'validate refuses an unreachable count')
}
{
  const p = puzzleOf({ 0: [2, 3], 1: [1], 2: [2], 3: [5], 4: [1, 5] })
  const instance = { name: 'count' }
  mod.setParams(instance, ONE_OR_TWO, COUNTER, TARGETS)
  assert.strictEqual(mod.validate(instance, p), true, 'validate accepts a reachable count')
}

// The counter is one of its own targets (the colleague's board,
// counter-in-targets/NOTES.md): digits {2,4,6,8}, counter R1C1 counting
// [itself, R2C2, R3C3], empty grid. The other two targets count 0..2, and the
// counter's own digit adds 1 when it is even, so value v needs v - [v even] in
// 0..2: 1 (0), 2 (1), 3 (3, out), 4 (3, out) ... only 1 and 2 survive.
{
  const EVENS = (1 << 2) | (1 << 4) | (1 << 6) | (1 << 8)
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const { got } = run({ 0: all, 1: all, 2: all }, { digits: EVENS, targets: [0, 1, 2] })
  assert.deepStrictEqual(got[0], [1, 2], 'a self-counting counter over 3 targets keeps 1,2')
}

// Five targets: the other four count 0..4, so 1..4 survive (5 needs 5 - 0 = 5 > 4).
{
  const EVENS = (1 << 2) | (1 << 4) | (1 << 6) | (1 << 8)
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const { got } = run({ 0: all, 1: all, 2: all, 3: all, 4: all }, { digits: EVENS, targets: [0, 1, 2, 3, 4] })
  assert.deepStrictEqual(got[0], [1, 2, 3, 4], 'a self-counting counter over 5 targets keeps 1..4')
}

// The forced rules see the counter's own contribution taken out. Counter in
// {1,2}, targets [self, 1]: the other target is open (1 or 5), digits {1,2}.
// v=1 is a hit itself so needs 0 from the other; v=2 is a hit and needs 1.
// Both stay possible, so the open target keeps both digits.
{
  const { got } = run({ 0: [1, 2], 1: [1, 5] }, { digits: ONE_OR_TWO, targets: [0, 1] })
  assert.deepStrictEqual(got[0], [1, 2])
  assert.deepStrictEqual(got[1], [1, 5], 'both readings of the other target survive')
}
// Counter in {1,5}: 1 is a hit needing 0 from the other, 5 is a miss needing
// 5 (impossible with one other target). So the counter is 1, and the other
// target cannot be a hit.
{
  const { got } = run({ 0: [1, 5], 1: [1, 5] }, { digits: ONE_OR_TWO, targets: [0, 1] })
  assert.deepStrictEqual(got[0], [1], 'the counter that cannot reach its miss value is forced')
  assert.deepStrictEqual(got[1], [5], 'and the other target leaves the set')
}

// The watch set is the counter plus its targets: the app re-runs update when
// any of them changes.
assert.deepStrictEqual(mod.getAffectedCells(ONE_OR_TWO, COUNTER, TARGETS), [COUNTER, ...TARGETS])

// setParams refuses a registration it cannot count. Each of these would
// otherwise miscount in silence: an array of digits coerces to a number when it
// holds one element, an empty mask counts nothing, and a target list past
// MAX_TARGETS runs the count off the end of a 32-bit mask.
{
  const instance = { name: 'count' }
  assert.throws(() => mod.setParams(instance, [1, 2], COUNTER, TARGETS), TypeError, 'an array of digits is refused')
  assert.throws(() => mod.setParams(instance, 0, COUNTER, TARGETS), RangeError, 'an empty digit mask is refused')
  assert.throws(
    () => mod.setParams(instance, ONE_OR_TWO, COUNTER, [...Array(31).keys()].map(i => i + 1)),
    RangeError,
    'a target list past the mask width is refused'
  )
}

console.log('ok')
