# SudokuMaker custom-constraint API reference

An explanatory reference for everything a custom constraint can reach: the
`puzzle` object, change objects, the component contract, every `helpers.*`
namespace, the utility globals, and all built-in components. Each entry was
written by reading the function body in the deobfuscated solver bundle
(`solver-Bv75x3BJ.js`, captured in `examples/_shared/sudokumaker.har`), not
inferred from its name. It complements `bundle-api-index.md`, which is the
generated, mangled-name-anchored signature list; this document explains what
the signatures do.

How it was made: `docs/research/humanify-pedagogy/` holds `bundle.claude.js`,
the bundle with all 3,674 mangled identifiers renamed by Claude (AST-verified
to be the same program), and `reference/` holds the seven section drafts plus
the brief their writers followed. Line citations point into
`bundle.claude.js`.

Caveats:

- Public method names, decorator display names and string literals are the
  app's own. Every other identifier in `bundle.claude.js`, including parameter
  names, was inferred by reading and can be wrong. One such case has been
  found and corrected by hand: the six candidate-removal methods on
  `SolverPuzzleView` take the digit first and the cell second, as
  `puzzle-api.md` says. Trust the entry text here over the renamed parameter
  list when they disagree.
- There are two `helpers` objects. Setup code gets the extended one with
  `lines`, `misc` and a region-aware `geometry`; a component's `update`,
  `initialize` and `validate` get the plain one without them.
- Mangled names are per-build. Everything here is for the bundle above and
  should be re-derived after the app ships a new one.

## Discrepancies found against the existing docs

Seven findings from the first pass were folded into `docs/puzzle-api.md`,
`docs/component-contract.md` and `docs/gotchas.md` on 2026-09-13 and their
notes removed from this reference. What remains is open or is a property of
the bundle itself; each is also flagged in place as a `Discrepancy` note.

| # | Finding | Status |
|-|-|-|
| 1 | `bundle-api-index.md` lists 34 components; the bundle has 42 `defineComponent` calls. The generator's filter rejects an array of names (`Pair`/`AsymmetricalPair`, `GreaterThan`/`LessThan`) and a template-literal description (the six group and sum components). | **In review**, sudokumaker-custom-constraints #415, PR #416. All eight are already in `builtin-components.md`. |
| 2 | `bundle-api-index.md:70` indexes `helpers.geometry` as the base class, so `getSubsetsPerRegion` is absent from it; the main-code instance is the region-aware subclass swapped in by `createExtendedHelpers` (9205). | **Ticketed** as the second gap on #415; `puzzle-api.md`, "Two helpers objects", already documents it. |
| 3 | `createExtendedHelpers` hands `MiscHelper` the base geometry, not the region-aware one (9218). | **Resolved as unobservable**: neither `MiscHelper` method uses its geometry helper. Noted in `puzzle-api.md`. |
| 4 | Straight-ray outer clues from the `BottomRight` and `BottomLeft` corners start at the wrong corner (1183, 1195), and all four corner cases assume a square board. | Bundle bug. Do not trust a bottom-corner straight ray. |

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
(9264-9273) — same function, two names.

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
- **Returns:** a **`Vector2` instance**, not a plain object — unlike
  `cellIds.getCoordsFromId`. It still reads as `{x, y}` but carries the
  `Vector2` mutating methods (`add`, `scale`, …), so cloning it before
  arithmetic matters.

#### `getCellCenterFromId(outerCellId)`
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
`bundle.claude.js:9201`); absent from the base `createHelpers` result and from
`docs/research/bundle-api-index.md`. Stateless — no constructor, no fields. A
"line" here is just an ordered `Array` of cell ids; nothing validates that the
cells are actually adjacent.

#### `getLineEnds(lineCells)`
- **Returns:** `[lineCells[0], lineCells.at(-1)]`. On a one-cell line both
  entries are that same cell; on an empty array both are `undefined`.

#### `getCellsBetweenLineEnds(lineCells)`
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

> Discrepancy: `docs/research/bundle-api-index.md:70` indexes
> `helpers.geometry` as the base class `gs` and lists only the base members, so
> `getSubsetsPerRegion` is missing from it. The instance is the region-aware
> subclass (`bundle.claude.js:9205`).

> Discrepancy: `createExtendedHelpers` hands `MiscHelper` the *base*
> `baseHelpers.geometry`, not the region-aware one it just built
> (`bundle.claude.js:9218`). `helpers.misc`'s internal geometry therefore has
> no `getSubsetsPerRegion`. Only matters if you reach into `helpers.misc`.

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
  cells. Matches `docs/puzzle-api.md:71` (verified there by live probe), which
  also warns to coerce the yielded ids with `| 0` before heavy use.

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
In-place AND.
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

#### `toDegrees(radians)` / `toRadians(degrees)`
Angle conversion. **Returns:** number.

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

> Discrepancy: `../../bundle-api-index.md` lists 34 registered components. This
> bundle contains 42 `defineComponent` calls. The eight the index omits are
> `Pair`/`AsymmetricalPair`, `DifferentGroups`, `RequiredGroups`,
> `DiverseGroups`, `GreaterThan`/`LessThan`, `SameGroup`, `SandwichSum` and
> `WeightedSum`; four of those (`DifferentGroups`, `DiverseGroups`,
> `GreaterThan`, plus the `Pair` base) fall in this section. The cause is
> the index generator's filter, which rejects an array of names and a
> template-literal description (sudokumaker-custom-constraints #415); all eight
> are in the same chunk and in `docs/builtin-components.md`.

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
