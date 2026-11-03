// The setup pass in FillominoComponent's `initialize`, driven the way the app
// drives it: a change does nothing until it is yielded, and a cell with one
// candidate left is not a placed cell until something places it. The harness's
// own mock does neither (docs/component-contract.md), so a pass that built its
// removals and never yielded them would pass on it. Soundness over fuzzed
// states is in soundness-harness.mjs.
//
// The expected grids are the generator's, from gen.json and gen_15g.json. The
// expected counts on the cap12-seed11 board are the ones the README records from
// a scratch prototype, which shared no code with this component.

import assert from 'assert'
import { readFileSync } from 'fs'
import { join } from 'path'
import { installGlobals, makeIo, patchSource } from '../_shared/harness-lib.mjs'
import { fixtureBoard } from './bound-screen-lib.mjs'
import { givensOf } from './hunt-lib.mjs'

const HERE = import.meta.dirname
const NAMES = ['setParams', 'initialize']
const UPDATE = 'function * update (instance, puzzle) {'
const CALL_LIMIT = 'const SETUP_CALL_LIMIT = 40000'
const DRY_LIMIT = 'const SETUP_DRY_LIMIT = 100'

// Each load counts its own `update` calls, in `calls.n`, and notes what cell 0
// held at each, in `calls.cell0`.
const calls = { n: 0, cell0: [] }
globalThis.setupPassCalls = calls
const countCalls = src => patchSource(src, UPDATE, `${UPDATE}
  globalThis.setupPassCalls.n++
  globalThis.setupPassCalls.cell0.push(puzzle.getValue(0))`)
const { load } = makeIo(HERE)
const loadWith = patch => load('FillominoComponent.js', NAMES, src => patch(countCalls(src)))
const shipped = loadWith(src => src)

function appPuzzle ({ width, height, cap, givens }) {
  const every = (2 ** (cap + 1)) - 2
  const candidates = Array.from({ length: width * height }, (_, i) => givens[i] === undefined ? every : 1 << givens[i])
  const values = candidates.map((_, i) => givens[i])
  const change = (mask, cell) => ({ mask, cell })
  return {
    candidates,
    hasValue: c => values[c] !== undefined,
    getValue: c => values[c],
    getCandidatesBitMask: c => candidates[c],
    removeCandidatesFromCell: change,
    apply ({ mask, cell }) { candidates[cell] &= ~mask }
  }
}

// Returns the puzzle after the pass, how many `update` calls the whole pass
// made, and how many it had made by its first change.
function runPass (mod, board) {
  installGlobals(1, board.cap)
  const { width, height } = board
  const inst = {}
  mod.setParams(inst, Array.from({ length: width * height }, (_, i) => i), width, height)
  const p = appPuzzle(board)
  calls.n = 0
  calls.cell0 = []
  let callsAtFirstChange = null
  for (const change of mod.initialize(inst, p)) {
    if (callsAtFirstChange === null) callsAtFirstChange = calls.n
    p.apply(change)
  }
  return { p, calls: calls.n, callsAtFirstChange }
}

const singles = p => p.candidates.filter(m => (m & (m - 1)) === 0).length

function boardFrom (file) {
  const { grid, clues, cap } = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
  const height = grid.length
  const width = grid[0].length
  return { width, height, cap: cap ?? Math.max(width, height), givens: givensOf(grid, clues), grid }
}

const assertSolved = (p, { grid }) => {
  const want = grid.flat().map(d => 1 << d)
  assert.deepStrictEqual(p.candidates, want, 'the pass did not leave exactly the solution')
}

// The whole of the shipped board falls to the pass, and it holds every change
// back until the search on its private copy has finished.
{
  const board = boardFrom('gen.json')
  const { p, calls: spent, callsAtFirstChange } = runPass(shipped, board)
  assertSolved(p, board)
  assert.strictEqual(callsAtFirstChange, spent, 'a change came out before the pass finished')
}

// A board that is not square reads its neighbours through the same copy.
{
  const board = boardFrom('gen_15g.json')
  assertSolved(runPass(shipped, board).p, board)
}

// A clue-free board has nothing to rule out, so it stops at the dry limit
// having changed nothing.
{
  const board = { width: 9, height: 9, cap: 29, givens: {} }
  const { p, callsAtFirstChange } = runPass(shipped, board)
  assert.strictEqual(callsAtFirstChange, null, 'a clue-free board lost a candidate')
  assert.strictEqual(singles(p), 0)
  // Cell 0 is tested first, largest digit first, and the board is otherwise
  // empty, so its tests run 29, 28, ... 1.
  const tested = calls.cell0.filter((d, k, all) => d !== -1 && d !== all[k - 1])
  assert.deepStrictEqual(tested, Array.from({ length: 29 }, (_, k) => 29 - k), 'cell 0 was not tested largest digit first')
}

// The one committed board the pass does not finish. Its longest dry run, 235
// tests, is past the limit, so the pass stops early at 48 cells; with no dry
// limit it reaches 49.
{
  const board = fixtureBoard(HERE, 'timing-fixture-9x9-cap12-seed11-rung25.txt')
  assert.strictEqual(singles(runPass(shipped, board).p), 48, 'the dry limit stopped the pass somewhere else')
  const noDryLimit = loadWith(src => patchSource(src, DRY_LIMIT, 'const SETUP_DRY_LIMIT = Infinity'))
  assert.strictEqual(singles(runPass(noDryLimit, board).p), 49, 'with no dry limit the pass should finish')
}

// The call limit is a hard stop. A test it cuts short proved nothing, so at
// every limit the pass keeps the solution; the limit lands inside a test of a
// false digit and of a true one somewhere in this range.
{
  const board = boardFrom('gen.json')
  const truth = board.grid.flat().map(d => 1 << d)
  for (let limit = 1; limit <= 400; limit++) {
    const capped = loadWith(src => patchSource(src, CALL_LIMIT, `const SETUP_CALL_LIMIT = ${limit}`))
    const { p, calls: spent } = runPass(capped, board)
    assert.ok(spent <= limit, `limit ${limit}: ${spent} update calls`)
    p.candidates.forEach((m, i) => assert.ok(m & truth[i], `limit ${limit}: cell ${i} lost its solution digit`))
  }
}

// A board whose clues already break the rules has to reach the solver as a
// broken board: two touching 1's are one island too big for its digit.
{
  const board = { width: 3, height: 3, cap: 9, givens: { 0: 1, 1: 1 } }
  const { p } = runPass(shipped, board)
  assert.ok(p.candidates.includes(0), 'a broken board left no cell empty')
}

// The same when only the tests show it: these clues get past the rules alone, and
// this board has no answer, so the pass ends at the removal that breaks it.
{
  const board = { width: 3, height: 3, cap: 3, givens: { 1: 1, 3: 3, 8: 2 } }
  const { p, calls: spent } = runPass(shipped, board)
  assert.ok(p.candidates.includes(0), 'a board the tests broke left no cell empty')
  assert.strictEqual(spent, 5, 'the pass went on past the removal that broke the board')
}

console.log('PASS')
