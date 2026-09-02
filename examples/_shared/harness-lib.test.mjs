// Focused tests of the harness-lib seams in isolation. Run:
//   node examples/_shared/harness-lib.test.mjs

import assert from 'assert'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { DigitSet, installGlobals, makeIo, makeLine, makePuzzle, makeRng } from './harness-lib.mjs'

const { rnd } = makeRng()

// ---- bare: any length, digits in range, repeats possible (forced by pigeonhole) ----
{
  const line = makeLine(rnd, 'bare', 20, 3)
  assert.strictEqual(line.length, 20)
  for (const d of line) assert.ok(d >= 1 && d <= 3, `digit ${d} out of range 1..3`)
  const distinct = new Set(line)
  assert.ok(distinct.size < line.length, '20 draws from 3 digits must repeat')
}

// ---- bare: can be shorter than the digit count ----
{
  const line = makeLine(rnd, 'bare', 2, 9)
  assert.strictEqual(line.length, 2)
}

// ---- house: n distinct digits, n < digitCount ----
{
  const line = makeLine(rnd, 'house', 5, 9)
  assert.strictEqual(line.length, 5)
  assert.strictEqual(new Set(line).size, 5, 'a house never repeats a digit')
  for (const d of line) assert.ok(d >= 1 && d <= 9, `digit ${d} out of range 1..9`)
}

// ---- fullHouse: a permutation of every digit 1..D exactly once ----
{
  const line = makeLine(rnd, 'fullHouse', 9, 9)
  assert.strictEqual(line.length, 9)
  assert.deepStrictEqual([...line].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9])
}

// ---- makePuzzle: getCellsCanHaveRepeats answers from the declared kind, not the digits ----
// A 'house' line whose seeded candidates happen to repeat a digit across cells
// must still report canHaveRepeats === false: the mock must not infer the
// kind by inspecting the digits it was given.
{
  const truth = { 0: 1, 1: 1 } // digits repeat in the truth map itself
  const p = makePuzzle(truth, (c, v) => [v], { kind: 'house', digitCount: 9 })
  assert.strictEqual(p.getCellsCanHaveRepeats([0, 1]), false)
  assert.strictEqual(p.spec.digitCount, 9)
}

{
  const truth = { 0: 1, 1: 2 }
  const p = makePuzzle(truth, (c, v) => [v], { kind: 'fullHouse', digitCount: 9 })
  assert.strictEqual(p.getCellsCanHaveRepeats([0, 1]), false)
}

{
  const truth = { 0: 1, 1: 2 }
  const p = makePuzzle(truth, (c, v) => [v], { kind: 'bare', digitCount: 9 })
  assert.strictEqual(p.getCellsCanHaveRepeats([0, 1]), true)
  assert.strictEqual(p.spec.digitCount, 9)
}

// ---- makePuzzle: no options given behaves as a bare line (the default kind) ----
{
  const truth = { 0: 1 }
  const p = makePuzzle(truth, (c, v) => [v])
  assert.strictEqual(p.getCellsCanHaveRepeats([0]), true)
}

// ---- makeIo().loadSource: eval source a caller already holds and edited ----
// A harness runs one component twice with a flag at the top of the file
// flipped, which means evaluating edited source rather than a file on disk.
{
  const { loadSource } = makeIo(dirname(fileURLToPath(import.meta.url)))
  const src = 'const FLAG = false\nfunction reading () { return FLAG }'
  assert.strictEqual(loadSource(src, ['reading']).reading(), false)
  assert.strictEqual(loadSource(src.replace('= false', '= true'), ['reading']).reading(), true)
}

// ---- makePuzzle: getValue answers undefined on an unsolved cell ----
// docs/puzzle-api.md: getValue is the SOLVED digit, undefined if not solved.
// A component that floods `getValue(cell) === digit` without a hasValue guard
// reads a mock that hands back the first candidate as a board full of placed
// cells, and passes in Node while doing something else in the app.
{
  const p = makePuzzle({ 0: 1, 1: 2 }, (c, v) => (c === 0 ? [v] : [1, 2, 3]))
  assert.strictEqual(p.hasValue(0), true)
  assert.strictEqual(p.getValue(0), 1)
  assert.strictEqual(p.hasValue(1), false)
  assert.strictEqual(p.getValue(1), undefined)
}

// ---- makePuzzle: the whole-grid calls a region-building component makes ----
// A vendored baseline reads the grid through the app's own names rather than
// index arithmetic, so the mock answers them: orthogonal neighbours on the
// square the cells form, the two multi-cell change calls, and stop.
{
  const truth = {}
  for (let c = 0; c < 9; c++) truth[c] = 1
  const p = makePuzzle(truth, () => [1, 2, 3])

  // 3x3, row-major: the centre has four neighbours, a corner two.
  assert.deepStrictEqual(p.getCellsOrthogonallyAdjacentToCell(4).sort(), [1, 3, 5, 7])
  assert.deepStrictEqual(p.getCellsOrthogonallyAdjacentToCell(0).sort(), [1, 3])
  assert.deepStrictEqual(p.getCellsOrthogonallyAdjacentToCell(8).sort(), [5, 7])

  p.removeCandidateFromCells(2, [0, 1])
  assert.deepStrictEqual([...p.getCandidates(0)].sort(), [1, 3])
  assert.deepStrictEqual([...p.getCandidates(2)].sort(), [1, 2, 3])

  p.filterCandidatesInCells(DigitSet.from([3]), [2])
  assert.deepStrictEqual([...p.getCandidates(2)], [3])

  // stop says the branch has no solution; the mock makes that visible the
  // one way every reader already looks for, an emptied cell.
  p.stop('no room')
  assert.ok([...Array(9).keys()].every(c => p.getCandidates(c).size === 0))
}

// ---- installGlobals: the naming helper a component calls for a message ----
installGlobals(1, 9)
assert.strictEqual(typeof globalThis.helpers.naming.getCageName('region', [0, 1]), 'string')

console.log('harness-lib.test.mjs: all seams pass')
