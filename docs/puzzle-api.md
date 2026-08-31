# The puzzle API

The solving object is available as `puzzle` or `sudoku`. `helpers` is also
reachable as `puzzle.helpers`. Signatures below are from the community docs
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
| `createFullDigitSet()` | DigitSet of all digits. **[docs]** |
| `createOddsDigitSet()` / `createEvensDigitSet()` | Odd / even DigitSet. **[docs]** |

## helpers.geometry / helpers.lines

Mostly TODO in the source docs; useful for global constraints. Known members
include `getOrthogonallyAdjacentCells`, `getDiagonallyAdjacentCells`,
`getAllRows`, `getAllColumns`, `getAllKnightMovePairs`, `getAllDominoes`,
`getCellsPointedAtByOuterClue`, and `helpers.lines.getLineEnds`. Verify the
exact signature before relying on one. **[docs]**

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
| `set.intersect(other)` / `.union(other)` / `.subtract(other)` | Set algebra. **Mutates `set` in place and returns it** — not a new set. Safe on `getCandidates()` results, which are fresh copies. **[verified]** (bundle) |
| `Array.from(set)` | Iterate as an array. **[verified]** |
