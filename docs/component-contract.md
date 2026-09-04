# The component contract

A custom constraint has two parts:

1. A **main (backend) code segment**. It runs once at setup. It reads the
   author's groups and registers components with
   `puzzle.addConstraintComponent(...)`.
2. Zero or more **component code segments**. Each defines the solving logic for
   one kind of component. The solver runs these during the solve.

A component is a set of free functions in its own code segment. You do not write
a class. SudokuMaker turns the segment into a constructor named after the
segment, so `new MyComponent(name, a, b)` is valid in the main code once a
component segment named `MyComponent` exists.

## Constructor arguments map by position

The first constructor argument is always the component `name` (a string, used in
messages). Every argument after `name` is passed, in order, to both
`setParams` and `getAffectedCells`. **[verified]**

```js
// main code
puzzle.addConstraintComponent(new RunningStartComponent(name, clueCell, lineCells))

// component code
function getAffectedCells (clueCell, lineCells) { ... }   // no `name`, no `instance`
function setParams (instance, clueCell, lineCells) { ... } // `instance` first, then the args
```

## The five functions

You define the ones you need. `setParams` and `update` are the working pair;
`validate` is the correctness backstop.

| Function | Signature | Role |
|-|-|-|
| `getAffectedCells` | `(…params) => CellId[]` | The cells this component watches. The solver re-runs `update` when any of them changes. Return every cell your logic reads. **[verified]** |
| `setParams` | `(instance, …params) => void` | Store the constructor args on `instance` (e.g. `instance.cells = cells`). Runs once. **[verified]** |
| `initialize` | `(instance, puzzle) => Generator<Change>` | Optional one-time pass at creation, e.g. remove impossible candidates up front. **[docs]** |
| `update` | `(instance, puzzle) => Generator<Change>` | The propagation loop. Yields Changes (candidate removals, component replacement). The solver calls it repeatedly until nothing more changes. **[verified]** |
| `validate` | `(instance, puzzle) => boolean` | Return `false` when the current assignment already breaks the rule, `true` otherwise. Return `true` while the group is incomplete, then do the real check once it is filled. **[verified]** |

## How `update` works

`update` is a **generator**. It `yield`s Change objects; it does not mutate the
puzzle directly. The solver applies each yielded Change and re-runs `update`
(and other components) until a fixpoint. **[verified]**

The Changes come from `puzzle` methods:

```js
function* update (instance, puzzle) {
  const { cells } = instance
  // remove a set of candidates from one cell
  yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from([1,2,3]), cells[0])
  // remove a single candidate from one cell
  yield puzzle.removeCandidateFromCell(9, cells[1])
  // swap this component for a different (built-in) one
  yield puzzle.replaceComponent(instance, new GreaterThanComponent(instance.name, a, b))
}
```

`yield*` delegates to a helper generator, which is handy for shared logic:

```js
function* less (puzzle, a, b) { /* yields removals enforcing a < b */ }
function* update (instance, puzzle) {
  yield* less(puzzle, instance.cells[0], instance.cells[1])
}
```

## How `validate` works

`validate` returns a boolean. It is the leaf check the solver uses to reject a
completed-but-wrong state. Guard it so it only judges a full group:

```js
function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === runningStart(puzzle, line)
}
```

**A component needs a working `update` to be active.** In every working example
we found, a component that defines `validate` also defines `update`. A
validate-only component appears inert — the solver neither prunes nor rejects
through it. See `gotchas.md`. **[verified]**

## `instance` lives for the whole solve, not one search node

`instance` is the component object itself: the generated wrapper calls
`setParams(this, ...args)` in its constructor. The solver's DFS clones the
puzzle state per candidate but copies the component set by reference —
`this.constraintComponents = new Set(e.constraintComponents)` in the state's
copy constructor, then `const o = this.state.clone(); ... yield* new
Qt(o, this).findSolutions()`. So every search node shares one component object,
and nothing written on `instance` is undone on backtrack. **[verified]**
(`solver-Bv75x3BJ.js`, extracted from `examples/_shared/sudokumaker.har`.)

`puzzle.stop()` is the other half of that asymmetry. It becomes an
`AbortSolver` change that fails **the cloned state** — the search loop simply
tries the next candidate. Nothing on the component is reset. **[verified]**

Two consequences:

- The app's own component template says, twice, "member variables should not be
  mutated after initialization!" A per-solve memo on `instance` breaks that
  rule. Ours (`instance.sig`) is safe only because the signature is a pure
  function of puzzle state, so a memo that still matches describes a state
  genuinely already swept.
- **Never write a memo on a path that called `stop()`.** The memo outlives the
  branch the stop killed; the next visit to that state matches it, returns
  early, and never raises the stop again. The branch is then silently not
  declared dead — not unsound, since `validate` still rejects at a leaf, but
  the pruning is gone. Have the sweep report whether it stopped and write the
  memo only when it did not (#316, #329).

- **Never cache a fact derived from candidates.** A gate that reads live
  candidates — "the line's union is exactly {1..n}" — is true of one search
  node, not of the solve. Latch it and it stays true after the backtrack to a
  parent state where the union has regained digits, and the rule behind it
  fires on a line it does not hold for: unsound, and silently so (#336). Only a
  fact geometry fixes may be cached, `getCellsCanHaveRepeats` being the one we
  rely on — houses are registered once and a backtrack cannot un-register one.
  A memo keyed on the state itself (`instance.sig`) is the other safe shape: it
  describes the state it was written for, so a match is a genuine repeat.

## Local vs global

- A **local** constraint gives the author group-drawing tools. The main code
  reads `input.groups` — an array of `{ value: string, cells: CellId[] }`. Use
  `cells[0]` as a clue/target and `cells.slice(1)` as the payload if your rule
  needs a distinguished cell. **[verified]**
- A **global** constraint has no groups; the main code builds components over
  the whole grid using `helpers.geometry` and `puzzle.getCellAt`. **[docs]**
