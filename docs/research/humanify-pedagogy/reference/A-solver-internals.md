## Solver internals: state, change application, worker messages

The machinery between a component's yielded change and a cell actually losing a
candidate: the `SolverState` that holds the grid, the two change appliers that
apply a logic step's changes, the search driver, the constraint-handler registry
that builds a puzzle from its constraint list, and the worker message handlers.
None of this is reachable from custom-constraint code unless an entry says
otherwise — a component sees only the `puzzle` facade and the change factory
functions. Cell ids are 0-based integers (`x + y * width`); a digit mask has
bit *d* set for digit *d*.

### ChangeApplier (internal)

`bundle.claude.js:2011`. Applies the changes of one or more deduction requests
(a logic step's `{ changes, description }` objects) to a `SolverState`. Built by
`Solver.getDeductionProcessor` when verbose solving is off. Fields: `sudoku`
(the `SolverState`) and `requests` (the deduction list, forced to an array by
`ensureArray`). Note the asymmetry with `SolverState.processChange`: this one
never handles `ReplaceComponent`, so a logic step cannot swap components — only
a component's own `update` can.

#### `execute()`
Walks every change of every request in order and returns the merged outcome.
- **Returns:** the last `changed` deduction result, or `UnchangedResult` if
  nothing changed, or the first `failed` result — returning immediately on a
  failure, leaving the remaining changes unapplied.
- **Mutates:** the `SolverState` it holds. **[read]**

#### `*processChange(change)`
Dispatches one change object to the matching applier method by `change.type`.
- **Returns:** generator of deduction results.
- **Notes:** `AbortSolver` yields `{ type: "failed", cells: change.cells || [], message: change.message }` directly. A type outside `ChangeType` yields nothing. **[read]**

#### `*setValueAtCell(value, cell)`
Sets `cell` to `value` through `SolverState.setValueAtCell`, yielding its one result. **[read]**

#### `*filterCandidatesAtCell(digitMask, cell)`
Intersects `cell`'s candidates with `digitMask` via `SolverState.filterCandidatesAtCell`, yielding its one result. **[read]**

#### `*filterCandidatesAtCells(digitMask, cells)`
Same intersection across an array of cell ids, delegating to the state's generator and yielding one result per cell. **[read]**

#### `*removeCandidatesFromCell(digitMask, cell)`
Clears the bits of `digitMask` from `cell`'s candidates, yielding the one result. **[read]**

#### `*removeCandidatesFromCells(digitMask, cells)`
Same removal across an array of cell ids, one yielded result per cell. **[read]**

### VerboseChangeApplier (internal)

`bundle.claude.js:2078`. The applier used when verbose solving is on (the
default; `disableVerboseSolving` turns it off). Same job as `ChangeApplier`, but
it records which cells each change actually touched so the UI can highlight the
step. Fields: `affected` (every cell touched by this deduction, clone-expanded),
`affectedPerChange` (Map from change object to its affected cell ids). Its
methods yield `[cellId, result]` pairs rather than bare results.

#### `execute()`
Applies every change like `ChangeApplier.execute`, and additionally records each non-`unchanged` change's affected cells, expanded through `SolverState.getCloneSet` so clone partners are highlighted too.
- **Returns:** last `changed` result, `UnchangedResult`, or the first `failed`.
- **Notes:** the recording is also gated on the module-level `verboseSolvingEnabled`, so it stays silent if the flag was flipped after construction. **[read]**

#### `getVerboseResults()`
Builds the per-request report the worker ships to the UI.
- **Returns:** array of `{ description, changes, affected }`, keeping only changes that actually affected a cell (or are `AbortSolver`), and dropping any request left with no changes. `affected` is parallel to `changes`.
- **Notes:** this is what `Solver.getDeductionResultsForTransport` returns. **[read]**

#### `processChange(change)`
Dispatches one change by type, exactly as in `ChangeApplier`, but returns a generator of `[affectedCellId, result]` pairs; an unknown type returns `[]`. **[read]**

#### `setValueAtCell(value, cell)` / `filterCandidatesAtCell(digitMask, cell)` / `removeCandidatesFromCell(digitMask, cell)`
Each performs the same state mutation as its `ChangeApplier` twin, but yields `[cell, result]` only when the result is not `unchanged`, after passing it through `ensureErrorMessage`. **[read]**

#### `filterCandidatesAtCells(digitMask, cells)` / `removeCandidatesFromCells(digitMask, cells)`
Loop the single-cell version over `cells`, yielding a pair per cell that actually changed.
- **Notes:** unlike the `ChangeApplier` versions, these call the state's *single-cell* method in a loop rather than its plural generator. Same effect. **[read]**

#### `reportBroken(cells, message)`
Yields one `[undefined, { type: "failed", cells, message }]` pair for an `AbortSolver` change; the `undefined` cell id is what keeps the abort out of the affected-cell highlighting. **[read]**

#### `ensureErrorMessage(result)`
Fills in a missing message on a `failed` result with `describeCellsWithNoCandidates(result.cells)`, and returns the result. **[read]**

### BranchCellRanking (internal)

`bundle.claude.js:2198`. Picks which unsolved cell the search should branch on
when logic runs out. Constructed per branch point by `Solver.findSolutions` with
the current state and a randomness flag; `cellWeights` is a lazily filled array
indexed by cell id.

#### `getBestCell()`
Scans all cells and returns the unsolved one with the lowest weight, or `undefined` if the grid is full. **[read]**

#### `getSortedCells()`
Returns every unsolved cell sorted by weight, cheapest first. Not called from `findSolutions`; it exists for callers that want the whole ordering. **[read]**

#### `getBetterCell(cellA, cellB)`
Returns whichever of the two cells has the lower weight, preferring `cellA` on a tie. **[read]**

#### `compareCells(cellA, cellB)`
A `-1 / 0 / 1` comparator on the two cells' weights. **[read]**

#### `getCellWeight(cell)`
Computes and memoizes a cell's branching cost: candidate count (capped at 3) times 100000, minus the number of constraint components at the cell, plus `Math.random()` when `useRandomness` is on.
- **Notes:** so fewer candidates dominates, more constraints breaks ties toward the more constrained cell, and the random term makes the search non-deterministic. Capping at 3 means a 4-candidate cell and a 9-candidate cell rank alike. Memoized per instance, so it is stale-free only because a new ranking is built at each branch point. **[read]**

### ComponentSubscription (internal)

`bundle.claude.js:2870`. A live, cloneable view of the components matching a
filter, used by logic steps that want to iterate "all components of kind X"
without rescanning the state. Fields: `filter` (component predicate), `state`
(arbitrary cloneable accumulator handed to the callbacks), `onAdd` / `onDelete`
callbacks, `components` (the matching Set).

#### `initialize(solverState)`
Binds to the state, then seeds `components` from the current component set, calling `onAdd` for each match. **[read]**

#### `bind(solverState)`
Registers a listener on the state's component event bus via `SolverState.addComponentListener`, so later adds that match the filter join the set and any removal leaves it.
- **Notes:** a `"delete"` event deletes unconditionally and calls `onDelete`, even for components the filter never accepted. **[read]**

#### `getComponents()`
Returns the live `Set` of matching components, not a copy. **[read]**

#### `getState()`
Returns the accumulator object handed to `onAdd` / `onDelete`. **[read]**

#### `clone(newSolverState)`
Makes a subscription for a cloned state: same filter and callbacks, `state?.clone()`, a fresh `Set` copy of the members, bound to `newSolverState`.
- **Notes:** this is how a logic step survives `SolverState.clone` at a branch point — the logic step's constructor takes the previous step and clones its cache. **[read]**

### EventEmitter (internal)

`bundle.claude.js:8613`. A minimal name-to-handler-set emitter. `SolverState`
holds one as `componentEventBus` and emits `"change"` on it for every component
add or remove. Field: `all`, a Map from event name to a Set of handlers.

#### `on(eventName, handler)`
Adds `handler` to that event's set, creating the set if needed. **[read]**

#### `off(eventName, handler)`
Removes one handler, or clears every handler for the event when `handler` is omitted. **[read]**

#### `emit(eventName, payload)`
Calls each handler with `payload`, over a copied array so a handler may subscribe or unsubscribe during dispatch. **[read]**

### CloneableMap (internal)

`bundle.claude.js:4353`. A `Map` subclass whose values are Sets, used for
`SolverState.constraintComponentByCell` (cell id → Set of components).

#### `clone()`
Returns a new `CloneableMap` with the same keys and a fresh `Set` per value, so the clone's per-cell sets are independent while the component objects inside stay shared by reference. **[read]**

### CandidateSetMap (internal)

`bundle.claude.js:8450`. Per digit, the list of "this digit must appear among
these cells" sets that the required-digits machinery has recorded — the index
behind hidden singles, pointing pairs and the like. Field: `map`, an array
indexed by digit, each entry an array of set-info objects
`{ candidate, name, houseType, cells, repeatCount }`. The copy constructor
deep-copies each entry via `cloneCandidateSetInfo`. Reached from a component
only indirectly, through `SolverState.getSetsForCandidate`.

#### `addSet(setInfo)`
Appends a set-info to its digit's list and re-sorts that list. **[read]**

#### `removeCandidate(digit, cellId)`
Drops `cellId` from every set recorded for `digit`, deletes any set left empty, then re-sorts.
- **Notes:** called by `SolverState.filterCandidatesAtCell` and `removeCandidatesFromCell` for each digit actually eliminated. A set shrinking to one cell is the hidden single. **[read]**

#### `reduceCandidateSetsAt(digit, cellId)`
Records that `digit` has been placed at `cellId`: removes every set containing that cell, except that a set with a nonzero `repeatCount` is kept and its count decremented instead. **[read]**

#### `getSets(digit)`
Returns the live array of set-infos for that digit, shortest first. **[read]**

#### `sortSets(sets)`
Sorts a set-info array ascending by `cells.length`, so the most constrained set is first. **[read]**

### Solver (additional members)

`bundle.claude.js:8347`. The search driver. One `Solver` per search node: the
constructor takes a state and an optional parent, inheriting `depth + 1`,
`useRandomness`, and a per-node clone of each logic step.

#### `setLogicSteps(logicSteps)`
Replaces the solver's logic-step list. Called by `StandardLogicStepsGenerator` or `CustomLogicStepsGenerator` right after the solver is built. **[read]**

#### `*findSolutions()`
The full search: runs the constraint fixpoint, then repeatedly takes logic steps, and when logic stalls, branches on a cell chosen by `BranchCellRanking` and recurses into a child `Solver` on a cloned state.
- **Returns:** generator of `Uint32Array` grid buffers (`serializeCellsToBuffer` format), one per solution.
- **Notes:** returns silently if the initial `updateConstraintsAndValidate` fails, an invalid step is reached, or a branch value is immediately contradictory. Clones the state per branch digit, so nothing is undone by backtracking — it is abandoned. **[read]**

#### `singleLogicStep()`
Takes exactly one logic step; a bare alias for `step()`, and the entry point used by the worker's single-step message. **[read]**

#### `getDeductionProcessor(deduction)`
Returns a `VerboseChangeApplier` when verbose solving is enabled, otherwise a `ChangeApplier`, wrapping this solver's state and the given deduction request. **[read]**

#### `step()`
Runs each logic step in turn, applies the first deduction that changes or breaks something, and returns as soon as one does.
- **Returns:** `{ changed, valid, deductionResults?, erroneousCells?, error? }`. A change is followed by `SolverState.updateConstraintsAndValidate`, whose failure is reported as `valid: false` with the contradiction's cells and message. If no logic step produced anything, `{ changed: false, valid: true }`.
- **Notes:** `deductionResults` is present only in verbose mode; `findSolutions` treats its presence as "logic made progress, do not branch yet". **[read]**

#### `getDeductionResultsForTransport(applier)`
Returns `applier.getVerboseResults()` for a `VerboseChangeApplier`, and `[]` for a plain one. **[read]**

#### `log(message)`
Prints `message` to the console indented by two spaces per search depth. **[read]**

### SolverState (additional members)

`bundle.claude.js:8630`. The already-documented state object; these are the
members the existing "When the solver calls what" section does not cover.

#### `static create()`
Returns a fresh empty `SolverState` — every cell valueless with all digits as candidates, no regions, no components. **[read]**

#### `setRegions(regionIdByCellId)`
Installs the region layout and creates one component per region: a `HouseComponent` when the region holds exactly as many cells as there are digits, otherwise a `DifferentDigitsComponent`.
- **Params:** `regionIdByCellId` – array indexed by cell id giving its region id, `-1` for none.
- **Mutates:** `regions`, `regionsByCellId`, and the component set.
- **Notes:** names the regions `box N` when `regionsAreRectangularBoxes` says the layout is rectangular boxes, else `region N`. Reached from setup code as `puzzle.setRegions`. **[read]**

#### `handleRequiredDigitsComponent(component)`
Registers a `RequiredDigitsComponent`'s digits with the candidate-set map. If the component's values are all distinct it marks them in one mask; otherwise it marks each value separately with that value's repeat count, so "two 5s in here" is recorded as a repeat rather than collapsing to one.
- **Notes:** called from `addConstraintComponent`, not directly. **[read]**

#### `getConstraintComponents()`
Returns the live `Set` of every registered component. **[read]**

#### `getHouseComponents()`
Returns the live `Set` of registered `HouseComponent`s only. **[read]**

#### `addComponentListener(listener)`
Subscribes `listener` to the `"change"` event, called with `{ type: "add" | "delete", component }` on every registration and unregistration. Used by `ComponentSubscription.bind`. **[read]**

#### `getCellsSeenByCells(cellIds, includeClones = true)`
The set of cells seen by **every** cell in `cellIds` — the intersection of their `getCellsSeenByCell` sets.
- **Returns:** a `Set` of cell ids; empty `Set` for an empty input.
- **Notes:** short-circuits as soon as the running intersection empties. This is what a naked-subset style elimination calls to find its targets; reached from a component as `puzzle.getCellsSeenByCells`. **[read]**

#### `filterCandidatesAtCell(digitMask, cellId)`
Intersects the cell's candidate mask with `digitMask`, telling the candidate-set map about each digit removed and marking the cell dirty.
- **Returns:** `UnchangedResult` if nothing was removed, a failed result for the cell if the mask emptied, otherwise `ChangedResult`.
- **Mutates:** the cell's `candidates`, `candidateSetMap`, `updateSet`. **[read]**

#### `*filterCandidatesAtCells(digitMask, cellIds)`
Applies the same intersection to each cell id in turn.
- **Returns:** generator, one result per cell. **[read]**

#### `markDigitsAsRequiredForCells(digitMask, componentName, cellIds, { repeatCount = 0, houseType })`
Records "each digit in `digitMask` must appear in `cellIds`", keyed by `` `${componentName}_${cellIds}` `` so repeated calls for the same group only add newly required digits.
- **Returns:** `true` if any digit was newly required.
- **Mutates:** `requiredDigitsForComponent`, and adds one set per newly required digit to `candidateSetMap`.
- **Notes:** a digit already placed enough times (`placedCount >= repeatCount + 1`) or with no candidate cells left records no set. **[read]**

#### `markDigitsAsRequiredForComponent(digitMask, component, cellIds = component.cellIds, repeatCount = 0)`
The same, keyed by the component's name and carrying the component's `houseType` when it is a `HouseComponent`.
- **Notes:** this is the call a component makes to tell the solver its cells must contain certain digits; `addConstraintComponent` uses it to require all digits in every house. **[read]**

#### `getSetsForCandidate(digit)`
Returns that digit's required-digit sets from the candidate-set map, shortest first. Read by hidden-single and pointing logic steps. **[read]**

#### `getCloneSet(cellId)`
Returns the `Set` of cell ids that always hold the same digit as `cellId`, including itself. Non-empty even with no clone constraints. **[read]**

#### `addClonedCells(cellSet)`
Expands `cellSet` in place with every clone partner of its members, and returns it.
- **Mutates:** the argument. **[read]**

#### `isSolved()`
True when every cell has a value. Says nothing about validity — `findSolutions` pairs it with `validate()`. **[read]**

#### `clone()`
Returns `new SolverState(this)`: per-cell value and candidates copied, `constraintComponentByCell` and `candidateSetMap` structurally copied, `clonedCellsMap` deep-copied, and the component set copied **by reference**, so every search node shares one component object. **[read]**

#### `isTerminalChange(change)`
True for `ReplaceComponent` and `AbortSolver` — the two change types after which the solver stops draining a component's generator. **[read]**

### ConstraintHandlerRegistry (additional members)

`bundle.claude.js:9342`. Maps a `ConstraintType` to the handler that turns a
constraint's config into components. The module-level singleton is
`constraintHandlerRegistry`.

#### `register(constraintType, handler)`
Stores `handler` under `constraintType`, defaulting `handler.priority` to `0`. A second registration for the same type replaces the first. **[read]**

#### `setupPuzzle(spec, state, constraints)`
Builds the whole puzzle: creates the helper bundle and a `PuzzleSetupView` over `state`, drops constraints with no registered handler, sorts the rest by handler priority, calls every handler's `register`, then every handler's optional `postRegister` in the same order.
- **Notes:** the two passes are why a handler can look at components other handlers created (anti-king checks `getCellsSeeEachOther` before adding its own). All handlers share one `puzzle` view and one `helpers` object. **[read]**

### PuzzleSetupView (additional members)

`bundle.claude.js:9318`. The `puzzle` object a constraint handler receives
during setup; extends `PuzzleAccessorBase` with the mutating methods.

#### `setRegions(regionIdByCellId)`
Forwards straight to `SolverState.setRegions`, creating the region components. **[read]**

### PuzzleAccessorBase (additional members)

`bundle.claude.js:9222`. The read-only geometry and grid base under both
`PuzzleSetupView` and `SolverPuzzleView`, so these are available on the `puzzle`
object inside a custom component.

#### `*getCellsOrthogonallyAdjacentToCoords(x, y)`
The orthogonal neighbours of the cell at `(x, y)`, by converting the coords to a cell id and delegating to `getCellsOrthogonallyAdjacentToCell`.
- **Returns:** generator of cell ids, edges omitted rather than out-of-range. **[read]**

#### `*getCellsDiagonallyAdjacentToCell(cellId)`
The up-to-four diagonal neighbours of `cellId`, delegating to `helpers.geometry.getDiagonallyAdjacentCells`.
- **Returns:** generator of cell ids. **[inferred]** — read this wrapper only, not `getDiagonallyAdjacentCells` itself; the edge-clipping claim comes from the helper's name and its orthogonal twin.

#### `*getCellsDiagonallyAdjacentToCoords(x, y)`
The same for the cell at `(x, y)`, via `helpers.cellIds.getIdFromCoords`.
- **Returns:** generator of cell ids. **[read]**

### ConstraintComponent (additional members)

`bundle.claude.js:2676`.

#### `get allowsEmptyCells()`
A getter returning `false` on the base class, meant to declare that the component tolerates cells with no digit.
- **Notes:** the name appears nowhere else in the bundle — nothing reads it, so overriding it in a custom component currently changes nothing. **[read]**

### Top-level functions (solver internals)

#### `setPuzzleSpec(spec)`
`bundle.claude.js:1651`. Installs the module-level puzzle spec: deep-copies `spec` into `puzzleSpec`, rebuilds `sharedHelpers` from it, and recomputes `allDigitsMask`.
- **Notes:** everything below reads grid size and digit range from this module global, so it must run before any state is created. **[read]**

#### `disableVerboseSolving()`
`bundle.claude.js:1657`. Flips `verboseSolvingEnabled` to `false` for the rest of the worker's life, so `Solver.getDeductionProcessor` builds plain `ChangeApplier`s and no step explanations are produced. One-way; nothing turns it back on. **[read]**

#### `serializeCellsToBuffer(cells)`
`bundle.claude.js:4861`. Packs a cell array into a `Uint32Array` of two words per cell: value then candidate mask, with `4294967295` standing in for an unset value.
- **Returns:** the buffer, which the worker transfers (not copies) to the main thread. **[read]**

#### `cloneCandidateSetInfo(setInfo)`
`bundle.claude.js:8442`. Shallow-copies one candidate-set record, copying its `cells` array so the clone's cell list is independent.
- **Notes:** drops `repeatCount`, which `CandidateSetMap.addSet` stores and `reduceCandidateSetsAt` reads — so a cloned state's sets look repeat-free. Flagged as observed, not as an intended behaviour. **[read]**

#### `registerConstraintHandler(constraintType, handler)`
`bundle.claude.js:9392`. Registers a handler on the singleton registry; the bundle calls it once per built-in constraint type at module load. **[read]**

#### `getNextConstraintId()`
`bundle.claude.js:9486`. Returns and increments a module-level counter, giving each constraint a unique id within the session. **[read]**

#### `createDefaultConstraintConfig({ type, spec, otherConstraints })`
`bundle.claude.js:9489`. Returns the empty starting config for a constraint of that type — `{ type }` alone for flag-like constraints, and a type-specific skeleton (empty clue arrays and so on) for the rest.
- **Notes:** for a custom constraint it also uniquifies the definition name against `otherConstraints`, bumping a trailing number or appending `" 2"`. Read the name-uniquing helper and the first few switch arms, not all of the long switch. **[inferred]**

#### `createConstraint({ id, type, spec, otherConstraints })`
`bundle.claude.js:9763`. Wraps `createDefaultConstraintConfig` into a full constraint record `{ id, name: undefined, enabled: true, solverIgnored: false, config }`, defaulting `id` from `getNextConstraintId()`. **[read]**

#### `getSolverEnvironment()`
`bundle.claude.js:9908`. Returns `{ verboseSolving: verboseSolvingEnabled }` — the one global flag exposed to constraint code, so a component can skip building step explanations it knows will be discarded. **[read]**

#### `applyInitialGridToState(state, gridBuffer)`
`bundle.claude.js:11479`. Loads the starting grid into a fresh state: for each cell, sets the given value or, failing that, intersects the pencilmark mask; then initializes every registered component and runs the constraint fixpoint plus validation.
- **Params:** `gridBuffer` – the two-words-per-cell `Uint32Array` from `serializeCellsToBuffer`.
- **Returns:** `{ changed: boolean }` on success, or the failed deduction result (with `cells` and `message`) on a contradiction.
- **Notes:** the `false` third argument to `setValueAtCell` is what keeps givens from being treated as solver deductions. This is the caller that makes `initialize` run once per component, after givens and before the first full update. **[read]**

#### `handleStepMessage()`
`bundle.claude.js:11539`. Worker handler for a single-step request: calls `activeSolver.singleLogicStep()`, attaches a serialized grid, and posts `{ type: "update", ... }` with the buffer transferred. Posts `{ type: "error" }` if no solver has been started. **[read]**

#### `handleFindNextMessage()`
`bundle.claude.js:11550`. Worker handler for "next solution": lazily creates the `findSolutions` iterator, pulls one solution, and posts it with `changed` set by comparing against the initial grid snapshot. When the iterator is exhausted it posts `changed: false` and a `valid` computed from `isSolved()` and `validate()`. **[read]**

#### `handleFindAllMessage()`
`bundle.claude.js:11578`. Worker handler for "all solutions": drains the `findSolutions` iterator, posting one `update` message per solution, then a final `{ type: "update", changed: false, valid: true }` terminator.
- **Notes:** synchronous and unbounded — it blocks the worker until the search finishes, which is why a multi-solution puzzle can hang the tab. **[read]**
