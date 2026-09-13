## Sums, X-sums, digits and naming

Four helper namespaces reached from the `helpers` object a component is built
with: `helpers.sums`, `helpers.xSums`, `helpers.digits` and `helpers.naming`.
All four are constructed once per puzzle by `createHelpers(spec)`
(`bundle.claude.js:1607`) and shared; nothing here touches puzzle state, so
every method is a pure computation over digit bitmasks, cell ids and numbers.

Throughout this section a **candidate mask** is a plain `number` bitmask where
bit `d` is digit `d` (`1 << d`) — exactly what `cell.candidates` and
`puzzle.getCandidatesBitMask(cell)` return. `DigitSet` (`SudokuDigitSet`) wraps
one such mask and has `valueOf()`, so a `DigitSet` can be passed wherever a mask
is read via `valueOf()`, and a raw number can be passed wherever a method calls
`.valueOf()` or intersects with a fresh set.

### helpers.sums (class SumsHelper)

Sum arithmetic over per-cell candidate masks (`bundle.claude.js:1466`). Fields:
`minDigit`, `maxDigit` (copied from the puzzle spec). Two families: the
`ExtremeSums`/`MinimumSum`/`MaximumSum` methods take **candidate masks** and
answer "what range can these cells sum to"; the `Combinations` methods ignore
candidates entirely and enumerate digit combinations over `minDigit..maxDigit`.

"With repeat" means cells may share a digit (each cell is scored independently).
"Without repeat" means the cells must take **distinct** digits, so the answer is
a search over injective digit assignments and can fail outright (`null`).

The constructor rebinds `getCombinationsForSumWithoutRepeat` to a memoized
wrapper keyed on `` `${sum}_${cellCount}` ``, so repeat calls are free but
**return the same array instance every time** — never mutate a returned
combination list or its inner arrays.

#### `getExtremeSumsWithRepeat(candidateMasks, weights)`
Adds up the smallest candidate of every cell and the largest candidate of every
cell, independently.
- **Params:** `candidateMasks` – array of per-cell candidate masks (numbers), one
  per cell, in the cells' order. `weights` – optional array of per-cell
  multipliers, same length; a missing entry defaults to `1`.
- **Returns:** `{ minSum, maxSum }` — always an object, never `null`.
- **Notes:** an empty mask (`0`) contributes `0` to both sums rather than
  signalling a contradiction (`smallestDigit ?? 0`), so this method cannot
  detect a dead cell. An empty `candidateMasks` gives `{minSum: 0, maxSum: 0}`.
  Cost is linear. Typical call:
  `helpers.sums.getExtremeSumsWithRepeat(this.cellIds.map(id => cells[id].candidates))`.

#### `getExtremeSumsWithoutRepeat(candidateMasks, weights)`
Same range, but requiring all cells to take distinct digits.
- **Returns:** `{ minSum, maxSum }`, or **`null`** when no assignment of distinct
  digits to these cells exists at all — i.e. the constraint is already broken.
- **Notes:** runs `getMinimumSumWithoutRepeat` first and short-circuits to `null`
  before computing the maximum. Two separate searches, so it costs twice a single
  extreme.

#### `getMinimumSumWithoutRepeat(candidateMasks, weights)`
Smallest weighted total achievable with all cells on distinct digits.
- **Returns:** a number, or `null` if no distinct-digit assignment exists.
- **Notes:** see `#e` below for the fixed-cell handling. The search recurses over
  every ordering of the not-yet-fixed cells, taking the smallest still-unused
  digit at each step, so its cost is `O(k!)` in the number of **unfixed** cells —
  cheap once most cells are solved, expensive on a fresh 9-cell group. The
  greedy-per-branch step is only valid for non-negative weights.

#### `getMaximumSumWithoutRepeat(candidateMasks, weights)`
Mirror of the above, taking the largest unused digit at each step.
- **Returns:** a number, or `null` if no distinct-digit assignment exists.

#### `getCombinationsForSumWithoutRepeat(sum, cellCount)`
Every set of `cellCount` distinct digits from `minDigit..maxDigit` that adds to
`sum`.
- **Returns:** array of arrays of digits (ascending within each combination),
  `[]` when `cellCount` is `0` or nothing matches.
- **Notes:** this ignores candidates — it is pure digit arithmetic. It enumerates
  **all** `C(maxDigit-minDigit+1, cellCount)` combinations and filters by sum, so
  it is the expensive call in this class; memoized per `(sum, cellCount)`, and the
  cached array is shared — copy before mutating. Convert to masks with
  `.map(toDigitMask)` if you want to intersect against candidates.

#### `getCombinationsForSumsWithoutRepeat(sums, cellCount)`
Concatenation of `getCombinationsForSumWithoutRepeat` over each entry of `sums`.
- **Returns:** array of digit arrays; `[]` when `cellCount` is `0`.
- **Notes:** no de-duplication — a repeated value in `sums` yields duplicate
  combinations.

Private `#e(candidateMasks, weights, search)` backs both extreme-sum searches.
It first splits out every cell whose mask is a **single candidate**: their digits
are added (times their weight) into a fixed total, and their bits seed the
"already used" mask so the search cannot reuse them. Only the remaining cells are
searched, and the fixed total is added back to the result. Consequence: two cells
already fixed to the **same** digit are not detected as a repeat — both are
counted in the total, the used-mask just ORs the same bit twice, and the method
returns a sum instead of `null`.

### helpers.xSums (class XSumsHelper)

Enumerates which X-sum readings are arithmetically possible for a given total
(`bundle.claude.js:1580`). Fields: `maxDigit`. It holds a reference to the
`SumsHelper` and reuses its memoized combination enumeration.

#### `*getXSumPossibilities(sum)`
Yields one entry per value of X for which the first X cells could sum to `sum`.
- **Params:** `sum` – the X-sum clue total.
- **Returns:** generator of `{ x, combinations }`. `x` is the digit in the first
  cell; `combinations` is an array of **digit masks**, each mask being one legal
  set of digits for the **remaining `x - 1` cells** (the `x` digit itself is
  excluded from every mask).
- **Notes:** `sum === 1` is special-cased to yield `{x: 1, combinations: [2]}` —
  there are no remaining cells there, and that lone mask (digit 1) describes the
  X cell, not the tail, unlike every other entry; the built-in consumer slices it
  away harmlessly. `sum === 2`, `sum === 4` and any `sum` above
  `triangularNumber(maxDigit)` yield nothing. An entry is skipped when no
  combination survives, so an empty generator means the clue is unsatisfiable.
  Cost is one `getCombinationsForSumWithoutRepeat` call per candidate X, so this
  is best called once in the constructor and cached, as `XSumFullLineComponent`
  does.

### helpers.digits (class DigitsHelper)

Digit-range facts and `DigitSet` factories (`bundle.claude.js:627`). Fields:
`minDigit`, `maxDigit` (from the spec) and `allDigitsMask`, computed as
`(1 << (maxDigit + 1)) - (1 << minDigit)` — for a classic 1..9 puzzle that is
bits 1 through 9, with bit 0 clear. Every factory returns a **fresh**
`SudokuDigitSet`, safe to mutate.

#### `createFullDigitSet()`
Every digit in the puzzle, as a `DigitSet` over `allDigitsMask`.

#### `createEvensDigitSet()`
The even digits.
- **Notes:** implemented as `allDigitsMask & 0x55555555` — the even-indexed bits,
  i.e. digits 0, 2, 4, 6, 8, then clipped to the puzzle's range.

#### `createOddsDigitSet()`
The odd digits (`allDigitsMask & 0xAAAAAAAA`, i.e. digits 1, 3, 5, 7, 9).

#### `createModuloDigitSet(divisor, remainder)`
Digits `d` in range with `d % divisor === remainder`.
- **Notes:** literal `%`, so `remainder` must be given in the same sign
  convention JavaScript produces. `createModuloDigitSet(3, 0)` on 1..9 gives
  {3, 6, 9}.

#### `createFilteredDigitSet(predicate)`
Digits in range for which `predicate(digit)` is truthy.
- **Params:** `predicate` – `(digit: number) => boolean`, called once per digit
  from `minDigit` to `maxDigit` inclusive.

### helpers.naming (class NamingHelper)

Builds the human-readable strings shown in solve explanations
(`bundle.claude.js:1301`). Fields: `spec`, and `names`, a row-major array of
`R#C#` labels built in the constructor — one per grid cell, so it is indexed by
cell id directly. It also holds the edge-id, outer-cell-id, geometry and digits
helpers.

#### `getCellName(cellId)`
The cell's `R#C#` label, 1-based in both coordinates.
- **Notes:** on a 9x9, cell id `12` renders as `"R2C4"` (row-major id, top-left
  is `R1C1`). Out-of-range ids give `undefined`, not a throw.

#### `getColumnName(columnIndex)`
`` `C${columnIndex + 1}` `` — takes a **0-based** column index, so `0` gives
`"C1"`.

#### `getRowName(rowIndex)`
`` `R${rowIndex + 1}` `` — 0-based in, 1-based out.

#### `getDigitFilterDescription(digitSet)`
A noun phrase for "the value must be one of these", e.g. `"an odd digit"`.
- **Params:** `digitSet` – a `DigitSet` or a raw mask; it is first intersected
  with a fresh full digit set, so out-of-range bits are ignored and the argument
  is **not** mutated.
- **Returns:** `"an odd digit"` / `"an even digit"` when the set equals exactly
  the odds / evens; `` `a ${digit}` `` for a single digit (e.g. `"a 5"`);
  otherwise `` `a ${...}` `` with the digits joined by `or` — `{1,2,5}` gives
  `"a 1, 2 or 5"`.

#### `getDigitSetDescription(digitSet, conjunction = "and")`
The digits of the set, ascending, joined as a list.
- **Returns:** `"1, 2 and 5"` by default; pass `"or"` for `"1, 2 or 5"`. Two
  digits give `"1 and 2"` with no comma; an empty set gives `""`.
- **Notes:** same intersect-with-full-set normalisation as above, so the argument
  is not mutated.

#### `getCellsDescription(cells)`
A list of cell names.
- **Params:** `cells` – array or iterable of cell ids; it is copied and sorted
  ascending by id, so the caller's order is not preserved and the argument is not
  mutated.
- **Returns:** `"R1C1, R2C2 and R3C3"`; `"???"` for an empty collection.

#### `getLineName(lineLabel, cells)`
`` `the ${lineLabel} from ${first} to ${last}` `` using `cells[0]` and
`cells.at(-1)` — relies on the array being in path order.

#### `getBranchingLineName(lineLabel, cells)`
`` `the ${lineLabel} containing ${name}` `` where the name is the cell with the
**smallest id** (`Math.min(...cells)`), so order does not matter.

#### `getEdgeClueName(clueLabel, edgeId)`
`` `the ${clueLabel} between R1C1 and R1C2` `` — resolves the edge to its two
cells via `geometry.getCellsTouchingEdge(edgeId)` and defers to
`getEdgeClueNameFromDomino`.

#### `getEdgeClueNameFromDomino(clueLabel, dominoCells)`
Same string from a pair of cell ids you already have.

#### `getCageName(cageLabel, cells)`
`` `the ${cageLabel} at ${name}` `` using the smallest cell id in the cage.

#### `getTupleName(cells)`
The size word for a group of cells: `"pair"` for 2, `"triple"` for 3.
- **Notes:** delegates to the table below via `cells.length`.

#### `getTupleNameBySize(tupleSize)`
The size word directly: `0` → `"empty tuple"`, `1` → `"single"`, then `"pair"`,
`"triple"`, `"quadruple"`, `"quintuple"`, `"sextuple"`, `"septuple"`,
`"octuple"`, `"nonuple"`; anything larger falls back to `` `${n}-tuple` ``.

#### `getOuterClueName(clueLabel, outerCellId)`
Names a clue sitting outside the grid, e.g. `"the sandwich clue in C3"`.
- **Returns:** `` `the top ${clueLabel} in C3` `` / `` `the bottom … in C3` `` for
  clues above and below a column, `` `the left/right ${clueLabel} in R3` `` for
  clues beside a row, and `` `the top-left ${clueLabel}` `` (and the three other
  corners) with no row or column for corner positions.
- **Notes:** reads the outer cell's side and 0-based x/y through
  `outerCellIds.getAllAttributes`; returns `undefined` if the id is not a
  recognised outer position.
