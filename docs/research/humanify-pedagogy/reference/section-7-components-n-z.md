## Built-in components, N to Z

Every constructor registered by `defineComponent` is injected as a global into
custom component and main code under its **`...Component`** name — `defineComponent`
appends the suffix if the display name lacks it, and the solver spreads
`getComponentConstructorsByName()` into the custom-code globals
(`bundle.claude.js:2756`, `bundle.claude.js:10068`). So the display name `Sum`
is reached as `new SumComponent(name, sums, cells)`; `RatioComponent` is
registered with the suffix already present and is reached the same way. This
section covers the registered names sorting at or after "N", the unregistered
internal components they delegate to, and the two abstract bases
(`PairComponent`, `CompositeComponent`).

Two conventions used throughout. A component's `update` and `initialize` are
generators that `yield` change objects (`{type: N, …}`); the change-type names
below are the app's own enum names, and the factory helpers map to them as:
`filterCandidatesAtCellChange`/`keepOnlyDigitAtCell` → type 1
FilterCandidatesAtCell, `filterCandidatesAtCellsChange` → type 2, 
`removeDigitFromCellChange`/`removeCandidatesFromCellChange` → type 3, 
`removeDigitFromCellsChange`/`removeCandidatesFromCellsChange` → type 4,
`abortSolverChange` → type 5 AbortSolver, `replaceComponentChange` → type 6
ReplaceComponent, and `removeComponentChange()` is `replaceComponentChange([])`
(`bundle.claude.js:1863`). And a built-in `validate` returns
`ValidResult = {valid: true}` (`bundle.claude.js:2675`) or
`{valid: false, message}` — not a boolean.

> Discrepancy: `docs/component-contract.md` says `validate` returns a boolean.
> That is true only for **custom** components: the compiler wraps a custom
> `validate` as `validateWrapper() ? __VALID : {valid: false, message: …}` and
> also force-defines `validateDuringSolve` to `true` on any component that
> supplies one (`bundle.claude.js:10048`). Built-ins return the result object
> directly and opt into `validateDuringSolve` by hand.

> Discrepancy: the contract doc describes `initialize` as an optional one-time
> pass. For custom components the wrapper runs the author's `initialize` and
> **then** `super.initialize`, which itself calls `update`
> (`bundle.claude.js:10030`, base at `bundle.claude.js:2686`). A custom
> `initialize` therefore never skips the first `update`.

### PairComponent (global `PairComponent`, aliased `AsymmetricalPairComponent`)

Abstract two-cell base, `class extends ConstraintComponent` at
`bundle.claude.js:3849`. Almost every two-cell built-in (Difference, Ratio,
GreaterThan(OrEquals), MaximumDifference, MinimumDifference, NegativeDifference,
NegativeRatio, NegativeSumPair, SumPair) subclasses it and supplies only a
friend table plus a `validate`. Fields: `cellId1`, `cellId2`, `friendsFor1` and
`friendsFor2` (arrays indexed by digit, each entry a digit mask of partners
allowed in the other cell), `unique` (true when no digit is its own friend).

#### `constructor(name, filterOrMapping, cellId1, cellId2)`
Builds the two friend tables from either a ready-made array of DigitSets
(index = digit in cell 1, value = allowed digits in cell 2) or a predicate
`(d1, d2) => boolean`.
- **Notes:** the array form is *asymmetrical* — `friendsFor2` is derived by
  inverting it (`friendMasksFromDigitSets`). Subclasses pass a cached table from
  a `FriendDigitTable`, which memoises per parameter value, so constructing
  thousands of Kropki-style pairs costs one table build.

#### `*update({cells})`
Unions the friend masks of every live candidate in each cell and filters the
other cell to that union. Yields two FilterCandidatesAtCell changes.

#### `getExclusionGroup()`
Returns `this.cellIds` when `unique` is set, otherwise `[]`. A non-empty
exclusion group makes the base `initialize` strip the set value from the partner
cell.

#### `getIsDone({cells})`
True once every candidate of cell 1 permits the whole current candidate set of
cell 2 — i.e. the pair can no longer prune.

### CompositeComponent

Abstract, `class CompositeComponent extends ConstraintComponent` at
`bundle.claude.js:4998`. It is the "decide the real component at solve time"
wrapper: `NegativeSum`, `Product`, `Sum`, `SandwichSum`, `SelfCounting`,
`Sequence`, `XSum`, `ConsecutiveDigitsSet`, `CountDigit`, `DiverseGroups`,
`ExactDigitCount` are all composites.

#### `constructor(componentName, cellIds, getComponents)`
Stores `getComponents`, a callback `(solverState) => Component | Component[]`.

#### `*initialize(state)`
Yields exactly one ReplaceComponent change carrying `getComponents(state)`, then
does nothing further — the composite removes itself in its first tick.
- **Notes:** it never defines `update` or `validate`; all real work is in the
  replacement. Because `getComponents` receives the solver state, it can read
  `puzzle.getCellsSeeEachOther(...)` / `getCellsCanHaveRepeats(...)` to pick a
  repeat-aware variant. A composite's own `getIsDone` is inherited and
  irrelevant, since it is gone after tick one.

### NegativeBetween (`NegativeBetweenComponent`)

`bundle.claude.js:6135`. Midpoints must fall outside the closed interval spanned
by the two endpoints.

- **Registered as** `"NegativeBetween"` with params
  `[["endPoints", {type: CellArray, amount: 2}], ["midPoints", CellArray]]`.
- **Constructor** `(name, endPoints, midPoints)` — `cellIds` is endpoints
  followed by midpoints; both arrays kept as fields.
- **update** Two directions. If the endpoints' candidate ranges are already
  disjoint, every digit strictly between them is removed from all midpoints
  (RemoveCandidatesFromCells). Then, for each **solved** midpoint, a value above
  an endpoint's maximum caps the *other* endpoint at that value, and a value
  below an endpoint's minimum floors the other endpoint at it
  (FilterCandidatesAtCell).
- **validate** Not defined; correctness rests entirely on `update`.
- **Notes:** `getIsDone` returns true as soon as both endpoints are filled, so
  the component stops once the interval is pinned. The second loop reads
  `maxEndA`/`minEndA` captured before any of this tick's yields, so it works off
  the pre-change snapshot.

### NegativeDifference (`NegativeDifferenceComponent`)

`bundle.claude.js:6238`, extends PairComponent.

- **Registered as** `"NegativeDifference"`, params `differences: NumberArray`,
  `cell1: Cell`, `cell2: Cell`.
- **Constructor** `(name, differences, cellIdA, cellIdB)` — friends come from
  `negativeDifferenceFriendTable`: start from the full digit set and delete
  `digit ± difference` for each forbidden difference.
- **update** Inherited from PairComponent.
- **validate** Once both cells are filled, fails if `|a − b|` is any listed
  difference. Message names the offending difference.
- **Notes:** `differences` is used verbatim, not `ensureArray`'d — pass an array.
  A difference of 0 makes the pair unique (self is deleted), which turns on the
  exclusion group.

### NegativeIndex (`NegativeIndexComponent`)

`bundle.claude.js:6299`. The indexer cell must not point at an occurrence of one
specific digit.

- **Registered as** `"NegativeIndex"`, params `valueToNotIndex: Number`,
  `indexerCell: Cell`, `cells: CellArray`.
- **Constructor** `(name, valueToNotIndex, indexerCellId, indexingCells)`.
- **update** Not defined — this component is purely event-driven.
- **onValueSet** When the indexer is set to `v`, removes `valueToNotIndex` from
  the `v`-th indexing cell (1-based) and then yields `removeComponentChange()`.
  When any indexing cell is set to `valueToNotIndex`, removes that cell's 1-based
  position from the indexer.
- **Notes:** having no `update` means the base `initialize` still walks already
  filled cells and replays `onValueSet` for each (`bundle.claude.js:2686`). The
  component deletes itself the moment the indexer resolves, so later fills of the
  indexing cells are not checked. There is no `validate`.

### NegativeRatio (`NegativeRatioComponent`)

`bundle.claude.js:6365`, extends PairComponent.

- **Registered as** `"NegativeRatio"`, params `ratios: NumberArray`,
  `cell1: Cell`, `cell2: Cell`.
- **Constructor** `(name, ratios, cellIdA, cellIdB)` — `ensureArray`s `ratios`,
  then builds friends by deleting `digit / ratio` (only when divisible) and
  `digit * ratio` (only when in range) from the full set.
- **validate** Fails when `a*r === b` or `b*r === a` for any listed ratio.
- **Notes:** ratio 1 forbids equality, making the pair unique.

### NegativeSum (`NegativeSumComponent`)

`bundle.claude.js:6472`, a CompositeComponent.

- **Registered as** `"NegativeSum"`, params `sums: NumberArray`,
  `cells: CellArray`.
- **initialize** Replaces itself with `NegativeSumPairComponent` when exactly two
  cells, otherwise `NegativeSumGroupComponent`.

### NegativeSumPairComponent (internal)

`bundle.claude.js:6430`, extends PairComponent. Friends from
`negativeSumFriendTable`: full digit set minus `sum − digit` for each forbidden
sum. `validate` fails when the two values add to a listed sum. This is the only
negative-sum path that actually prunes candidates.

### NegativeSumGroupComponent (internal)

`bundle.claude.js:6404`. Three-or-more-cell fallback. `validateDuringSolve` is
true, but it defines **no `update`** — it only checks, once every cell in the
group is filled, that the total is not a forbidden sum. Expect zero propagation
from a NegativeSum over three or more cells.

### PredefinedCandidates (`PredefinedCandidatesComponent`)

`bundle.claude.js:5369`. One-shot candidate restriction.

- **Registered as** `"PredefinedCandidates"`, params `candidates: DigitSet`,
  `cellOrCells: CellArray`.
- **Constructor** `(componentName, candidateMask, cellOrCells)` — `+candidateMask`
  coerces a DigitSet to its mask via `valueOf`, so a raw number works too;
  `ensureArray` accepts a single cell id.
- **initialize** Yields FilterCandidatesAtCells with the mask, then
  `removeComponentChange()`. It has no `update` and no ongoing cost.
- **Notes:** `SumComponent` uses this as the degenerate one-cell sum.

### Product (`ProductComponent`)

`bundle.claude.js:6574`, a CompositeComponent.

- **Registered as** `"Product"`, params `productOrProducts: NumberOrNumberArray`,
  `cells: CellArray`.
- **initialize** Array → `MultiProductComponent`; positive scalar →
  `SingleProductComponent`; a product of `0` (or negative) →
  `new RequiredDigitsComponent(name, [0], cells)`, i.e. "some cell must be 0",
  which only makes sense on a 0-based digit spec.

### SingleProductComponent (internal)

`bundle.claude.js:6499`. The propagating product component.

- **update** Divides the target by every filled value in turn; a value that does
  not divide the remainder yields AbortSolver immediately. Builds a digit set of
  divisors of the remaining product and filters every unfilled cell to it, while
  accumulating running min/max products from the surviving candidate extremes.
  Aborts if the running minimum exceeds the target, or at the end if the maximum
  falls short.
- **Notes:** the min/max accumulation is order-dependent and interleaved with the
  filter yields, so it reads the pre-change candidate masks. `createFilteredDigitSet`
  is called with each candidate digit, so a 0-based spec divides by zero — the
  `remainingProduct % 0` is `NaN`, and 0 is excluded from the divisor set.

### MultiProductComponent (internal)

`bundle.claude.js:6601`. Used when several products are allowed.

- **initialize** Builds the union of digits dividing any allowed product (plus 1,
  always) and filters all cells to it. One FilterCandidatesAtCells change.
- **validate** `validateDuringSolve` is true; once all cells are filled, checks
  the product is in the list. No `update` — after the initial filter this
  component is a pure checker.

### RatioComponent (`RatioComponent`)

`bundle.claude.js:4009`, extends PairComponent. Sorts under R, included here
because PairComponent is documented in this section.

- **Registered as** `"RatioComponent"` (the only registered name that already
  carries the suffix), params `ratioOrRatios: NumberOrNumberArray`,
  `cell1: Cell`, `cell2: Cell`.
- **Constructor** `ensureArray`s the ratios and takes friends from
  `ratioFriendTable`.
- **validate** Passes if either cell is `r` times the other for any listed ratio;
  otherwise a message naming the `1 : r` ratios.

### RequiredDigits (`RequiredDigitsComponent`)

`bundle.claude.js:3234`. A multiset of digits must be placeable in distinct cells
of the group. Heavily reused: SandwichSum, SelfCounting and Product all build
these internally.

- **Registered as** `"RequiredDigits"`, params `values: NumberArray`,
  `cells: CellArray`.
- **Constructor** `(name, values, cellIds)` — also builds `repeatCounts`, a map
  from digit to (occurrences − 1), keeping only digits that actually repeat. It
  is used solely to phrase the failure message ("enough 3s").
- **initialize** An empty `values` removes the component; otherwise defers to the
  base.
- **update** Subtracts each filled value from a working copy of `values` (one
  occurrence per fill) and collects unfilled cells. **Only when the number of
  unfilled cells exactly equals the number of unplaced values** does it filter
  those cells to the mask of remaining values. Otherwise it yields nothing.
- **validate** `validateDuringSolve` is true. Greedily walks the cells, striking
  each required value off as soon as some cell can still hold it; fails naming
  whatever could not be placed.
- **Notes:** the greedy matching in `validate` is not a real bipartite matching,
  so it can pass a state where no full assignment exists. It is a soundness-safe
  direction (too permissive, never too strict). The `update` gate means a
  RequiredDigits over a large group prunes nothing until the group is nearly
  full.

### RequiredGroups (`RequiredGroupsComponent`)

`bundle.claude.js:5416`. Each digit group must be represented at least once.

- **Registered as** `"RequiredGroups"`, params `groups: DigitSetArray`,
  `cells: CellArray`. Its own description warns it only works when the groups do
  not overlap.
- **Constructor** `(componentName, groupMasks, cellIds)` — each group is coerced
  with `+` to a mask.
- **update** For each group, scans for cells whose candidates intersect it. Zero
  such cells yields AbortSolver; exactly one yields FilterCandidatesAtCell
  restricting that cell to the group. Two or more: nothing.
- **Notes:** this is a hidden-single over groups, not a counting argument. It
  never notices that three groups need three distinct cells.

### SameDigit (`SameDigitComponent`)

`bundle.claude.js:6658`. Clone cells.

- **Registered as** `"SameDigit"`, params `cells: CellArray`.
- **initialize** First calls `validateConfiguration`: if any listed cell is seen
  by `cellIds[0]`, yields AbortSolver with "one or more cloned cells are seeing
  each other" and stops. Then, if some cell is already solved, replays
  `onValueSet` for it; otherwise runs `update`.
- **onValueSet** Yields a SetValue change for every other cell in the group.
- **update** Intersects the candidate masks of all cells and yields one
  FilterCandidatesAtCells with the intersection.
- **validate** Fails naming the first cell whose value differs from the first
  filled cell's value.
- **Notes:** the seen-check only tests against `cellIds[0]`, so two clones that
  see each other but not the first cell slip through. SetValue (type 0) is one of
  the few places a built-in writes a value rather than pruning.

### SameGroup (`SameGroupComponent`)

`bundle.claude.js:6749`. Every cell takes a digit from one and the same group.

- **Registered as** `"SameGroup"`, params `groups: DigitSetArray`,
  `cells: CellArray`; description warns that overlapping groups misbehave.
- **update** Drops any group that some cell cannot reach at all, then filters
  every cell to the union of the surviving groups. One FilterCandidatesAtCells.
- **Notes:** no `validate`. The mutation of `remainingGroups` happens while
  iterating the same `Set`, which JavaScript permits for deletes.

### SameSum (`SameSumComponent`)

`bundle.claude.js:7069`. The richest component in this range: several named
groups, possibly weighted or digit-string valued, must share one sum.

- **Registered as** `"SameSum"`, single param `groups: ObjectArray` with fields
  `name: String`, `cells: CellArray`, `weights?: Map<CellId, number>`,
  `asNumber?: Boolean`.
- **Constructor** `cellIds` is the de-duplicated union of every group's cells;
  each group is passed through `normalizeSameSumGroup` (`bundle.claude.js:7286`),
  which classifies it as `"weighted"` (explicit weights, or duplicate cells
  turned into occurrence counts), `"asNumber"`, or `"list"`.
- **initialize** For every group carrying `allowRepeats`, recomputes it as
  `!puzzle.getCellsSeeEachOther(group.cells)`, then defers to the base.
- **update** Computes each group's `{minimum, maximum}` reachable value; a
  `null` from the no-repeat sums helper means the group cannot be filled at all
  and yields AbortSolver. Takes the max of the minima and the min of the maxima.
  Equal → replace every unfinished group with a concrete sum component (see
  below). Max-of-minima below min-of-maxima → narrow each group into that
  window. Above → AbortSolver "it’s not possible to satisfy equal sums".
- **replaceWithSumConstraintComponents(puzzle, sum)** For each not-yet-complete
  group: `asNumber` groups get their digits pinned place by place via
  `setNumberGroup`; single-cell groups get `keepOnlyDigitAtCell(sum / weight)`,
  aborting if the weight does not divide; weighted groups become a
  `WeightedSumComponent`, plain ones a `SumComponent`. All collected into one
  ReplaceComponent change.
- **restrictGroup** `asNumber` groups get a per-place digit filter (only the most
  significant place is really constrained); weighted groups go through
  `WeightedSumCandidateUpdater`; list groups through `SumCandidateUpdater`.
- **validate** `validateDuringSolve` is true. Same min/max sweep; fails if the
  windows no longer overlap, or if a group has no values at all.
- **Notes:** `asNumber` is base-10 with the **least** significant digit at index
  0 (`getExtremeValuesForNumberGroup` uses `10 ** digitIndex`). A group listing
  the same cell twice is silently converted to weight 2 and gains
  `allowRepeats: true`, which the `initialize` pass then does **not** recompute
  for `"weighted"` groups — it only rewrites `allowRepeats` where the key exists,
  and it does exist on weighted groups, so a weighted group's repeats flag is
  overwritten by the seen-check too. Cost is dominated by the sums helper: with
  no repeats it enumerates combinations.

### SandwichSum (`SandwichSumComponent`)

`bundle.claude.js:7525`, a CompositeComponent.

- **Registered as** `"SandwichSum"`, params `sum: Number`,
  `sandwichDigits: {type: NumberArray, amount: 2}`, `cells: CellArray`;
  description notes it currently requires all cells distinct.
- **initialize** Replaces itself with a pair: a `RequiredDigitsComponent` forcing
  both crust digits onto the line, and a `SandwichSumInnerComponent`.

### SandwichSumInnerComponent (internal)

`bundle.claude.js:7363`. Fields: `combinations` (every subset of the non-crust
digits summing to `sum`, enumerated once in the constructor by
`iterateSubsetsSummingTo`), `minDistance`/`maxDistance` (shortest and longest
crust-to-crust gap, subset length + 1), `sandwichDigitsMask`.

- **initialize** `minDistance === Infinity` (no subset sums to the target) yields
  AbortSolver. If the minimum gap exceeds half the line, the cells that could
  never be a crust — `cellIds.slice(len − minDistance, minDistance)` — lose both
  crust digits. Then runs `update`.
- **update** Three passes: for each crust digit, if some cell is pinned to it,
  every cell at a distance outside `[minDistance, maxDistance]` loses the *other*
  crust digit; then, if exactly two cells can still hold crust digits,
  replaces the whole component with a plain `SumComponent` over the cells
  strictly between them.
- **validate** Walks the line, sums the cells between the first and second crust
  value, and fails only when that stretch is fully filled and mis-sums.
- **Notes:** `sum === 0` short-circuits the combination enumeration and sets
  `maxDistance` to 2 only on a 0-based spec. The constructor's enumeration is
  exponential in the digit count for large targets; it happens once per
  component, not per tick.

### SelfCounting (`SelfCountingComponent`)

`bundle.claude.js:7803`, a CompositeComponent.

- **Registered as** `"SelfCounting"`, params `cells: CellArray`.
- **initialize** Emits one `MaxDigitCountComponent(name, d, d, cells)` per digit
  — digit `d` may appear at most `d` times — plus **one of two** engines:
  `SelfCountingSumComponent` when `verboseSolvingEnabled`, otherwise
  `SelfCountingStateComponent`.
- **Notes:** the two engines behave differently, so a SelfCounting puzzle can
  solve differently under verbose solving than under a normal solve. Worth
  knowing before reading a step trace.

### SelfCountingStateComponent (internal)

`bundle.claude.js:7553`. The non-verbose engine. Immutable-state style: instead
of mutating, it builds a replacement of itself via `transitionTo` and yields a
ReplaceComponent change. Fields: `state` (`{required, forbidden, housed,
combinations}`) and `misc` (house bookkeeping, built once).

- **initialize** Reads `puzzle.getHouseComponents()`, splits each house into its
  circled (in `cellIds`) and uncircled cells, pre-builds a `RequiredDigitsComponent`
  per digit, and seeds `combinations` with every multiset of positive digits of
  the right size (`iterateCombinationsForSum`), capped by the largest circled
  count in any house. Then runs `houseAnalysis` and `update`.
- **update** Derives `required` (digits pinned in some cell, plus digits in every
  surviving combination) and `forbidden` (digits no cell can take, plus digits in
  no combination). If neither changed, falls through to `houseAnalysis`.
  Otherwise removes the forbidden digits from all cells and yields a
  ReplaceComponent carrying a `RequiredDigitsComponent` per newly required digit
  and a successor state component.
- **houseAnalysis** Per digit and per house type (row, column, region): if fewer
  than `d` houses can hold `d` among their circled cells, `d` is impossible
  everywhere; if exactly `d` houses have no uncircled cell able to take `d`, then
  those houses must supply it from their circles — a RequiredDigits per house —
  and every *other* house's circles lose `d`.
- **Notes:** `transitionTo` filters `combinations` to those disjoint from
  forbidden and superset of required, so the state monotonically shrinks. There
  is no `validate`; the MaxDigitCount siblings and RequiredDigits children do the
  checking.

### SelfCountingSumComponent (internal)

`bundle.claude.js:3345`. The verbose-solving engine. Fields: `helperComponents`
(the DifferentDigits/House components overlapping the cells, discovered lazily in
`initialize` via `sudoku.getConstraintComponents()`), `excludedDigits` and
`addedComponentsFor` (masks), `possibleSums`/`possibleDigits` (recomputed each
tick).

- **initialize** An empty cell list removes the component. Otherwise finds the
  helper components and defers to the base.
- **update** Recomputes the possible digit multisets from the union of live
  candidates, bounded by the largest overlap with any helper house. No
  combination left → AbortSolver. One combination left → emit a RequiredDigits
  per newly determined digit, plus a successor carrying the widened
  `addedComponentsFor` mask. Otherwise: filter all cells to `possibleDigits`,
  then per digit `v` seen in a filled cell — if `v` now occupies exactly `v`
  cells, strip `v` from the rest and shrink the component onto the remaining
  cells; else register a RequiredDigits for `v` once. Finally aborts if any digit
  present in a cell has fewer than `d` cells that could hold it.
- **Notes:** `iterateCombinationsForSum(unionCandidates, cellCount, maxRepeats,
  maxDigit)` is re-enumerated on **every** tick — this is the expensive engine,
  which is why it is gated behind verbose solving.

### Sequence (`SequenceComponent`)

`bundle.claude.js:7853`, a CompositeComponent.

- **Registered as** `"Sequence"`, params `cells: CellArray`.
- **initialize** Scans for any two listed cells that see each other; if found,
  the minimum step is 1 (a flat sequence is impossible), else 0. Replaces itself
  with `SequenceStepComponent(name, cells, minimumDifference)`.

### SequenceStepComponent (internal)

`bundle.claude.js:7877`. Arithmetic progression along the cell order.

- **update** Returns immediately for lines of two or fewer cells — a
  two-cell Sequence prunes nothing. Otherwise computes, for the forward and the
  reversed reading, the set of digits each position can take under *some* valid
  common step, and filters each cell to the union of the two direction masks.
- **getValidValuesForDirection(puzzle, reversed)** Brute force: for each start
  digit and each step from `minimumDifference` up to
  `floor(maxSpan / (len − 1))`, walks the whole line and, if every position's
  candidate survives, ORs the realised digits into the per-position masks.
- **Notes:** cost is `O(digits × steps × length)` per direction per tick, cheap
  for real lines. Negative steps are covered by the reversed pass, not by
  negative step values. There is no `validate`.

### Skyscraper (`SkyscraperComponent`)

`bundle.claude.js:7950`. Count of visible increasing maxima along the cell order.

- **Registered as** `"Skyscraper"`, params `amount: Number`, `cells: CellArray`.
- **initialize** Special case: `amount === 1` on a 1-based spec replaces the
  component with one `GreaterThanOrEqualsComponent(name, cellId, cellIds[0])` per
  later cell — the first cell dominates the line. Otherwise defers to the base.
- **update** Sweeps the line front to back with a sliding ceiling starting at
  `maxDigit − amount + 1`, filtering each cell to digits up to the ceiling, and
  raising the ceiling by one each time the cell just processed can still be the
  next visible skyscraper.
- **validate** `validateDuringSolve` is true. Counts visible skyscrapers, skipping
  cells that provably cannot exceed the running maximum. On an incomplete line it
  fails only when the count already exceeds `amount`; on a complete line it
  requires equality.
- **Notes:** the ceiling loop rebuilds `allowedMask` from scratch each iteration
  and yields a filter for *every* cell, including cells it does not actually
  constrain, so it is chattier than it needs to be.

### Sum (`SumComponent`)

`bundle.claude.js:6982`, a CompositeComponent — the dispatcher every other sum
constraint funnels through.

- **Registered as** `"Sum"`, params `sumOrSums: NumberOrNumberArray`,
  `cells: CellArray`.
- **initialize** In order: duplicated cells → `WeightedSumComponent` with each
  cell's occurrence count as its weight; one cell → `PredefinedCandidatesComponent`
  holding the allowed totals; `allowRepeats = !puzzle.getCellsSeeEachOther(cells)`;
  two cells → `SumPairComponent`; a contiguous run of allowed sums
  (`describeSumsAsContiguousRange`, `bundle.claude.js:7290`) →
  `SumRangeComponent`; otherwise `ExactSumComponent`.
- **Notes:** a repeated cell counts N times, matching the registered description.
  Note the one-cell branch tests `this.cellIds.length`, which is the
  **de-duplicated-free** original array, while the duplicate branch has already
  returned.

### SumPairComponent (internal)

`bundle.claude.js:6861`, extends PairComponent. Constructor takes
`(name, sums, allowRepeats, cellIdA, cellIdB)` and picks between two friend
tables: the repeat table allows `sum − digit === digit`, the distinct table
excludes it. `validate` fails when the two values are filled and their total is
not in `sums`.

### ExactSumComponent (internal)

`bundle.claude.js:4251`. Used when the allowed totals are not contiguous.
`validateDuringSolve` is true. `update` delegates the whole job to
`SumCandidateUpdater` over `[min(sums), max(sums)]`; `validate` checks the exact
total against the list once every cell is filled.
- **Notes:** because `update` only enforces the *range*, gaps in `sums` are
  caught by `validate` alone, not by propagation.

### SumRangeComponent (internal)

`bundle.claude.js:4292`. Used when the allowed totals form a contiguous run.
`update` runs `SumCandidateUpdater` with a `resolvedFlag`; if the updater found
exactly one surviving digit combination, the component removes itself after
applying it. `validate` (note: no `validateDuringSolve` override, so it runs only
at a leaf) compares the sums helper's reachable min/max against the window.

### SumCandidateUpdater (internal helper, not a component)

`bundle.claude.js:4108`. Shared by ExactSum, SumRange and SameSum's list groups.
`updateCandidates(allowRepeats, resolvedFlag)` picks one of two strategies.

- **Without repeats:** subtracts filled values from the window, enumerates
  `helpers.sums.getCombinationsForSumWithoutRepeat(target, unsolvedCount)` for
  every target in the remaining window, keeps only combinations whose digits are
  all still available, and filters the unsolved cells to the union — or, when a
  single combination survives, to exactly that combination and sets
  `resolvedFlag.value`.
- **With repeats:** per-cell bounds only. For each unsolved cell, removes digits
  that cannot fit between the min and max achievable by the *other* unsolved
  cells.
- **Notes:** the combination enumeration is the expensive path and scales with
  the window width — a wide `SumRange` enumerates once per target sum in the
  range. With all cells solved, both paths yield AbortSolver if the total misses
  the window.

### WeightedSum (`WeightedSumComponent`)

`bundle.claude.js:6905`. Cells with per-cell multipliers summing to a target.

- **Registered as** `"WeightedSum"`, params `sumOrSums: NumberOrNumberArray`,
  `cellWeightMapping: Map<CellId, number>`; the description warns that only
  positive whole-number weights are supported.
- **Constructor** `(name, sumOrSums, cellWeightMapping)` — `cellIds` comes from
  the map's key order; `minSum`/`maxSum` are the extremes of the allowed totals.
- **update** Delegates to `WeightedSumCandidateUpdater` over `[minSum, maxSum]`.
- **validate** `validateDuringSolve` is true; once every cell is filled, checks
  the weighted total is in `sums`.
- **Notes:** as with ExactSum, only the range propagates; gaps between allowed
  sums are caught at validate time. Negative weights break the bound arithmetic.

### WeightedSumCandidateUpdater (internal helper, not a component)

`bundle.claude.js:6781`. The weighted twin of `SumCandidateUpdater`'s
with-repeats path, and its only strategy: subtract filled contributions from the
window, then for each open cell remove digits where
`minOtherSum + digit*weight > remainingMax` or
`maxOtherSum + digit*weight < remainingMin`. No combination enumeration, so it
is cheap and correspondingly weak — it never notices that two cells cannot both
take their extremes.

### WeakLink (`WeakLinkComponent`)

`bundle.claude.js:8055`. A single forbidden value pair.

- **Registered as** `"WeakLink"`, params `cell1: Cell`, `value1: Number`,
  `cell2: Cell`, `value2: Number`.
- **update** Not defined; event-driven only.
- **onValueSet** If the triggering cell took its linked value, removes the
  partner's linked value; either way yields `removeComponentChange()`.
- **validate** Fails when both cells hold their linked values.
- **Notes:** the component deletes itself on the **first** value set in either
  cell, even a value unrelated to the link — correct, since after that the link
  can only be violated by the other cell, which `validate` still catches, but it
  means no further pruning.

### WeakLinks (`WeakLinksComponent`)

`bundle.claude.js:8111`. Group form of the same idea.

- **Registered as** `"WeakLinks"`, params `cells1: CellOrCellArray`,
  `value1: DigitSet`, `cells2: CellOrCellArray`, `value2: DigitSet`.
- **Constructor** `ensureArray`s both cell arguments and coerces both DigitSets
  to masks with `+`.
- **update** If any cell of group 1 has its candidates entirely inside `values1`,
  removes `values2` from every cell of group 2 and removes the component
  (symmetrically for group 2).
- **Notes:** the trigger is "candidates ⊆ values", not "cell is filled", so it
  fires earlier than WeakLink's `onValueSet`. There is no `validate`, and the
  component removes itself after firing once.

### XSum (`XSumComponent`)

`bundle.claude.js:8321`, a CompositeComponent.

- **Registered as** `"XSum"`, params `sum: Number`, `xCell: Cell`,
  `cells: CellArray`.
- **initialize** Chooses `XSumFullLineComponent` only when all of: 1-based digits,
  the X cell is the line's first cell, the line is a full `digitCount` long, and
  `!puzzle.getCellsCanHaveRepeats(cells)`. Otherwise `XSumPrefixComponent`.

### XSumFullLineComponent (internal)

`bundle.claude.js:8161`. The strong path, using the precomputed
`helpers.xSums.getXSumPossibilities(sum)` table. `cellIds` is truncated to the
largest feasible X.

- **initialize** Filters the X cell to the set of feasible X values, then runs
  `update`.
- **update** If X is pinned, replaces the component with a plain `SumComponent`
  over the first X cells (or removes itself when `sum <= x`). Otherwise filters
  the cells strictly inside every feasible prefix to the union of all feasible
  combinations, and removes from the cells beyond the largest feasible prefix the
  digits that every possibility forces inside it.
- **validate** Reports invalid when no possibility exists for the sum at all;
  otherwise sums the first X cells once X and the prefix are filled.

### XSumPrefixComponent (internal)

`bundle.claude.js:8251`. The general fallback, with a separate X cell.

- **initialize** `sum === 0` pins the X cell to 0 and removes the component.
  Otherwise filters X to `1..cellsToSum.length` and defers to the base.
- **update** Only acts once X is a single candidate, then replaces itself with a
  `SumComponent` over the first X cells.
- **validate** `validateDuringSolve` is true; uses the smallest surviving X and
  fails when the minimum achievable prefix sum already exceeds the target. The
  failure result carries a `cells` field naming the prefix.
- **Notes:** until X resolves, this component prunes nothing at all — the whole
  constraint is carried by a one-sided validate bound. That asymmetry (it never
  checks the prefix sums to *at most* the target) is deliberate, since a longer
  prefix is still possible.
