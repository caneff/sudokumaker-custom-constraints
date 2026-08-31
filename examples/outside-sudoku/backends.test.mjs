// The two backends: which components each one registers, and how main.js
// answers a group it cannot enforce.
//
//   node examples/outside-sudoku/backends.test.mjs
//
// main.js reads the author's drawn groups; main-global.js reads none and
// builds the 4n frame lines from the board size. The expected frame comes from
// the shared frameGeometry, not from a second copy of the same loop.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { frameGeometry } from '../_shared/frame-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = f => readFileSync(join(HERE, f), 'utf8')

// A board W cells wide: cell id = col + row * W, so `getCellAt(a, b)` is
// `a + b * W` (docs/puzzle-api.md). The frame is symmetric under transpose, so
// the 4n lines match frameGeometry's either way; only the labels swap.
function mockPuzzle (W) {
  const registered = []
  return {
    registered,
    spec: { size: { width: W, height: W } },
    getCellAt: (a, b) => a + b * W,
    getRow: c => Math.floor(c / W),
    getColumn: c => c % W,
    addConstraintComponent: comp => registered.push(comp)
  }
}

const helpers = { naming: { getCellsDescription: cells => cells.join(',') } }

// The component constructor the backends call: records its arguments.
function OutsideSudokuComponent (name, clue, line) {
  return { name, clue, line }
}

function runBackend (file, puzzle, input) {
  // The app runs a backend segment as a bare script with these names in
  // scope; a Function body is the closest Node equivalent.
  const fn = new Function('input', 'puzzle', 'helpers', 'OutsideSudokuComponent', src(file)) // eslint-disable-line no-new-func
  fn(input, puzzle, helpers, OutsideSudokuComponent)
}

// ---- main.js: one component per drawn group
{
  const W = 11
  const p = mockPuzzle(W)
  const row = [12, 13, 14, 15] // a row line, clue at the ring cell 11
  runBackend('main.js', p, { groups: [{ cells: [11, ...row] }] })
  assert.strictEqual(p.registered.length, 1, 'one component per group')
  assert.strictEqual(p.registered[0].clue, 11)
  assert.deepStrictEqual(p.registered[0].line, row)
}

// ---- main.js: a group still being drawn (clue only) is skipped
{
  const p = mockPuzzle(11)
  runBackend('main.js', p, { groups: [{ cells: [11] }] })
  assert.deepStrictEqual(p.registered, [], 'an empty line registers nothing')
}

// ---- main.js: a line that is not one row or column fails loud
{
  const p = mockPuzzle(11)
  const bent = [12, 13, 24] // two cells of row 1, then one of row 2
  assert.throws(
    () => runBackend('main.js', p, { groups: [{ cells: [11, ...bent] }] }),
    /not one row or column/,
    'a bent line must throw, not solve wrong'
  )
  assert.deepStrictEqual(p.registered, [], 'nothing is registered from a bad group')
}

// ---- main-global.js: all 4n frame lines, no groups read
{
  const n = 9
  const p = mockPuzzle(n + 2)
  runBackend('main-global.js', p, undefined) // no `input` at all
  assert.strictEqual(p.registered.length, 4 * n, 'one component per frame line')
  const built = p.registered.map(c => [c.clue, ...c.line].join(','))
  const expected = frameGeometry(n, [3, 3]).groups.map(g => g.cells.join(','))
  assert.deepStrictEqual([...built].sort(), [...expected].sort(), 'the 4n frame lines')
}

console.log('PASS')
