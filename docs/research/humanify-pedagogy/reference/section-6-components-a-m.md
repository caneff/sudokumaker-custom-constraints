## Built-in components, A to M

The solver ships ~42 constraint component classes. A custom component never
subclasses them, but three things make them worth reading: a `replaceComponent`
change can hand your work to one of them (`new HouseComponent(name, cells)` is
the cheapest way to say "these N cells are a house"), the built-ins are the
reference implementation of the `update`/`validate` split, and their message
templates are the app's own vocabulary. Reach them by their registered
constructor name inside main code: the `defineComponent` decorator appends
`Component` to any name that lacks it, so `House` is registered as
`HouseComponent` and that is the global you call `new` on
(`bundle.claude.js:2742`).

Two shapes recur. A **leaf** component extends `ConstraintComponent` and does
its own pruning in `update`. A **composite** extends `CompositeComponent`,
builds a list of leaf components in `initialize`, and deletes itself. A **pair**
extends `PairComponent` and delegates all pruning to a precomputed friend table,
supplying only `validate` and a constructor.

This section covers every such class whose registered display name (or class
name, when unregistered) sorts before `N`, in that order.

> Discrepancy: `../../bundle-api-index.md` lists 34 registered components. This
> bundle contains 42 `defineComponent` calls. The eight the index omits are
> `Pair`/`AsymmetricalPair`, `DifferentGroups`, `RequiredGroups`,
> `DiverseGroups`, `GreaterThan`/`LessThan`, `SameGroup`, `SandwichSum` and
> `WeightedSum`; four of those (`DifferentGroups`, `DiverseGroups`,
> `GreaterThan`, plus the `Pair` base) fall in this section. The index is
> generated from the HAR's shipped chunks, so the likely cause is tree-shaking
> in those chunks, not a naming difference — but treat the four as present and
> callable only after checking the live build.

> Discrepancy: `../../../component-contract.md` states that `validate` returns a
> boolean. Every built-in returns either the shared `ValidResult` object or
> `{valid: false, message, cells?}`. The contract doc describes the custom
> component wrapper, which adapts a boolean; the built-in classes you might
> subclass in a `replaceComponent` do not use that convention.

### Between (`class BetweenComponent extends ConstraintComponent`)

Between-line logic for two endpoints and any number of midpoints
(`bundle.claude.js:4891`). Fields: `endPoints` (exactly two cell ids),
`midPoints`. `cellIds` is the concatenation, endpoints first.

- **Registered as** `Between`, "The digits on all {midPoints} must be between
  the digits on the {endPoints}.", params `[["endPoints", {type: CellArray,
  amount: 2}], ["midPoints", CellArray]]`.
- **Constructor** `(name, endPoints, midPoints)`.
- **update** Runs two passes. `updateEnds` finds the lowest and highest *placed*
  midpoint value, builds a mask of digits below the lowest and one of digits
  above the highest, then tests which of the two orientations (first end low, or
  first end high) is still possible; if exactly one survives it filters each end
  to its own mask, if both survive it filters both ends to the union, if neither
  it aborts. `updateInBetween` takes the strictly-between range implied by the
  ends' candidate extremes and filters the midpoints to it. Yields
  `FilterCandidatesAtCell`, `FilterCandidatesAtCells` and `AbortSolver`.
- **validate** Not overridden; correctness rests entirely on `update`.
- **Notes** `updateInBetween` aborts with "the end-points ... have the same
  value" when neither orientation has a strictly increasing range, which also
  fires when both ends are solved to the same digit. `getIsDone` returns true as
  soon as both endpoints have values, so a Between line stops re-running before
  its midpoints are filled.

### CompositeComponent (`class CompositeComponent extends ConstraintComponent`)

The base for every component that is just a bundle of other components
(`bundle.claude.js:4998`). Unregistered; you reach it only by subclassing or by
reading one of its concrete subclasses. Field: `getComponents`, a thunk taking
the solver state.

- **Constructor** `(name, cellIds, getComponents)` — `getComponents` is
  `(state) => Component | Component[]`, called once.
- **initialize** Yields exactly one `ReplaceComponent` change carrying
  `getComponents(state)`. The composite is gone after that; it never sees
  `update`.
- **Notes** The thunk runs at initialize time, not construction time, so it can
  branch on puzzle geometry (`state.getCellsCanHaveRepeats`, `puzzleSpec.digitCount`).
  This is the pattern to copy when your constraint decomposes into built-ins.

### ConsecutiveDigits (`class ConsecutiveDigitsComponent extends ConstraintComponent`)

Digits in the cells form a run of consecutive values, repeats allowed
(`bundle.claude.js:2794`).

- **Registered as** `ConsecutiveDigits`, "All digits within {cells} must make a
  set of consecutive digits, but may repeat as well.", params `[["cells",
  CellArray]]`.
- **Constructor** `(name, cellIds)`.
- **update** Counts how many *distinct* digits are still needed: it starts from
  `cellIds.length` and decrements once for each repeat among the already-solved
  cells. That count bounds the run's width. For each cell it then takes
  `[smallest candidate - width + 1, largest candidate + width - 1]`, clipped to
  `[minDigit, maxDigit]`, and intersects all of those windows into one mask.
  Yields a single `FilterCandidatesAtCells` over every cell.
- **validate** Not overridden.
- **Notes** The distinct count only shrinks on *solved* cells, so on an empty
  line it is simply the cell count and the mask is everything. `digitSeen` is
  allocated at `maxDigit` length and indexed by digit, so a puzzle with
  `minDigit` 0 relies on the array growing. `ConsecutiveSetsLogicStep`
  (`bundle.claude.js:2921`) subscribes to instances of this class whose cells all
  see each other, and runs a stronger cross-component deduction on them — a
  reason to prefer this component over a hand-rolled equivalent.

### ConsecutiveDigitsSet (`class ConsecutiveDigitsSetComponent extends CompositeComponent`)

Consecutive run with no repeats (`bundle.claude.js:5029`).

- **Registered as** `ConsecutiveDigitsSet`, "All digits within {cells} must make
  a set of consecutive digits, without repeats.", params `[["cells", CellArray]]`.
- **Constructor** `(name, cellIds)`.
- **initialize** Via the composite: two cells become one `DifferenceComponent`
  with difference 1; a cell count equal to `digitCount` becomes a
  `HouseComponent`; anything else becomes a `ConsecutiveDigitsComponent` plus a
  `DifferentDigitsComponent`.
- **Notes** It overrides `getExclusionGroup` to return all its cells even though
  it replaces itself immediately — that matters because the base
  `ConstraintComponent.initialize` is not the one running here, and other
  subsystems may query the exclusion group before the replacement lands.

### CountDigit (`class CountDigitComponent extends CompositeComponent`)

One digit's occurrence count, read off a counter cell (`bundle.claude.js:5167`).

- **Registered as** `CountDigit`, "The digit in {counterCell} must equal the
  amount of occurrences of {digit} in {targetCells}", params `[["digit",
  Number], ["counterCell", Cell], ["targetCells", CellArray]]`.
- **Constructor** `(name, digit, counterCell, targetCells)`.
- **initialize** Replaces itself with a single `CountDigitsComponent` whose
  digit mask is `1 << digit`.
- **Notes** It passes only `targetCells` as its own `cellIds`, so the counter
  cell is not in the composite's watch set — harmless, because the replacement
  lands before any update.

### CountDigits (`class CountDigitsComponent extends ConstraintComponent`)

Counter cell equals the number of target cells holding a digit from a set
(`bundle.claude.js:5092`). Fields: `digits` (a digit mask), `counterCell`,
`targetCells`, `digitsName`.

- **Registered as** `CountDigits`, "The digit in {counterCell} must equal the
  amount of occurrences of digits from {digits}.", params `[["digits",
  DigitSet], ["counterCell", Cell], ["targetCells", CellArray]]`.
- **Constructor** `(name, digits, counterCell, targetCells)` — `digits` is used
  raw as a mask (`this.digits & candidates`), so pass a mask or a `DigitSet`
  that coerces.
- **update** Not defined. This component prunes nothing.
- **validate** With `validateDuringSolve` true, so it runs on every state, not
  only complete ones. A target cell whose whole candidate mask lies inside
  `digits` is a *definite* hit; if the definite count exceeds the counter cell's
  largest candidate, invalid. A target cell sharing any candidate with `digits`
  is a *possible* hit; if the possible count is below the counter cell's
  smallest candidate, invalid.
- **Notes** A real validate-only built-in, which contradicts the read in
  `../../../gotchas.md` that a validate-only component is inert. The difference
  is `validateDuringSolve`: a custom component's `validate` is only consulted at
  a leaf unless the solver is told to check it continuously, and this class opts
  in. It still contributes no candidate pruning of its own.

### Difference (`class DifferenceComponent extends PairComponent`)

Two cells differ by exactly one of the given amounts (`bundle.claude.js:3939`).
Fields: `differences` (array), `cellId1`, `cellId2`.

- **Registered as** `Difference`, "The difference between the values at {cell1}
  and {cell2} must be exactly {difference}.", params `[["difference",
  NumberOrNumberArray], ["cell1", Cell], ["cell2", Cell]]`.
- **Constructor** `(name, difference, cellId1, cellId2)` — a scalar is wrapped
  to an array. It builds the friend table by mapping each digit `d` to the mask
  of `d ± each difference`, clipped to the digit range, then hands that to
  `PairComponent`.
- **update** Inherited from `PairComponent`: one mask lookup per candidate digit
  in each direction.
- **validate** Passes while either cell is unfilled; otherwise checks
  `abs(v1 - v2)` is in `differences`.
- **Notes** A difference of 0 makes each digit its own friend, so `unique` is
  false and the pair contributes no exclusion group. This is the constructor to
  use for Kropki white dots and for any "consecutive pair" replacement.

### DifferentCombinations (`class DifferentCombinationsComponent extends ConstraintComponent`)

No two cell groups may hold the same multiset of digits
(`bundle.claude.js:5219`). Field: `cellGroups` (array of cell id arrays);
`cellIds` is the flattened union.

- **Registered as** `DifferentCombinations`, "Every group of cells of
  {cellGroups} must have a distinct make-up of digits.", params `[["cellGroups",
  "CellId[][]"]]` — note the type is a raw string, not a `ParamType`.
- **Constructor** `(name, cellGroups)`.
- **update** Not defined; no pruning.
- **validate** `validateDuringSolve` is true. Takes only the fully-filled
  groups, and returns valid if fewer than two. For each it builds a "make-up"
  key by mapping cells to values, sorting, and joining, then rejects the first
  collision, reporting both groups in `cells`.
- **Notes** `getMakeUp` uses a bare `.sort()`, which sorts lexicographically, and
  joins without a separator. That is correct only for single-character digits: on
  a 16-digit puzzle `[1, 10]` and `[11, 0]` both key as `"011"`-shaped strings and
  can collide. Distinct groups of different sizes can also collide by
  concatenation.

### DifferentDigits (`class DifferentDigitsComponent extends ConstraintComponent`)

All cells hold different digits, without requiring the full digit set
(`bundle.claude.js:3166`).

- **Registered as** `DifferentDigits`, "Every cell of {cells} must have a
  different digit from the rest.", params `[["cells", CellArray]]`.
- **Constructor** `(name, cellIds)`.
- **initialize** If the cell count equals `digitCount`, replaces itself with a
  `HouseComponent` — the stronger constraint. Otherwise delegates to the base.
- **update** Unions every cell's candidates into a `SudokuDigitSet`; if the union
  is smaller than the cell count, yields `AbortSolver`. That is the only change
  it makes; ordinary elimination comes from `getExclusionGroup`.
- **getExclusionGroup** Returns all cells, which is what makes the base class's
  `initialize` walk already-placed values and what makes the solver treat the set
  as mutually exclusive.
- **validate** Runs `findNakedSubsetsAmongCells` over the cells;
  `validateDuringSolve` mirrors `verboseSolvingEnabled`, so the naked-subset
  report is only produced when verbose solving is on.

### DifferentGroups (`class DifferentGroupsComponent extends ConstraintComponent`)

Each cell takes its digit from a different one of the given digit groups
(`bundle.claude.js:5286`). Field: `groups` (array of masks, coerced with `+`).

- **Registered as** `DifferentGroups`, params `[["groups", DigitSetArray],
  ["cells", CellArray]]`. Its own description ends "**Note:** currently only
  works properly when the groups do not overlap."
- **Constructor** `(name, groupMasks, cellIds)`.
- **initialize** ORs the groups together and, if that is not `allDigitsMask`,
  filters every cell to the union first, then delegates to `update`.
- **update** For each cell whose candidates are wholly contained in one group,
  removes that whole group from every *other* cell. Yields
  `RemoveCandidatesFromCell` per pair.
- **validate** Not overridden.
- **Notes** `getIsDone` reads `cells[cellIndex]` twice instead of comparing
  against `otherCellIndex`, so it compares a cell's candidates with themselves
  and returns false whenever any cell has candidates. The practical effect is
  that the component is never retired early, which costs time but is sound.
  Cost is O(cells² × groups) per update.

### DiverseGroups (`class DiverseGroupsComponent extends CompositeComponent`)

At least one digit from every group must appear (`bundle.claude.js:5485`).

- **Registered as** `DiverseGroups`, params `[["groups", DigitSetArray],
  ["cells", CellArray]]`, with the same non-overlapping-groups caveat.
- **Constructor** `(name, groupMasks, cellIds)`.
- **initialize** One cell becomes a `PredefinedCandidatesComponent` holding the
  union of all groups. Otherwise it emits a `RequiredGroupsComponent` when there
  are at least as many cells as groups, and a `DifferentGroupsComponent` when
  there are at most as many, so an equal count yields both.

### ExactDigitCount (`class ExactDigitCountComponent extends CompositeComponent`)

A digit appears exactly `count` times (`bundle.claude.js:5676`).

- **Registered as** `ExactDigitCount`, "The digit {value} must appear exactly
  {count} times in {cells}.", params `[["value", Number], ["count", Number],
  ["cells", CellArray]]`.
- **Constructor** `(name, digitValue, requiredCount, cellIds)`.
- **initialize** Splits into a `MaxDigitCountComponent` (the upper bound) and a
  `RequiredDigitsComponent` whose `values` array is the digit repeated `count`
  times (the lower bound). The repeat-to-require-repeats trick is exactly what
  `RequiredDigits`' own message template describes.

### ExactSumComponent (`class ExactSumComponent extends ConstraintComponent`)

Unregistered leaf that `SumComponent` and friends delegate to
(`bundle.claude.js:4251`). Fields: `sums` (array), `repeat` (bool), `minSum`,
`maxSum`, `sumsDescription`.

- **Constructor** `(name, sums, cellIds, repeat)`.
- **update** Delegates wholesale to `new SumCandidateUpdater(state, minSum,
  maxSum, cellIds, name).updateCandidates(repeat)`; it holds no sum logic of its
  own. See the sums section for that updater.
- **validate** `validateDuringSolve` is true. Returns valid as soon as it hits an
  unfilled cell; otherwise checks the total against `sums`.
- **Notes** Only `minSum` and `maxSum` reach the updater, so a disjoint sum list
  such as `[5, 20]` prunes as the range 5–20 during solving and is narrowed to
  the exact members only by `validate`.

### ForbiddenCandidates (`class ForbiddenCandidatesComponent extends ConstraintComponent`)

One-shot removal of a digit set from cells (`bundle.claude.js:5555`).

- **Registered as** `ForbiddenCandidates`, "The value of {cellOrCells} cannot be
  any of {candidates}.", params `[["candidates", DigitSet], ["cellOrCells",
  CellOrCellArray]]`.
- **Constructor** `(name, forbiddenMask, cellOrCells)` — a single cell id is
  wrapped to an array; the mask is coerced with `+`.
- **initialize** Yields `FilterCandidatesAtCells` with `allDigitsMask -
  forbiddenCandidates`, then `RemoveComponent`. It never participates in the
  solve loop.
- **Notes** The mask arithmetic is subtraction, not `& ~`. That is only correct
  when every forbidden bit is actually set in `allDigitsMask`; a stray bit
  outside the digit range corrupts the result rather than being ignored.

### FriendDigitTable (`class FriendDigitTable`)

Not a component: the memoized lookup table behind every `PairComponent`
subclass (`bundle.claude.js:3774`).

- **Constructor** `(callback, paramType)` — `callback(paramValue, digit)`
  returns the mask of digits that may sit opposite `digit`. `paramType` is a
  `FriendCacheKeyKind` selecting how the cache key is built (`None` for
  parameterless relations like greater-than, `Number` for a numeric parameter
  like a difference).
- **getFriends(paramValue)** Returns an array indexed by digit, built once per
  (param, minDigit, maxDigit) triple and cached.
- **Notes** The cache is keyed on the digit range too, so the same table object
  is safe across puzzles of different sizes. `friendMasksFromDigitSets` and
  `friendMasksFromPredicate` (just below it) are the two other ways to build the
  same array — `PairComponent` accepts either an array of masks or a
  `(d1, d2) => boolean` predicate, memoizing the predicate by identity.

### GreaterThan / LessThan (`class GreaterThanComponent extends PairComponent`)

Strict inequality between two cells (`bundle.claude.js:5739`). Fields:
`lesserCellId`, `greaterCellId`.

- **Registered as** `["GreaterThan", "LessThan"]` — both names map to this one
  class, so `new LessThanComponent(...)` is the *same* constructor with the same
  argument order, not a reversed one. Message "The digit in {lesserCell} must be
  less than the one in {greaterCell}", params `[["lesserCell", Cell],
  ["greaterCell", Cell]]`.
- **Constructor** `(name, lesserCellId, greaterCellId)`. The friend table is
  parameterless: digit `d` maps to every digit above `d`.
- **update** Inherited.
- **validate** Compares the *smallest candidate* of the lesser cell with the
  *largest candidate* of the greater cell, so it can reject before either cell
  is filled — unlike most pair validates, which wait for values.
- **Notes** Because no digit is its own friend, `unique` is true and the pair
  does yield an exclusion group.

### GreaterThanOrEquals (`class GreaterThanOrEqualsComponent extends PairComponent`)

Non-strict inequality (`bundle.claude.js:5810`).

- **Registered as** `GreaterThanOrEquals`, "The digit in {greaterCell} must be
  greater than or equal to the one in {lesserCell}", params `[["lesserCell",
  Cell], ["greaterCell", Cell]]`.
- **Constructor** `(name, lesserCellId, greaterCellId)`; friend mask for `d` is
  every digit from `d` upward.
- **initialize** Asks `state.getCellsCanHaveRepeats(this.cellIds)`. If the two
  cells can never repeat — they see each other — it replaces itself with the
  strict `GreaterThanComponent`. Only when repeats are possible does it keep the
  weaker relation.
- **validate** Passes while either cell is unfilled, then checks `lesser <=
  greater`.
- **Notes** That `initialize` is the cleanest worked example of strengthening a
  constraint from geometry, and worth copying.

### House (`class HouseComponent extends ConstraintComponent`)

A full house: every digit exactly once (`bundle.claude.js:3096`). Fields:
`houseType` (defaults to `HouseType.ExtraRegion`), `seenIds` (a `Map` from each
cell to the other cells, built in the constructor).

- **Registered as** `House`, "Every digit must appear exactly once in {cells}.",
  params `[["cells", CellArray]]`.
- **Constructor** `(name, cellIds, houseType = HouseType.ExtraRegion)` — the
  registered signature exposes only the first two.
- **update** Not defined. All elimination flows through `getExclusionGroup`,
  which returns every cell, plus the standard hidden/naked single logic steps
  that recognise houses.
- **validate** `validateDuringSolve` is true. Invalid if any digit is missing
  from the union of candidates, or if the cell count is not `digitCount`; the
  message names the missing digits via `naming.getDigitSetDescription`. When
  verbose solving is on it additionally runs `findNakedSubsetsAmongCells` to
  produce a human-readable reason.
- **Notes** The cheapest correct way to declare an extra region from a custom
  constraint: `yield puzzle.replaceComponent(instance, new HouseComponent(name,
  cells))`. Cost per update is effectively zero; the work happens in the solver's
  own logic steps.

### Index (`class IndexComponent extends ConstraintComponent`)

An indexer cell points at a position holding a given digit
(`bundle.claude.js:5877`). Fields: `valueToIndex`, `indexerCellId`,
`indexingCellIds`, `allowRepeats`.

- **Registered as** `Index`, "The value of {indexerCell} must be the (1-based)
  index of an appearance of {valueToIndex} in the sequence of cells {cells}.",
  params `[["valueToIndex", Number], ["indexerCell", Cell], ["cells",
  CellArray]]`.
- **Constructor** `(name, valueToIndex, indexerCellId, indexingCellIds)`.
- **initialize** Records `getCellsCanHaveRepeats(indexingCellIds)`. When repeats
  are impossible and the indexer cell is itself one of the indexed cells at a
  position other than `valueToIndex - 1`, it removes `valueToIndex` from the
  indexer — the self-reference deduction. Then delegates to the base.
- **update** Three steps. `updateIndexerCandidates` builds a mask of positions
  (1-based) whose cell still has `valueToIndex` as a candidate and filters the
  indexer to it. `updateFromIndexer` runs only once the indexer has a value: it
  aborts if that position is past the end of the sequence, otherwise filters the
  indexed cell to exactly `valueToIndex`. Finally, once the indexer has a value,
  it yields `RemoveComponent`.
- **validate** Not overridden.
- **Notes** Indexing is 1-based, so position 0 is never reachable and a
  `minDigit` of 0 in the indexer cell is simply pruned away. `allowRepeats` is
  computed but read only in `initialize`.

### MaxDigitCount (`class MaxDigitCountComponent extends ConstraintComponent`)

A digit appears at most `maxCount` times (`bundle.claude.js:5605`). Fields:
`value`, `maxCount`.

- **Registered as** `MaxDigitCount`, "The digit {value} must appear at most
  {maxCount} times in {cells}.", params `[["value", Number], ["maxCount",
  Number], ["cells", CellArray]]`.
- **Constructor** `(name, digitValue, maxCount, cellIds)`.
- **initialize** A `maxCount` of 0 replaces the component with a
  `ForbiddenCandidatesComponent` for that digit; otherwise it delegates to the
  base.
- **update** One pass counting placed occurrences of `value` and collecting the
  cells that are not one of them, plus a count of cells still carrying the digit
  as a candidate. If the candidate count is already within `maxCount` the
  component retires itself (`RemoveComponent`). If the placed count has reached
  `maxCount`, it removes the digit from every remaining cell.
- **validate** Not overridden.
- **Notes** The two yields are independent, so a single update can both remove
  the digit everywhere and retire. The `placedCount < this.maxCount` guard means
  a state that already over-places the digit routes the surplus cells into
  `remainingCellIds` and then tries to remove the digit from cells that hold it
  as a value — the contradiction surfaces through the change applier, not here.

### MaximumDifference (`class MaximumDifferenceComponent extends PairComponent`)

Two cells differ by at most `maxDifference` (`bundle.claude.js:5990`).

- **Registered as** `MaximumDifference`, "The difference between the values of
  {cell1} and {cell2} must be at most {maxDifference}.", params
  `[["maxDifference", Number], ["cell1", Cell], ["cell2", Cell]]`.
- **Constructor** `(name, maxDifference, firstCellId, secondCellId)`. Friend mask
  for `d` is the clipped window `[d - maxDifference, d + maxDifference]`.
- **validate** Passes while either cell is unfilled, then checks `abs(v1 - v2) <=
  maxDifference`.
- **Notes** Every digit is its own friend, so `unique` is false and no exclusion
  group is contributed. This is the constructor for a "renban-adjacent" or
  whisper-style *upper* bound.

### MinimumDifference (`class MinimumDifferenceComponent extends PairComponent`)

Two cells differ by at least `minDifference` (`bundle.claude.js:6073`).

- **Registered as** `MinimumDifference`, "The difference between the values of
  {cell1} and {cell2} must be at least {minDifference}.", params
  `[["minDifference", Number], ["cell1", Cell], ["cell2", Cell]]`.
- **Constructor** `(name, minDifference, cellIdA, cellIdB)`. Friend mask for `d`
  is everything at or below `d - minDifference` plus everything at or above `d +
  minDifference` — the complement of the window `MaximumDifference` keeps.
- **validate** Passes while either cell is unfilled, then checks `abs(a - b) >=
  minDifference`.
- **Notes** This is the German-whisper primitive. With `minDifference >= 1` no
  digit is its own friend, so `unique` is true and the pair also acts as an
  exclusion.

### MultiProductComponent (`class MultiProductComponent extends ConstraintComponent`)

Unregistered leaf behind `Product` when several products are allowed
(`bundle.claude.js:6601`). Field: `products` (array of numbers).

- **Constructor** `(name, products, cellIdList)`.
- **initialize** Builds the set of digits that could ever participate: 1 always,
  plus every digit that divides at least one product (a product of 0 admits every
  digit). Yields one `FilterCandidatesAtCells`. It does not retire itself.
- **update** Not defined, so after `initialize` the component only validates.
- **validate** `validateDuringSolve` is true, but it returns valid until every
  cell has a value, then multiplies them and checks membership in `products`.
- **Notes** The divisibility filter is the whole of its propagation — it is a
  one-shot domain narrowing, not an ongoing product deduction. `product % digit`
  with `digit` 0 yields `NaN`, which fails the `=== 0` test, so digit 0 is only
  admitted through the `product === 0` branch.
