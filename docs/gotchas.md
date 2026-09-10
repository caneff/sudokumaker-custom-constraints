# Gotchas

The expensive lessons. The first two each cost real debugging time.

## 1. `replaceComponent` only works with built-in components

`puzzle.replaceComponent(instance, new X(...))` swaps `instance` for a new
component `X`. This works when `X` is a **built-in** (e.g. `SkyscraperComponent`,
`GreaterThanComponent`, `IndexComponent`). It does **not** work when `X` is
another **custom** component from a sibling code segment — the swap silently
produces nothing, and your rule never enforces. **[verified]**

The trap is seductive because the built-in edge-clue template does exactly this:
a small wrapper watches the clue cell, then
`replaceComponent(instance, new SkyscraperComponent(name, value, cells))` once
the clue has a value. Copy that shape for your own rule and swap in
`new MyCustomComponent(...)`, and the whole constraint goes dead.

**Fix:** do not split across two custom components. Write **one self-contained
component** and register it directly in the main code. Give it both the clue
cell and the line, and let its own `update`/`validate` do everything. The
Running Start example takes this shape.

## 2. A validate-only component is inert

Defining only `validate` (no `update`) looks reasonable — the solver should call
it to reject wrong states. It does not appear to. In every working example we
found, each component that has `validate` also has `update`. Symptoms of a
validate-only component: outside/target cells keep their full candidate set, and
entering a wrong value raises no conflict. **[verified]**

**Fix:** always give the component a real `update` that removes at least some
candidates. Keep `validate` as the exact final check. See
`component-contract.md`.

## 3. Groups carry the reading direction — do not re-derive it

For an edge/line rule, the author's group already lists the line cells in the
order your rule should read them (nearest the clue first). Read `cells.slice(1)`
in the given order. Do not recompute row/column geometry and risk reading a
line backwards; trust the group order. **[verified]**

## 4. `DigitSet` is iterable but not an array

`puzzle.getCandidates(cell)` returns a `DigitSet`. Wrap it with `Array.from(...)`
before using array methods (`filter`, `includes`, spread into `Math.max`). Build
one to pass back with `SudokuDigitSet.from([...])`, or from a bitmask with
`new SudokuDigitSet(mask)` (bit `d` = digit `d`; `puzzle.getCandidatesBitMask`
reads one). The set algebra (`intersect`, `union`, `subtract`) **mutates** the
set it is called on. Members in `docs/puzzle-api.md`. **[verified]**

## 5. The puzzle ships with its full solution

An "interactive/entered" puzzle stores a value on every cell; the `given` flag
decides what the solver sees. A clue cell with `given: false` is **not** shown
to the solver — it is a blank the solver must deduce, not a clue. If you want a
visible clue, its cell must be `given: true`. **[verified]**

## 6. Order-of-evaluation for `getCellsCanHaveRepeats` / `getCellsSeeEachOther`

Both walk the exclusion groups of the constraint components registered **so
far**. The app sorts constraints by type priority (0 for all but
Nonconsecutive, so document order) and registers them one by one; a query made
in **main code** at register time sees only the constraints registered before
yours. A query made in a component's `update` runs at solve time, after every
constraint is registered, and sees them all: moving our constraint ahead of the
built-in `Rows`/`Columns` houses did not change the answer (live, 2026-08-28,
#189). Gate house rules in `update`, not in main code. **[verified]**

## 7. The whole puzzle is in the URL

There is no server store. A very large component (long code, embedded images)
can push the URL past browser/server length limits and truncate the puzzle,
which is silent data loss. Keep component code lean. **[docs]**

## 8. Encoding is lz-string

The `?puzzle=` payload is `LZString.compressToEncodedURIComponent(JSON.stringify(document))`.
Decode with `decompressFromEncodedURIComponent`. See `patterns.md`. **[verified]**

## 9. A region constraint does not give you rows and columns

A board built with `{"type": 1, "regions": [...]}` plus `{"type": 0}` enforces
**boxes and given digits only**. Rows and columns are not implied, and nothing
in the app says so: the solver runs, reports times, and counts solutions on a
puzzle that is not the one you meant. Add them explicitly. `framebuild.py` registers one named component per
interior line (`examples/_shared/frame-rowcol.js`), which is how a line gets a
name the app can use in an explanation -- a `type: 301` cage cannot be named,
the app hard-codes `the cage at <cell>` and gives row 1 and column 1 the same
string:

```js
new HouseComponent(`row ${i + 1}`, cells.map(c => c | 0), 'Row')
```

Read the next gotcha before copying that line: the `| 0` is load-bearing.
A cage still works, and `check_layout.check_houses` accepts either form.

This cost three tickets of quad-rank work (#324, #328, #335). Every board went
to the app box-only, so the app searched a wildly under-constrained puzzle: a
9x9 with 44 givens that CP-SAT proves unique in 0.01s timed out at 300s, and a
6x6 whose true count is 2 came back as 5 solutions. Adding rows and columns
made the same boards finish in 0.0s with the right verdicts. A latin-square
deduction (quad rank's leading-digit bound) is also *unsound* on such a board,
so those timings measured a component removing true candidates.

**How to catch it:** `check_layout.py` checks every committed link in an
example (isofill and fillomino are bare boards and exempt). For a board it does
not cover, decode the link and count solutions independently, or tap the solver
worker's messages and read the grid the app calls a solution — a duplicate
digit in a row is the tell. Both tools are on branch `proto/quad-rank-335`
(`proto/ground_truth.mjs`, `proto/app_solutions.mjs`). **[verified]**

## 10. Cell ids from the geometry helpers need `| 0`, like `getCellAt`

Gotcha-adjacent to #276's `getCellAt` rule, and it caught us again.
`helpers.geometry.getAllRows()` / `getAllColumns()` yield ids that are **not
plain integers**, and the app's solver runs slower on them until they are.
Nothing about the value looks wrong from JS: `Array.isArray` on the line is
true, `typeof` on a cell is `"number"`, and the ids compare `===` to the ones
in the puzzle JSON.

Measured on the shipped Skyscrapers 9x9 (#394), four interleaved rounds, cold,
non-deterministic solve off: eighteen `HouseComponent`s built straight from
`getAllRows()` ran **1.18x** the `type: 301` cages they replaced; the identical
construction with `.map(c => c | 0)` ran **0.97x**. One `| 0` was the whole
difference. A control of eighteen registered components whose `update` returns
immediately cost 1.02x, so it is neither the registration nor the class.

**Also:** those two are **generators**, not arrays -- `[...getAllRows()]` to
index or slice them, and call the helper again rather than reusing a spent
generator. Each line it yields covers the whole board, ring included.
`docs/puzzle-api.md` carries the full note. **[verified]** (live probe
2026-09-09)

## 11. `update` runs inside the solver's hypotheses — never read its view as the board

The app's logical stepper (Icon AutoStep) does **trial-based contradiction
reasoning**: it hypothetically places a digit, propagates, and eliminates the
candidate when the branch dies. Its own step log says so —

    Placing 5 in R2C3 forces R2C2 -> 2, R2C7 -> 6, ... causing a
    contradiction: unable to place 6 in row 2; removed 5 from R2C3

**A component's `update` is called inside those hypotheses.** So most of what it
sees through `getCandidates` / `getCandidatesBitMask` is a branch, not the
board, and the *last* state it observes is a branch teardown. A component is
only called when its cells change, so it can never observe the fixpoint at all.

Measured on the Skyscrapers global board (#406): a reporter component logging
its houses produced 55537 snapshots, and **25832 of them hold a state
impossible for the puzzle's unique solution** — 22018 cells forced to the WRONG
digit, 50020 missing the true digit. A sound propagator cannot do that on a
uniquely solvable puzzle. The same shows on a plain board with no custom
constraint (1393 of 3274), so it is how the app works, not a board quirk.

This is not a defect and `getCandidatesBitMask` is not lying —
`docs/puzzle-api.md` describes it correctly. The trap is reading a branch as a
board state. In #406 that produced four wrong diagnoses in a row, each built on
"the solver stalls with N unpropagated placements" numbers that were pure
teardown-frame artifacts.

**What to do instead:** read the app's own step log off the page
(`document.body.innerText`). It names the technique for every step — naked
single, hidden single, pointing pair, contradiction — and a custom component's
`puzzle.stop()` message appears there verbatim as a deduction, which is how you
confirm your component is actually firing. **[verified]** (live probe
2026-09-10)

## 12. An unclued line component is not idle — it is a refutation test

Because the stepper works by refutation (#11), a component earns its keep by
**killing hypotheses**, not only by removing candidates outright. A skyscraper
line with both clue cells still unsolved carries no information, and CP-SAT
confirms the grid's solution is unchanged without it — yet deleting it makes
the app's logical solver measurably weaker, because inside a trial placement it
still answers "no arrangement of heights fits" and kills the branch.

Measured (#406): skipping three such lines still finishes 81/81; skipping a
fourth drops it to 30/81; skipping all eighteen leaves the board at its 7
givens. The stalled run ends ON contradiction steps after 3.0s — out of steps,
not out of time.

**Consequence for judging strength:** a propagation-only harness understates a
component. It measures what the component removes at a fixpoint and misses
every branch it would have refuted. Two components equal at a fixpoint can be
far apart in the real app. Judge on real-app timing and on the app's step log,
not on fixpoint candidate counts alone. **[verified]** (live probe 2026-09-10)
