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

// (e) #415: registrations whose first arg is an array of names (aliases)
// emit one row per name, the non-primary ones marked as aliases.
assert.ok(generated.includes('| Pair | filterOrMapping: ((d1: number, d2: number) => boolean) | DigitSet[], cell1: Cell, cell2: Cell |'),
  'Pair (primary name of the ["Pair","AsymmetricalPair"] registration) should be listed unmarked')
assert.ok(generated.includes('| AsymmetricalPair (alias of Pair) | filterOrMapping: ((d1: number, d2: number) => boolean) | DigitSet[], cell1: Cell, cell2: Cell |'),
  'AsymmetricalPair should be listed as an alias of Pair')
assert.ok(generated.includes('| GreaterThan | lesserCell: Cell, greaterCell: Cell |'),
  'GreaterThan (primary name of the ["GreaterThan","LessThan"] registration) should be listed unmarked')
assert.ok(generated.includes('| LessThan (alias of GreaterThan) | lesserCell: Cell, greaterCell: Cell |'),
  'LessThan should be listed as an alias of GreaterThan')

// (f) #415: registrations whose message is a template literal (used for a
// multi-line "**Note:**" message) are read instead of being dropped, with
// the newline rendered as <br> so the markdown table row stays one line.
assert.ok(generated.includes(
  '| SandwichSum | sum: Number, sandwichDigits: NumberArray (amount: 2), cells: CellArray | ' +
  'Along {cells} there must be a sequence of values starting with one of {sandwichDigits}, ' +
  'then some values summing to {sum}, then another digit from {sandwichDigits}. <br>' +
  '**Note:** currently requires all cells to be different. |'),
'SandwichSum should have its template-literal message extracted, newline rendered as <br>')
assert.ok(generated.includes(
  '| DifferentGroups | groups: DigitSetArray, cells: CellArray | ' +
  'Every cell of {cells} must have a digit from a different group from {groups}. ' +
  'E.g. if one group is 123, and one cell has a 1, the other cells cannot be 2 or 3.<br>' +
  '**Note:** currently only works properly when the groups do not overlap. |'),
'DifferentGroups should have its template-literal message extracted')

// (g) the header count reflects every name emitted as its own row
// (42 registration calls, 2 of which alias a second name, for 44 rows).
assert.ok(generated.includes('44 registered component names (42 constructors, 2 of them aliasing'),
  'header should count all 44 component name rows and call out the 2 aliases')

console.log('bundle-index self-check OK')
