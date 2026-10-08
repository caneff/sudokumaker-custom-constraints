import { join } from 'path'
import assert from 'assert'
import { frameGeometry } from '../_shared/frame-geometry.mjs'
import { assembleSource } from '../_shared/include.mjs'
import { boxRegions } from '../_shared/box-regions.mjs'
import { gridGeometry } from './grid-geometry.mjs'

const HERE = import.meta.dirname
// Assembled, not raw: main-global.js splices in the shared frame reader
// (examples/_shared/frame-lines.js), and the app runs the assembled text.
const src = f => assembleSource(join(HERE, f))

function mockPuzzle (W) {
  const registered = []
  return {
    registered,
    spec: { size: { width: W, height: W } },
    getCellAt: (a, b) => a + b * W,
    getRow: c => Math.floor(c / W),
    getColumn: c => c % W,
    // A 3x3-box grid inside a one-cell ring: ring cells have no region.
    ...boxRegions(W, W),
    addConstraintComponent: comp => registered.push(comp)
  }
}

const helpers = { naming: { getCellsDescription: cells => cells.join(','), getCellName: cell => String(cell) } }

function OutsideSudokuComponent (name, clue, line, w) {
  return { name, clue, line, w }
}

function runBackend (file, puzzle, input) {
  // The app runs a backend segment as a bare script with these names in
  // scope; a Function body is the closest Node equivalent.
  const fn = new Function('input', 'puzzle', 'helpers', 'OutsideSudokuComponent', src(file)) // eslint-disable-line no-new-func
  fn(input, puzzle, helpers, OutsideSudokuComponent)
}

// On a 6x6 the boxes are 2 tall and 3 wide, so a row line and a column line
// from the same corner differ: a reading that ignores the direction gets one of
// them wrong.
{
  const geo = gridGeometry(6, 2, 3)
  const windowLength = new Function(`${src('window-length.js')}\nreturn windowLength`)() // eslint-disable-line no-new-func
  const p = geo.api
  assert.strictEqual(windowLength(p, geo.rowLine(0, 0, 6)), 3, 'along a row: 3 wide')
  assert.strictEqual(windowLength(p, geo.columnLine(0, 0, 6)), 2, 'down a column: 2 tall')
  assert.strictEqual(windowLength(p, geo.columnLine(0, 0, 1)), 1, 'a one-cell line has a one-cell window')
}

{
  const W = 11
  const p = mockPuzzle(W)
  const row = [12, 13, 14, 15]
  runBackend('main.js', p, { groups: [{ cells: [11, ...row] }] })
  assert.strictEqual(p.registered.length, 1, 'one component per group')
  assert.strictEqual(p.registered[0].clue, 11)
  assert.deepStrictEqual(p.registered[0].line, row)
  assert.strictEqual(p.registered[0].w, 3, 'the window is the box extent along the row')
}

{
  const p = mockPuzzle(11)
  runBackend('main.js', p, { groups: [{ cells: [11, 12, 13] }] })
  assert.strictEqual(p.registered[0].w, 2, 'the window is capped by the line length')
}

{
  const p = mockPuzzle(11)
  runBackend('main.js', p, { groups: [{ cells: [1, 12, 23, 34, 45] }] })
  assert.strictEqual(p.registered[0].w, 3)
}

{
  const p = mockPuzzle(11)
  runBackend('main.js', p, { groups: [{ cells: [11] }] })
  assert.deepStrictEqual(p.registered, [], 'an empty line registers nothing')
}

{
  const p = mockPuzzle(11)
  const bent = [12, 13, 24]
  runBackend('main.js', p, {
    groups: [{ cells: [11, 12, 13, 14] }, { cells: [11, ...bent] }, { cells: [22, 23, 24, 25] }]
  })
  assert.deepStrictEqual(p.registered.map(c => c.clue), [11, 22], 'the bent group alone is skipped, no throw')
}

{
  const n = 9
  const p = mockPuzzle(n + 2)
  runBackend('main-global.js', p, undefined)
  assert.strictEqual(p.registered.length, 4 * n, 'one component per frame line')
  const built = p.registered.map(c => [c.clue, ...c.line].join(','))
  const expected = frameGeometry(n, [3, 3]).groups.map(g => g.cells.join(','))
  assert.deepStrictEqual([...built].sort(), [...expected].sort(), 'the 4n frame lines')
  assert.ok(p.registered.every(c => c.w === 3), 'every frame line has the 3-cell window')
}

console.log('PASS')
