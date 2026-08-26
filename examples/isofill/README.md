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

- `main.js` — the main code. No `input.groups`; it builds the hundred cell ids
  row by row with `helpers.cellIds.getIdFromCoordsSafe` and registers a single
  `IsofillComponent` over them.
- `IsofillComponent.js` — the component code. One whole-grid `update` that
  prunes by count and by reach, and a `validate` leaf check (see below).
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
const cells = []
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) cells.push(helpers.cellIds.getIdFromCoordsSafe({ x, y }))
}
puzzle.addConstraintComponent(new IsofillComponent('ISOFILL', cells))
```

The constructor arguments after the name go to `setParams` and
`getAffectedCells` in order. `getAffectedCells` returns the same cell list, so
the solver re-runs `update` when any cell changes. That is the right trigger for
a rule that counts across the whole grid. The list is built by coordinates, not
from `getAllCellIds()`, because the component finds neighbours by index
arithmetic and so needs row-major order.

## What the component deduces

`update` runs three sound deductions per digit. Ten regions of ten cells, one
digit each, means every digit fills exactly ten cells:

- **Cap** — once a digit occupies ten cells, remove it from every other cell's
  candidates.
- **Force** — when a digit has exactly ten cells that can still hold it, place
  it in all ten.
- **Reach** — walk outward from the digit's placed cells, stepping only into
  orthogonal neighbours that still allow the digit, at most `10 − placed`
  steps. A cell the walk never meets loses the candidate. Sound because a
  ten-cell region with `k` placed cells has at most `10 − k` open cells, so
  every region cell is within that many steps of a placed one. When two placed
  cells of one digit cannot join within nine steps the region is split; the
  component empties the stranded cell's candidates so the solver sees the dead
  branch. Cell neighbours come from index arithmetic on the row-major list.

`validate` is the exact leaf check: on a full grid, each digit must be one
connected blob of ten. The solver may not call it (`../../docs/gotchas.md`,
gotcha 2); the deductions above do the work, `validate` states the rule.

All of it reads each cell's candidates as a `DigitSet` (wrap it in
`Array.from`; build one back with `SudokuDigitSet.from`).

Reach is required, not a timing-gated stretch: without it the app never
reaches a verdict. With it, on this instance, it still does not — see the next
section and `../../docs/real-app-timing.md`.

## What the app checks

The shipped link stores the full solution as entered values (35 black givens,
65 blue entries). Strip it before you time or play it:
`uv run --with lzstring examples/_shared/probe_link.py strip examples/isofill/PUZZLE_LINK.txt /tmp/iso.txt`.

On the stripped grid the app's "Find all solutions" does **not** reach a
verdict (live app, build of 2026-08-26, `app-solve.mjs`): it stops at its own
time limit. The count-floor-only component before reach was added returns
"Found 10,000 solutions" in 0.3 s on the same grid, so reach prunes — it turns
a fast wrong answer into no answer — but not enough for the app to close the
search. An earlier "unique in 2 s" figure was measured with 36 solution values
still entered in the outer ring and was wrong.

`verify.py` is the uniqueness proof: it models the rule from scratch
(flow-based connectivity). Getting the app to a verdict is an open decision on
the map (#48): stronger pruning, more givens, or both.

## Run the tests

Soundness (needs Node):

```
node examples/isofill/soundness-harness.mjs
# -> isofill rows fixture: 20000 tests, 0 violations
# -> isofill bent fixture: 20000 tests, 0 violations
# -> validate: true
# -> cap fired: true | force fired: true | reach fired: true | split fired: true | split at cap: true
# -> PASS
```

The harness mocks only the puzzle methods the component calls, seeds random
partial fills of two valid ISOFILL solutions (one with row *r* holding digit
*r*, one with bent L-shaped regions so reach walks around corners) in which
every cell still allows its true value, runs `update` to a fixpoint, and asserts
every true value survived. It also builds one state for each deduction — cap,
force, reach, split, split with all ten cells placed — and checks each fired,
and checks `validate` accepts a full valid grid and rejects a count-valid but
split one.

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
