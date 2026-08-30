# Outside Sudoku

The simplest outside-clue example in this repo: a pure membership test. No
index, no order, no DP. Read this one first if you are writing your first
outside-clue component — Numbered Rooms and Skyscraper add machinery on top of
the same shape.

## The rule

A line reads inward from an outside clue cell. The clue digit must appear in
the line's **window**: its first `w` cells.

    clue ∈ { value(line[0]), …, value(line[w - 1]) }

`w` is the extent of the box the line starts in, measured along the line's
direction, capped by the line length: 3 along a row or a column of a 9x9,
3 across and 2 down on a 6x6, 2 on a 4x4. The component reads `w` off the
board and never assumes 3.

A line that starts at the grid edge — every frame line, and so every line on
the shipped board — has exactly its own first box as its window. A line an
author draws from mid-box gets a window of the same `w` cells, which runs on
into the next box.

The rule says nothing else. The digit may appear outside the window too, and
it may appear in the window more than once, so the rule holds on a line of any
kind (`docs/line-contract.md`) and the component needs no kind gate.

## What the component does

`OutsideSudokuComponent.js` defines `getAffectedCells`, `setParams`, `update`
and `validate` — no `initialize`. `update` makes three deductions in one pass,
all read off the pre-pass bitmasks:

1. **Clue pruning.** The clue keeps only digits some window cell can still
   hold.
2. **Forced placement.** The clue is solved to `d` and exactly one window cell
   still admits `d`, so that cell is `d`.
3. **Dead branch.** The clue is solved to `d` and no window cell admits `d`, so
   the clue's last candidate goes and the solver backtracks at once. This falls
   out of deduction 1: `d` is not in the union, so deduction 1 removes it.

`validate` is the filled-board backstop: on a full group it checks the clue's
digit against the window.

### Sizing the window

`update` needs the board, and `setParams` does not get it, so the window length
is read on the first `update` and cached on the instance
(`puzzle.getRegion`, `getRegionCells`, `getRow`, `getColumn`). Board geometry
cannot change under a live component, and the app rebuilds every component when
the author edits a group, so a redrawn group gets a fresh instance and a fresh
answer.

A line whose first cell has no region (region `-1`) falls back to the whole
line as its window. That is weaker than the rule, never unsound.

## Files

| File | What it is |
| --- | --- |
| `OutsideSudokuComponent.js` | The component — paste into a component code segment |
| `main.js` | Local backend: one component per drawn group |
| `main-global.js` | Global backend: the 4n frame lines, built from the board size |
| `grid-geometry.mjs` | The board geometry the Node harnesses hand the mock puzzle |
| `soundness-harness.mjs` | Soundness fuzz — zero removed true values |
| `update-strength.test.mjs` | Never-weaker fuzz against the three deductions |
| `backends.test.mjs` | What each backend registers, and how `main.js` fails |
| `build_link.py` (+ test) | Swap a candidate component into the shipped board |
| `verify.py` | CP-SAT proof that the shipped board has one solution |
| `PUZZLE_LINK.txt` | The shipped board (see below) |

## The two backends

- **Local** (`main.js`): the author draws one group per clue, clue cell first,
  then the line nearest-first. A group still being drawn (clue only, no line)
  is skipped. A line that is not one row or column **throws**: the window is a
  box extent in the line's *direction*, and a bent path has no direction.
- **Global** (`main-global.js`): reads no groups. It builds all `4n` frame
  lines from `puzzle.spec.size.width` and registers one component per line.

## The shipped board

`PUZZLE_LINK.txt` is a 9x9 Outside Sudoku on the shared interactive-outside
frame: an 11x11 board, the 9x9 interior ringed by one clue cell per row and
column end. It runs the **local** backend, with all 36 frame lines shipped as
drawn groups.

- Seed 101 of `framebuild.generate`, 11 interior givens, 21 of the 36 ring
  clues shown; the other 15 are empty cells the solver fills in.
- Uniqueness is proved by OR-Tools CP-SAT, which models the same membership
  rule the component enforces (clue equals at least one of the first three
  cells). `verify.py` re-runs that proof against the committed link, so the
  claim is checkable from the tree:

      uv run --with lzstring --with ortools examples/outside-sudoku/verify.py

  It is the rule's third home, beside the component and the soundness harness
  (`CODING_STANDARDS.md`, "The rule has one home"). It is slow, so `just check`
  does not run it; run it after changing the board or the rule.
- Every non-given cell decodes as `{}` — no solution digit and no hidden clue
  ships pre-typed.

### Regenerating

The committed generator (`build_size.py` + `rebuild_size.py`, boards at 4x4,
6x6 and 9x9) lands with #261; this board was built from a one-off script over
`examples/_shared/framebuild.py`. Until then, to re-encode the link after a
component change, swap the component into the committed board:

    uv run --with lzstring examples/outside-sudoku/build_link.py \
      --component examples/outside-sudoku/OutsideSudokuComponent.js \
      --out examples/outside-sudoku/PUZZLE_LINK.txt

One note for #261: `framebuild.Spec.clue_fn` sees only the line's digits, not
its direction, so a 6x6 board (window 3 across, 2 down) needs the direction
passed in or the clue derived per side.

## Run

    node examples/outside-sudoku/soundness-harness.mjs
    node examples/outside-sudoku/update-strength.test.mjs
    node examples/outside-sudoku/backends.test.mjs
    uv run --with lzstring examples/outside-sudoku/build_link.test.py

All of these run under `just check`.

## Timing

Not measured yet — the real-app timing row lands with #262. The component ships
with the three deductions above and no speed work; `OPTIMIZATION_LOG.md`
records what has been considered.

## Not covered

Variant clue semantics (Outside Consecutive, "the digit must NOT appear",
several digits per clue), boards over 9x9, and any deduction that couples the
clues of one line or one side. See #259, Out of Scope.
