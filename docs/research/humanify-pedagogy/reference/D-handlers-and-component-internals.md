## Constraint handlers, layouts, and component internals

Every built-in constraint type in a puzzle document has a registered handler. At
`setupPuzzle` the solver walks the document's constraints and calls each
handler's `register`, which adds the constraint components that actually do the
deducing; `validate` runs alongside it to report document-level problems. All of
this happens before any custom main code runs. A custom constraint never calls
these functions, but they are the map from "the document says killer cage 17" to
"the solver holds a `DifferentDigitsComponent` and a `SumComponent`". The rest
of the section documents members of already-covered helper and component classes
that the reference did not reach. Cell ids are 0-based; in a digit mask, bit *d*
is digit *d*.

### XSumsHelper (additional members)

#### `*getXSumPossibilities(sum)`

Generator over the ways an X-sum clue of total `sum` can be realised, yielding
`{ x, combinations }` where `x` is the count of leading cells and
`combinations` is an array of digit masks for the remaining `x - 1` cells.
- **Notes:** `sum === 1` yields only `{ x: 1, combinations: [2] }` (the mask for
  digit 1, since the single leading cell must itself be 1). Sums 2 and 4, and
  any sum above the triangular number of `maxDigit`, yield nothing. For each
  candidate `x` it enumerates non-repeating combinations of `sum - x` over
  `x - 1` cells and drops any that contain `x` itself, since `x` occupies the
  first cell of the same house. Enumeration cost scales with `maxDigit`.
  **[read]**

### LinesHelper (additional members)

#### `*getAllPairsAlongLines(lines)`

Generator yielding `[cellA, cellB]` for every adjacent pair of cells along each
line in `lines` (an array of cell-id arrays).
- **Notes:** pairs are consecutive positions in the line's own order, not
  geometric adjacency; a line of *n* cells yields *n - 1* pairs. **[read]**

### FriendDigitTable (additional members)

#### `getFriends(paramValue)`

Returns the memoized per-digit "friend" table for `paramValue`, an array indexed
by digit from `puzzleSpec.minDigit` to `puzzleSpec.maxDigit` holding whatever the
table's callback produced for that digit (typically a digit mask of partners).
- **Notes:** the memo key comes from `getFriendCacheKeyBuilder(paramType)` and
  folds in the live min/max digit, so the same table is safe across puzzle specs.
  Digits below `minDigit` are holes in the returned array. **[read]**

### SumCandidateUpdater (additional members)

#### `*updateCandidatesWithoutRepeats(resolvedFlag)`

Generator implementing the no-repeat branch of `updateCandidates`: it subtracts
filled values from the `[minimumSum, maximumSum]` window, enumerates every
non-repeating digit combination for each remaining target, keeps those whose
digits are all still available somewhere among the unsolved cells, and filters
the unsolved cells to the union of the survivors.
- **Notes:** when exactly one combination survives it filters to that mask and
  sets `resolvedFlag.value = true` so the caller can retire the component. With
  no unsolved cells left it yields AbortSolver if the total misses the window.
  The remaining minimum is clamped up to `puzzleSpec.minDigit` before
  enumerating. **[read]**

#### `*updateCandidatesWithRepeats()`

Generator implementing the repeats-allowed branch: per unsolved cell it removes
any candidate digit that cannot fit between the minimum and maximum totals
achievable by the *other* unsolved cells.
- **Notes:** no combination enumeration, so it is much cheaper and much weaker
  than the no-repeat path. Same AbortSolver behaviour when every cell is filled.
  **[read]**

#### `getMinSum(state, cellIdSet, excludedCellId)`

Returns the smallest total the cells in `cellIdSet` can reach, skipping
`excludedCellId`, taking each cell's value if filled and otherwise its smallest
candidate.
- **Notes:** a cell with an empty candidate mask contributes 0, not a failure.
  **[read]**

#### `getMaxSum(state, cellIdSet, excludedCellId)`

The largest-total mirror of `getMinSum`, using each unfilled cell's largest
candidate. **[read]**

### WeightedSumCandidateUpdater (additional members)

#### `getMinSum(state, cellWeights, excludedCellId)`

Returns the smallest weighted total over the `Map` of cell id to weight, skipping
`excludedCellId`, multiplying each cell's value (or its smallest candidate) by
that cell's weight.
- **Notes:** takes a `Map`, not an array of ids, which is the only real
  difference from the unweighted version. **[read]**

#### `getMaxSum(state, cellWeights, excludedCellId)`

The largest-weighted-total mirror, using each unfilled cell's largest candidate
times its weight. **[read]**

### SandwichSumInnerComponent (additional members)

#### `*updatePossibleCellsForSandwichDigits(puzzle, knownDigit, otherDigit)`

Generator: once `knownDigit` is placed (some cell's candidates equal exactly that
digit's bit), it removes `otherDigit` from every cell whose index distance from
the anchor is outside `[minDistance, maxDistance]`.
- **Notes:** no-op when `knownDigit` is not yet resolved to a single cell.
  Distance is measured in positions along `cellIds`, not geometrically. **[read]**

#### `*updateCandidatesBetweenSandwichDigits(puzzle)`

Generator: when exactly two cells can still hold the sandwich digits, it replaces
the whole component with a `SumComponent` over the cells strictly between them.
- **Notes:** if the union of those two cells' candidates, masked to the sandwich
  digits, does not hold exactly two digits, it yields AbortSolver instead. The
  replacement is a one-way transition: the sandwich logic is gone afterwards.
  **[read]**

#### `getSandwichIndices(puzzle)`

Returns the positions in `cellIds` (indices, not cell ids) of cells whose
candidates are a subset of the sandwich-digit mask, meaning they can hold nothing
but a sandwich digit. **[read]**

### SelfCountingStateComponent (additional members)

#### `getCandidatesUnion(puzzle, cellIdsToUnion)`

Returns a `SudokuDigitSet` holding every digit still a candidate in any of
`cellIdsToUnion`. **[read]**

#### `getSingletons(puzzle, cellIdsToScan)`

Returns a `SudokuDigitSet` of the digits that are the sole candidate in some cell
of `cellIdsToScan`.
- **Notes:** a filled cell reads as a singleton mask here, so placed digits are
  included. **[read]**

### SelfCountingSumComponent (additional members)

#### `updatePossibleSums(state)`

Recomputes `this.possibleSums` and `this.possibleDigits` from the current
candidate union over the component's cells, enumerating digit combinations of
length `cellIds.length` and discarding any that touch `excludedDigits`.
- **Mutates:** the receiver's `possibleSums` and `possibleDigits`.
- **Notes:** the repeat allowance is derived first — it is the largest overlap
  between the component's cells and any of its helper house components, so cells
  spread across two houses may repeat a digit that many times. Enumeration cost
  grows with the cell count. Returns nothing; it is not a generator and yields no
  changes. **[read]**

### SequenceStepComponent (additional members)

#### `getValidValuesForDirection(puzzle, reversed = false)`

Returns an array of digit masks, one per cell, holding every digit that appears
in some arithmetic progression consistent with the current candidates when the
sequence is read from one end.
- **Params:** `reversed` – false reads from `cellIds[0]` forward, true from the
  last cell backward.
- **Returns:** array of digit masks parallel to `cellIds`; the empty array when
  the span between the ends is negative.
- **Notes:** step sizes run from `minimumDifference` up to
  `floor(span / (cellIds.length - 1))`, so only non-decreasing runs are found in
  one direction — `update` ORs the forward and reverse results to cover both. A
  progression is kept only if every cell still holds its digit. **[read]**

### Top-level functions (constraint handlers, layouts, digit groups, sum caches)

**Sum caches and combination entries.**

#### `getFriendCacheKeyBuilder(keyKind)`

`bundle.claude.js:3758`. Returns the memo-key function a `FriendDigitTable` uses,
picked by `FriendCacheKeyKind`: `None` keys on `min + 10 * max` alone, `Number`
folds a numeric parameter in as `(min + 10 * max) * 1000 + value`, `Numbers`
builds `"a,b,c_<minmax>"`, and `String` builds `"<text>_<minmax>"`.
- **Notes:** the `Number` form assumes the parameter is under 1000; larger values
  would collide with the digit-range part of the key. **[read]**

#### `buildSumCombinationsEntry(sums, cellCount)`

`bundle.claude.js:4360`. Returns `{ combinations, required: 0 }`, where
`combinations` is every non-repeating digit combination reaching one of `sums`
over `cellCount` cells, each converted to a digit mask.
- **Notes:** this is the cache entry shape the sum logic step stores per
  component; `required` starts empty and is narrowed later. **[read]**

#### `isNonRepeatingSumComponent(component)`

`bundle.claude.js:4368`. True when `component` is a `SumRangeComponent` or
`ExactSumComponent` whose `repeat` flag is false, which is the class of component
the shared sum-combination cache can handle. **[read]**

**Region and box layout.**

#### `hasStandardBoxShape({ width, height })`

`bundle.claude.js:8509`. True when the grid is square and its side is 4, 6, 8, or
9, the sizes with a canonical box shape in `BoxShapesByDigitCount` (2x2, 3x2,
4x2, 3x3). **[read]**

#### `groupCellIdsByRegionId(regionIdByCell)`

`bundle.claude.js:8512`. Inverts a per-cell region-id array into an array of cell
id arrays indexed by region id.
- **Notes:** cells with region id `-1` (unassigned) are dropped, and region
  indices with no cells come back as empty arrays rather than holes. **[read]**

#### `getDefaultRegionLayout(spec)`

`bundle.claude.js:8523`. Returns the per-cell region-id array a puzzle gets when
the document does not supply regions: the standard box layout if the grid is
square with side equal to the digit count, else a divisible box layout, else one
region per row for a square grid of side at most 9, else all `-1`. **[read]**

#### `getStandardBoxLayout(size)`

`bundle.claude.js:8542`. Returns the rectangular box layout for a 4x4, 6x6, 8x8
or 9x9 grid, or `undefined` for any other size. **[read]**

#### `getDivisibleBoxLayout(spec)`

`bundle.claude.js:8546`. Searches factor pairs of the digit count for a box shape
that tiles the grid exactly, trying each orientation, and returns the matching
layout or `undefined`.
- **Notes:** bails immediately unless the cell count is a multiple of the digit
  count and each region would hold at most 9 cells. The search starts at
  `ceil(sqrt(digitCount))`, so the squarest box wins. **[read]**

#### `buildRectangularBoxLayout(size, boxSize)`

`bundle.claude.js:8576`. Returns a per-cell region-id array tiling a `size` grid
with `boxSize` boxes, numbering boxes left to right then top to bottom.
- **Notes:** assumes the grid divides evenly by the box; it does no checking, so
  a bad `boxSize` yields fractional region ids. **[read]**

#### `regionsAreRectangularBoxes({ width, height }, regionIdByCell)`

`bundle.claude.js:8587`. True when no 2x2 window of the grid shows a region
pattern that a rectangular tiling could not produce.
- **Notes:** each window must be split horizontally, split vertically, or have
  its two diagonal pairs all distinct; anything else returns false. It is a
  necessary local test, not a proof of a global rectangular tiling. **[read]**

**Digit-group classification (used to name entropy-style constraints).**

#### `describeDigitGroupsAsText(groups)`

`bundle.claude.js:10343`. Renders an array of digit masks as a canonical string,
each group's digits concatenated and the groups sorted, e.g. `"123 456 789"`.
**[read]**

#### `groupsPartitionAllDigits(groups, spec)`

`bundle.claude.js:10349`. True when the groups are disjoint and together cover
every digit of the spec exactly once.
- **Notes:** it subtracts each group from a full digit set and fails on the first
  group that is not still wholly present, which catches both overlap and stray
  digits. Empty `groups` is false. **[read]**

#### `groupsAreParityPair(groups, spec)`

`bundle.claude.js:10358`. True when `groups` is exactly the two masks for the odd
digits and the even digits of the spec. **[read]**

#### `groupsAreModularClasses(groups, classCount, spec)`

`bundle.claude.js:10366`. True when there are `classCount` groups and each one
equals one of the residue classes of the spec's digits modulo `classCount`.
**[read]**

#### `groupsArePolarityPair(groups, spec)`

`bundle.claude.js:10375`. Intended to detect the low/high split around the
midpoint of the digit range, checking that `groups` holds both the low mask and
the high mask.
- **Notes:** in the bundle both masks are built with the same predicate
  (`digit < midpoint`), so `lowMask` and `highMask` are identical and the
  function really asks only whether the low group is present among two groups.
  A low/high pair still passes; so would a pair of low plus anything. **[read]**

> Discrepancy: `bundle.claude.js:10382` builds `highMask` with
> `digitForHigh < midpoint`, the same test as `lowMask` at line 10380. This looks
> like a bug in the shipped bundle rather than a deliberate rule.

#### `groupsAreEntropySets(groups, spec)`

`bundle.claude.js:10387`. True when the spec's digit range and the canonical
group text match one of eight hard-coded entropy partitions, such as `1_9` with
`"123 456 789"` or `0_5` with `"01 23 45"`. **[read]**

#### `describeDigitGroupKind({ groups, spec, short, adjective })`

`bundle.claude.js:10401`. Returns a human name for what the groups are: parity,
modulo-3, modulo-4, polarity, or entropy, tested in that order.
- **Params:** `short` – trims the parenthetical, so `"parity"` rather than
  `"parity (odd/even)"`. `adjective` – returns the adjectival form, `"3-modular"`
  or `"entropic"`.
- **Notes:** with no match it falls back to the groups' digits joined by slashes,
  and `"???"` when `groups` is empty. **[read]**

#### `getEntropyLineDisplayName(groups, spec)`

`bundle.claude.js:10432`. Returns the adjectival group kind followed by
`" line"`, e.g. `"entropic line"`, used to name the components an entropy-lines
constraint adds. **[read]**

**Constraint handlers and their validators.**

#### `registerArrowConstraint({ puzzle, input, helpers })`

`bundle.claude.js:9812`. For each bulb, adds a `SameDigitComponent` over the
single-cell arrows plus the bulb when the bulb is one cell, and a
`SameSumComponent` equating every multi-cell arrow against the bulb read as a
multi-digit number.
- **Notes:** with a multi-cell bulb, single-cell arrows are folded into the
  multi-cell list instead of becoming a same-digit group. The bulb group is
  sorted descending by cell id and carries `asNumber: true`, which is how a
  two-cell bulb reads as a two-digit number. **[read]**

#### `registerBetweenLinesConstraint({ puzzle, input, helpers })`

`bundle.claude.js:9865`. Adds one `BetweenComponent` per line, over the two line
ends and the cells between them.
- **Notes:** lines shorter than 3 cells are skipped, since there is nothing
  between the ends. **[read]**

#### `registerDiagonalConstraint({ puzzle, input, helpers })`

`bundle.claude.js:10142`. Adds a `HouseComponent` over the named diagonal when
the digit count equals the grid width, and a `DifferentDigitsComponent` otherwise.
- **Notes:** the positive/negative choice comes from `input.type`; the house type
  is `DiagonalPlus` or `DiagonalMinus`, so the diagonal participates in
  house-based logic only on a full-size grid. **[read]**

#### `isEdgeClueConstraint(constraint)`

`bundle.claude.js:10167`. True when the constraint's configured type is one of
the edge-clue types (difference and ratio kropki dots, XV). **[read]**

#### `validateEdgeCluesNotObstructed({ puzzle, input })`

`bundle.claude.js:10170`. Warns when a later edge-clue constraint places a clue
on an edge this one already uses, naming the obstructing kind.
- **Notes:** only constraints *after* this one in the document list are checked,
  so the warning attaches to the one that will be drawn under. Returns a Valid
  severity otherwise. **[read]**

#### `validateRegionsInput({ input, puzzle })`

`bundle.claude.js:10269`. Returns an error string when a region id is out of
range or when any region holds more than `width` cells, and `""` when the regions
are usable.
- **Notes:** custom puzzles short-circuit to `""` with no checking. It counts
  region sizes rather than verifying shape, so disconnected regions pass. **[read]**

#### `registerOddEvenConstraint({ puzzle, input, helpers })`

`bundle.claude.js:10483`. Adds a `PredefinedCandidatesComponent` per clued cell,
restricting it to the odd digits (mask 682) or the even digits (mask 341).
- **Notes:** the masks are literal constants for digits 1-9: 682 is bits 1, 3, 5,
  7, 9 and 341 is bits 0, 2, 4, 6, 8. **[read]**

#### `registerIndexerConstraint({ puzzle, input, helpers })`

`bundle.claude.js:10551`. Adds an `IndexComponent` per clued cell: a row indexer
indexes the cell's own column with its 1-based row number, a column indexer
indexes its row with its 1-based column number. **[read]**

#### `killerCageSumIsInformative(cage, spec)`

`bundle.claude.js:10593`. True when a cage's total actually constrains anything:
false for a cage with no value, and false for a full-house-sized cage whose total
is the forced triangular number of `maxDigit`. **[read]**

#### `registerFortressConstraint({ puzzle, input, helpers })`

`bundle.claude.js:10732`. For each fortress cell, adds a `GreaterThanComponent`
against every orthogonally adjacent cell outside the fortress — the fortress cell
larger for a Maximum constraint, smaller for a Minimum.
- **Notes:** neighbours that are themselves fortress cells are skipped, so a
  contiguous fortress block constrains only its border. **[read]**

#### `fortressConstraintsConflict(configA, configB)`

`bundle.claude.js:10758`. True when one config is Minimum and the other Maximum
and their cell lists share at least one cell. **[read]**

#### `validateFortressOverlap({ puzzle, input })`

`bundle.claude.js:10767`. Returns an Error-severity result when any other
constraint conflicts with this one per `fortressConstraintsConflict`, naming the
opposite fortress kind, and `""` otherwise. **[read]**

#### `ratioClueSupersedesNegativeDifference(maxDigit, ratio, component)`

`bundle.claude.js:10896`. True when a ratio clue on an edge already implies the
`NegativeDifferenceComponent` on that edge, so the handler can remove the
weaker component.
- **Notes:** it walks multipliers 1 through `maxDigit / ratio` and checks whether
  `multiplier * (ratio - 1)` is one of the component's forbidden differences,
  since a ratio-*r* pair `(d, r*d)` differs by exactly that. Returns false for a
  component of any other class. **[read]**

#### `isPossibleSandwichSum(sumValue, spec)`

`bundle.claude.js:11031`. True unless the value is in the hard-coded impossible
list for the spec's digit range, e.g. 1 and 34 and 36-45 for digits 1-9.
- **Notes:** a digit range with no table entry passes everything. **[read]**

#### `isPossibleXSumValue(xSumValue, spec)`

`bundle.claude.js:11413`. True unless the spec is a Sudoku and the value is in
the impossible list for `maxDigit`: 2 and 4 at every size, plus 7 at maxDigit 4
and 11 at maxDigit 5.
- **Notes:** non-Sudoku puzzle kinds skip the check entirely. It indexes the
  table by `maxDigit` without a guard, so a Sudoku spec with `maxDigit` outside
  4-9 would throw. **[read]**
