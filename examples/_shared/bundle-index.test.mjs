// bundle-index.mjs reads the tracked HAR and derives docs/research/
// bundle-api-index.md from it (#410). Tested here against the real HAR --
// there's no smaller fixture worth building, since the whole point is
// reading the bundle's own JS -- so this also doubles as the drift check:
// a bundle update that reshapes something this script matches on shows up
// as a byte diff or a missing known name, not silently.
//
//   node examples/_shared/bundle-index.test.mjs

import assert from 'assert'
import { readFileSync } from 'fs'
import { generate, OUTPUT_PATH } from './bundle-index.mjs'

const generated = generate()

// (a) byte-equal to the committed index -- a hand edit, or a HAR update
// whose regeneration was skipped, is a failing test.
const committed = readFileSync(OUTPUT_PATH, 'utf8')
assert.strictEqual(generated, committed,
  'docs/research/bundle-api-index.md is stale -- regenerate with `node examples/_shared/bundle-index.mjs`')

// (b) a handful of known names are present, spanning every section --
// catches a shape change silently emptying one of them.
for (const name of [
  'getCellsCanHaveRepeats', // puzzle/state base
  'getCandidatesBitMask', // puzzle/state subclass
  'createFullDigitSet', // helpers.digits
  'getCellName', // helpers.naming
  'getOrthogonallyAdjacentCells', // helpers.geometry
  'House', // built-in component display name
  'AbortSolver', // change-object type enum
  'intersects' // DigitSet read method
]) {
  assert.ok(generated.includes(name), `expected ${name} in the generated index`)
}

// (c) at least one known arity matches a signature already verified by hand
// in docs/puzzle-api.md: `getCellAt(col, row)` takes 2 arguments.
assert.ok(generated.includes('`getCellAt(arg0, arg1)`'),
  'getCellAt should show arity 2 (col, row)')

// (d) the component table carries a real param list, not an extraction
// that silently dropped every param. Two components, not one: House's
// param type is a plain `f.CellArray` type-enum reference, Between's are
// object-literal type specs (`{type:f.CellArray,amount:2}`) -- the two
// distinct shapes the decorator uses for a param's type.
assert.ok(generated.includes('| House | cells: CellArray |'),
  'House should list its cells: CellArray param')
assert.ok(generated.includes('| Between | endPoints: CellArray (amount: 2), midPoints: CellArray |'),
  'Between should list both params, including the object-typed endPoints')

console.log('bundle-index self-check OK')
