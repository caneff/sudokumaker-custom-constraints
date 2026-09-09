// The frame backend declares the interior's rows and columns as houses, and
// hands the SudokuPad export the same lines through `postprocessJSON`.
//
//   node examples/_shared/frame-rowcol.test.mjs
//
// Why this matters. A region constraint gives BOXES ONLY: nothing in the app
// makes a row or a column a house, so a frame board that declares neither is
// not the puzzle it looks like -- it solves, times and counts solutions on a
// different board (#335, docs/gotchas.md #9). Two consumers need those lines
// and they must be the same lines: the app's solver, through registered
// components, and SudokuPad, through the publish-time userscript hook.
//
// The board is run rectangular (W != H) on purpose: rows and columns are
// different lengths there, so a backend that reads one dimension twice, or
// slices the wrong axis, is caught.
//
// The mock yields BOXED `new Number(id)` cells, the same trick
// global-backends.test.mjs uses. An id that reaches a component unboxed has
// been coerced with `| 0`, which is load-bearing and not decoration: the same
// eighteen houses built straight from `getAllRows()` ran 1.18x the document
// cages they replaced, and 0.97x once coerced (#394, #276).

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'frame-rowcol.js'), 'utf8')

// A W x H board whose geometry helpers behave like the app's: `getAllRows` and
// `getAllColumns` are GENERATORS (verified against the live app), each yielding
// one plain array of every cell on that line, ring included, and each call
// makes a fresh generator.
function mockHelpers (W, H, minDigit = 1, maxDigit = null) {
  const id = (x, y) => new Number(x + y * W) // eslint-disable-line no-new-wrappers -- the point of the test
  return {
    geometry: {
      * getAllRows () { for (let y = 0; y < H; y++) yield Array.from({ length: W }, (_, x) => id(x, y)) },
      * getAllColumns () { for (let x = 0; x < W; x++) yield Array.from({ length: H }, (_, y) => id(x, y)) }
    },
    cellIds: {
      width: W,
      height: H,
      getCoordsFromId: cell => ({ x: (cell | 0) % W, y: Math.floor((cell | 0) / W) })
    },
    digits: { minDigit, maxDigit: maxDigit ?? Math.max(W, H) - 2 }
  }
}

function run (W, H, minDigit = 1, maxDigit = null) {
  const ctorNames = [...new Set([...SRC.matchAll(/new (\w+Component)\(/g)].map(m => m[1]))]
  const ctors = ctorNames.map(n => {
    const Recorder = function (...args) { this.args = args; this.ctor = n }
    Object.defineProperty(Recorder, 'name', { value: n })
    return Recorder
  })
  const registered = []
  const puzzle = { addConstraintComponent: c => registered.push(c) }
  const helpers = mockHelpers(W, H, minDigit, maxDigit)
  const fn = new Function('input', 'puzzle', 'helpers', 'SudokuDigitSet', ...ctorNames, SRC + '\n;return typeof postprocessJSON === "function" ? postprocessJSON : null') // eslint-disable-line no-new-func
  const postprocessJSON = fn(undefined, puzzle, helpers, null, ...ctors)
  return { registered, postprocessJSON, helpers }
}

// The interior of a W x H frame board, written out rather than derived from
// the backend's own arithmetic: row r (1-based) is the cells of board row r
// with the two ring cells dropped.
function interiorRows (W, H) {
  const rows = []
  for (let y = 1; y < H - 1; y++) rows.push(Array.from({ length: W - 2 }, (_, i) => (i + 1) + y * W))
  return rows
}
function interiorColumns (W, H) {
  const cols = []
  for (let x = 1; x < W - 1; x++) cols.push(Array.from({ length: H - 2 }, (_, i) => x + (i + 1) * W))
  return cols
}

for (const [W, H] of [[11, 11], [8, 6], [6, 8]]) {
  const { registered, postprocessJSON } = run(W, H)
  const where = `${W}x${H}`
  const want = [...interiorRows(W, H), ...interiorColumns(W, H)]

  assert.strictEqual(registered.length, want.length,
    `${where}: expected ${want.length} houses, got ${registered.length}`)

  const got = registered.map(c => c.args.find(a => Array.isArray(a)))
  assert.deepStrictEqual(got, want, `${where}: the houses are not the interior rows then columns`)

  // Every id reaches the component as a plain integer, not the boxed Number
  // the helpers handed out.
  for (const [i, cells] of got.entries()) {
    const boxed = cells.filter(c => c instanceof Number || typeof c !== 'number')
    assert.deepStrictEqual(boxed, [],
      `${where}: house ${i} carries ${boxed.length} uncoerced ids; \`| 0\` is load-bearing (#276, #394)`)
  }

  // Names the app can use in an explanation, and distinct -- the document
  // cages it replaces were all called "the cage at <cell>", duplicated
  // between row 1 and column 1.
  const names = registered.map(c => c.args.find(a => typeof a === 'string'))
  assert.strictEqual(new Set(names).size, want.length, `${where}: house names are not distinct`)
  assert.deepStrictEqual(names.slice(0, 2), ['row 1', 'row 2'], `${where}: rows are misnamed`)
  assert.strictEqual(names[interiorRows(W, H).length], 'column 1', `${where}: columns are misnamed`)

  // A line as long as the digit range is a house; any other line is only
  // all-different (see the digit-range cases at the bottom). And a house has to
  // carry its `houseType`: only Row, Column and Region houses are legible to
  // the solver's row/column mappings and its Fishes, and the default
  // ExtraRegion is skipped by all of it.
  const { minDigit, maxDigit } = mockHelpers(W, H).digits
  const digitCount = maxDigit - minDigit + 1
  for (const [i, c] of registered.entries()) {
    const cells = c.args.find(a => Array.isArray(a))
    const isRow = i < interiorRows(W, H).length
    if (cells.length === digitCount) {
      assert.strictEqual(c.ctor, 'HouseComponent',
        `${where}: line ${i} is as long as the digit range, so it is a house`)
      assert.strictEqual(c.args.find(a => a === 'Row' || a === 'Column'), isRow ? 'Row' : 'Column',
        `${where}: house ${i} does not carry its houseType`)
    } else {
      assert.strictEqual(c.ctor, 'DifferentDigitsComponent',
        `${where}: line ${i} is shorter than the digit range, so it is not a house`)
    }
  }

  // ---- the publish-time hook -------------------------------------------
  assert.ok(postprocessJSON, `${where}: the backend defines no postprocessJSON`)

  const json = {
    metadata: {},
    cages: [{ cells: [[0, 0]], value: 3 }],
    cells: Array.from({ length: H }, () => Array.from({ length: W }, () => ({ value: 1 })))
  }
  postprocessJSON(json)

  assert.strictEqual(json.metadata.norowcol, true,
    `${where}: the ring shares a physical row with the interior, so the export must set norowcol`)

  const added = json.cages.slice(1)
  assert.strictEqual(added.length, want.length,
    `${where}: expected ${want.length} exported rowcol cages, got ${added.length}`)
  assert.deepStrictEqual(
    added.map(c => c.cells),
    want.map(cells => cells.map(c => [Math.floor(c / W), c % W])),
    `${where}: the exported cages are not the same lines the components got`)
  for (const cage of added) {
    assert.strictEqual(cage.type, 'rowcol', `${where}: an exported line cage is not tagged rowcol`)
    assert.strictEqual(String(cage.hidden), 'true', `${where}: an exported line cage is not hidden`)
    assert.strictEqual(String(cage.unique), 'true', `${where}: an exported line cage is not unique`)
  }
  assert.strictEqual(json.cages[0].value, 3, `${where}: an existing cage was disturbed`)

  // The corners hold no puzzle digit, so nothing about them should ride into
  // what SudokuPad checks.
  for (const [r, c] of [[0, 0], [0, W - 1], [H - 1, 0], [H - 1, W - 1]]) {
    assert.ok(!('value' in json.cells[r][c]),
      `${where}: corner ${r},${c} still carries a value into the export`)
  }
}

// A board whose digit range is WIDER than its lines -- hit-counts runs
// `minDigit: 0`, so a 9x9 interior row holds 9 cells and the puzzle has ten
// digits. "Every digit exactly once" is then false and a `HouseComponent`
// states a rule the puzzle does not have; all-different is the honest one, and
// it is what the type-301 cages this replaces actually registered.
for (const [W, H, minDigit, maxDigit] of [[11, 11, 0, 9], [8, 6, 0, 6]]) {
  const { registered } = run(W, H, minDigit, maxDigit)
  const where = `${W}x${H}, digits ${minDigit}..${maxDigit}`
  assert.deepStrictEqual(
    [...new Set(registered.map(c => c.ctor))], ['DifferentDigitsComponent'],
    `${where}: a line shorter than the digit range is all-different, not a house`)
  const names = registered.map(c => c.args.find(a => typeof a === 'string'))
  assert.strictEqual(new Set(names).size, registered.length, `${where}: names are not distinct`)
  for (const cells of registered.map(c => c.args.find(a => Array.isArray(a)))) {
    assert.deepStrictEqual(cells.filter(c => typeof c !== 'number'), [],
      `${where}: uncoerced ids`)
  }
}

console.log('frame-rowcol self-check OK')
