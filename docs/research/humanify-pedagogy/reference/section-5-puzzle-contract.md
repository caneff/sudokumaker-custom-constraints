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

#### `getRegion(cellId)` / `getRegionCells(regionId)` / `getRegions()` / `hasRegions()` / `getRegionAt(x, y)`
Region lookups, delegated straight to `SolverState`.
- **Returns:** `getRegion` → 0-based region id, `-1` when the cell has no region
  (`getRegionIdAt` is `this.regionsByCellId[cellId] ?? -1`, 8802).
  `getRegionCells` → the region's cell-id array. `getRegions` → the array of
  those arrays. `hasRegions` → `regions.length > 0`.
- **Notes:** `getRegionAt(x, y)` goes through `unsafeGetCellAt`, so
  out-of-range coords give a garbage id, not `undefined`.

#### `getX(cellId)` / `getY(cellId)` / `getColumn(cellId)` / `getRow(cellId)`
0-based column and row. `getColumn` is literally `getX` and `getRow` is `getY`
(9265-9276) — same function, two names.

#### `getCellAt(x, y)` / `unsafeGetCellAt(x, y)`
Coords to cell id. `getCellAt` uses `helpers.cellIds.getIdFromCoordsSafe` and is
`undefined` off the board; `unsafeGetCellAt` uses `getIdFromCoords` and does not
bounds-check.

#### `getCellsOrthogonallyAdjacentToCell(cellId)` / `…DiagonallyAdjacentToCell(cellId)` / the `…ToCoords(x, y)` pair
Thin `yield*` wrappers over `helpers.geometry.getOrthogonallyAdjacentCells` and
`getDiagonallyAdjacentCells`.
- **Returns:** generator of cell ids. Spread it before indexing.

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

#### `getCellsSeeEachOther(cells)` / `getCellsCanHaveRepeats(cells)`
Whether every pair in the list excludes each other, and its complement.
- **Params:** array or any iterable of cell ids.
- **Returns:** boolean. `getCellsCanHaveRepeats` is
  `hasDuplicates(list) || !getCellsSeeEachOther(list)` (8860) — a repeated id in
  the list alone makes it `true`.
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
> **the digit or digit mask comes first, the cell or cells second**, exactly as
> `docs/puzzle-api.md` says. The first deobfuscation pass had labelled them
> `(cellId, digit)`; `bundle.claude.js:9941` onwards now reads
> `removeCandidateFromCell(digit, cellId)` and so on, corrected by hand and
> re-verified against the AST and scope checks.

#### `getValue(cellId)` / `hasValue(cellId)`
The solved digit, and whether there is one. `getValue` is
`state.cells[cellId].value`, `undefined` when unsolved.

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

#### `removeCandidateFromCell(digit, cellId)`
Change: drop one digit from one cell.
- **Returns:** `{ type: 3, value: 1 << digit, cell }`.

#### `removeCandidatesFromCell(digits, cellId)`
Change: drop a set of digits from one cell.
- **Params:** `digits` — a bitmask or a `DigitSet` (it is stored raw and later
  used under `&`, which calls `valueOf`).
- **Returns:** `{ type: 3, value: digits, cell }`.

#### `filterCandidatesInCell(digits, cellId)`
Change: keep only these digits in the cell.
- **Returns:** `{ type: 1, value: digits, cell }`.

#### `removeCandidateFromCells(digit, cells)` / `removeCandidatesFromCells(digits, cells)` / `filterCandidatesInCells(digits, cells)`
The same three changes over a list of cells.
- **Returns:** `{ type: 4 | 4 | 2, value, cells: [...cells] }` — the cell list is
  copied at build time, so mutating your array afterwards is harmless.

#### `replaceComponent(component, replacement)`
Change: unregister the component this change came from and register the
replacement(s) instead.
- **Returns:** `{ type: 6, with: ensureArray(replacement ?? component) }`.
- **Notes:** the first argument is ignored unless it is the only one — the
  component removed is always the one whose `update` yielded the change, chosen
  by the solver, not by this argument. `replaceComponent(instance, next)` and
  `replaceComponent(next)` do the same thing. **This is a terminal change**: the
  solver stops draining your generator after it (9114).

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
  (10041). You never set it yourself.

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
   (`ReplaceComponent` or `AbortSolver`, 9105).
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

> Discrepancy: `docs/gotchas.md` §2 says a validate-only component is inert. The
> bundle shows the call path exists — `SolverState.validate` (9045) calls
> `validate` on every component with `validateDuringSolve`, and the custom-code
> wrapper sets that getter to `true` whenever your segment defines `validate`
> (10041) — independently of whether `update` exists. Nothing in this bundle
> makes validation conditional on `update`. The observed symptom is real but its
> cause is not visible here; the safe advice (always ship a real `update`)
> stands, but the stated mechanism does not match the solver source.

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
  custom component; `ParamType` and `defineComponent` (2746) are metadata for
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
  appends the `Component` suffix to every registered name, 2751). `puzzle`,
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

> Discrepancy: `helpers` is not the same object in the two segments.
> `setupPuzzle` (9349) builds it with `createExtendedHelpers` (9201), but
> `compileCustomComponentClass` builds its own with plain `createHelpers`
> (9994/1614). So the main code's `helpers` has `lines` (LinesHelper), `misc`
> (MiscHelper) and a region-aware `geometry` (`RegionAwareGeometryHelper`, which
> adds `getSubsetsPerRegion`), while **inside a component segment `helpers.lines`
> and `helpers.misc` are `undefined` and `helpers.geometry` lacks
> `getSubsetsPerRegion`**. `puzzle.helpers` inside `update` is that same reduced
> object, since `__getFacade` passes it to the `SolverPuzzleView`.
> `docs/puzzle-api.md` lists `helpers.lines.getLineEnds` without noting it is
> setup-only. Compute line ends in the main code and pass them as a parameter.
