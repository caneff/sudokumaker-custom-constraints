# ISOFILL — a worked global constraint

Divide the grid into 10 regions, each with 10 orthogonally connected cells.
Every cell in a region should contain the same digit. All of the digits 0-9
must appear in the grid.

The board is a 10×10 custom grid with digits 0–9 and **no** row, column, or box
houses. Ten regions of ten cells cover the hundred cells, and all ten digits
appear, so each digit is exactly one orthogonally connected blob of ten cells.
Rule source: Marty Sears' *Homogeneous* (Logic Masters Deutschland).

Every other example in this repo is a **local** constraint: the author draws
groups and the main code builds one component per group. ISOFILL is **global**.
There are no groups. The main code takes every cell id and registers one
component over the whole grid. That is the one structural thing this example
exists to teach.

## Files

- `main.js` — the main code. No `input.groups`; it reads
  `helpers.cellIds.getAllCellIds()` and registers a single `IsofillComponent`
  over all hundred cells.
- `IsofillComponent.js` — the component code. One whole-grid `update` that
  prunes by counting (see below).
- `soundness-harness.mjs` — Node soundness harness (see below).
- `verify.py` — uniqueness checker (OR-Tools CP-SAT). Proves a grid plus clue
  set has exactly one solution.
- `puzzle.json` — the shipped instance: the full solution grid and the list of
  clue cells (35 givens).
- `build_link.py` — builds `PUZZLE_LINK.txt` from `puzzle.json`, `main.js`, and
  the component file. Run it after changing any of them:
  `uv run --with lzstring examples/isofill/build_link.py`.
- `PUZZLE_LINK.txt` — the built SudokuMaker link. Open it to play.

## Paste into SudokuMaker

Make a custom 10×10 board with digits 0–9 (the app's default palette for a
10-wide custom board). Add a custom **global** constraint — no group input — and
paste `main.js` as the main code. Add one component segment named
`IsofillComponent` with the component file's contents. Enter the givens.

## The global pattern

```js
puzzle.addConstraintComponent(
  new IsofillComponent('ISOFILL', Array.from(helpers.cellIds.getAllCellIds()))
)
```

The constructor arguments after the name go to `setParams` and
`getAffectedCells` in order. `getAffectedCells` returns the same cell list, so
the solver re-runs `update` when any cell changes. That is the right trigger for
a rule that counts across the whole grid, and the scan is cheap arithmetic.

## What the component deduces

`update` enforces only the **count floor**. Ten regions of ten cells, one digit
each, means every digit fills exactly ten cells. Two sound deductions follow:

- **Cap** — once a digit occupies ten cells, remove it from every other cell's
  candidates.
- **Force** — when a digit has exactly ten cells that can still hold it, place
  it in all ten.

Nothing else. There is no connectivity reasoning: the component does not reject
a candidate for stranding a region or splitting one. That is a deliberate
deferral, not an oversight. A stronger deduction must pay for itself in
end-to-end solve time in the real app (see `../../CODING_STANDARDS.md` and
`../../docs/real-app-timing.md`). Connectivity pruning gets written only if a
timing run shows the count floor leaves the solver too slow, and kept only if
the timing then improves.

## What the app can and cannot check

The shipped link opens and plays. The app's own "Find all solutions" button
does **not** prove it unique: measured in the live app (`app-solve.mjs`, app
build of 2026-08-26), the link with every non-given cell emptied returns
"Found 10,000 solutions" in 1.3 s. That is the count floor doing exactly what it
promises and no more — the app's solver sees only the deductions `update` makes,
so it accepts any filling where every digit has ten cells, connected or not.
More givens would not change this; only a puzzle the force deduction pins
completely would read as unique in the app.

`verify.py` is the uniqueness proof. The in-app verdict becomes meaningful only
if connectivity moves into the component, and that is the timing decision the
deferral above leaves open.

## Run the tests

Soundness (needs Node):

```
node examples/isofill/soundness-harness.mjs
# -> 20000 tests, 0 violations, cap fired: true | force fired: true, PASS
```

The harness mocks only the puzzle methods the component calls, seeds random
partial fills of a valid ISOFILL solution (row *r* holds digit *r*) in which
every cell still allows its true value, runs `update` to a fixpoint, and asserts
every true value survived. It also builds one state where the cap must fire and
one where the force must fire, and checks each pruned.

Uniqueness (needs Python; `uv` fetches OR-Tools):

```
uv run --with ortools examples/isofill/verify.py                                # self-check
uv run --with ortools examples/isofill/verify.py examples/isofill/puzzle.json   # -> unique
```

`verify.py` models the rule as exact counts (ten cells per digit) plus a
single-commodity flow per digit for connectivity: one root cell sends nine
units, every other cell of that digit absorbs one, and flow moves only between
orthogonal neighbours that both hold the digit. A cut-off cell starves, so a
split region is infeasible. Uniqueness is one no-good cut: solve, forbid that
grid, and require `INFEASIBLE`. A solver timeout raises — it is never reported
as unique. The self-check covers a unique clue set, an ambiguous one, a
count-valid but disconnected one, and the timeout path.

The model and the component state the same rule in two places that cannot
share code. Change the rule, and change both in the same diff.

## Authoring a puzzle

There is no generator. Write a full solution grid into `puzzle.json`, list the
clue cells, and run `verify.py` on it. It must print `unique`. To carve clues,
remove one at a time and re-run; keep any whose removal makes the puzzle
ambiguous. `just check` re-verifies the shipped instance on every run.
