# The puzzle API

Full extracted surface: `docs/research/bundle-api-index.md`, regenerate with
`node examples/_shared/bundle-index.mjs`.
What each method actually does, read from the bundle body:
`docs/research/bundle-api-reference.md`. Look there first when a signature
below is marked **[docs]** or is missing.

The solving object is available as `puzzle` or `sudoku`. `helpers` is also
reachable as `puzzle.helpers`, but **the main code and a component get two
different `helpers` objects** (see "Two helpers objects" below). Signatures
below are from the community docs
([Chris-Tophski repo][src]) plus what we verified in use. Many methods there are
marked TODO; this file keeps the ones you actually reach for. Tags: **[verified]**
= we used it; **[verified]** (bundle) = read in the app's own JS bundle, not
yet used by a component here; **[docs]** = documented, not personally exercised.

[src]: https://github.com/Chris-Tophski/SudokuMakerConstraints

## Reading cells

| Method | Returns | Notes |
|-|-|-|
| `puzzle.hasValue(cell)` | boolean | Is the cell solved to a single value. **[verified]** |
| `puzzle.getValue(cell)` | number | The solved digit. Undefined if not solved. **[verified]** |
| `puzzle.getCandidates(cell)` | DigitSet | Remaining candidates, as a **fresh copy** each call (`new DigitSet(mask)` in the bundle). Wrap in `Array.from`, or use the mask algebra below. **[verified]** |
| `puzzle.getCandidatesBitMask(cell)` | number | The raw candidate bitmask (bit `d` = digit `d`). Cheapest read; Numbered Rooms uses it. **[verified]** (bundle) |
| `puzzle.getCellsAreFilled(cells)` | boolean | True when every listed cell is solved. **[verified]** |
| `puzzle.getCellAt(col, row)` | CellId | 0-based coordinates to cell id: `col + row * width`, and `undefined` off the board (`getIdFromCoordsSafe` in the bundle). **Coerce the result with `\| 0` before you hand it to a component** — an id derived from the board size, by this call or by your own arithmetic on `puzzle.spec.size.width`, costs the app's solver ~1.3x per candidate read until it is a plain integer again (#276). **[verified]** (bundle + live probe 2026-08-31) |
| `puzzle.getX(cell)` / `getY(cell)` | number | 0-based column / row of a cell. **[docs]** |
| `puzzle.getRow(cell)` / `getColumn(cell)` | number | 0-based row / column; `-1` for negative ids. **[docs]** |
| `puzzle.getRegion(cell)` | number | 0-based region id; `-1` out of bounds. **[docs]** |
| `puzzle.getRegionCells(regionId)` | CellId[] | Cells of a region. **[docs]** |
| `puzzle.getCellsSeenByCell(cell)` | Set | Cells that must differ from `cell`. Only sees constraints defined earlier. **[docs]** |
| `puzzle.getCellsSeeEachOther(cells)` | boolean | Every pair of listed cells is in each other's exclusion group (`getCellsSeenByCell`). True for one cell. **[verified]** (bundle) |
| `puzzle.getCellsCanHaveRepeats(cells)` | boolean | `cells` is an array or iterable of cell ids. True when the list repeats a cell id, else `!getCellsSeeEachOther(cells)`. Live 2026-08-28: inner row on a board with row/column houses → `false`; any two cells of it → `false`; the same row with a ring cell in the list → `true`; every row/column on the isofill 10x10 (no houses) → `true`, also under numbered-rooms' global main.js. Called from `update`, it sees every house whatever the constraint order (gotchas #6). Proof rig: #189. **[verified]** |

## Writing changes (yield these from `update`)

| Method | Effect |
|-|-|
| `puzzle.removeCandidateFromCell(digit, cell)` | Drop one candidate from one cell. **[verified]** |
| `puzzle.removeCandidatesFromCell(digitSet, cell)` | Drop a set of candidates from one cell. **[verified]** |
| `puzzle.removeCandidatesFromCells(digitSet, cells)` | Drop a set from several cells. **[docs]** |
| `puzzle.replaceComponent(instance, newComponent)` | Swap this component for another. **Built-in target only** (see gotchas). **[verified]** |
| `puzzle.addConstraintComponent(component)` | Register a component (used in the main code). **[verified]** |
| `puzzle.removeConstraintComponent(component)` | Remove a component. **[docs]** |
| `puzzle.stop(message)` | Signal a contradiction / halt. **[docs]** |

## helpers.naming

| Method | Returns |
|-|-|
| `getCellName(cell)` | `"R1C1"` style name (top-left is R1C1). **[verified]** |
| `getCellsDescription(cells)` | `"R1C1, R2C2 and R3C3"`; `"???"` for empty. **[verified]** |
| `getColumnName(col)` / `getRowName(row)` | `"C1"` / `"R1"` from 0-based id. **[docs]** |
| `getBranchingLineName(name, cells)` | `"the <name> containing <cell>"`. **[docs]** |
| `getCageName(name, cells)` | `"the <name> at <cell>"`. **[docs]** |

## helpers.digits

| Member | Meaning |
|-|-|
| `minDigit` / `maxDigit` | Lowest / highest digit in the puzzle (1 / 9 for classic). **[verified]** |
| `allDigitsMask` | Bitmask of available digits. **[docs]** |
| `createFullDigitSet()` | DigitSet of all digits. **[verified]** (bundle) |
| `createOddsDigitSet()` / `createEvensDigitSet()` | Odd / even DigitSet, masked to `minDigit..maxDigit`. **[verified]** (bundle) |
| `createModuloDigitSet(divisor, remainder)` | Digits `d` in `minDigit..maxDigit` with `d % divisor === remainder`. **[verified]** (bundle) |
| `createFilteredDigitSet(predicate)` | Digits `d` in `minDigit..maxDigit` with `predicate(d)` truthy. **[verified]** (bundle) |

## Two helpers objects

The bundle builds `helpers` twice, and only the main code gets the bigger one.

| Segment | Factory (bundle) | What it has |
|-|-|-|
| Main code (`setupPuzzle`) | `createExtendedHelpers` | everything below **plus** `helpers.lines` (`getLineEnds`), `helpers.misc` (`MiscHelper`: `getCellGroupsFromLines(lines)`, `*getEdgesForNegativeConstraint(clues)`), and a region-aware `helpers.geometry` that adds `getSubsetsPerRegion(cells)` |
| A component segment, and `puzzle.helpers` inside `initialize` / `update` / `validate` | plain `createHelpers` | `cellIds`, `cornerIds`, `edgeIds`, `outerCellIds`, `geometry` (base class only), `sums`, `xSums`, `digits`, `naming`, `connectivity` |

(`helpers.misc` is handed the base geometry, not the region-aware one, but
neither of its methods uses it, so nothing observable follows.)

So inside a component, `helpers.lines` and `helpers.misc` are `undefined` and
`helpers.geometry.getSubsetsPerRegion` does not exist. Compute line ends,
connected groups, or per-region splits in the main code and pass the result
in as a constructor parameter. **[verified]** (bundle: `createHelpers` at
`bundle.claude.js:1614`, `createExtendedHelpers` at 9201, `setupPuzzle` at
9349, `compileCustomComponentClass` at 9994 and its `SolverPuzzleView` facade
at 10072, in `docs/research/humanify-pedagogy/`)

## helpers.connectivity

`getOrthogonallyConnectedGroups(cells)` splits a cell list into its
orthogonally connected groups. **It returns a generator, and each item is a
`LineGraph` object, not an array of cell ids.** Call `.getPoints()` on each
item to get the cells, and spread the generator once:

```js
const groups = [...helpers.connectivity.getOrthogonallyConnectedGroups(cells)]
  .map(g => g.getPoints())
```

`bundle-api-index.md` files it as a plain "method" because the function itself
is not a generator; it returns `LineGraph.getAllComponents()`, which is
(`bundle.claude.js:345` and `:494`). Available in both segments.
**[verified]** (bundle)

## helpers.geometry / helpers.lines

Mostly TODO in the source docs; useful for global constraints. Known members
include `getOrthogonallyAdjacentCells`, `getDiagonallyAdjacentCells`,
`getAllRows`, `getAllColumns`, `getAllKnightMovePairs`, `getAllDominoes`,
`getCellsPointedAtByOuterClue`, and, **main code only**,
`helpers.lines.getLineEnds` and `helpers.geometry.getSubsetsPerRegion`.
Verify the exact signature before relying on one. **[docs]**

**`getAllRows()` / `getAllColumns()` return a GENERATOR, not an array**, and
each line it yields is a plain `Array` of cell ids covering the whole board
edge to edge -- on a frame board, `[...getAllRows()].slice(1, -1)` drops the
ring rows and `line.slice(1, -1)` drops each row's two ring cells. The
generator is consumed by one walk, so call it again rather than reusing it.
**[verified]** (live probe 2026-09-09, #394)

**Coerce these ids with `| 0` too.** The same ~1.2-1.3x per-candidate cost
`getCellAt` carries (#276, above) applies to ids that come out of the geometry
helpers. Measured on the shipped skyscraper 9x9: eighteen row/column
`HouseComponent`s built straight from `getAllRows()` ran **1.18x** the
document cages they replaced; the identical construction with
`.map(c => c | 0)` ran **0.97x** (#394). Nothing about the id looks different
from JS -- `Array.isArray` is true and the values compare `===` -- so the
coercion is not optional decoration.

## spec

`puzzle.spec.digitCount`, `spec.minDigit`, `spec.maxDigit`,
`spec.size.width`, `spec.size.height`, `spec.type` (`"sudoku"` or `"custom"`).
**[docs]**

## DigitSet

| Member | Meaning |
|-|-|
| `SudokuDigitSet.from(array)` | Build a set from an array of digits. **[verified]** |
| `new SudokuDigitSet(mask)` | Build a set from a bitmask (bit `d` = digit `d`). **[verified]** (read from the app bundle, 2026-08-26) |
| `set.mask` / `set.valueOf()` | The bitmask. **[verified]** (bundle) |
| `set.has(digit)` / `set.size` | Membership / count. **[verified]** (bundle) |
| `set.intersects(other)` | True when the sets share a digit. Does not mutate. **[verified]** (bundle) |
| `set.intersect(other)` / `.union(other)` / `.subtract(other)` / `.xor(other)` | Set algebra. **Mutates `set` in place and returns it** — not a new set. Safe on `getCandidates()` results, which are fresh copies. **[verified]** (bundle) |
| `set.add(digit)` / `set.delete(digit)` / `set.clear()` / `set.equals(other)` | Single-digit edits (in place) and equality. **[verified]** (bundle) |
| `SudokuDigitSet.getUnion(sets)` / `.getIntersection(sets)` | Statics over an iterable of sets that **return a fresh set** and leave the inputs alone. The intersection starts from an all-ones mask, so pass at least one set. **[verified]** (bundle `bundle.claude.js:608-617`) |
| `Array.from(set)` | Iterate as an array. **[verified]** |
