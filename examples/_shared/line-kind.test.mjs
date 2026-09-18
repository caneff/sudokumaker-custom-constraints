// lineKind, the one line-kind gate the outside-clue components splice in
// (docs/line-contract.md, "How a component gates"). Run:
//   node examples/_shared/line-kind.test.mjs

import assert from 'assert'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { makeIo, makePuzzle } from './harness-lib.mjs'

const { load } = makeIo(dirname(fileURLToPath(import.meta.url)))
const { lineKind, BARE, HOUSE, FULL_HOUSE } = load('line-kind.js', ['lineKind', 'BARE', 'HOUSE', 'FULL_HOUSE'])

const LINE = [0, 1, 2, 3]
const CLUE = 100
const state = (cands, houses = [LINE]) =>
  makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0, [CLUE]: 0 }, c => (c === CLUE ? [1] : cands[c]), { houses })
const ONE_TO_FOUR = [[1, 2], [2, 3], [3, 4], [4, 1]]

// ---- the three kinds, and the digit set on a full house ----
assert.deepStrictEqual(lineKind({}, state(ONE_TO_FOUR, []), LINE), { kind: BARE, oneToN: false })
assert.deepStrictEqual(lineKind({}, state([[1, 5], [2], [3], [4]]), LINE), { kind: HOUSE, oneToN: false })
assert.deepStrictEqual(lineKind({}, state(ONE_TO_FOUR), LINE), { kind: FULL_HOUSE, oneToN: true })
// four digits over four cells, but not 1..4: a full house of the wrong set
assert.deepStrictEqual(lineKind({}, state([[0], [1], [2], [3]]), LINE), { kind: FULL_HOUSE, oneToN: false })
assert.ok(BARE < HOUSE && HOUSE < FULL_HOUSE, 'a gate reads `kind >= HOUSE`')

// ---- query the line alone: the clue cell is in no house with it ----
assert.strictEqual(lineKind({}, state(ONE_TO_FOUR), [CLUE, ...LINE]).kind, BARE)

// ---- one instance, a union that changes between calls (#336) ----
// The app shares one component object across every search node. Deep in a
// branch the union is {1..4}; the search backtracks to a parent where a 0 is
// live again, then comes back. Each call must answer for the state it is
// handed, never for one it saw before.
{
  const inst = {}
  const p = state(ONE_TO_FOUR)
  assert.deepStrictEqual(lineKind(inst, p, LINE), { kind: FULL_HOUSE, oneToN: true })
  p._cand.get(2).add(0)
  assert.deepStrictEqual(lineKind(inst, p, LINE), { kind: HOUSE, oneToN: false }, 'a regained digit shuts the gate')
  p._cand.get(2).delete(0)
  assert.deepStrictEqual(lineKind(inst, p, LINE), { kind: FULL_HOUSE, oneToN: true }, 'and it opens again')
  // nothing about the digit set lands on the instance
  assert.ok(!('oneToN' in inst) && !('kind' in inst), `no hidden write: ${Object.keys(inst)}`)
}

// ---- the repeats fact is latched both ways, per line ----
// Whether a line can repeat is geometry, fixed once update first runs, so a
// house and a bare line are each asked about once. A component reading several
// lines (a side's positions, its perpendiculars) latches each on its own. The
// solver can retire a filled built-in house for the rest of a branch, which
// can only weaken a latched answer, never make a removal unsound.
{
  const asked = []
  const p = state(ONE_TO_FOUR)
  const real = p.getCellsCanHaveRepeats
  p.getCellsCanHaveRepeats = cs => { asked.push(cs); return real(cs) }
  const inst = {}
  const OTHER = [0, 1]
  lineKind(inst, p, LINE)
  lineKind(inst, p, LINE)
  assert.strictEqual(asked.length, 1, 'a house is asked about once')
  const WITH_CLUE = [CLUE, 0]
  assert.strictEqual(lineKind(inst, p, WITH_CLUE).kind, BARE)
  assert.strictEqual(lineKind(inst, p, WITH_CLUE).kind, BARE)
  assert.strictEqual(asked.length, 2, 'a bare line is latched too: the answer is geometry, fixed once update first runs')
  lineKind(inst, p, OTHER)
  assert.strictEqual(asked.length, 3, 'another line gets its own answer')
}

console.log('line-kind.test.mjs: all seams pass')
