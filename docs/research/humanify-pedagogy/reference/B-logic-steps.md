## Logic steps: the app's own deductions

A logic step is a small object over one `SolverState` with two members: a
generator `execute()` that yields *deduction requests*
(`{ changes, description }`, the same change objects a component's `update`
yields) and `clone(state)` that rebinds it to a cloned state for a search node.
`Solver.step` (`bundle.claude.js:8398`) walks `this.logicSteps` in order, runs
each yielded request through a `ChangeApplier`, and returns after the first
request that actually changes something — so step order is priority order.
Which steps exist is decided once at solver setup (11530): a `"sudoku"` puzzle
gets `StandardLogicStepsGenerator`, a `"custom"` puzzle gets
`CustomLogicStepsGenerator`, which is the standard generator with the step-type
list filtered down to the nine types that make sense without built-in sudoku
geometry (no fish, X-wing, Y-wing, skyscraper, unorthodox fish). A custom
constraint never calls any of this: these steps run *beside* your component,
and they reach your constraint only through `ComponentSubscription` filters
that recognise built-in component classes. Naked and hidden singles are always
on and are not gated by a step type.

Cell ids are 0-based (`x + y * width`); a digit mask has bit `d` set for digit
`d`. "generator" means the member yields.

### Top-level functions (deductions and results)

#### `countMatchingValues(values, target, { comparator })`
Counts entries of `values` equal to `target`, by `===` unless a `comparator`
is passed. `bundle.claude.js:1660`. **[read]**

#### `describeCellsWithNoCandidates(cells)`
Builds the failure string `"<cells description> has/have no candidates"`, the
verb agreeing with `cells.length`. `bundle.claude.js:1980`. **[read]**

#### `createFailedResultForCell(cell)`
Returns `{ type: "failed", cells: [cell] }` with no message.
`bundle.claude.js:1985`. **[read]**

#### `createFailedResultForCells(cells, message)`
Returns `{ type: "failed", cells: cells.slice(), message }`; the copy means the
caller may keep mutating its own array. `bundle.claude.js:1988`. **[read]**

#### `getFailureMessage(failedResult)`
Returns the result's `message`, falling back to
`describeCellsWithNoCandidates(failedResult.cells)`. `bundle.claude.js:1993`.
**[read]**

#### `mergeDeductionResults(currentResult, nextResult)`
Folds one deduction result into an accumulator: `unchanged` loses to anything,
a `failed` beats a `changed`, and two `failed`s merge by appending the new
result's cells to the current result's `cells` array (deduplicated).
- **Mutates:** `currentResult.cells` in the failed-plus-failed case.
- `bundle.claude.js:1998`. **[read]**

#### `getNakedSingleDigit(cell)`
Returns the single digit left in `cell.candidates`, or `undefined` when the
mask holds zero or more than one bit (`31 - Math.clz32(mask)` is the bit
index). `bundle.claude.js:2240`. **[read]**

#### `describeVerboseDeductions(verboseResults)`
Renders a list of verbose apply-results as English ("r1c1 → 4", "3 to be
removed from r1c2, r1c3"), one clause per change with a non-empty affected-cell
list, joined with a conjunction. Changes other than set-value, filter and
remove produce no clause. `bundle.claude.js:2264`. **[read]**

#### `unionMaskOverMappedSets(candidateSets, mapCell)`
ORs together, over every candidate set, the digit mask built from
`mapCell(cell)` for each of that set's cells — the fish trick of turning cell
coordinates into a mask of occupied lines.
- **Returns:** a mask whose bit `n` means some set touched line `n`.
- `bundle.claude.js:2370`. **[read]**

#### `*yieldRequiredDigitDeductions(solverState, digitMask, houseName, cellIds)`
The shared "these digits must appear among these cells" engine: records the
requirement via `solverState.markDigitsAsRequiredForCells` and returns
immediately if that call reports nothing new, then per required digit yields a
`HiddenSingle` set-value when exactly one of `cellIds` still has the digit, and
finally yields one `PointingRequiredDigits` deduction removing each required
digit from every cell seen by all its possible carriers.
- **Returns:** generator of deduction requests; the final one is yielded even
  when its `changes` array is empty.
- **Cost:** one pass per digit in the mask over `cellIds`, plus a
  `getCellsSeenByCells` per digit.
- `bundle.claude.js:2834`. Used by the consecutive-sets, kropki and simple-sums
  steps. **[read]**

### `AlmostXWingLogicStep`

`bundle.claude.js:1903`. Single-digit almost-fish patterns on rows and columns:
skyscrapers, finned and sashimi X-wings. Constructed with the solver state
only.

#### `*execute()`
For every digit, collects the candidate sets from
`sudoku.getSetsForCandidate(digit)` and runs `handleHouse` once for rows and
once for columns.
- **Cost:** digits × 2 house types; the real work is in `handleHouse`.
**[read]**

#### `*handleHouse(digit, houseType, candidateSets)`
Takes each two-cell set as a base, pairs it with every other set as cover
(skipping the ordered duplicate when both are pairs), and for a base cell that
shares a cross-line with some cover cell removes `digit` from every cell seen
by the other base cell together with the remaining cover cells.
- **Notes:** labels the pattern `"finned"` when the other base cell is also
  covered, `"sashimi"` when more than one cover cell remains, else
  `"skyscraper"`; the label is descriptive only.
- **Cost:** O(pairs × sets × 2) per digit, each iteration doing a
  `getCellsSeenByCells`. **[read]**

#### `clone(sudoku)`
New `AlmostXWingLogicStep` over `sudoku`; nothing is carried over. **[read]**

### `NakedSingleLogicStep`

`bundle.claude.js:2244`. Always in the step list, first. Holds only the state.

#### `*execute()`
Yields a `SetValue` for every unsolved cell whose candidate mask has exactly
one bit, described as `NakedSingle` with the cell id.
- **Cost:** one pass over all cells. **[read]**

#### `clone(sudoku)`
New instance over `sudoku`. **[read]**

### `ByContradictionLogicStep`

`bundle.claude.js:2297`. Brute-force last resort: try a candidate, propagate,
and if that explodes, eliminate it. Fields: `sudoku`, `useRandomness` (passed
to the branch-cell ranking, default `true`). Last in the step list because it
is by far the most expensive.

#### `*execute()`
Walks cells in `BranchCellRanking` order and, for each candidate digit, yields a
`RemoveDigit` change described as `ByContradiction` when `tryCandidate` reports
a contradiction, carrying the reason string as a description parameter.
- **Cost:** a full state clone plus a constraint fixpoint per candidate tried —
  cells × candidates clones in the worst case. **[read]**

#### `tryCandidate(cellId, digit)`
Clones the state, sets `digit` at `cellId`, and returns a reason string when
that fails outright, when `updateConstraintsAndValidate` fails, or when the
naked-single cascade below fails; returns `null` when the placement survives.
- **Notes:** the reason is human-readable prose only while verbose solving is
  on; otherwise it is the sentinel string `"fail"`, which is still truthy.
**[read]**

#### `optimizedNakedSingleCheck(sudoku)`
Applies every naked single the cloned state offers, revalidating after each,
and returns the `"fail"` sentinel on the first failure, else `null`. **[read]**

#### `verboseNakedSingleCheck(sudoku)`
Same cascade through a `VerboseChangeApplier`, accumulating the applied changes
so a failure returns `"forces <deductions>, causing a contradiction: <reason>"`.
- **Notes:** chosen over the optimized variant whenever verbose solving is on,
  and it is the slower path. **[read]**

#### `clone(sudoku)`
New instance over `sudoku`, keeping `useRandomness`. **[read]**

### `FishLogicStep`

`bundle.claude.js:2378`. Classic fish of a fixed size: X-wing at size 2,
swordfish at 3, and so on. Fields: `groupSize`, `sudoku`.

#### `*execute()`
Per digit, takes the row candidate sets no larger than `groupSize`, and for
each combination of `groupSize` of them whose union of columns is exactly
`groupSize` wide, removes the digit from those columns in every *other* row;
then the mirrored pass with columns as base and rows as cover.
- **Returns:** generator of `Fishes` deductions, parameterised by house type and
  the base lines' trailing name characters.
- **Cost:** two `iterateCombinationsOfSize(sets, groupSize)` enumerations per
  digit, so it grows sharply with `groupSize`. **[read]**

#### `clone(sudoku)`
New `FishLogicStep` with the same `groupSize`. **[read]**

### `HiddenSetLogicStep`

`bundle.claude.js:2495`. Hidden pairs, triples and so on inside one house.
Fields: `groupSize`, `sudoku`.

#### `*execute()`
Delegates to `executeForRegion` for every house component the state knows.
**[read]**

#### `*executeForRegion(house)`
Over the house's unsolved cells (skipped entirely when there are at most
`groupSize` of them), finds each combination whose candidates minus the
candidates of all other unsolved cells still holds exactly `groupSize` digits,
then yields two changes: filter the combination's cells down to that hidden
mask, and remove the hidden mask from every cell seen by the whole combination.
- **Cost:** `C(unsolved, groupSize)` per house, each with two mask passes.
**[read]**

#### `clone(sudoku)`
New instance with the same `groupSize`. **[read]**

### `HiddenSingleLogicStep`

`bundle.claude.js:2544`. Always in the step list, second. Holds only the state.

#### `*execute()`
For each digit, yields a `SetValue` for every candidate set from
`getSetsForCandidate(digit)` that has exactly one cell left, described by the
set's name.
- **Notes:** because it reads candidate *sets* rather than houses, it also
  fires on the required-digit sets a constraint registered. **[read]**

#### `clone(sudoku)`
New instance over `sudoku`. **[read]**

### `NakedSetLogicStep`

`bundle.claude.js:2568`. Naked pairs, triples and so on inside one house.
Fields: `groupSize`, `sudoku`.

#### `*execute()`
Runs `check` on every house component. **[read]**

#### `clone(newSudoku)`
New instance with the same `groupSize`. **[read]**

#### `*check(house)`
For each combination of `groupSize` unsolved cells in the house whose union of
candidates is exactly `groupSize` digits wide, removes that mask from every cell
seen by the whole combination.
- **Notes:** unlike the hidden-set step it does not prefilter by candidate
  count, so it enumerates `C(unsolved, groupSize)` combinations per house
  regardless. **[read]**

### `PointingSetLogicStep`

`bundle.claude.js:2604`. The cheapest cross-house step. Holds only the state.

#### `*execute()`
For each digit and each candidate set of that digit, removes the digit from
every cell seen by all of the set's cells, when that seen-set is non-empty.
- **Notes:** described as `PointingSet` for a real house and
  `PointingRequiredDigits` when the set has no `houseType`, i.e. came from a
  constraint's required digits. **[read]**

#### `clone(newSudoku)`
New instance over `newSudoku`. **[read]**

### `UnorthodoxNakedSetLogicStep`

`bundle.claude.js:2634`. A naked set whose cells need not share a house — any
mutually-seeing group of cells works, which is what makes it useful on custom
puzzles. Fields: `groupSize`, `sudoku`.

#### `*execute()`
Prefilters to unsolved cells with at most `groupSize` candidates, then for each
combination of `groupSize` of them whose union is exactly `groupSize` digits
*and* which all see each other (`getCellsSeeEachOther`), removes that mask from
every cell they jointly see.
- **Cost:** `C(prefiltered cells, groupSize)` over the whole grid, not per
  house — the most expensive of the set steps, though the candidate-count
  prefilter usually keeps the pool small. **[read]**

#### `clone(newSudoku)`
New instance with the same `groupSize`. **[read]**

### `ConsecutiveSetsLogicStep` (additional members)

Constructed with the state and an optional previous step; its `cache` is a
`ComponentSubscription` over `ConsecutiveDigitsComponent`s whose cells all see
each other, cloned from the previous step when there is one.

#### `*execute()` (2934)
For each subscribed consecutive component, runs `getValidSubsetDeduction` then
`getPointingSubsetDeduction`. **[read]**

#### `clone(newState)` (2939)
New step over `newState` passing `this` as the previous step, so the component
subscription and its state are cloned rather than rebuilt. **[read]**

#### `*getValidSubsetDeduction(component)` (2942)
Unions the component's cells' candidates, splits that mask into maximal runs of
consecutive digits, and removes from the component's cells every digit in a run
shorter than the component's cell count — a run too short to host the whole set.
- **Notes:** the deduction is yielded unconditionally, even when no digit is
  removable, so the applier reports `unchanged` in that case. **[read]**

#### `*getPointingSubsetDeduction(component)` (2975)
When the union of candidates spans fewer than twice the cell count, every digit
in the overlap between the lowest and highest possible windows must appear, so
it hands that required mask to `yieldRequiredDigitDeductions`.
- **Notes:** the window is `highest - n + 1 .. lowest + n - 1`; an empty
  intersection yields nothing. **[read]**

### `CountingCirclesCacheState`

`bundle.claude.js:3508`. The per-search-node payload for the counting-circles
subscription: `info`, a `Map` from component to
`{ houses: { row|column|region → Map<house, cellIds> }, availableDigits }`.

#### `clone()`
Deep-clones `info` so a branch's digit eliminations do not leak to siblings.
**[read]**

### `CountingCirclesLogicStep`

`bundle.claude.js:3516`. Handles self-counting circles: a digit `d` in a circle
means exactly `d` circles hold `d`. Fields: `rowMapping`, `columnMapping`,
`regionMapping` (cell id → house component), `legibleHouses` (rows, columns and
regions), and `cache`, a `ComponentSubscription` over
`SelfCountingSumComponent`. A clone copies the mappings by reference and clones
only the cache.

#### `*execute()`
Per subscribed component, tallies how often each digit is already placed in its
circles, collects the still-empty circles, then runs the three deductions in
order: max-count, house-exclusion, digit-limitations. **[read]**

#### `*getMaxCountDeduction(component, digitCounts, emptyCells)`
Finds the house type whose houses cover all empty circles in the fewest
distinct houses, then removes every digit `d` for which
`d - (already placed count of d) > that house count`: more copies of `d` are
still needed than the houses could supply.
- **Notes:** yields nothing when the empty circles are not all mapped by at
  least one house type. **[read]**

#### `*getDigitLimitations(component)`
For each digit still in the cached `availableDigits` and each primary house
type, counts the houses that still have a circle able to take that digit, and
when that count is below the digit, deletes the digit from `availableDigits`
and removes it from every circle.
- **Mutates:** the cached entry's `availableDigits`, which is why the cache
  state deep-clones. **[read]**

#### `*getHouseExclusionDeduction(component)`
Marks a house as "must hold digit `d`" when the union of its circles' candidates
is exactly as large as its circle count and contains `d`; then per digit, if
more than `d` houses of one type are so marked it yields an `AbortSolver`, and
if exactly `d` are, it removes `d` from the circles of every *other* house of
that type.
- **Cost:** a pass over all legible houses plus one grouping per digit.
**[read]**

#### `clone(newState)`
New step over `newState` with `this` as source: mappings shared, cache cloned.
**[read]**

### `KropkiDotsLogicStep`

`bundle.claude.js:4055`. Works the two-cell white-dot / black-dot components.
Field `components`, the set of `DifferenceComponent`s and `RatioComponent`s
with exactly one difference or ratio; it is seeded from the state (or from the
constructor's `knownComponents`) and kept current by a component listener that
adds on `"add"` and deletes on anything else.

#### `*execute()`
Runs `executeForComponent` over every tracked kropki component. **[read]**

#### `*executeForComponent(component)`
When the two cells' combined candidates hold exactly three digits, the middle
digit must be used by the pair, so it is handed to
`yieldRequiredDigitDeductions` under the component's name.
- **Notes:** skipped for a ratio component whose combined mask includes digit 0,
  where the middle-digit argument does not hold. **[read]**

#### `clone(newSudoku)`
New step over `newSudoku` seeded with the current component set — which also
installs a fresh listener on the new state. **[read]**

### `SumLogicCacheState`

`bundle.claude.js:4375`. Payload for the simple-sums subscription:
`componentInfo` (component → `{ combinations, required }` from
`buildSumCombinationsEntry`) and `componentsByCell` (a `CloneableMap` from cell
id to the set of sum components covering it).

#### `clone()`
Deep-clones `componentInfo` and clones `componentsByCell`, so combination
pruning is per search node. **[read]**

### `SimpleSumsLogicStep`

`bundle.claude.js:4390`. Prunes the candidate-digit combinations of
non-repeating sum components (killer cages and the like). `cache` is a
`ComponentSubscription` over `isNonRepeatingSumComponent`; on add it indexes the
component by cell and precomputes the digit-mask list for every possible sum
(`sums`, or the whole `minSum..maxSum` range).

#### `*execute()`
Runs `pointDigits`, then `reduceCombinationsByContainment`. **[read]**

#### `*pointDigits()`
For every tracked component with more than two cells, drops cached combinations
that miss an already-placed digit or use a digit no cell can take, intersects
what survives to get the digits every remaining combination needs, and hands
that mask to `yieldRequiredDigitDeductions`.
- **Mutates:** the cached `info.combinations`. **[read]**

#### `*reduceCombinationsByContainment()`
When every cell of a candidate set for a digit lies inside one sum component,
that component must contain the digit: it records the digit as required, keeps
only combinations holding it, and filters the component's cells down to the
union of the survivors.
- **Cost:** digits × candidate sets, each with a set intersection over the
  covering components. **[read]**

#### `getComponentsContainingCells(cellIds)`
Returns the set of sum components covering *every* one of `cellIds`, or
`undefined` as soon as a cell has none or the running intersection empties.
**[read]**

#### `clone(state)`
New step over `state` with `this` as source, cloning the cache. **[read]**

### `UnorthodoxFishLogicStep`

`bundle.claude.js:4527`. Counting argument on `RequiredDigitsComponent`s that
demand a digit more than once. Fields: `cache` (subscription to those
components), `regionComponents` (the region houses) and
`regionComponentIndexByCell`; a clone shares the region data and clones the
cache.

#### `*execute()`
Per component and per `(digit, count)` in its `repeatCounts`, decrements the
count for each already-placed copy and builds masks of the rows, columns and
regions its remaining candidate cells occupy. If a mask has exactly
`remaining + 1` lines, the digit can be removed from the rest of those lines
outside the component; if it has fewer, the requirement is unsatisfiable and it
yields an `AbortSolver`.
- **Notes:** the region branch is skipped entirely when any candidate cell lies
  outside every region. The line deductions are collected and yielded as one
  array of requests at the end.
- **Cost:** one pass over the component's cells per repeated digit. **[read]**

#### `clone(state)`
New step over `state` with `this` as source. **[read]**

#### `getRowCellsWithoutCells(rowIndices, excludedCells)`
Set of all cells in those rows minus `excludedCells`, via
`helpers.geometry.getCellsInRow`. **[read]**

#### `getColumnCellsWithoutCells(columnIndices, excludedCells)`
Same for columns, via `helpers.geometry.getCellsInColumn`. **[read]**

#### `getRegionCellsWithoutCells(regionIndices, excludedCells)`
Same for regions, indexing `this.regionComponents` and taking their `cellIds`.
**[read]**

### `YWingLogicStep`

`bundle.claude.js:4706`. Classic Y-wing (XY-wing). Holds only the state.

#### `*execute()`
For every bivalue cell as pivot, takes the bivalue cells it sees, and for each
pair of those whose three-way candidate union is exactly three digits and whose
shared digits do not overlap the pivot's, removes the shared mask from every
cell both wings see.
- **Cost:** cells × `C(bivalue peers, 2)`, each pair doing a
  `getCellsSeenByCells`.
- **Notes:** the loop is over `sudoku.cells` without an explicit solved-cell
  skip; a solved cell simply fails the two-candidate test. **[read]**

#### `clone(state)`
New instance over `state`. **[read]**

### `StandardLogicStepsGenerator`

`bundle.claude.js:4769`. Builds the step list for a `"sudoku"` puzzle. Fields:
`enabledStepTypes` (a `Set` of `LogicStepType` strings from the solve strategy)
and `useRandomness`.

#### `setLogicSteps(solver)`
Calls `solver.setLogicSteps(this.getLogicSteps(solver.state))` and copies
`useRandomness` onto the solver. **[read]**

#### `getLogicSteps(state)`
Returns the ordered step array: naked single and hidden single unconditionally,
then for each set size from 2 to half the digit count the enabled naked, hidden
and unorthodox naked set steps, then pointing sets, a size-2 fish for either
`xWings` or `fishes`, simple sums, consecutive sets, kropki, unorthodox fishes,
then larger fishes up to half the grid width, then Y-wing, almost-X-wing,
counting circles, and finally by-contradiction.
- **Notes:** order here is solve priority — cheap steps first,
  by-contradiction last. **[read]**

### `CustomLogicStepsGenerator`

`bundle.claude.js:4841`. The generator used for a `"custom"` puzzle. It filters
the requested step types down to `CustomPuzzleEnabledStepTypes` — naked sets,
hidden sets, pointing sets, unorthodox naked sets, simple sums, consecutive
sets, kropki dots, counting circles, by-contradiction — and wraps a
`StandardLogicStepsGenerator` built from the filtered options. Fish, X-wing,
Y-wing, skyscraper and unorthodox-fish steps can therefore never run on a
custom puzzle, whatever the strategy asks for.

#### `setLogicSteps(solver)`
Delegates straight to the wrapped standard generator. **[read]**
