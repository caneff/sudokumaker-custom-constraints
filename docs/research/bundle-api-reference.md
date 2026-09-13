# SudokuMaker custom-constraint API reference

An explanatory reference for everything a custom constraint can reach: the
`puzzle` object, change objects, the component contract, every `helpers.*`
namespace, the utility globals, and all built-in components. Each entry was
written by reading the function body in the app's solver bundle
(`solver-Bv75x3BJ.js` as served by sudokumaker.app), not inferred from its
name.

Line citations (`bundle.claude.js:<line>`) point into a copy of that bundle
with every mangled identifier renamed to a readable one, verified by AST
comparison to be the same program.

Caveats:

- Public method names, decorator display names and string literals are the
  app's own. Every other identifier in `bundle.claude.js`, including parameter
  names, was inferred by reading and can be wrong. Trust the entry text here
  over a renamed parameter list when they disagree.
- There are two `helpers` objects. Setup code gets the extended one with
  `lines`, `misc` and a region-aware `geometry`; a component's `update`,
  `initialize` and `validate` get the plain one without them.
- Mangled names are per-build. Everything here is for the bundle above and
  should be re-derived after the app ships a new one.
- Confidence. Every entry was written from the function body unless it
  carries **[inferred]**, which means the description comes from the name,
  the call sites, or a partial read, and the entry says what was not read.
  Treat an **[inferred]** entry as a best guess to verify before relying on it.
  Entries in the appendix sections also carry **[read]** where the body was
  read in full.

## Bundle bugs

Places where the bundle's own behaviour looks wrong. Each is also flagged in
place as a `Discrepancy` note in the entry concerned.

| # | Finding |
|-|-|
| 1 | Straight-ray outer clues from the `BottomRight` and `BottomLeft` corners start at the wrong corner (1183, 1195), and all four corner cases assume a square board. Do not trust a bottom-corner straight ray. |
| 2 | `groupsArePolarityPair` (10375) builds its low and high masks with the same `digit < midpoint` test (10382), so the two are identical and a low/high polarity pair is never recognised. Confirmed in the minified original. |

## The puzzle object, change objects and the component contract

This section covers the three objects a custom constraint actually talks to: the
`puzzle` handed to the main (backend) code segment at setup, the `puzzle` handed
to a component's `initialize` / `update` / `validate` during the solve, and the
plain change objects a component yields. It also covers how SudokuMaker turns
your code segment into a class, so it says exactly where `this`, `puzzle`,
`input` and `helpers` come from and what the solver does with each yielded
change. Everything here is read from `bundle.claude.js`.

Two `puzzle` objects exist and they are different classes. The main code gets a
`PuzzleSetupView`; `initialize`/`update`/`validate` get a `SolverPuzzleView`
built fresh per call. Both extend `PuzzleAccessorBase`, so the geometry and
region reads are shared; only the setup view can add or remove components, and
only the solver view can read cells or build changes.

### `puzzle` in the main code (class PuzzleSetupView)

`bundle.claude.js:9318`. Extends `PuzzleAccessorBase` and adds nothing but
component registration. It is constructed once per solve setup in
`ConstraintHandlerRegistry.setupPuzzle` (9349) and passed to every constraint
handler as `{ puzzle, constraints, input, helpers }`; `registerCustomConstraint`
(10101) then hands it to your backend code as both `puzzle` and `sudoku`.
Fields: `spec`, `state` (the live `SolverState`), `helpers`.

#### `addConstraintComponent(component)`
Registers a component instance with the solver state for the whole solve.
- **Mutates:** `puzzle.state` — indexes the component under each of its
  `cellIds`, adds it to the component set, and emits a `change` event.
- **Notes:** `SolverState.addConstraintComponent` (8729) special-cases built-in
  classes: a `HouseComponent` also joins the house set and marks all digits
  required, a `SameDigitComponent` merges clone sets, a
  `RequiredDigitsComponent` registers its required digits. A custom component
  is none of those, so it only gets indexed. Registration does **not** run
  `initialize`; see "When the solver calls what" below.

#### `removeConstraintComponent(component)`
Unregisters a component.
- **Mutates:** `puzzle.state` — de-indexes it from every cell in its `cellIds`.
- **Notes:** used by built-in handlers (e.g. 10237) to strip a component another
  constraint supersedes.

#### `getConstraintComponentsAt(cellId)`
Returns the `Set` of components currently registered on that cell.
- **Notes:** live set from the state's per-cell index, not a copy. Handlers use
  it to find and drop a component they are about to replace.

### Shared reads (class PuzzleAccessorBase)

`bundle.claude.js:9222`. The base of both views. Fields: `spec`, `state`,
`helpers`. Getters `puzzleType` (`spec.type`), `size` and `width`
(`spec.size.width`), `height`, `maxDigit`, `minDigit`, `digitCount` — all plain
reads off `spec`.

#### `getRegion(cellId)`
The region a cell belongs to, delegated to `SolverState.getRegionIdAt`
(`this.regionsByCellId[cellId] ?? -1`, 8802).
- **Returns:** 0-based region id, `-1` when the cell has no region.

#### `getRegionCells(regionId)`
The cells of one region.
- **Returns:** the region's cell-id array, as the state holds it.

#### `getRegions()`
Every region on the board.
- **Returns:** the array of region cell-id arrays.

#### `hasRegions()`
Whether the puzzle defines any regions at all.
- **Returns:** boolean, `regions.length > 0`.

#### `getRegionAt(x, y)`
The region of the cell at these coordinates.
- **Returns:** 0-based region id, or `-1`.
- **Notes:** goes through `unsafeGetCellAt`, so out-of-range coords give a
  garbage id, not `undefined`.

#### `getX(cellId)`
The 0-based column of a cell.
- **Returns:** number.

#### `getY(cellId)`
The 0-based row of a cell.
- **Returns:** number.

#### `getColumn(cellId)`
Alias of `getX` (9264-9273): the same function under a second name.

#### `getRow(cellId)`
Alias of `getY` (9264-9273): the same function under a second name.

#### `getCellAt(x, y)`
Coordinates to cell id, bounds-checked through
`helpers.cellIds.getIdFromCoordsSafe`.
- **Returns:** cell id, or `undefined` off the board.

#### `unsafeGetCellAt(x, y)`
Coordinates to cell id through `getIdFromCoords`, with no bounds check.
- **Returns:** `x + y * width`, which is a garbage id for off-board coords.

#### `*getCellsOrthogonallyAdjacentToCell(cellId)`
The up-to-four edge neighbours of a cell, a `yield*` wrapper over
`helpers.geometry.getOrthogonallyAdjacentCells`.
- **Returns:** generator of cell ids. Spread it before indexing.

#### `*getCellsOrthogonallyAdjacentToCoords(x, y)`
The same for the cell at `(x, y)`.
- **Returns:** generator of cell ids.

#### `*getCellsDiagonallyAdjacentToCell(cellId)`
The up-to-four corner neighbours of a cell, a `yield*` wrapper over
`helpers.geometry.getDiagonallyAdjacentCells`.
- **Returns:** generator of cell ids.

#### `*getCellsDiagonallyAdjacentToCoords(x, y)`
The same for the cell at `(x, y)`.
- **Returns:** generator of cell ids.

#### `getFriendlyDigitsForCell(cellId)`
The "friendly digits" of a cell: column index + 1, row index + 1, and region id
+ 1 as a `SudokuDigitSet`.
- **Returns:** `new SudokuDigitSet((1 << x+1) | (1 << y+1) | regionBit)`, where
  `regionBit` is `0` when the cell has no region.

#### `getCellsSeenByCell(cellId, includeClones = true)`
The set of cells that must differ from this one.
- **Returns:** a fresh `Set` of cell ids, excluding `cellId` itself.
- **Notes:** built at call time by unioning `getExclusionGroup(cellId)` over
  every component registered on the cell (8808), so it only sees components
  registered so far — in the main code that means constraints ordered before
  yours; from `update` every house is already registered. With
  `includeClones` (the default) the clone map expands both the source and the
  result.

#### `getCellsSeeEachOther(cells)`
Whether every pair of cells in the list must differ, using `getCellsSeenByCell`
for each.
- **Params:** array or any iterable of cell ids.
- **Returns:** boolean; `true` for a single cell.

#### `getCellsCanHaveRepeats(cells)`
The complement: whether some two cells in the list may hold the same digit.
- **Params:** array or any iterable of cell ids.
- **Returns:** boolean, `hasDuplicates(list) || !getCellsSeeEachOther(list)`
  (8860). A repeated id in the list alone makes it `true`.
- **Notes:** cost is `O(n)` calls to `getCellsSeenByCell`, each of which walks
  every component on that cell. Not a cheap read in a hot loop.

### `puzzle` inside `update` / `initialize` / `validate` (class SolverPuzzleView)

`bundle.claude.js:9914`. Constructed per call by `__getFacade` (10072) as
`new SolverPuzzleView(componentInstance, puzzleSpec, solverState, helpers)`, so
`puzzle.state` is the search node's live `SolverState` and `puzzle.instance` is
your component. Its reads go straight to `state.cells[id]`; its "write" methods
write nothing — they build and return a plain change object for you to `yield`.

> Note: the six change-building methods here are bare positional pass-throughs
> to the factories at `bundle.claude.js:1866-1881`, whose bodies fix the order:
> **the digit or digit mask comes first, the cell or cells second**.

#### `getValue(cellId)`
The solved digit of a cell, read as `state.cells[cellId].value`.
- **Returns:** number, or `undefined` when unsolved.

#### `hasValue(cellId)`
Whether the cell is solved to a single digit.
- **Returns:** boolean, `value !== undefined`.

#### `getCandidates(cellId)`
Remaining candidates as a `SudokuDigitSet`.
- **Returns:** `new SudokuDigitSet(state.cells[cellId].candidates)` — a **fresh
  object every call**, so the mutating set algebra (`intersect`, `subtract`) is
  safe on it.

#### `getCandidatesBitMask(cellId)`
The raw candidate bitmask, bit `d` set for digit `d`. No allocation; the
cheapest candidate read.

#### `getCellsAreFilled(cells)`
True when every listed cell has a value. Plain loop over `hasValue`.

#### `getFriendlyCandidates(cellId)`
The cell's friendly digits intersected with its live candidates.
- **Returns:** a `SudokuDigitSet`. Note the body mutates the friendly set in
  place and returns it, so the result is a fresh set you may keep mutating.

#### `removeCandidateFromCell(digit, cellId)`, `removeCandidateFromCells(digit, cells)`
Change: drop one digit from one cell, or from every listed cell.
- **Returns:** `{ type: 3, value: 1 << digit, cell }` for one cell;
  `{ type: 4, value: 1 << digit, cells: [...cells] }` for a list. The cell list
  is copied at build time, so mutating your array afterwards is harmless.

#### `removeCandidatesFromCell(digits, cellId)`, `removeCandidatesFromCells(digits, cells)`
Change: drop a set of digits from one cell, or from every listed cell.
- **Params:** `digits` — a bitmask or a `DigitSet` (it is stored raw and later
  used under `&`, which calls `valueOf`).
- **Returns:** `{ type: 3, value: digits, cell }` for one cell;
  `{ type: 4, value: digits, cells: [...cells] }` for a list.

#### `filterCandidatesInCell(digits, cellId)`, `filterCandidatesInCells(digits, cells)`
Change: keep only these digits in one cell, or in every listed cell.
- **Returns:** `{ type: 1, value: digits, cell }` for one cell;
  `{ type: 2, value: digits, cells: [...cells] }` for a list.

#### `replaceComponent(component, replacement)`
Change: unregister the component this change came from and register the
replacement(s) instead.
- **Returns:** `{ type: 6, with: ensureArray(replacement ?? component) }`.
- **Notes:** the first argument is ignored unless it is the only one — the
  component removed is always the one whose `update` yielded the change, chosen
  by the solver, not by this argument. `replaceComponent(instance, next)` and
  `replaceComponent(next)` do the same thing. **This is a terminal change**: the
  solver stops draining your generator after it (9107).

#### `removeComponent()`
Change: unregister this component and put nothing in its place. Equal to
`replaceComponentChange([])`. Also terminal.

#### `stop(message, cells)`
Change: declare the current state contradictory.
- **Returns:** `{ type: 5, cells, message }`, with the message defaulting to
  `` `unable to satisfy ${this.instance.name}` ``.
- **Notes:** terminal, and it fails the *current search node* only — the DFS
  moves to the next candidate. Nothing on your component instance is rolled
  back.

### Change objects (ChangeType and the factory functions)

`bundle.claude.js:1845`. A change is a plain object with a numeric `type` and a
couple of fields; there is no class and no method on it. The solver reads
`change.type` in `SolverState.processChange`. The `ChangeType` enum is not
exposed to custom code — build changes through `puzzle`, never by hand.

| Factory (1860-1891) | `type` | Fields on the object |
|-|-|-|
| `setValueChange(value, cell)` | `0` SetValue | `value` (a **digit**), `cell` |
| `filterCandidatesAtCellChange(mask, cell)` | `1` FilterCandidatesAtCell | `value` (mask), `cell` |
| `keepOnlyDigitAtCell(digit, cell)` | `1` | `value: 1 << digit`, `cell` |
| `filterCandidatesAtCellsChange(mask, cells)` | `2` FilterCandidatesAtCells | `value` (mask), `cells` (copied) |
| `removeDigitFromCellChange(digit, cell)` | `3` RemoveCandidatesFromCell | `value: 1 << digit`, `cell` |
| `removeCandidatesFromCellChange(mask, cell)` | `3` | `value` (mask), `cell` |
| `removeDigitFromCellsChange(digit, cells)` | `4` RemoveCandidatesFromCells | `value: 1 << digit`, `cells` (copied) |
| `removeCandidatesFromCellsChange(mask, cells)` | `4` | `value` (mask), `cells` (copied) |
| `abortSolverChange(message = "", cells = [])` | `5` AbortSolver | `message`, `cells` |
| `replaceComponentChange(components)` | `6` ReplaceComponent | `with` (array, via `ensureArray`) |
| `removeComponentChange()` | `6` | `with: []` |

Note the `value` field carries a **bitmask** for types 1-4 and a **bare digit**
for `setValue`. `SolverPuzzleView` exposes no way to yield a `SetValue` change,
so a custom component cannot write a digit — it can only remove candidates until
one is left.

### The component base class (class ConstraintComponent)

`bundle.claude.js:2676`. Every component, built-in or custom, extends this.
Fields: `name` (string, defaults to `"Nameless constraint"`; used in failure
messages) and `cellIds` (the array the solver indexes and dirty-checks against).
A custom component also gets `cells`, set by the compiled constructor to the
same array.

#### `get validateDuringSolve()`
Whether the solver should call `validate` at each node. Base returns `false`.
- **Notes:** the custom-code wrapper redefines this getter to `true` on the
  prototype **only if your segment defines a `validate` function**
  (10050). You never set it yourself.

#### `get allowsEmptyCells()`
Base returns `false`. Nothing in the solver bundle reads it; it appears once in
the minified source, which is this same definition. Treat it as inert here.

#### `*initialize(solverState)`
One-time pass when the component enters the solve. Base implementation: if the
subclass overrode `getExclusionGroup` or `onValueSet`, walk `cellIds`, and for
each already-solved cell yield that cell's `onValueSet` changes plus a removal
of its value from its exclusion group; then, always, `yield* this.update(solverState)`.
- **Notes:** so the base `initialize` **runs `update` once** even for a
  component whose own cells are not dirty. A custom component cannot override
  `getExclusionGroup` or `onValueSet` (the wrapper injects only
  `getAffectedCells`, `setParams`, `initialize`, `update`, `validate`), so the
  first branch never fires for custom code and the whole of base `initialize` is
  effectively "run update once".

#### `*onValueSet(solverState, cellId, value)`
Hook fired by `SolverState.setValueAtCell` (8868) on every component registered
on the cell that just got a value. Base yields nothing. Not reachable from
custom code.

#### `*update(solverState)`
The propagation pass. Base yields nothing.
- **Notes:** the argument is the raw `SolverState`, not a puzzle view — built-in
  components destructure it as `*update({ cells })`. The custom-code wrapper
  replaces this method with one that calls your `update(this, facade)` inside a
  try/catch, so your second parameter is a `SolverPuzzleView`, not the state.

#### `validate(solverState)`
Leaf check. Base returns the shared `ValidResult` object (`{ valid: true }`, 2675).
- **Returns:** a result object, not a boolean: `{ valid: true }` or
  `{ valid: false, message, cells? }`. Your custom `validate` returns a plain
  boolean; the wrapper converts `false` to
  `` { valid: false, message: `unable to satisfy ${this.name}` } ``.
- **Notes:** called by `SolverState.validate` (9045) for **every** registered
  component whose `validateDuringSolve` is true, independent of `update`. A
  thrown error is caught, logged, and treated as `false`.

#### `getExclusionGroup(cellId)`
The cells this component forbids from sharing `cellId`'s digit. Base returns
`[]`. This is what feeds `getCellsSeenByCell`. Not overridable from custom code,
which is why a custom component never contributes to "seen by" relations.

#### `getIsDone(solverState)`
Whether the solver may drop this component for the rest of this branch.
- **Returns:** `false` if any of `cellIds` is still unsolved; otherwise
  `validateDuringSolve ? this.validate(solverState).valid : false`.
- **Notes:** so a component with a `validate` retires itself once its cells are
  all filled and the check passes; a component without one is never dropped.
  Called from `updateConstraints` right after draining `update` (9029).

### When the solver calls what (SolverState)

`bundle.claude.js:8630`. The state object your component receives (as
`puzzle.state`) and that the solver clones per search node. The fields worth
knowing, and what a component may legitimately reach through `puzzle`:

- `cells` — one object per cell, `{ id, x, y, value, candidates }`. `value` is
  `undefined` or a digit; `candidates` is a bitmask. Indexed by cell id, which
  is `x + y * width`. This is what `getValue` / `getCandidatesBitMask` read.
- `regions` (array of cell-id arrays) and `regionsByCellId` — behind
  `getRegions` / `getRegion`.
- `constraintComponents` (a `Set`), `constraintComponentByCell` (cell id → Set)
  and `houseConstraintComponents` — behind `getConstraintComponentsAt` and
  `getCellsSeenByCell`.
- `updateSet` — the dirty-cell set driving the update loop.
- `clonedCellsMap`, `candidateSetMap`, `requiredDigitsForComponent` — internal;
  no public accessor reaches them.

The clone constructor (8646) copies `value` and `candidates` per cell but copies
the component set **by reference** (`new Set(sourceState.constraintComponents)`),
so every search node shares one component object. Nothing you write on
`instance` is undone on backtrack.

#### `updateConstraints()`
The fixpoint loop. Repeats a pass until a pass reports `unchanged`, or bails on
the first `failed`.

A single pass (`runPass`, 9006):
1. Take `updateSet` as the dirty cells and reset it to empty.
2. For each registered component **whose `cellIds` intersect the dirty set**,
   drain its `update(this)` generator.
3. For each yielded change, `processChange` applies it and yields deduction
   results; a `failed` result aborts the whole pass immediately, stamping
   `` `unable to satisfy ${component.name}` `` as the message when verbose
   solving is on.
4. Stop draining the generator early if the change was terminal
   (`ReplaceComponent` or `AbortSolver`, 9107).
5. After the generator, call `component.getIsDone(this)` and unregister the
   component if it says yes.

So `update` runs when one of the cells in the array `getAffectedCells` returned
is dirtied, and dirty means any candidate removal or value set anywhere on it
(`removeCandidatesFromCell` and `setValueAtCell` both do `updateSet.add(cellId)`).
A cell your logic reads but did not list is invisible to this test — that is the
whole reason `getAffectedCells` must name every cell you read.

#### `*processChange(component, change)`
Applies one change and yields one deduction result per affected cell
(`{ type: "changed" | "unchanged" | "failed", cells?, message? }`).
- `AbortSolver` → a failed result carrying the change's cells and message.
- `SetValue` → `setValueAtCell`, which also propagates to every seen cell and
  fires `onValueSet` on components at that cell.
- `FilterCandidatesAtCell(s)` / `RemoveCandidatesFromCell(s)` → the matching
  state mutation; emptying a cell's candidate mask produces a `failed` result.
- `ReplaceComponent` → unregisters `component`, then for each replacement:
  register it and immediately drain its `initialize`, recursively processing
  those changes; stop at the replacement's first abort or nested replace.
- **Notes:** a change type outside the enum is silently ignored.

#### `validate()` and `updateConstraintsAndValidate()`
`validate` loops the component set, skips anything with
`validateDuringSolve === false`, and returns the first `{ valid: false }` it
finds. `updateConstraintsAndValidate` runs the fixpoint first and validates only
if it did not fail, converting an invalid result into
`{ type: "failed", cells, message }`.

`initialize` is **not** called on registration. It is called once per component
from `buildSolverStateFromPuzzle` (11497), after givens and pencilmarks are
loaded and before the first `updateConstraintsAndValidate`, via
`initializeComponent` (8823) — which drains the generator through
`processChange` and breaks on the first terminal change. The other caller is the
`ReplaceComponent` branch above, for the incoming replacement.

### How your code becomes a class

#### `runCustomCodeWithGlobals(code, globals)`
`bundle.claude.js:9987`. Runs a code string with a set of names in scope:
`new Function(...Object.keys(globals), code)(...Object.values(globals))`.
- **Notes:** this is a function body, not a module and not `eval` — so your
  segment's top-level `function` declarations are local to it, `this` is
  `undefined` at top level, and nothing you declare leaks to `window`. The
  "globals" you see are just parameters of that function.

#### `getCustomConstraintGlobals()`
`bundle.claude.js:9972`. The names available in **both** the main code and every
component code segment: `MathUtils`, `Vector2Funcs`, `CombinatoricUtils`,
`ArrayUtils`, `SetUtils`, `IterationUtils`, `SudokuDigitSet`, `SmallNumberSet`,
`DigitSet` (an alias of `SudokuDigitSet`), `DiagonalType`, `OuterPosition`.

#### `compileCustomComponentClass(componentDefinition, customComponents)`
`bundle.claude.js:9990`. Turns one component code segment into a constructor.
It builds an internal `class CustomComponent extends ConstraintComponent` whose
constructor is:

```js
constructor (componentName = '', ...constructorArgs) {
  const affectedCells = injected.getAffectedCells(...constructorArgs)
  super(componentName || `the custom constraint containing ${…getCellsDescription(affectedCells)}`,
        affectedCells)
  this.cells = affectedCells
  injected.setParams(this, ...constructorArgs)
}
```

then runs your segment through `runCustomCodeWithGlobals` with an appended
preamble that copies your free functions onto that class.

- **Params:** `componentDefinition` — only `.name` (used in error messages and
  as the key) and `.code` are read. There is no declared parameter list for a
  custom component; `ParamType` and `defineComponent` (2745) are metadata for
  **built-in** components only.
- **Returns:** the `CustomComponent` class. `compileCustomComponents` (10086)
  compiles the definitions in order into a `customComponents` object keyed by
  name.
- **Notes on how your five functions are wired:**
  - `getAffectedCells(...args)` — copied into the injected slot if you define
    it. Default if you do not: `args => args[0]`, i.e. the first constructor
    argument after `name`. Its return value becomes both `cellIds` and `cells`,
    and it runs **before** `super()`, so it cannot touch `this`.
  - `setParams(instance, ...args)` — copied if defined, else a no-op. Called
    last in the constructor with the same arguments, `instance` prepended. This
    is the only route from constructor arguments to the instance.
  - `initialize(instance, puzzle)` — wraps the prototype method as
    `yield* initialize(this, facade)` then `yield* superInitialize.call(this, state)`,
    so your `initialize` runs first and the base's "run `update` once" runs
    after.
  - `update(instance, puzzle)` — replaces the prototype method outright, no
    super call.
  - `validate(instance, puzzle)` — replaces the prototype method and sets
    `validateDuringSolve` to `true`. Your boolean is converted to a result
    object.
  - All four are wrapped in try/catch; an exception is passed to
    `logConstraintError` (9911, a bare `console.error`) with a context string
    naming your component, and the generator simply ends. **A throw in `update`
    is silent apart from the console** — no deduction, no failure, the solve
    continues.
- **Notes on scope inside a component segment:** the names in scope are the
  common globals above, plus `env` (`{ verboseSolving }`), `helpers`,
  `customComponents` (the shared object of compiled custom classes — the way one
  component instantiates another), and every built-in component constructor by
  name (`HouseComponent`, `DifferentDigitsComponent`, … — `defineComponent`
  appends the `Component` suffix to every registered name, 2752). `puzzle`,
  `sudoku` and `input` are **not** in scope here; `puzzle` reaches you only as
  the second parameter of `initialize`/`update`/`validate`.

#### `registerCustomConstraint({ puzzle, input, helpers })`
`bundle.claude.js:10101`. The handler registered for `ConstraintType.Custom`.
Compiles all component segments, then runs your backend segment with:
the common globals, `env`, `puzzle` and `sudoku` (both the same
`PuzzleSetupView`), `input` (which is `input.input` — the constraint's own saved
input, e.g. its groups, **not** the wrapper object), `helpers`, every built-in
component constructor by name, and every compiled custom component spread by
name as a bare global.
- **Notes:** a compile failure logs and returns, leaving the constraint with no
  components; a throw in your backend code is caught and logged the same way, so
  a broken main code segment fails open — the puzzle solves as if the constraint
  did not exist. If `definition.backend.type !== "code"` nothing runs at all.


## Cell, corner, edge and outer-cell ids, connectivity, lines, misc

Everything in this section is pure coordinate arithmetic over the board's
dimensions — no puzzle state is read, so these calls are cheap and safe to make
anywhere in `update`. A component reaches them as `helpers.cellIds`,
`helpers.cornerIds`, `helpers.edgeIds`, `helpers.outerCellIds`,
`helpers.connectivity`, `helpers.lines` and `helpers.misc`. The first five come
from the base factory `createHelpers(spec)` (`bundle.claude.js:1614`);
`lines` and `misc` exist **only** on the object built by
`createExtendedHelpers(spec, sudokuState)` (`bundle.claude.js:9201`), which
spreads the base helpers and adds `lines`, `misc`, and a region-aware
`geometry`. Built-in components use `helpers.lines` and `helpers.misc` freely,
so the extended object is what a solving component receives; a bare
`createHelpers` result would not have them.

The four id schemes are all row-major integers, but over four different
lattices: cells over `width`, corners over `width + 1`, edges over
`2 * width` per row, outer cells over `width + 2`. Never mix an id from one
scheme into a call belonging to another — they are all plain numbers, so
nothing will throw.

### helpers.cellIds (class CellIds)

`bundle.claude.js:3`. Cell ids are row-major over the grid:
`cellId = x + y * width`, so id 0 is the top-left cell and x, y are 0-based
with y growing downward. A cell occupies the unit square `[x, x+1] x [y, y+1]`
in board coordinates. Fields: `spec`, `width`, `height`.

#### `getX(cellId)`
Column of the cell, `cellId % width`. No range check; a negative or
out-of-range id yields garbage rather than `undefined`.

#### `getY(cellId)`
Row of the cell, `Math.floor(cellId / width)`.

#### `getCoordsFromId(cellId)`
Converts a cell id to its 0-based column and row via `getX`/`getY`. **[read]**
- **Returns:** a plain object `{x, y}` (not a `Vector2`).

#### `getIdFromCoords(coords)`
Unchecked inverse: `coords.x + coords.y * width`.
- **Notes:** off-grid coords silently produce a wrong in-range id (e.g.
  `{x: -1, y: 3}` gives the last cell of row 2). Use the Safe variant when the
  coords come from an offset walk.

#### `getIdFromCoordsSafe(coords)`
Same, but bounds-checked.
- **Returns:** the cell id, or `undefined` when `x` or `y` is outside
  `[0, width)` / `[0, height)`.

#### `areValidCoords({x, y})`
True when the coords lie on the board. The bounds test behind
`getIdFromCoordsSafe`.

#### `getAllCellIds()`
Lists every cell id on the board. **[read]**
- **Returns:** a fresh `Array` `[0, 1, …, width*height - 1]`, in reading order.
  An array, not a generator, so it can be reused and indexed.

#### `getCellCenterFromId(cellId)`
Geometric centre of the cell as `{x: getX(cellId) + 0.5, y: getY(cellId) + 0.5}`.
Board units, not pixels. This half-offset is the convention every other id
scheme in this section is defined against.

### helpers.cornerIds (class CornerIds)

`bundle.claude.js:497`. Corners are the lattice points of the grid: integer
`(x, y)` with `x` in `[0, width]` and `y` in `[0, height]`, numbered row-major
over a lattice one wider than the cell grid — `cornerId = x + y * (width + 1)`.
Corner `(x, y)` is the **top-left** corner of cell `(x, y)`, so corner id 0 is
the board's top-left point and the corner ids are *not* interchangeable with
cell ids past the first row. Fields: `spec` (and `cellIdHelper`).

#### `getIdFromCornerCoords(cornerCoords)`
`cornerCoords.x + cornerCoords.y * (width + 1)`. Note the method name differs
from the `getIdFromCoords` used by the other three helpers.
- **Notes:** unchecked; no Safe variant exists.

#### `getCoordsFromId(cornerId)`
Converts a corner id to grid-point coordinates on the (width+1) by (height+1) lattice of cell corners. **[read]**
- **Returns:** `{x: cornerId % (width + 1), y: Math.floor(cornerId / (width + 1))}`,
  a plain object.
- **Notes:** the consumer that fixes this convention is
  `helpers.geometry.getCellsTouchingCorner` (`bundle.claude.js:1088`), which
  yields the cells at the four offsets `(-1,-1), (0,-1), (-1,0), (0,0)` from
  the corner coords, dropping those off-board.

### helpers.edgeIds (class EdgeIds)

`bundle.claude.js:659`. An edge is the border between two orthogonally adjacent
cells, identified by its **midpoint** in board coordinates: a vertical edge has
integer `x` and half-integer `y`, a horizontal edge half-integer `x` and
integer `y`. Ids are laid out in blocks of `2 * width` per grid row: within the
block for row `r`, the first `width` ids are the vertical edges at
`(x, r + 0.5)` for `x = 0 … width-1`, and the next `width` are the horizontal
edges at `(c + 0.5, r + 1)` for `c = 0 … width-1`. So the id space is
`2 * width * height` slots, addressing each cell's left border and bottom
border. Fields: `spec` (and `cellIdHelper`).

#### `getIdFromCoords(coords)`
Encodes an edge midpoint: `Math.floor(coords.x) + (coords.y - 0.5) * width * 2`.
- **Params:** `coords` – edge midpoint, e.g. `{x: 3, y: 1.5}` for the border
  between cells (2,1) and (3,1), or `{x: 2.5, y: 4}` for the border between
  (2,3) and (2,4).
- **Notes:** unchecked, and the right-hand board border is **not**
  representable — `{x: width, y: r + 0.5}` encodes to the same id as the
  horizontal edge `{x: 0.5, y: r + 1}`. Stay inside `x < width`;
  `helpers.misc.getEdgesForNegativeConstraint` only ever emits interior edges
  (`x` from 1 to `width-1`, `y` from 1 to `height-1`), which is the safe range.

#### `getCoordsFromId(edgeId)`
Inverse of the above, branching on whether `edgeId % (width * 2) < width`.
- **Returns:** `{x: edgeId % width, y: floor(edgeId / (2*width)) + 0.5}` for a
  vertical edge, else `{x: 0.5 + (edgeId % width), y: floor(edgeId / (2*width)) + 1}`
  for a horizontal one. Plain object.
- **Notes:** which of the two cells an edge separates is read from
  `helpers.geometry.getCellsTouchingEdge` (`bundle.claude.js:1101`), which
  floors and ceils `(x - 0.5, y - 0.5)`.

### helpers.outerCellIds (class OuterCellIds)

`bundle.claude.js:1404`. Outer cells are the clue positions in the one-cell
ring around the board, addressed in a coordinate system where the grid itself
is `0 … width-1` / `0 … height-1` and the ring is `x = -1` or `x = width`,
`y = -1` or `y = height`, including the four diagonal corner slots. Ids are
row-major over that padded `(width + 2) x (height + 2)` lattice:
`id = (x + 1) + (y + 1) * (width + 2)`, so id 0 is the top-left corner clue
slot. Fields: `width`, `height`. A side is an `OuterPosition` enum value
(`bundle.claude.js:677`): `Top 0, Right 1, Bottom 2, Left 3, TopLeft 4,
TopRight 5, BottomRight 6, BottomLeft 7`.

#### `getX(outerCellId)`
`(outerCellId % (width + 2)) - 1`. Returns `-1` for the left ring column.

#### `getY(outerCellId)`
`Math.floor(outerCellId / (width + 2)) - 1`. Returns `-1` for the top ring row.

#### `getIdFromCoords(coords)`
`coords.x + 1 + (coords.y + 1) * (width + 2)`. Unchecked; no Safe variant.

#### `getCoordsFromId(outerCellId)`
Converts an outer-cell id to its coordinates in the ring around the board. **[read]**
- **Returns:** a **`Vector2` instance**, not a plain object — unlike
  `cellIds.getCoordsFromId`. It still reads as `{x, y}` but carries the
  `Vector2` mutating methods (`add`, `scale`, …), so cloning it before
  arithmetic matters.

#### `getCellCenterFromId(outerCellId)`
Gives the centre point of an outer-cell slot. **[read]**
- **Returns:** `Vector2(x + 0.5, y + 0.5)`, the centre of the outer slot in the
  same board units as `cellIds.getCellCenterFromId`.

#### `getSide(outerCellId)`
Which side of the board the clue sits on.
- **Returns:** an `OuterPosition` value, via `getSideFromCoords`.

#### `getAllAttributes(outerCellId)`
One-call decode.
- **Returns:** `{x, y, side}` — the ring coords plus the `OuterPosition`. This
  is what `helpers.geometry.getCoordsPointedAtByOuterClue` consumes to walk the
  row, column or diagonal a clue points down.

#### `getSideFromCoords(coords)`
Classifies ring coords: `y < 0` gives `TopLeft` / `Top` / `TopRight` by `x`;
`y >= height` gives the Bottom trio; otherwise `x >= width` gives `Right`.
- **Notes:** the final fallback is `Left`, with no check that `x < 0`. Any
  **interior** cell's coords therefore classify as `Left`. Only pass coords you
  know are on the ring.

### helpers.connectivity (class ConnectivityHelper)

`bundle.claude.js:478`. One method, wrapping the internal `LineGraph`
(`bundle.claude.js:250`) — an undirected adjacency-map graph. Fields: `spec`,
`geometryHelper`.

#### `getOrthogonallyConnectedGroups(cells)`
Splits a set of cells into its orthogonally connected components. It builds a
`LineGraph` with one point per cell and an edge for each orthogonally adjacent
pair that is *also* in the input set, then returns the components.
- **Params:** `cells` – any iterable of cell ids. It is iterated more than
  once, so pass an array or `Set`, never a generator.
- **Returns:** a **generator of `LineGraph` objects**, not of cell arrays. Call
  `.getPoints()` on each to get its cell ids: `for (const g of
  helpers.connectivity.getOrthogonallyConnectedGroups(cells)) { const ids =
  g.getPoints(); … }`. A single cell with no neighbours still yields its own
  one-point graph.
- **Notes:** diagonal adjacency is never considered. Cost is linear in the
  input; the graph is rebuilt on every call, so hoist it out of a per-candidate
  loop.

The `LineGraph` instances that come back are worth knowing a little about:
`getPoints()` (array of points), `getPointsAdjacentTo(p)` (a `Set`),
`getPointCount()`, `isEmpty()`, `hasEdge(a, b)`, `getEdges()` (generator, each
undirected edge once), `hasCycles()`, `isSimpleLines()` (true when no point has
three or more neighbours), and `toArrays()` (traces the graph into arrays of
points, starting from degree-1 endpoints; it throws
`"This should never happen"` after 1000 steps). Non-number points are interned
by structural key, so `{x, y}` objects compare by value.

### helpers.lines (class LinesHelper)

`bundle.claude.js:9135`. **Extended helpers only** (`createExtendedHelpers`,
`bundle.claude.js:9201`); absent from the base `createHelpers` result.
Stateless — no constructor, no fields. A
"line" here is just an ordered `Array` of cell ids; nothing validates that the
cells are actually adjacent.

#### `getLineEnds(lineCells)`
Picks the first and last cell of a line. **[read]**
- **Returns:** `[lineCells[0], lineCells.at(-1)]`. On a one-cell line both
  entries are that same cell; on an empty array both are `undefined`.

#### `getCellsBetweenLineEnds(lineCells)`
Drops a line's two end cells and keeps the interior. **[read]**
- **Returns:** `lineCells.slice(1, -1)` — a new array of the interior cells,
  empty for lines of length 2 or less.

#### `*getAllPairsAlongLines(lines)`
Every consecutive pair along every line.
- **Params:** `lines` – iterable of cell-id arrays.
- **Returns:** generator yielding `[cellA, cellB]` two-element arrays. Order is
  line by line, then along each line; no de-duplication if two lines share a
  pair.

### helpers.misc (class MiscHelper)

`bundle.claude.js:9148`. **Extended helpers only**, same as `lines`. Holds
`cellIdHelper`, `edgeIdHelper`, `outerCellIdHelper`, `cornerIdHelper`,
`geometryHelper` and `spec`; note the constructor is handed the *base*
`geometry`, not the region-aware one the extended object exposes.

#### `*getEdgesForNegativeConstraint(existingClues)`
Yields every interior edge of the board that does **not** already carry a clue —
the enumeration a negative-constraint rule ("every unmarked border is not a
domino") needs.
- **Params:** `existingClues` – iterable of clue objects, each with an `.edge`
  property holding an edge id. Only that property is read.
- **Returns:** generator of edge ids, in row-major order, vertical edge before
  horizontal edge per cell.
- **Notes:** it walks each cell and emits the edge to its right
  (`x = column + 1`, when `column < width - 1`) and the edge below it
  (`y = row + 1`, when `row < height - 1`), so board-boundary edges are never
  yielded. That is also the canonical demonstration of the safe edge-coordinate
  range.

#### `getCellGroupsFromLines(lines)`
Merges lines that share cells into connected groups — the "all lines touching
each other form one shape" step.
- **Params:** `lines` – array of cell-id arrays; each becomes a path in a
  `LineGraph`.
- **Returns:** an `Array` of arrays of cell ids, one per connected component.
  Unlike `connectivity.getOrthogonallyConnectedGroups`, this returns plain cell
  arrays, and connectivity comes from line membership, not board adjacency.
- **Notes:** a cell appearing in two lines fuses those lines into one group.
  Cells not on any line never appear.


## Geometry

Everything here is reached as `helpers.geometry` inside a component. It turns
one cell/corner/edge/outer-clue id into the cells around it, and enumerates
whole-board patterns (rows, dominoes, knight pairs, 2x2 quadruples). It knows
only the board rectangle and — in the subclass — the region layout; it never
reads candidates, so nothing here is affected by solve state except
`getSubsetsPerRegion`.

Two conventions run through the whole section. **Cell ids are
`y * width + x`**, 0-based, and coordinates are plain `{x, y}` objects with
`x` a column and `y` a row, both 0-based. **Almost every member is a
generator**: it yields lazily, is consumed by one walk, and must be re-called
rather than re-iterated. The two exceptions are `getCellsTouchingEdge`,
`getManhattanDistanceBetweenCells` and `getCellsAreKingsMoveApart`, which
return values, plus `getSubsetsPerRegion` on the subclass.

### `helpers.geometry` (class `RegionAwareGeometryHelper extends GeometryHelper`)

`GeometryHelper` is `bundle.claude.js:913`; `RegionAwareGeometryHelper` is
`bundle.claude.js:9114`. What a component actually receives is the subclass:
`createExtendedHelpers` (`bundle.claude.js:9201`) builds
`geometry: new RegionAwareGeometryHelper(sudokuState, …)` and puts it on the
helpers object, so every base method below plus `getSubsetsPerRegion` is
available. Fields: `spec` (the puzzle spec), `width` and `height` (copied from
`spec.size` at construction, so a component can read `geometry.width` directly),
and the four id helpers `cellIdHelper`, `edgeIdHelper`, `cornerIdHelper`,
`outerCellIdHelper`; the subclass adds `sudoku` (the solver's sudoku state).

#### `getAdjacentCells(cellId, includeDiagonals = false)`
Yields the cells touching `cellId`, orthogonals first, then diagonals if asked.
- **Returns:** generator of cell ids. Never includes `cellId` itself.
- **Notes:** pure delegation to the two methods below, so the order is
  left, up, right, down, then up-left, up-right, down-left, down-right.

#### `getOrthogonallyAdjacentCells(cellId)`
Yields the up-to-four edge-sharing neighbours.
- **Returns:** generator of cell ids, in the order left, up, right, down.
- **Notes:** silently drops neighbours off the board, so a corner cell yields
  two. Excludes `cellId`.

#### `getDiagonallyAdjacentCells(cellId)`
Yields the up-to-four corner-sharing neighbours.
- **Returns:** generator of cell ids, ordered up-left, up-right, down-left,
  down-right. Off-board neighbours are dropped; `cellId` is excluded.

#### `getCellsInRow(rowIndex)`
Yields the whole row left to right.
- **Params:** `rowIndex` – 0-based row (a `y`).
- **Returns:** generator of `width` cell ids.
- **Notes:** no range check — an out-of-range `rowIndex` yields ids that are
  arithmetically valid but off the board.

#### `getCellsInColumn(columnIndex)`
Yields the whole column top to bottom.
- **Params:** `columnIndex` – 0-based column (an `x`).
- **Returns:** generator of `height` cell ids. Same absence of range checking.

#### `getCellsInRowOfCell(cellId)`
Yields the full row containing `cellId`, left to right.
- **Returns:** generator of cell ids. **Includes `cellId` itself** — filter it
  out yourself when building a "sees" relation.

#### `getCellsInColumnOfCell(cellId)`
Yields the full column containing `cellId`, top to bottom, `cellId` included.

#### `getCellsKnightsMoveAwayFromCell(cellId)`
Yields the up-to-eight cells a chess knight's move from `cellId`.
- **Returns:** generator of cell ids, in offset order `(-1,-2) (+1,-2)
  (-2,-1) (+2,-1) (-2,+1) (+2,+1) (-1,+2) (+1,+2)` as `(dx, dy)`.
- **Notes:** off-board moves dropped; `cellId` excluded.

#### `getCoordsInDiagonal(diagonalType, startX)`
Walks one diagonal downward from row 0, yielding coordinates.
- **Params:** `diagonalType` – a `DiagonalType` member. `startX` – optional
  column on row 0 to start from; defaults to `0` for `NegativeDiagonal` and
  `width - 1` for `PositiveDiagonal`.
- **Returns:** generator of `{x, y}` objects, one per row, `y` ascending from
  0. `NegativeDiagonal` steps `x` by `+1` per row (down-right), so the default
  is the main top-left-to-bottom-right diagonal; `PositiveDiagonal` steps `-1`
  (down-left), default the top-right-to-bottom-left diagonal.
- **Notes:** breaks as soon as `x` leaves the board, so an off-centre `startX`
  yields a short diagonal. It always starts at `y = 0`; there is no way to
  start a diagonal partway down the board.

#### `getCellsInDiagonal(diagonalType, startX)`
Same walk as `getCoordsInDiagonal`, yielding cell ids instead of coords.

#### `getAllRows()`
Yields each row of the board as an array.
- **Returns:** generator of arrays of cell ids, top row first, each array
  `width` long and in left-to-right order.
- **Notes:** the arrays are materialised (`[...getCellsInRow(i)]`), the outer
  sequence is not. Rows span the board edge to edge, including any frame/ring
  cells (verified by live probe). Coerce the yielded ids with `| 0` before
  heavy use: ids derived from board arithmetic cost the solver about 1.2x per
  candidate read until they are plain integers again.

#### `getAllColumns()`
Yields each column as an array of cell ids, leftmost first, top-to-bottom
within each.

#### `getAllPairsWithOffset(offsetX, offsetY)`
Yields every cell paired with the cell at a fixed offset from it.
- **Params:** `offsetX`, `offsetY` – the displacement in columns and rows; may
  be negative.
- **Returns:** generator of 2-element arrays `[baseCellId, offsetCellId]`,
  scanned in reading order (rows top to bottom, columns left to right by the
  base cell). Pairs whose offset cell falls off the board are skipped.
- **Notes:** one direction only — it never also yields the reversed pair, which
  is why the wrappers below pick a half-set of offsets to get each unordered
  pair exactly once.

#### `getAllDominoes()`
Every orthogonally adjacent pair, each unordered pair once: all horizontal
pairs (offset `1,0`) first, then all vertical pairs (offset `0,1`). Generator
of `[cellId, cellId]`.

#### `getAllDiagonallyAdjacentPairs()`
Every diagonally adjacent pair once: offset `1,-1` (up-right) then `1,1`
(down-right). Generator of `[cellId, cellId]`.

#### `getAllKingsMovePairs()`
Every king-move pair once: offsets `1,0`, `0,1`, `1,-1`, `1,1`, in that order.
Generator of `[cellId, cellId]`.

#### `getAllKnightMovePairs()`
Every knight-move pair once: offsets `1,-2`, `1,2`, `2,-1`, `2,1`, in that
order. Generator of `[cellId, cellId]`.

#### `getAllQuadruples()`
Yields every 2x2 block of cells on the board.
- **Returns:** generator of 4-element arrays ordered top-left, top-right,
  bottom-left, bottom-right — reading order within the block, *not* clockwise.
- **Notes:** iterates `rowIndex < height - 1` and `columnIndex < width - 1`, so
  there are `(width-1) * (height-1)` of them, indexed by their top-left cell.

#### `getCellsTouchingCorner(cornerId)`
Yields the up-to-four cells meeting at a corner point.
- **Params:** `cornerId` – a corner id (corner `(x, y)` is the top-left corner
  of cell `(x, y)`).
- **Returns:** generator of cell ids, ordered top-left, top-right, bottom-left,
  bottom-right. Cells off the board are dropped, so a board-corner yields one.
- **Notes:** it builds a local `touchingCells` array, never pushes to it, and
  `return`s it as the generator's (normally discarded) return value — dead
  code, ignore it.

#### `getCellsTouchingEdge(edgeId)`
Returns the two cells sharing an edge.
- **Params:** `edgeId` – an edge id; edge coords have one half-integer
  component (`{x: 2, y: 1.5}` is vertical, `{x: 1.5, y: 2}` horizontal).
- **Returns:** a plain **array** of exactly two cell ids — not a generator.
  Left then right for a vertical edge, top then bottom for a horizontal one.
- **Notes:** uses the unchecked `getIdFromCoords`, so a border edge produces a
  bogus id rather than `undefined`. Validate the edge before calling.

#### `getCoordsPointedAtByOuterClue(outerCellId, diagonalType)`
Walks the board from an outer clue in the direction that clue points, yielding
coordinates.
- **Params:** `outerCellId` – an outer-cell id (the ring one step outside the
  grid). `diagonalType` – optional `DiagonalType`; omit for the straight
  row/column ray.
- **Returns:** generator of `{x, y}` coords. The outer clue's own position is
  never yielded.
- **Notes (straight, `diagonalType` omitted)** — the ray runs inward from the
  clue and crosses the whole board: `Top` walks down its column, `y` 0 →
  `height-1`; `Bottom` walks up its column, `y` `height-1` → 0; `Left` walks
  right along its row, `x` 0 → `width-1`; `Right` walks left along its row,
  `x` `width-1` → 0. The four corner positions ignore the clue's own `x`/`y`
  and walk a main diagonal of length `min(width, height)`.
- **Notes (diagonal):** the step comes from the table `OuterClueDiagonalSteps`
  (`bundle.claude.js:1221`) keyed `` `${side}_${diagonalType}` ``; the walk
  starts by *adding* the step to the clue's coords, then continues until it
  leaves the board. Several combinations are deliberately `undefined` — a
  corner clue only has one sensible diagonal — and for those the generator
  **yields nothing at all** (early `return`), it does not throw. The live
  combinations: `Top`/`Left` + `NegativeDiagonal` step `(1,1)`; `Top` +
  `PositiveDiagonal` `(-1,1)`; `Bottom`/`Right` + `NegativeDiagonal` `(-1,-1)`;
  `Bottom`/`Left` + `PositiveDiagonal` `(1,-1)`; `Right` + `PositiveDiagonal`
  `(-1,1)`; `TopLeft`+`Negative` `(1,1)`; `TopRight`+`Positive` `(-1,1)`;
  `BottomLeft`+`Positive` `(1,-1)`; `BottomRight`+`Negative` `(-1,-1)`.

> Discrepancy (bundle bug, not a doc one): in the straight-ray branch the
> `BottomRight` case yields `{x: i, y: height-1-i}` — starting at the
> *bottom-left* corner and walking up-right — and `BottomLeft` yields
> `{x: width-1-i, y: height-1-i}`, starting at the bottom-right
> (`bundle.claude.js:1183` and `bundle.claude.js:1195`). The two corners are
> swapped relative to `TopLeft`/`TopRight`, which are correct. Don't trust a
> bottom-corner outer clue's straight ray. Also, all four corner cases assume
> a square board: they run `min(width, height)` steps along the true diagonal,
> which is not the visual diagonal of a non-square grid.

#### `getCellsPointedAtByOuterClue(outerCellId, diagonalType)`
Same walk as `getCoordsPointedAtByOuterClue`, yielding cell ids. Inherits every
note above, including the swapped bottom corners.

#### `getManhattanDistanceBetweenCells(cellA, cellB)`
Returns `|dx| + |dy|` between two cells as a number. Zero for a cell against
itself.

#### `getCellsAreKingsMoveApart(cellA, cellB)`
Returns `true` when the two cells are within one king's move.
- **Notes:** explicitly `false` when `cellA` and `cellB` are the same cell, so
  it means "adjacent including diagonally", not "within a king's move" in the
  reflexive sense.

#### `getSubsetsPerRegion(cellIds)`
Buckets a set of cells by which region each lives in. Subclass-only
(`bundle.claude.js:9125`).
- **Params:** `cellIds` – any iterable of cell ids; duplicates are removed
  first via `new Set(...)`.
- **Returns:** a `Map` from region id to an array of the cell ids in that
  region. Not a generator. Map insertion order follows first appearance in the
  deduped input; each array is in that same order.
- **Notes:** region id comes from the sudoku state's `getRegionIdAt`, which
  returns **`-1` for a cell in no region** (`bundle.claude.js:8802`) — so a
  frame/ring cell buckets under key `-1` rather than being dropped. On a
  puzzle with no regions at all, everything lands in one `-1` bucket.

### `DiagonalType` (enum, `bundle.claude.js:697`)

Numeric enum with two members, and the values are the `x`-step used when
walking down a diagonal, which is why they are signed rather than 0/1.

| Member | Value | Direction walking downward |
|-|-|-|
| `PositiveDiagonal` | `1` | `x` decreases per row (down-left) |
| `NegativeDiagonal` | `-1` | `x` increases per row (down-right) |

> Note the inversion: `getCoordsInDiagonal` computes
> `xStep = diagonalType === NegativeDiagonal ? 1 : -1`, so the *step it uses*
> is the negation of the enum's own numeric value. Pass the named member;
> never pass a raw `1` or `-1` expecting it to be the step.

"Positive" and "negative" name the diagonal's slope in ordinary maths axes
(`y` up), not in the board's `y`-down coordinates. `PositiveDiagonal` is the
bottom-left-to-top-right diagonal; `NegativeDiagonal` is the classic
top-left-to-bottom-right one. The same words appear in `HouseType` as
`DiagonalPlus` / `DiagonalMinus` (`bundle.claude.js:688`), which are string
values, not these numbers.

### `OuterPosition` (enum, `bundle.claude.js:677`)

Numeric enum naming which side of the board an outer-clue cell sits on. It is
what `helpers.outerCellIds.getSide(id)` and the `side` field of
`getAllAttributes(id)` return, and the thing `getCoordsPointedAtByOuterClue`
switches on.

| Member | Value |
|-|-|
| `Top` | `0` |
| `Right` | `1` |
| `Bottom` | `2` |
| `Left` | `3` |
| `TopLeft` | `4` |
| `TopRight` | `5` |
| `BottomRight` | `6` |
| `BottomLeft` | `7` |

- **Notes:** the sides run clockwise from `Top`, but the corners do **not**
  continue that rotation — `BottomRight` (6) precedes `BottomLeft` (7). Never
  derive a corner from arithmetic on a side value. Reverse lookup works
  (`OuterPosition[0] === "Top"`) because the enum is the usual TypeScript
  double-mapped object. The side is derived purely from coordinates by
  `getSideFromCoords` (`bundle.claude.js:1435`): `y < 0` gives the `Top` band,
  `y >= height` the `Bottom` band, and within each band an `x` outside
  `[0, width)` promotes it to the corresponding corner; a clue with in-range
  `y` is `Right` if `x >= width` and otherwise `Left`, so an outer id with
  fully in-range coords reports `Left`.


## Sums, X-sums, digits and naming

Four helper namespaces reached from the `helpers` object a component is built
with: `helpers.sums`, `helpers.xSums`, `helpers.digits` and `helpers.naming`.
All four are constructed once per puzzle by `createHelpers(spec)`
(`bundle.claude.js:1614`) and shared; nothing here touches puzzle state, so
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


## Digit sets and utility globals

Every name in this section is a bare global inside custom component code and
inside a `backend.code` block — no import, no `helpers.` prefix. They come from
`getCustomConstraintGlobals` (`bundle.claude.js:9972`), which returns exactly
`MathUtils`, `Vector2Funcs`, `CombinatoricUtils`, `ArrayUtils`, `SetUtils`,
`IterationUtils`, `SudokuDigitSet`, `SmallNumberSet`, `DigitSet` (an alias for
the same `SudokuDigitSet` class), `DiagonalType` and `OuterPosition`.
`runCustomCodeWithGlobals` (`bundle.claude.js:9987`) compiles your source as
`new Function(...Object.keys(globals), code)` and applies it with the matching
values, so the globals are ordinary function parameters: shadowing one with a
local `const` of the same name is legal and silently hides it.
`compileCustomComponentClass` (`bundle.claude.js:9990`) spreads the same object
and adds `env`, `helpers`, `customComponents`, every built-in component
constructor by name, and the `__`-prefixed internals; the constraint-level call
site (`bundle.claude.js:10119`) adds `puzzle`, `sudoku` (the same object) and
`input` on top. Because the code runs through `new Function`, it is evaluated in
global scope: `window`, `Math`, `Set` and friends are reachable, but nothing
module-local from the bundle is.

### `SmallNumberSet` (global `SmallNumberSet`)

A set of small non-negative integers stored as a single 32-bit bitmask, at
`bundle.claude.js:541`. Bit `d` is member `d`, so digit 1 is bit 1 and bit 0 is
unused in sudoku puzzles. One public field, `mask`, the raw bitmask; it is
readable and writable. The constructor takes `initialMask` and coerces it with
unary `+`, so `new SmallNumberSet(otherSet)` works and copies, since `valueOf`
returns the mask. Iteration is ascending: `[...set]` yields members lowest
first. The class is the base for `SudokuDigitSet`; the mutating operators return
`this` for chaining, but `add`, `delete` and `clear` return `undefined`.

#### `get size()`
Number of members, via a `popCount` of the mask.
- **Returns:** number.

#### `add(numberToAdd)`
Sets bit `numberToAdd`.
- **Mutates:** the receiver. **Returns:** `undefined`, not `this`.

#### `delete(numberToDelete)`
Clears bit `numberToDelete`.
- **Mutates:** the receiver. **Returns:** `undefined`.
- **Notes:** no report of whether the member was present, unlike `Set.delete`.

#### `clear()`
Sets the mask to 0.
- **Mutates:** the receiver. **Returns:** `undefined`.

#### `union(otherSet)`
In-place OR of `otherSet` into the receiver.
- **Params:** `otherSet` – anything whose `valueOf()` is a bitmask, so another
  set or a plain number both work.
- **Returns:** `this`. **Mutates:** the receiver.
- **Notes:** this is the one that trips people up — it is not `a ∪ b` as a new
  set. `a.union(b)` changes `a`. Copy first: `new DigitSet(a).union(b)`.

#### `intersect(otherSet)`
Keeps only the digits present in both sets, by ANDing the masks in place. **[read]**
- **Returns:** `this`. **Mutates:** the receiver.

#### `xor(otherSet)`
In-place XOR: members in exactly one of the two.
- **Returns:** `this`. **Mutates:** the receiver.

#### `subtract(otherSet)`
In-place AND-NOT: removes every member of `otherSet`.
- **Returns:** `this`. **Mutates:** the receiver.

#### `has(number)`
Whether bit `number` is set.
- **Returns:** boolean. Does not mutate.

#### `equals(otherSet)`
Mask equality, using `+otherSet`.
- **Returns:** boolean.

#### `isSubsetOf(otherSet)`
True when every member of the receiver is in `otherSet`.
- **Returns:** boolean. Equal sets count as subsets.

#### `isSupersetOf(otherSet)`
True when the receiver contains every member of `otherSet`.
- **Returns:** boolean. Equal sets count as supersets.

#### `isDisjointFrom(otherSet)`
True when the masks share no bit.
- **Returns:** boolean.

#### `intersects(otherSet)`
True when the masks share at least one bit — the negation of `isDisjointFrom`.
- **Returns:** boolean.

#### `valueOf()`
The raw bitmask.
- **Returns:** number. This is what makes `+set`, `set | other`, `set & other`
  and `` `${+set}` `` work, and what every method above calls on its argument.
- **Notes:** there is no `toString` override, so `` `${set}` `` prints the
  number too (string coercion falls back to `valueOf` for a plain object). Use
  `+set` when you want the mask explicitly.

#### `getSmallestNumber()`
The lowest member.
- **Returns:** number, or `undefined` when the set is empty.

#### `getLargestNumber()`
The highest member.
- **Returns:** number, or `undefined` when the set is empty.

#### `[Symbol.iterator]()`
Yields members in ascending order, clearing the lowest set bit each step.
- **Returns:** generator of numbers. Works with `for…of`, spread and
  `Array.from`. It reads `this.mask` once at the start, so mutating the set
  mid-loop does not affect the remaining iteration.

#### `static from(numbers)`
Builds a set from any iterable of numbers.
- **Returns:** a new instance of the class it is called on — `new this(...)` —
  so `SudokuDigitSet.from([1,2,3])` gives a `SudokuDigitSet`.

#### `static getUnion(sets)`
Union of an iterable of sets.
- **Returns:** a new set. Does not mutate the inputs.

#### `static getIntersection(sets)`
Intersection of an iterable of sets.
- **Returns:** a new set.
- **Notes:** it starts from `2147483647` (all 31 low bits), so the intersection
  of an empty list is that full mask, not the empty set. Its size is 31.

### `SudokuDigitSet` (globals `SudokuDigitSet` and `DigitSet`)

`bundle.claude.js:619`. A `SmallNumberSet` with two renamed accessors and
nothing else added — no digit-range awareness of its own, so a `SudokuDigitSet`
can hold bit 0 or bit 12 if you put them there. The puzzle's actual digit range
lives on `helpers.digits`, whose `createFullDigitSet`, `createEvensDigitSet`,
`createOddsDigitSet`, `createModuloDigitSet(divisor, remainder)` and
`createFilteredDigitSet(predicate)` all return fresh `SudokuDigitSet`s built
inside the puzzle's min/max. The candidate masks on solver state are plain
numbers in the same bit convention, so `new DigitSet(cell.candidates)` is the
standard bridge.

#### `getSmallestDigit()`
Alias for `getSmallestNumber()`.
- **Returns:** number, or `undefined` when empty.

#### `getLargestDigit()`
Alias for `getLargestNumber()`.
- **Returns:** number, or `undefined` when empty.

### `MathUtils` (global `MathUtils`)

Scalar helpers, defined at `bundle.claude.js:767` as a plain object of free
functions. Nothing here is sudoku-specific.

#### `sum(numbers)`
Adds an iterable of numbers, starting at 0. **Returns:** number.

#### `product(numbers)`
Multiplies an iterable of numbers, starting at 1. **Returns:** number.

#### `mod(dividend, divisor)`
Euclidean remainder, `((a % b) + b) % b`. **Returns:** number, non-negative for
a positive divisor — unlike JavaScript's `%`, which keeps the sign of the
dividend.

#### `clamp(value, minValue, maxValue)`
`Math.min(Math.max(min, value), max)`. **Returns:** number. With `min > max` the
maximum wins.

#### `lerp(startValue, endValue, fraction)`
Linear interpolation, `start + (end - start) * fraction`. **Returns:** number.
The fraction is not clamped.

#### `triangularNumber(count)`
`count * (count + 1) / 2` — the sum 1..count, which is the standard minimum for
a killer cage of that many distinct digits starting at 1. **Returns:** number.

#### `isPrime(number)`
Primality by trial division over odd divisors, with a lookup table below 87 and
a memo `Map` above it. **Returns:** boolean.
- **Notes:** 0, 1 and negatives return false via the small-primes set. The cache
  grows without bound, which is fine at sudoku scale.

#### `getFactors(number)`
Full prime factorization, small primes first then odd candidates upward.
**Returns:** array of primes with multiplicity, e.g. 12 gives `[2, 2, 3]`.
- **Notes:** throws `Error("Cannot factorize non-integers")` on a non-integer.
  Called with 0 it never terminates — 0 is divisible by every prime and the
  magnitude never reaches 1. Guard the zero case yourself.

#### `toDegrees(radians)`
Radians to degrees. **Returns:** number.

#### `toRadians(degrees)`
Degrees to radians. **Returns:** number.

### `Vector2Funcs` (global `Vector2Funcs`)

Free functions over plain `{x, y}` points, at `bundle.claude.js:896`. Every one
of them takes and returns plain objects and mutates nothing — the mutating
`Vector2` class next to them is not exported to custom code. Cell coords from
`helpers.geometry` are exactly this shape, so these compose with it directly.

#### `getMagnitude(vector)`
`Math.hypot(x, y)`. **Returns:** number.

#### `normalized(vector)`
Unit vector in the same direction. **Returns:** a new `{x, y}`. A zero vector
gives `{x: NaN, y: NaN}`.

#### `scaled(vector, scaleFactor)`
Component-wise multiply by a scalar. **Returns:** a new `{x, y}`.

#### `sum(vectorA, vectorB)`
Component-wise addition. **Returns:** a new `{x, y}`. Note the name collision
with `MathUtils.sum`, which is a different thing entirely.

#### `difference(vectorA, vectorB)`
`a - b`, component-wise. **Returns:** a new `{x, y}`.

#### `scaledSum(vectorA, vectorB, scaleFactor)`
`a + b * scaleFactor`. **Returns:** a new `{x, y}`.

#### `getDistance(pointA, pointB)`
Euclidean distance. **Returns:** number.

#### `getDotProduct(vectorA, vectorB)`
`ax*bx + ay*by`. **Returns:** number.

#### `getAngle(vectorA, vectorB)`
Unsigned angle between two vectors, as `acos` of the dot product of their
normalizations. **Returns:** number in radians, 0 to π. Floating-point error can
push the argument just past ±1 and yield `NaN` for near-parallel inputs.

#### `getManhattanDistance(pointA, pointB)`
`|dx| + |dy|`. **Returns:** number. On integer cell coords this is the
king-free taxicab step count.

#### `getRotated(vector, angle)`
Rotation by `angle` radians. **Returns:** a new `{x, y}`.

#### `getClamped(point, rect)`
Clamps a point into a rect given as `{x, y, width, height}`. **Returns:** a new
`{x, y}`.

#### `compareVectors(pointA, pointB)`
Reading-order comparator: row first, then column. **Returns:** -1, 0 or 1, so it
drops straight into `Array.prototype.sort` for cell coords.

#### `isVectorGreaterThan(pointA, pointB)`
True when `a` comes after `b` in reading order. **Returns:** boolean.

#### `getAverage(points)`
Centroid of an iterable of points. **Returns:** a new `{x, y}`; an empty input
gives `{x: NaN, y: NaN}` (0/0).

### `SetUtils` (global `SetUtils`)

Helpers over native `Set` objects, at `bundle.claude.js:141`. Several accept an
options object `{comparator}`; when given, membership is decided by calling
`comparator(a, b)` pairwise instead of by identity, which costs O(n·m) but lets
you work with `{x, y}` coords and other structural values. Watch the in-place
versus copying split carefully — the names do not announce it.

#### `takeOne(sourceSet)`
Removes and returns the first element in iteration order.
- **Returns:** the element, or `undefined` on an empty set. **Mutates:**
  `sourceSet`.

#### `deleteAll(targetSet, itemsToDelete, options?)`
Removes every item of `itemsToDelete` from `targetSet`.
- **Returns:** `targetSet`. **Mutates:** `targetSet`.
- **Notes:** this is the in-place set difference. Its copying twin is
  `difference` below; the pair differs only in that. Pick `deleteAll` when you
  own the set, `difference` when you do not.

#### `difference(sourceSet, itemsToRemove, options?)`
Same removal, on a copy.
- **Returns:** a new `Set`. **Mutates:** nothing.

#### `symmetricDifference(leftCollection, rightCollection)`
Elements in exactly one of the two collections.
- **Returns:** a new `Set`.
- **Notes:** takes the fast path only when both arguments have a `has` method;
  otherwise it falls back to two `difference` calls unioned, so arrays work but
  cost more. No comparator option.

#### `filter(targetSet, otherSet)`
Retains in `targetSet` only what `otherSet.has`.
- **Returns:** `targetSet`. **Mutates:** `targetSet`. This is the in-place
  intersection, despite the name suggesting a predicate; it takes a set, not a
  function.

#### `intersection(sourceSet, otherSet)`
The same intersection, on a copy.
- **Returns:** a new `Set`. **Mutates:** nothing.

#### `addAll(targetSet, itemsToAdd)`
Adds every item of an iterable.
- **Returns:** `targetSet`. **Mutates:** `targetSet`.

#### `union(leftSet, rightSet)`
Copies the left set and adds every element of the right one (`unionOfSets`, `bundle.claude.js:99`). **[read]**
- **Returns:** a new `Set` with both sides' elements. **Mutates:** nothing.

#### `isEqual(leftSet, rightSet, options?)`
Size check, then `hasAll`.
- **Returns:** boolean.
- **Notes:** with a comparator the size check still uses raw `size`, so two sets
  that a loose comparator would call equal but that differ in cardinality
  return false.

#### `hasAll(containerSet, items, options?)`
Whether `containerSet` contains every item of the iterable.
- **Returns:** boolean. An empty `items` gives true.

#### `hasSome(containerSet, items, options?)`
Whether it contains at least one.
- **Returns:** boolean. An empty `items` gives false.

#### `hasSomeWhere(sourceSet, predicate)`
Whether any element satisfies `predicate`.
- **Returns:** boolean. This is the one that really takes a function.

### `IterationUtils` (global `IterationUtils`)

Iterable helpers, at `bundle.claude.js:197`. Three of the six are generators, so
their results are consumed once — spread them if you need to iterate twice.

#### `getOne(iterable)`
First element, by opening the iterator once.
- **Returns:** the element, or `undefined` when empty. Does not consume more
  than one step of a generator.

#### `getRange(startValue, endValue)`
Ascending integers, `start` up to but excluding `end`.
- **Returns:** generator of numbers. Empty when `start >= end`.

#### `getRangeInclusive(startValue, endValue)`
Same, including `end`. Use this one for digits: `getRangeInclusive(spec.minDigit,
spec.maxDigit)`.
- **Returns:** generator of numbers.

#### `getCombinations(items, size)`
Every combination of exactly `size` elements, in lexicographic index order.
- **Params:** `items` – any iterable; it is materialized to an array first.
- **Returns:** generator of arrays, each a fresh array.
- **Notes:** yields nothing when `size` exceeds the item count. `size` 0 yields
  one empty array and then stops. It combines by position, not by value, so
  duplicate items produce duplicate combinations. Cost is C(n, k) — fine for one
  cage, expensive if you nest it per cell per solve step.

#### `getCounts(items)`
Tallies occurrences.
- **Returns:** a `Map` from value to count, keyed by `Map` identity semantics.

#### `getBest(items, scoreFn, fallback)`
The element with the highest `scoreFn` value.
- **Returns:** the winning element, or `fallback` when `items` is empty.
- **Notes:** strictly greater wins, so the first of several tied maxima is kept.
  The initial best score is `-Infinity`, so an element scoring `-Infinity` never
  beats the fallback.

### `ArrayUtils` (global `ArrayUtils`)

Array helpers, at `bundle.claude.js:1825`. The same `{comparator}` option
appears throughout with the same meaning as in `SetUtils`. The in-place members
(`remove`, `removeWhere`, `removeFirst`, `removeFirstWhere`) all return the same
array they were handed, which makes an accidental aliasing bug easy to write.

#### `count(values, target, {comparator}?)`
How many elements equal `target`; the default comparator is `===`.
- **Returns:** number.

#### `countWhere(values, predicate)`
How many elements satisfy `predicate`. **Returns:** number.

#### `removeFirst(array, value, options?)`
Splices out the first occurrence.
- **Returns:** `array`. **Mutates:** `array`. A miss is a no-op.

#### `removeFirstWhere(array, predicate)`
Splices out the first match of `predicate`.
- **Returns:** `array`. **Mutates:** `array`.

#### `withoutAll(array, valuesToRemove, options?)`
Every element not in `valuesToRemove`.
- **Returns:** a new array. **Mutates:** nothing. Uses a `Set` for the
  comparator-free path.

#### `remove(array, valuesToRemove, options?)`
The same filtering, applied in place by emptying and refilling the array.
- **Returns:** `array`. **Mutates:** `array`. This and `withoutAll` are the
  array-side copy/in-place twin pair.

#### `removeWhere(array, predicate)`
Drops every element satisfying `predicate`, in place.
- **Returns:** `array`. **Mutates:** `array`.

#### `includesSome(array, values, options?)`
Whether any of `values` appears. **Returns:** boolean.

#### `includesEvery(array, values, options?)`
Whether all of `values` appear. **Returns:** boolean; empty `values` gives true.

#### `shuffled(array)`
Fisher-Yates on a copy, using `Math.random`.
- **Returns:** a new array. **Mutates:** nothing.
- **Notes:** non-deterministic, so keep it out of `update` if you want
  reproducible solve output.

#### `mapIterable(iterable, mapFn)`
Maps any iterable into an array. **Returns:** a new array. `mapFn` receives the
element only, no index.

#### `sliceWrapped(array, start, end)`
Slice with wraparound indexing, via Euclidean mod, so negative and
past-the-end indices wrap. Useful for cyclic lines and rings.
- **Returns:** a new array of length `end - start`, or `[]` for an empty input.
  Elements repeat when the span exceeds the array length.

#### `chunk(array, chunkSize)`
Splits into consecutive runs of `chunkSize`, the last possibly short.
- **Returns:** array of arrays.

#### `areSameLength(...arrays)`
Whether all arguments have equal length. **Returns:** boolean; true for no
arguments.

#### `hasDuplicates(array, options?)`
Whether any value repeats. **Returns:** boolean. The comparator path is O(n²).

#### `withoutDuplicates(array, options?)`
Deduplicates, keeping first occurrences.
- **Returns:** a new array. `Set`-based without a comparator, O(n²) with one.

#### `ensureArray(value)`
`Array.isArray(value) ? value : [value]`.
- **Returns:** an array. **Notes:** it does not copy an array input, so the
  result may alias the caller's array. It does not unwrap a `Set` either — a
  `Set` comes back wrapped as a single element.

#### `createFilledArray(length, fillValue)`
`new Array(length).fill(fillValue)`.
- **Returns:** a new array. **Notes:** every slot holds the same reference, so
  do not fill with an object or array you intend to mutate per index.

### `CombinatoricUtils` (global `CombinatoricUtils`)

One function, at `bundle.claude.js:3342`. This is the sum-combination search
behind killer-style reasoning.

#### `getCombinationsForSum(values, targetSum, minCount = 1, maxCount = Infinity)`
Every combination of distinct positions in `values` whose elements add to
`targetSum`, with a size between `minCount` and `maxCount`.
- **Params:** `values` – iterable of numbers, copied and sorted ascending
  internally. `targetSum` – the total to hit. `minCount`/`maxCount` – inclusive
  bounds on combination length.
- **Returns:** generator of arrays, each ascending, each a fresh array.
- **Notes:** no element is reused, and equal values at different positions are
  deduplicated, so `[1,1,2]` never yields `[1,1]` twice. It prunes on
  `value > remainingSum`, which assumes non-negative values — negatives break
  the pruning and the results. `targetSum` 0 yields the empty combination only
  when `minCount` is 0. A digit set needs converting first:
  `getCombinationsForSum([...digitSet], 15, 2, 2)`.

### `OuterPosition` (global `OuterPosition`)

A numeric enum of the eight outer-clue anchor positions, at
`bundle.claude.js:677`: `Top` 0, `Right` 1, `Bottom` 2, `Left` 3, `TopLeft` 4,
`TopRight` 5, `BottomRight` 6, `BottomLeft` 7. It is the usual TypeScript
two-way enum object, so `OuterPosition[0]` is the string `"Top"`. The geometry
helper uses it to turn an outer cell into the row, column or diagonal it points
along; the four corners are the diagonal cases.

### `DiagonalType` (global `DiagonalType`)

A numeric enum with two members, at `bundle.claude.js:697`: `PositiveDiagonal`
is `1` and `NegativeDiagonal` is `-1`. The values are the x-step direction used
when walking a diagonal, not arbitrary tags, so they can be multiplied into
coordinate arithmetic. Also two-way: `DiagonalType[1]` is `"PositiveDiagonal"`.
Beware the sign intuition — in screen coords, where y grows downward, the
"negative" diagonal is the one running top-left to bottom-right.


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
(`bundle.claude.js:2745`). Every registered constructor is spread into the
custom constraint's evaluation globals by name
(`...Object.fromEntries(getComponentConstructorsByName())`,
`bundle.claude.js:10069`), which is what makes those names resolve inside a
component or main code segment.

Two shapes recur. A **leaf** component extends `ConstraintComponent` and does
its own pruning in `update`. A **composite** extends `CompositeComponent`,
builds a list of leaf components in `initialize`, and deletes itself. A **pair**
extends `PairComponent` and delegates all pruning to a precomputed friend table,
supplying only `validate` and a constructor.

This section covers every such class whose registered display name (or class
name, when unregistered) sorts before `N`, in that order.

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
- **Notes** A real validate-only built-in: it prunes nothing and is still
  load-bearing, because `validateDuringSolve` puts it in the solver's
  per-state validation sweep (`bundle.claude.js:9045`). See the discrepancy on
  validate-only components above.

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
- **Notes** `SumComponent` picks this class only when the requested sums are
  *not* a contiguous range; a contiguous list goes to `SumRangeComponent`
  instead (`bundle.claude.js:7019`). Only `minSum` and `maxSum` reach the
  updater, so a disjoint list such as `[5, 20]` still prunes as the range 5–20
  during solving, and the exact membership is enforced only by `validate` once
  every cell is filled.

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

Unregistered leaf that `ProductComponent` uses when its product argument is an
array (`bundle.claude.js:6601`; dispatch at `bundle.claude.js:6578`). A single
positive product goes to `SingleProductComponent`, and a product of 0 becomes a
`RequiredDigitsComponent` for digit 0. Field: `products` (array of numbers).

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


## Built-in components, N to Z

Every constructor registered by `defineComponent` is injected as a global into
custom component and main code under its **`...Component`** name — `defineComponent`
appends the suffix if the display name lacks it, and the solver spreads
`getComponentConstructorsByName()` into the custom-code globals
(`bundle.claude.js:2745`, `bundle.claude.js:10069`). So the display name `Sum`
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
  each group is passed through `normalizeSameSumGroup` (`bundle.claude.js:7293`),
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
  (`describeSumsAsContiguousRange`, `bundle.claude.js:7038`) →
  `SumRangeComponent`; otherwise `ExactSumComponent`.
- **Notes:** a repeated cell counts N times, matching the registered description.
  The branch order matters: duplicates are resolved into weights before anything
  else, so the later branches never see a repeated cell. `allowRepeats` here
  means "these cells may legally hold the same digit", which is the opposite
  polarity of `getCellsSeeEachOther`.

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

#### `*filterCandidatesAtCell(digitMask, cell)`, `*filterCandidatesAtCells(digitMask, cells)`
Intersects the candidates of one cell, or of each listed cell, with `digitMask` via the matching `SolverState` method, yielding one result per cell. **[read]**

#### `*removeCandidatesFromCell(digitMask, cell)`, `*removeCandidatesFromCells(digitMask, cells)`
Clears the bits of `digitMask` from one cell's candidates, or from each listed cell's, yielding one result per cell. **[read]**

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

#### `*setValueAtCell(value, cell)`
Sets the cell's value as `ChangeApplier` does, but yields `[cell, result]` only when the result is not `unchanged`, after passing it through `ensureErrorMessage`. **[read]**

#### `*filterCandidatesAtCell(digitMask, cell)`, `*filterCandidatesAtCells(digitMask, cells)`
Intersects the candidates of one cell, or of each listed cell, with `digitMask` as `ChangeApplier` does, yielding `[cell, result]` only for a cell that actually changed, after `ensureErrorMessage`.
- **Notes:** the plural form loops the single-cell state method rather than calling the state's plural generator as `ChangeApplier` does. Same effect. **[read]**

#### `*removeCandidatesFromCell(digitMask, cell)`, `*removeCandidatesFromCells(digitMask, cells)`
Clears `digitMask` from one cell's candidates, or from each listed cell's, as `ChangeApplier` does, yielding `[cell, result]` only for a cell that actually changed, after `ensureErrorMessage`.
- **Notes:** same loop-versus-plural-generator difference from `ChangeApplier`, same effect. **[read]**

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

#### `filterCandidatesAtCell(digitMask, cellId)`, `*filterCandidatesAtCells(digitMask, cellIds)`
Intersects the candidate mask of one cell, or of each listed cell in turn, with `digitMask`, telling the candidate-set map about each digit removed and marking the cell dirty.
- **Returns:** for one cell, `UnchangedResult` if nothing was removed, a failed result for the cell if the mask emptied, otherwise `ChangedResult`; the plural form is a generator yielding one such result per cell.
- **Mutates:** the cell's `candidates`, `candidateSetMap`, `updateSet`. **[read]**

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

#### `createFailedResultForCell(cell)`, `createFailedResultForCells(cells, message)`
Builds a failed result: `{ type: "failed", cells: [cell] }` with no message for
one cell, or `{ type: "failed", cells: cells.slice(), message }` for a list;
the copy means the caller may keep mutating its own array.
`bundle.claude.js:1985` and `:1988`. **[read]**

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

## Utility functions and graph classes

This appendix covers the two undirected/directed graph classes the solver uses
for lines and thermometers, the remaining members of `LineGraph`,
`SmallNumberSet` and `Vector2`, and the ~65 free functions that sit underneath
the utility namespaces. A custom component reaches almost none of these by
name. `getCustomConstraintGlobals` (`bundle.claude.js:9971`) injects exactly
`MathUtils`, `Vector2Funcs`, `CombinatoricUtils`, `ArrayUtils`, `SetUtils`,
`IterationUtils`, `SudokuDigitSet`, `SmallNumberSet`, `DigitSet`,
`DiagonalType` and `OuterPosition` — so the top-level functions below are
reachable only through the namespace member that aliases them, and most of this
section exists so you can read a namespace member's real behaviour. Neither
graph class is a global; you can still hold a `LineGraph` instance, because
`helpers.connectivity.getOrthogonallyConnectedGroups` yields them
(`bundle.claude.js:486`). `Vector2` is not reachable at all — use `Vector2Funcs`.

Points in both graph classes are interned through `internStructuredValue`, so
`{x, y}` coords and other plain objects compare structurally rather than by
identity. Cell ids are 0-based; in a digit mask, bit `d` is digit `d`.

### `DirectedLineGraph` (not a global; internal, used by the Thermometer handler)

A directed multi-source graph, at `bundle.claude.js:11095`. Fields: `points`, a
`Set` of every interned point; `pointsAfter`, a `Map` from point to its
successor `Set`; `pointsBefore`, the same for predecessors. The constructor
takes an array of lines (each an array of points in order) and chains their
consecutive pairs. Both maps prune an entry when its set empties, and `points`
drops a point with no edges either way, so an isolated point cannot exist here
— unlike `LineGraph`, there is no `addPoint`.

#### `addLine(line)`
Adds a directed edge for every consecutive pair in `line`, front to back.
- **Returns:** `this`. **Mutates:** the receiver. A line of one point adds
  nothing at all, since there is no lone-point storage. **[read]**

#### `addEdge(fromPoint, toPoint)`
Interns both endpoints, then records `toPoint` as a successor of `fromPoint`
and `fromPoint` as a predecessor of `toPoint`.
- **Returns:** `this`. **Mutates:** the receiver. Duplicate edges are absorbed
  by the underlying `Set`. **[read]**

#### `removeEdge(fromPoint, toPoint)`
Removes the one directed edge, then drops either endpoint from `points` if it
is left with no edges in either direction.
- **Returns:** `this`. **Mutates:** the receiver. A missing edge is a no-op.
  Pruning is unconditional here, with no opt-out flag — `LineGraph.removeEdge`
  has one. **[read]**

#### `removePoint(point)`
Removes every outgoing and then every incoming edge of `point`, which also
evicts the point itself.
- **Returns:** `this`. **Mutates:** the receiver. Returns early if the point is
  absent. **[read]**

#### `hasEdge(fromPoint, toPoint)`
Whether the directed edge exists in that direction.
- **Returns:** boolean. Both arguments are interned first, so structural
  points work. **[read]**

#### `hasPoint(point)`
Whether the interned point is in the graph. **Returns:** boolean. **[read]**

#### `getPoints()`
Every point, in insertion order.
- **Returns:** a new array; mutating it does not touch the graph. **[read]**

#### `getPointsBefore(point)`
The predecessor set of `point`.
- **Returns:** the graph's own live `Set`, or a fresh empty `Set` when the
  point has no predecessors. Do not mutate the returned set.
- **Notes:** this does **not** intern its argument, unlike `hasEdge` and
  `hasPoint`. Pass a structural point that is not already the interned instance
  and you get the empty set. **[read]**

#### `getPointsAfter(point)`
The successor set, with the same live-set and no-interning caveats.
- **Returns:** the graph's own `Set`, or a fresh empty `Set`. **[read]**

#### `getPointCount()`
Size of `points`. **Returns:** number. **[read]**

#### `isEmpty()`
Whether the graph holds no points. **Returns:** boolean. **[read]**

#### `getEdges()`
Walks `pointsAfter` and yields each directed edge once.
- **Returns:** generator of `[fromPoint, toPoint]` pairs. **Mutates:** nothing.
  Unlike `LineGraph.getEdges` there is no comparator dedup — direction already
  makes each edge appear once. **[read]**

#### `hasMergePoints()`
Whether any point has more than one predecessor.
- **Returns:** boolean. This is the "two lines join here" test. **[read]**

#### `hasBranchPoints()`
Whether any point has more than one successor.
- **Returns:** boolean. **[read]**

#### `hasCycles()`
Depth-first search following successors, with a visited set and an on-stack
set; true when it re-enters a point still on the stack.
- **Returns:** boolean. **Mutates:** nothing.
- **Notes:** recursive, so a pathological graph could overflow the stack; at
  thermometer scale that never happens. **[read]**

#### `getComponentsContainingPoints(points)`
Builds a new graph holding the weakly connected components that the given
points belong to.
- **Params:** `points` – iterable of points, interned on the way in.
- **Returns:** a new `DirectedLineGraph` containing every outgoing edge of
  every point in those components. **Mutates:** nothing.
- **Notes:** a component point with no outgoing edges and no incoming edge from
  within the component is silently dropped, because the sub-graph is rebuilt
  from edges only. **[read]**

#### `getPointsConnectedTo(startPoint)`
Weak connectivity: walks predecessors to exhaustion, then successors, from
`startPoint`.
- **Returns:** a new `Set` of points including `startPoint` itself, empty only
  if you count that the start is always added. **Mutates:** nothing.
- **Notes:** the backward walk runs first and marks points visited, so the
  forward walk stops at anything already reached; the result is the weakly
  connected set, not a directed reachable set. **[read]**

#### `toArrays()`
Decomposes the graph into paths by repeatedly tracing from a start point and
deleting each edge as it is consumed.
- **Returns:** array of arrays of points. **Mutates:** nothing — it works on
  `clone()`.
- **Notes:** the start-point picker is written `!before || before`, which is
  always true, so it simply takes the first key of `pointsAfter` rather than
  preferring a source; paths can therefore start mid-line. Throws
  `Error("This should never happen")` after 1000 total steps. **[read]**

#### `clone()`
Rebuilds a graph from `getEdges()`.
- **Returns:** a new `DirectedLineGraph`. **Mutates:** nothing. Points are
  shared, not deep-copied, which is safe because they are interned. **[read]**

### `LineGraph` (additional members)

Members of the undirected graph at `bundle.claude.js:250` not covered earlier.
Its one field is `pointsConnected`, a `Map` from interned point to a `Set` of
neighbours; the constructor's second argument is an `isGreaterThan(a, b)`
comparator (default `a > b`) used only to emit each undirected edge once.

#### `addLine(line)`
Adds an undirected edge for each consecutive pair in `line`.
- **Returns:** `this`. **Mutates:** the receiver. A one-point line adds
  nothing; use `addPoint` for that. **[read]**

#### `addPoint(point)`
Ensures the point exists with an empty neighbour set.
- **Returns:** `undefined`. **Mutates:** the receiver.
- **Notes:** this is the one entry point that does **not** intern its argument,
  so an object point added here and then queried via `hasPoint` may miss. Pass
  cell ids, or intern yourself. **[read]**

#### `addPoints(points)`
`addPoint` over an iterable. **Returns:** `undefined`. **Mutates:** the
receiver. Same no-interning caveat. **[read]**

#### `addEdge(pointA, pointB)`
Interns both points, creates their neighbour sets if needed, and links them
both ways.
- **Returns:** `this`. **Mutates:** the receiver. **[read]**

#### `removeEdge(pointA, pointB, pruneIsolated = true)`
Removes the link in both directions, and by default deletes either endpoint
that is left with no neighbours.
- **Returns:** `this`. **Mutates:** the receiver. Pass `false` as the third
  argument to keep now-isolated points in the graph. A no-op when either point
  is absent. **[read]**

#### `removePoint(point)`
Removes every edge at `point`, which with default pruning also removes the
point.
- **Returns:** `this`. **Mutates:** the receiver.
- **Notes:** it iterates the point's live neighbour set while `removeEdge`
  deletes from it. Sets tolerate this in JS, but a point whose last edge is
  removed disappears mid-loop. **[read]**

#### `hasPoint(point)`
Whether the interned point is present. **Returns:** boolean. **[read]**

#### `getAllComponents()`
Splits the whole graph into connected components.
- **Returns:** generator of new `LineGraph` objects, each carrying the original
  comparator. **Mutates:** nothing.
- **Notes:** this is what `helpers.connectivity.getOrthogonallyConnectedGroups`
  hands you — a generator, so spread it if you need two passes. **[read]**

#### `getConnectedPointSets(points)`
Groups the given points by which component they fall in, without building
graphs.
- **Params:** `points` – iterable, interned; omit it to use every point in the
  graph.
- **Returns:** generator of arrays of points. **Mutates:** nothing.
- **Notes:** each yielded array is the *full* connected set reachable from a
  seed, so it can include points that were not in your input. **[read]**

#### `getPointsConnectedTo(startPoint)`
Breadth-style flood fill from `startPoint` over neighbour sets.
- **Returns:** a new `Set` of reachable points. **Mutates:** nothing.
- **Notes:** a `startPoint` not in the graph yields an empty set, since the
  loop skips points with no entry. **[read]**

#### `getComponentContainingPoint(startPoint)`
The single component containing `startPoint`, as a graph.
- **Returns:** a new `LineGraph` with the same comparator, holding those points
  and the edges among them. **Mutates:** nothing. An unknown start point gives
  an empty graph. **[read]**

#### `getComponentsContainingPoints(points)`
The union of the components containing any of `points`, as one graph.
- **Returns:** a new `LineGraph`; the requested points are added explicitly, so
  isolated ones survive here (unlike the `DirectedLineGraph` twin).
  **Mutates:** nothing. **[read]**

#### `clone()`
Rebuilds from `getEdges()` with the same comparator.
- **Returns:** a new `LineGraph`. **Mutates:** nothing.
- **Notes:** edges only — a point with no edges is lost by the clone, and so
  by `toArrays()`, which clones first. **[read]**

### `Vector2` (additional members)

The mutable vector class at `bundle.claude.js:775`. Not exported to custom
code; you will meet it only inside the bundle. Every instance method returns
`this`, so calls chain and each one mutates the receiver.

#### `get magnitude`
`Math.hypot(x, y)`. **Returns:** number. **Mutates:** nothing. **[read]**

#### `get magnitudeSqr`
`x*x + y*y`, avoiding the square root when you only compare lengths.
**Returns:** number. **Mutates:** nothing. **[read]**

#### `addScaled(otherVector, scaleFactor)`
Adds `otherVector * scaleFactor` component-wise.
- **Returns:** `this`. **Mutates:** the receiver. **[read]**

#### `rotate(angle)`
Rotates in place by `angle` radians, reading both components before writing
either.
- **Returns:** `this`. **Mutates:** the receiver. **[read]**

#### `normalize()`
Divides both components by the magnitude.
- **Returns:** `this`. **Mutates:** the receiver. A zero vector becomes
  `{x: NaN, y: NaN}`. **[read]**

#### `copy(otherVector)`
Overwrites this vector's components from another.
- **Returns:** `this`. **Mutates:** the receiver, not the argument. **[read]**

#### `Vector2.from(source)`
Builds a `Vector2` from anything with `x` and `y`.
- **Returns:** a new `Vector2`. **Mutates:** nothing. **[read]**

### Top-level functions (sets, iteration, arrays, numbers, vectors, cloning)

Source-order groups. Where a function is the implementation behind a namespace
member already documented, the entry says so and still describes the body.

**Sets** — the implementations behind `SetUtils`. An `options.comparator` path,
where present, decides membership by calling `comparator(a, b)` pairwise, at
O(n·m).

#### `takeOneFromSet(sourceSet)` — `bundle.claude.js:46`
Behind `SetUtils.takeOne`. Returns the first element in iteration order and
deletes it. **Returns:** the element, or `undefined` when empty. **Mutates:**
`sourceSet`. **[read]**

#### `deleteAllFromSet(targetSet, itemsToDelete, options)` — `bundle.claude.js:50`
Behind `SetUtils.deleteAll`. In-place set difference.
- **Returns:** `targetSet`. **Mutates:** `targetSet`. With a comparator it
  scans the whole target per removal and deletes while iterating. **[read]**

#### `differenceOfSets(sourceSet, itemsToRemove, options)` — `bundle.claude.js:60`
Behind `SetUtils.difference`. Copies `sourceSet` first, then removes.
- **Returns:** a new `Set`. **Mutates:** nothing.
- **Notes:** the comparator is called `(existingItem, itemToRemove)` here but
  `(itemToDelete, existingItem)` in `deleteAllFromSet` — argument order is
  reversed between the twins, which matters for an asymmetric comparator.
  **[read]**

#### `symmetricDifferenceOfCollections(leftCollection, rightCollection)` — `bundle.claude.js:70`
Behind `SetUtils.symmetricDifference`. Dispatches to the set-only fast path
when both arguments have a `has` method, otherwise unions two differences.
**Returns:** a new `Set`. **Mutates:** nothing. **[read]**

#### `symmetricDifferenceOfSets(leftSet, rightSet)` — `bundle.claude.js:78`
The fast path: elements present in exactly one side, by two `has` scans.
**Returns:** a new `Set`. **Mutates:** nothing. No comparator support. **[read]**

#### `retainIntersectionInSet(targetSet, otherSet)` — `bundle.claude.js:86`
Behind `SetUtils.filter`. Deletes from `targetSet` anything `otherSet` lacks.
**Returns:** `targetSet`. **Mutates:** `targetSet`. Takes a set, never a
predicate, despite the namespace name. **[read]**

#### `intersectionOfSets(sourceSet, otherSet)` — `bundle.claude.js:90`
Behind `SetUtils.intersection`. Same test, applied to a copy.
**Returns:** a new `Set`. **Mutates:** nothing. **[read]**

#### `addAllToSet(targetSet, itemsToAdd)` — `bundle.claude.js:95`
Behind `SetUtils.addAll`. Adds every item of an iterable.
**Returns:** `targetSet`. **Mutates:** `targetSet`. **[read]**

#### `unionOfSets(leftSet, rightSet)` — `bundle.claude.js:99`
Behind `SetUtils.union`. Copies the left set and adds the right.
**Returns:** a new `Set`. **Mutates:** nothing. **[read]**

#### `setsAreEqual(leftSet, rightSet, options)` — `bundle.claude.js:104`
Behind `SetUtils.isEqual`. Raw `size` comparison, then `setHasAllOf`.
**Returns:** boolean. **Mutates:** nothing. The size gate applies even on the
comparator path. **[read]**

#### `setHasAllOf(containerSet, items, options)` — `bundle.claude.js:109`
Behind `SetUtils.hasAll`. Whether every item of the iterable is in the set.
**Returns:** boolean; true for empty `items`. **Mutates:** nothing.
Comparator order is `(candidateFromSet, item)`. **[read]**

#### `setHasSomeOf(containerSet, items, options)` — `bundle.claude.js:126`
Behind `SetUtils.hasSome`. Whether at least one item is present.
**Returns:** boolean; false for empty `items`. **Mutates:** nothing. **[read]**

#### `setHasSomeWhere(sourceSet, predicate)` — `bundle.claude.js:137`
Behind `SetUtils.hasSomeWhere`. Whether any element satisfies `predicate`.
**Returns:** boolean. **Mutates:** nothing. **[read]**

**Iteration** — the implementations behind `IterationUtils`.

#### `getFirstOfIterable(iterable)` — `bundle.claude.js:155`
Behind `IterationUtils.getOne`. Opens the iterator and takes one step.
**Returns:** the first value, or `undefined` when empty. **Mutates:** nothing,
though it does advance a generator by one. **[read]**

#### `iterateRangeExclusive(startValue, endValue)` — `bundle.claude.js:158`
Behind `IterationUtils.getRange`. Ascending integers, `end` excluded.
**Returns:** generator of numbers; empty when `start >= end`. **[read]**

#### `iterateRangeInclusive(startValue, endValue)` — `bundle.claude.js:161`
Behind `IterationUtils.getRangeInclusive`. Same with `end` included — the one
to use for `spec.minDigit`..`spec.maxDigit`. **Returns:** generator of numbers.
**[read]**

#### `iterateCombinationsOfSize(items, size)` — `bundle.claude.js:164`
Behind `IterationUtils.getCombinations`. Materializes `items` to an array, then
walks index combinations in lexicographic order.
- **Returns:** generator of fresh arrays, each of length `size`. **Mutates:**
  nothing (the shared index array is mapped, not yielded).
- **Notes:** yields nothing when `size` exceeds the count; `size` 0 yields one
  empty array then stops. It combines by position, so repeated values give
  repeated combinations. Cost is C(n, k). **[read]**

#### `countOccurrencesByValue(items)` — `bundle.claude.js:183`
Behind `IterationUtils.getCounts`. Tallies an iterable.
**Returns:** a new `Map` from value to count, using `Map` identity semantics.
**Mutates:** nothing. **[read]**

#### `getBestByScore(items, scoreFn, fallback)` — `bundle.claude.js:188`
Behind `IterationUtils.getBest`. Highest `scoreFn` wins, strictly, starting
from `-Infinity`.
**Returns:** the winning element, or `fallback` for empty input. **Mutates:**
nothing. First of tied maxima is kept; an element scoring `-Infinity` never
beats the fallback. **[read]**

**Cloning and interning** — not exposed to custom code, but both graph classes
depend on `internStructuredValue` and `deepClone` backs component state copies.

#### `deepClone(value)` — `bundle.claude.js:205`
Recursively copies arrays, `Set`s, `Map`s and plain objects; delegates to
`value.clone()` when the object has one; returns primitives as-is.
- **Returns:** a fresh structure. **Mutates:** nothing.
- **Notes:** it walks `for...in`, so inherited enumerable properties are copied
  and a class instance without a `clone` method degrades to a plain object.
  Cycles recurse forever. **[read]**

#### `serializeForInternKey(value)` — `bundle.claude.js:225`
Builds a `key:(value);` string recursively for use as an intern key.
**Returns:** string. **Mutates:** nothing. Property order decides the key, so
`{x, y}` and `{y, x}` intern separately; `null` and `undefined` inside an
object throw on `Object.entries`. **[read]**

#### `internStructuredValue(value)` — `bundle.claude.js:233`
Canonicalizes an object to one shared deep clone, so structurally equal values
become identity-equal. It checks a `WeakMap` by object first, then a `Map` by
serialized key, cloning on a miss.
- **Returns:** the canonical instance; primitives, `null` and `undefined` pass
  straight through. **Mutates:** nothing visible, but it caches.
- **Notes:** the string-keyed `Map` is never pruned, so interning many distinct
  coords leaks for the page's lifetime. This is why graph points can be
  `{x, y}` objects at all. **[read]**

**Digit masks** — bit `d` of a mask is digit `d`, so a 1..9 grid uses bits 1..9
and bit 0 stays clear.

#### `buildDigitMask(digits)` — `bundle.claude.js:512`
Aliased as `toDigitMask` (`bundle.claude.js:1288`) and used by
`SmallNumberSet.from`. ORs `1 << digit` for each digit.
**Returns:** number. **Mutates:** nothing. A digit above 30 wraps under JS
shift semantics and silently sets the wrong bit. **[read]**

#### `listDigitsInMask(mask)` — `bundle.claude.js:517`
Aliased as `digitsInMask`. Pops the lowest set bit repeatedly.
**Returns:** a new array of digits, ascending. **Mutates:** nothing. **[read]**

#### `isSingleCandidateMask(mask)` — `bundle.claude.js:532`
Whether exactly one bit is set — the "this cell is solved" test.
**Returns:** the truthy mask value or boolean `false`, not a strict boolean, so
compare with `!!` if you care. **Mutates:** nothing. Mask 0 gives `0`. **[read]**

#### `lowestSetBitIndex(mask)` — `bundle.claude.js:535`
Aliased as `smallestDigitInMask`, behind `DigitSet.getSmallestNumber`.
**Returns:** the index of the lowest set bit, or `undefined` for mask 0.
**Mutates:** nothing. **[read]**

#### `highestSetBitIndex(mask)` — `bundle.claude.js:538`
Aliased as `largestDigitInMask`, behind `DigitSet.getLargestNumber`.
**Returns:** the index of the highest set bit, or `undefined` for mask 0.
**Mutates:** nothing. **[read]**

**Numbers** — the implementations behind `MathUtils`.

#### `sumOfNumbers(numbers)` — `bundle.claude.js:704`
Behind `MathUtils.sum`. Accumulates an iterable from 0. **Returns:** number.
**Mutates:** nothing. **[read]**

#### `productOfNumbers(numbers)` — `bundle.claude.js:709`
Behind `MathUtils.product`. Accumulates from 1. **Returns:** number.
**Mutates:** nothing. **[read]**

#### `modulo(dividend, divisor)` — `bundle.claude.js:714`
Behind `MathUtils.mod`. `((a % b) + b) % b`, so the result is non-negative for
a positive divisor unlike JS `%`. **Returns:** number. **Mutates:** nothing.
Also drives `sliceWrapped`. **[read]**

#### `getPrimeFactors(number)` — `bundle.claude.js:740`
Behind `MathUtils.getFactors`. Divides out the tabled primes up to 83, then
odd candidates upward checked with `isPrime`.
- **Returns:** a new array of primes with multiplicity, `[2, 2, 3]` for 12.
- **Notes:** throws `Error("Cannot factorize non-integers")` on a non-integer.
  It stops on `Math.abs(number) === 1`, so 0 never terminates and ±1 returns
  `[]` only after the small-prime loop; a negative input factors its magnitude
  with no sign factor. **[read]**

#### `radiansToDegrees(radians)` — `bundle.claude.js:761`
Behind `MathUtils.toDegrees`. **Returns:** number. **Mutates:** nothing. **[read]**

#### `degreesToRadians(degrees)` — `bundle.claude.js:764`
Behind `MathUtils.toRadians`. **Returns:** number. **Mutates:** nothing. **[read]**

**Vectors** — the implementations behind `Vector2Funcs`, all over plain
`{x, y}`. Every one returns a fresh object or a scalar and mutates no argument.

#### `getVectorMagnitude(vector)` — `bundle.claude.js:826`
Behind `Vector2Funcs.getMagnitude`. `Math.hypot`. **Returns:** number. **[read]**

#### `getNormalizedVector(vector)` — `bundle.claude.js:829`
Behind `Vector2Funcs.normalized`. Multiplies by the reciprocal magnitude.
**Returns:** a new `{x, y}`; a zero vector gives `NaN`s. **[read]**

#### `getScaledVector(vector, scaleFactor)` — `bundle.claude.js:833`
Behind `Vector2Funcs.scaled`. **Returns:** a new `{x, y}`. **[read]**

#### `addVectors(vectorA, vectorB)` — `bundle.claude.js:836`
Behind `Vector2Funcs.sum` — note the name clash with `MathUtils.sum`.
**Returns:** a new `{x, y}`. **[read]**

#### `subtractVectors(vectorA, vectorB)` — `bundle.claude.js:839`
Behind `Vector2Funcs.difference`. `a - b`. **Returns:** a new `{x, y}`. **[read]**

#### `addScaledVector(vectorA, vectorB, scaleFactor)` — `bundle.claude.js:842`
Behind `Vector2Funcs.scaledSum`. `a + b * scaleFactor`. **Returns:** a new
`{x, y}`. **[read]**

#### `getDistanceBetweenPoints(pointA, pointB)` — `bundle.claude.js:848`
Behind `Vector2Funcs.getDistance`. Euclidean. **Returns:** number. **[read]**

#### `getAngleBetweenVectors(vectorA, vectorB)` — `bundle.claude.js:854`
Behind `Vector2Funcs.getAngle`. `acos` of the dot product of two normalized
copies.
- **Returns:** number in radians, 0 to π. **Mutates:** nothing — it normalizes
  temporary `Vector2` copies, not your objects.
- **Notes:** rounding can push the `acos` argument past ±1 and give `NaN` for
  near-parallel or near-opposite inputs. **[read]**

#### `getManhattanDistanceBetweenPoints(pointA, pointB)` — `bundle.claude.js:862`
Behind `Vector2Funcs.getManhattanDistance`. `|dx| + |dy|`. **Returns:** number;
on integer cell coords, the orthogonal step count. **[read]**

#### `getRotatedVector(vector, angle)` — `bundle.claude.js:865`
Behind `Vector2Funcs.getRotated`. Standard rotation by radians. **Returns:** a
new `{x, y}`. **[read]**

#### `getClampedVector(point, rect)` — `bundle.claude.js:873`
Behind `Vector2Funcs.getClamped`. Clamps into `{x, y, width, height}`.
**Returns:** a new `{x, y}`. **[read]**

#### `compareVectorsInReadingOrder(pointA, pointB)` — `bundle.claude.js:879`
Behind `Vector2Funcs.compareVectors`. Compares `y` first, then `Math.sign` of
the `x` difference.
**Returns:** -1, 0 or 1 — drop it straight into `Array.prototype.sort`. **[read]**

#### `isVectorAfterInReadingOrder(pointA, pointB)` — `bundle.claude.js:886`
Behind `Vector2Funcs.isVectorGreaterThan`. Whether `a` follows `b` in reading
order. **Returns:** boolean. **[read]**

#### `getAverageVector(points)` — `bundle.claude.js:889`
Behind `Vector2Funcs.getAverage`. Centroid of an iterable.
**Returns:** a new `{x, y}`; empty input gives `{x: NaN, y: NaN}` from 0/0.
**Mutates:** nothing — it accumulates into its own object. **[read]**

**Text and memoization** — neither is on a `*Utils` global; both are internal.

#### `joinWithConjunction(values, conjunction = "and")` — `bundle.claude.js:1292`
Joins values into an English list, `"a, b and c"`, stringifying each element.
- **Returns:** string. **Mutates:** nothing.
- **Notes:** no Oxford comma, and it indexes `values.length`, so it needs an
  array rather than any iterable. One element returns just that element; empty
  input returns `""`. Used for constraint names in solver explanations. **[read]**

#### `memoizeWithKey(computeValue, getKey, useWeakKeys = false)` — `bundle.claude.js:1453`
Wraps a function in a cache keyed by whatever `getKey(...args)` returns.
- **Params:** `computeValue` – the function to memoize. `getKey` – receives the
  same arguments and returns the cache key. `useWeakKeys` – use a `WeakMap`
  instead of a `Map`, for object keys you want collectable.
- **Returns:** a new function with the same arguments. **Mutates:** nothing
  outside its own cache, which never evicts on the `Map` path.
- **Notes:** this is what makes `SumsHelper.getCombinationsForSumWithoutRepeat`
  cheap to call repeatedly (`bundle.claude.js:1470`). It caches `undefined`
  results correctly, since it tests with `cache.has`. **[read]**

**Arrays** — the implementations behind `ArrayUtils`. The copy/in-place twins
are easy to confuse: `arrayWithoutAll` copies, `removeValuesInPlace` does not.

#### `removeFirstValue(array, value, options)` — `bundle.claude.js:1676`
Behind `ArrayUtils.removeFirst`. Splices out the first occurrence, by
`indexOf` or by comparator.
**Returns:** `array`. **Mutates:** `array`. A miss is a no-op. The comparator
is called `(value, candidate)`. **[read]**

#### `arrayWithoutAll(array, valuesToRemove, options)` — `bundle.claude.js:1688`
Behind `ArrayUtils.withoutAll`. Filters out everything in `valuesToRemove`,
using a `Set` on the fast path.
**Returns:** a new array. **Mutates:** nothing. The comparator path is O(n·m)
and dedups the removal list first. **[read]**

#### `removeValuesInPlace(array, valuesToRemove, options)` — `bundle.claude.js:1702`
Behind `ArrayUtils.remove`. Same filtering, done by copying the contents out,
truncating the array to length 0 and pushing the keepers back.
**Returns:** `array`. **Mutates:** `array`. Anyone holding the same array
reference sees the change. **[read]**

#### `removeWhereInPlace(array, predicate)` — `bundle.claude.js:1719`
Behind `ArrayUtils.removeWhere`. Drops every element satisfying `predicate`,
by the same empty-and-refill trick.
**Returns:** `array`. **Mutates:** `array`. **[read]**

#### `arrayIncludesSome(array, values, options)` — `bundle.claude.js:1725`
Behind `ArrayUtils.includesSome`. Whether any of `values` appears.
**Returns:** boolean; false for empty `values`. **Mutates:** nothing. **[read]**

#### `arrayIncludesEvery(array, values, options)` — `bundle.claude.js:1735`
Behind `ArrayUtils.includesEvery`. Whether all of `values` appear.
**Returns:** boolean; true for empty `values`. **Mutates:** nothing. **[read]**

#### `shuffledCopy(array)` — `bundle.claude.js:1745`
Behind `ArrayUtils.shuffled`. Fisher-Yates over a `slice()` copy using
`Math.random`.
**Returns:** a new array. **Mutates:** nothing. Non-deterministic — keep it out
of `update` if you want reproducible solves. **[read]**

#### `mapIterableToArray(iterable, mapFn)` — `bundle.claude.js:1753`
Behind `ArrayUtils.mapIterable`. Maps any iterable into an array.
**Returns:** a new array. **Mutates:** nothing. `mapFn` gets the element only,
no index. **[read]**

#### `chunkArray(array, chunkSize)` — `bundle.claude.js:1765`
Behind `ArrayUtils.chunk`. Splits into consecutive runs, the last possibly
short.
**Returns:** a new array of new arrays. **Mutates:** nothing. A `chunkSize` of
0 or less produces one chunk holding everything, because the `index % size`
guard only fires at index 0. **[read]**

#### `arraysAreSameLength(...arrays)` — `bundle.claude.js:1774`
Behind `ArrayUtils.areSameLength`. Whether every argument matches the first
one's length.
**Returns:** boolean; true for no arguments. **Mutates:** nothing. **[read]**

#### `hasDuplicatesByComparator(array, comparator)` — `bundle.claude.js:1789`
The O(n²) comparator path of `ArrayUtils.hasDuplicates`; the wrapper
`hasDuplicates` uses a `Set` when no comparator is given.
**Returns:** boolean. **Mutates:** nothing. **[read]**

#### `withoutDuplicatesByComparator(array, comparator)` — `bundle.claude.js:1800`
The O(n²) comparator path of `ArrayUtils.withoutDuplicates`, keeping first
occurrences.
**Returns:** a new array. **Mutates:** nothing. It uses `Array.prototype.find`
as the membership test, so a stored `undefined` would be treated as absent.
**[read]**

#### `toArrayMaybeUnique(value, { unique = false })` — `bundle.claude.js:1814`
Normalizes an array or any iterable to an array, optionally deduplicated.
- **Returns:** an array. **Mutates:** nothing.
- **Notes:** with `unique` false and an array input it returns *that same
  array*, not a copy — the result can alias the caller's. Used internally by
  the comparator paths of `arrayWithoutAll` and `removeValuesInPlace`. **[read]**

**Cells and graphs** — the last three, sudoku-specific or graph-specific.

#### `cellsShareColumn(cellA, cellB)` — `bundle.claude.js:1893`
Whether two 0-based cell ids have the same x, via
`sharedHelpers.cellIds.getX`, which is `cellId % width`.
**Returns:** boolean. **Mutates:** nothing. It reads the module-level
`sharedHelpers`, so it is bound to the loaded puzzle's width, not to a spec you
pass. **[read]**

#### `cellsShareRow(cellA, cellB)` — `bundle.claude.js:1898`
The same for y, `Math.floor(cellId / width)`.
**Returns:** boolean. **Mutates:** nothing. **[read]**

#### `getAllPathsThroughDirectedGraph(graph)` — `bundle.claude.js:11336`
Enumerates every source-to-sink path of a `DirectedLineGraph` by depth-first
walk from each point with no predecessors.
- **Params:** `graph` – a `DirectedLineGraph`.
- **Returns:** a new array of arrays of points; `[]` when the graph has a
  cycle, checked up front with `hasCycles()`. **Mutates:** nothing — it pushes
  and pops a scratch path and slices each result.
- **Notes:** this is how the Thermometer handler turns branching or merging
  thermometers into the individual strictly-increasing runs
  (`bundle.claude.js:11324`). Path count is exponential in the branching, which
  is fine for thermometers and would not be for a dense graph. **[read]**

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

