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
import assert from 'assert'
import { frameGeometry } from '../_shared/frame-geometry.mjs'
import { assembleSource } from '../_shared/include.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// Assembled, not raw: main-global.js splices in the shared frame reader
// (examples/_shared/frame-lines.js), and the app runs the assembled text.
const src = f => assembleSource(join(HERE, f))

// A board W cells wide: cell id = col + row * W, so `getCellAt(a, b)` is
// `a + b * W` (docs/puzzle-api.md) -- the cell at column a, row b, the same
// coordinates frameGeometry indexes the other way round.
function mockPuzzle (W) {
  const registered = []
  return {
    registered,
    spec: { size: { width: W, height: W } },
    getCellAt: (a, b) => a + b * W,
    getRow: c => Math.floor(c / W),
    getColumn: c => c % W,
    // A 3x3-box grid inside a one-cell ring: ring cells have no region.
    getRegion: c => {
      const r = Math.floor(c / W) - 1
      const k = (c % W) - 1
      if (r < 0 || k < 0 || r >= W - 2 || k >= W - 2) return -1
      return Math.floor(r / 3) * ((W - 2) / 3) + Math.floor(k / 3)
    },
    getRegionCells: reg => {
      const across = (W - 2) / 3
      const cells = []
      for (let dr = 0; dr < 3; dr++) {
        for (let dk = 0; dk < 3; dk++) cells.push((Math.floor(reg / across) * 3 + dr + 1) * W + (reg % across) * 3 + dk + 1)
      }
      return cells
    },
    addConstraintComponent: comp => registered.push(comp)
  }
}

const helpers = { naming: { getCellsDescription: cells => cells.join(','), getCellName: cell => String(cell) } }

// The component constructor the backends call: records its arguments.
function OutsideSudokuComponent (name, clue, line, w) {
  return { name, clue, line, w }
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
  assert.strictEqual(p.registered[0].w, 3, 'the window is the box extent along the row')
}

// ---- main.js: a line shorter than the box extent is capped at its length
{
  const p = mockPuzzle(11)
  runBackend('main.js', p, { groups: [{ cells: [11, 12, 13] }] })
  assert.strictEqual(p.registered[0].w, 2, 'the window is capped by the line length')
}

// ---- main.js: a line down a column measures the box along the column
{
  const p = mockPuzzle(11)
  runBackend('main.js', p, { groups: [{ cells: [1, 12, 23, 34, 45] }] })
  assert.strictEqual(p.registered[0].w, 3)
}

// ---- main.js: a group still being drawn (clue only) is skipped
{
  const p = mockPuzzle(11)
  runBackend('main.js', p, { groups: [{ cells: [11] }] })
  assert.deepStrictEqual(p.registered, [], 'an empty line registers nothing')
}

// ---- main.js: a bent group is skipped; groups around it still register
{
  const p = mockPuzzle(11)
  const bent = [12, 13, 24] // two cells of row 1, then one of row 2
  runBackend('main.js', p, {
    groups: [{ cells: [11, 12, 13, 14] }, { cells: [11, ...bent] }, { cells: [22, 23, 24, 25] }]
  })
  assert.deepStrictEqual(p.registered.map(c => c.clue), [11, 22], 'the bent group alone is skipped, no throw')
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
  assert.ok(p.registered.every(c => c.w === 3), 'every frame line has the 3-cell window')
}

console.log('PASS')
