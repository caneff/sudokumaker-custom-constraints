// The no-ring board's rows and columns: every row and every column of the
// whole grid becomes a house, with plain integer cell ids.
//
//   node examples/_shared/grid-rowcol.test.mjs
//
// Why this matters. A no-ring board is a `"custom"` document -- the live editor
// opens a `"sudoku"` document as 9x9 whatever its width says
// (docs/research/368-up-to-n-setup-throw.md) -- and a custom document's region
// constraint gives boxes only (docs/gotchas.md #9). This backend is what makes
// its rows and columns houses. Unlike frame-rowcol.js it keeps the first and
// last line and every line's end cells: on a board with no ring they are real
// cells.
//
// The board is run rectangular here (W != H) so a backend that reads one
// dimension twice cannot pass.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { runBackend } from './backend-runner.mjs'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grid-rowcol.js'), 'utf8')

// A W x H board whose geometry helpers yield boxed ids, as the app's own do
// (#394): numerically right, not plain numbers.
function run (W, H, minDigit, maxDigit) {
  const registered = []
  /* eslint-disable no-new-wrappers -- a boxed id is what the coercion check is for */
  const rows = function * () { for (let y = 0; y < H; y++) yield Array.from({ length: W }, (_, x) => new Number(x + y * W)) }
  const columns = function * () { for (let x = 0; x < W; x++) yield Array.from({ length: H }, (_, y) => new Number(x + y * W)) }
  /* eslint-enable no-new-wrappers */
  runBackend(SRC, {
    puzzle: { addConstraintComponent: c => registered.push(c) },
    helpers: { geometry: { getAllRows: rows, getAllColumns: columns }, digits: { minDigit, maxDigit } }
  })
  return registered
}

// Written out, not derived from the backend's arithmetic: a 3-wide, 2-tall
// board's two rows and three columns, ids x + y * 3.
{
  const got = run(3, 2, 1, 3)
  const lines = got.map(c => ({ ctor: c.ctor, cells: c.args[1] }))
  assert.deepStrictEqual(lines.map(l => l.cells), [
    [0, 1, 2], [3, 4, 5],
    [0, 3], [1, 4], [2, 5]
  ])
  for (const c of got) for (const cell of c.args[1]) assert.strictEqual(typeof cell, 'number', 'cell ids are coerced')
  // A 3-cell row over digits 1..3 holds every digit: a house, typed as a row.
  assert.deepStrictEqual(got.slice(0, 2).map(c => [c.ctor, c.args[2]]), [['HouseComponent', 'Row'], ['HouseComponent', 'Row']])
  // A 2-cell column cannot hold three digits: all-different, not a house.
  assert.deepStrictEqual(got.slice(2).map(c => c.ctor), ['DifferentDigitsComponent', 'DifferentDigitsComponent', 'DifferentDigitsComponent'])
}

// A square 4x4 over 1..4: eight houses, four rows then four columns.
{
  const got = run(4, 4, 1, 4)
  assert.deepStrictEqual(got.map(c => [c.ctor, c.args[2]]), [
    ...Array(4).fill(['HouseComponent', 'Row']),
    ...Array(4).fill(['HouseComponent', 'Column'])
  ])
  assert.deepStrictEqual(got[7].args[1], [3, 7, 11, 15])
}

console.log('PASS')
