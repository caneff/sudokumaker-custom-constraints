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
| `outside_rule.py` | The window rule in Python: both window measures and the CP-SAT membership post |
| `build_size.py` (+ test) | The generator: fresh boards at 4x4, 6x6 and 9x9 |
| `rebuild_size.py` | Re-encode a sized link from its recorded seed, no fresh search |
| `verify.py` | CP-SAT proof that a board has one solution |
| `PUZZLE_LINK.txt`, `gen.json` | The shipped board, on the global lane (see below) |
| `PUZZLE_LINK_local.txt`, `gen_local.json` | The same frame, on the local lane |
| `PUZZLE_LINK_<n>x<n>.txt`, `gen_<n>x<n>.json` | The smaller boards and their seed data |

## The two backends

- **Local** (`main.js`, `PUZZLE_LINK_local.txt`): the author draws one group
  per clue, clue cell first, then the line nearest-first. A group still being
  drawn (clue only, no line) is skipped. A line that is not one row or column
  **throws**: the window is a box extent in the line's *direction*, and a bent
  path has no direction.
- **Global** (`main-global.js`, `PUZZLE_LINK.txt`): reads no groups. It builds
  every frame line from `puzzle.spec.size.width` and
  `puzzle.spec.size.height` — `2(W-2) + 2(H-2)` of them, `4n` on a square
  board — and registers one component per line.

## The shipped board

`PUZZLE_LINK.txt` is a 9x9 Outside Sudoku on the shared interactive-outside
frame: an 11x11 board, the 9x9 interior ringed by one clue cell per row and
column end. It runs the **global** backend and draws no groups, as every
example's bare `PUZZLE_LINK.txt` does (`docs/example-layout.md`, "Which lane a
link runs", #268).

- Seed 123 of `framebuild.generate`, recorded in `gen.json`: 10 interior
  givens, 23 of the 36 ring clues shown; the other 13 are empty cells the
  solver fills in.
- Uniqueness is proved by OR-Tools CP-SAT, which models the same membership
  rule the component enforces (clue equals at least one of the first three
  cells). `verify.py` re-runs that proof against the committed link, so the
  claim is checkable from the tree:

      uv run --with lzstring --with ortools examples/outside-sudoku/verify.py

  The rule states itself three times — the component, the soundness harness,
  and `outside_rule.py` for the Python side, which the generator and
  `verify.py` share (`CODING_STANDARDS.md`, "The rule has one home"). A change
  to the rule changes all three. `verify.py` is slow, so `just check` does not
  run it; run it after changing the board or the rule.
- Every non-given cell decodes as `{}` — no solution digit and no hidden clue
  ships pre-typed. `build_size.test.py` checks the same of every sized board.

### Regenerating

To re-encode the shipped link after a component change, swap the component
into the committed board:

    uv run --with lzstring examples/outside-sudoku/build_link.py \
      --component examples/outside-sudoku/OutsideSudokuComponent.js \
      --out examples/outside-sudoku/PUZZLE_LINK.txt

## The local board

`PUZZLE_LINK_local.txt` is the local lane's board: the same 11x11 frame with
all 36 lines shipped as **drawn groups**, so `main.js` registers one component
per group. Seed 101, recorded in `gen_local.json`: 11 interior givens and 21 of
the 36 clues shown. It carries the local timing row.

    uv run --with ortools --with lzstring \
      examples/outside-sudoku/build_size.py 9 3 3 1 --local
    uv run --with lzstring examples/outside-sudoku/rebuild_size.py 9 --local

### Why its lines are straight, not bent (#268)

Every other example's local board draws **bent paths**, which is what makes a
line stop being a house and gives the bare-line deductions a board to play.
This rule cannot use one. The window is the box extent measured **along the
line's direction**, and a bent path has no single direction — so `main.js`
throws on a group that is not one row or one column, and a bent-path board
would not open at all. The local board therefore draws the frame lines, and
its rules text keeps quiet about houses: on this board every drawn line really
is a row or a column.

What the local board still proves is the lane: `main.js` reading the author's
groups reaches the same 36 components `main-global.js` builds from the grid,
on the same rule and the same board shape.

## The sized boards

`build_size.py` generates a fresh board of any size on the same frame, in the
**global** variant (no drawn groups: `main-global.js` builds the 4n frame lines
itself). Three sizes ship, each carved to a unique solution by OR-Tools:

| Board | Seed | Interior givens | Clues shown of 4n | Window |
| --- | --- | --- | --- | --- |
| `PUZZLE_LINK_4x4.txt` | 102 | 1 | 5 of 16 | 2 either way |
| `PUZZLE_LINK_6x6.txt` | 123 | 3 | 13 of 24 | 3 across, 2 down |
| `PUZZLE_LINK.txt` (the 9x9) | 123 | 10 | 23 of 36 | 3 either way |
| `PUZZLE_LINK_local.txt` (9x9, local lane) | 101 | 11 | 21 of 36 | 3 either way |

    uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 4 2 2
    uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 6 2 3
    uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 9 3 3

The carve loop drops a given, then a shown clue, whenever the board stays
unique without it, so the ring stays sparse: every clue left blank is one the
solver deduces. Uniqueness is a **failed second-solution search** — CP-SAT
finds one solution, is told to avoid it, and finds no other. `verify.py`
re-runs that proof against any committed link, so the claim is checkable from
the tree:

    uv run --with lzstring --with ortools examples/outside-sudoku/verify.py \
      examples/outside-sudoku/PUZZLE_LINK_6x6.txt

After a component change, re-encode a sized link from its recorded seed rather
than searching again — the clue of a line is a pure function of the line, so
the same board comes back out:

    uv run --with lzstring examples/outside-sudoku/rebuild_size.py 6

`build_size.test.py` holds that to a byte: each committed link must equal what
`rebuild_size.rebuild(n)` produces from its gen JSON, the local board
included. The 9x9 global board is the shipped one, so `build_size.py 9 3 3`
and `rebuild_size.py 9` write `PUZZLE_LINK.txt`, not `PUZZLE_LINK_9x9.txt`.

### Which window digit is the clue

The generator's clue is the **largest digit of the window**. Any window digit
would satisfy the rule; picking one deterministically is what lets a rebuild
re-derive the clues with no search. The solver is never told the clue is the
largest — the component, the CP-SAT model and the harness all enforce plain
membership.

### How a clue function sees the direction

A window is 3 across but 2 down on a 6x6, so the line's digits alone do not
fix its length. `framebuild.Spec.clue_fn` therefore takes `(values, cells)`:
`cells` are the line's cells, nearest the clue first, and both of this
example's clue functions read the direction off `cells[0]` and `cells[1]`.
The box shape comes from `build_size.spec_for(bh, bw)`, which builds a Spec for
the size being generated. Clue functions on other examples ignore the second
argument.

## Run

    node examples/outside-sudoku/soundness-harness.mjs
    node examples/outside-sudoku/update-strength.test.mjs
    node examples/outside-sudoku/backends.test.mjs
    uv run --with lzstring examples/outside-sudoku/build_link.test.py
    uv run --with lzstring examples/outside-sudoku/build_size.test.py

All of these run under `just check`. None needs OR-Tools: `framebuild` imports
the solver inside its search, so the clue functions, the document assembly and
the rebuild all reach a test with `lzstring` alone.

## Timing

```
just time outside-sudoku --ring-clues
```

| date | app version | board | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-31 | v2026.08.14-d47fc4b | outside-sudoku | 500ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | outside-sudoku after-logical | 300ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | outside-sudoku (cell-id coercion, #276) | 500ms | 500ms | 1.00 | gate: PASS |
| 2026-08-31 | v2026.08.14-d47fc4b | outside-sudoku (cell-id coercion, #276) after-logical | 300ms | 300ms | 1.00 | gate: PASS |

The last pair is #276, which makes `main-global.js` coerce every cell id it
derives from the board size with `| 0`. It adds no deduction, so the bar is
**≤ 1.1× on both rows** and "unchanged" is the pass
(`docs/real-app-timing.md`, "Bar for a gate change"). This board is closed
almost without searching, so it has too little search left to show the gain
the fix gives a harder board; numbered-rooms is where the effect is visible,
and its README carries the probes that found it. Baseline is the committed
link before the coercion, candidate the same board with it, 3 reps, arms
interleaved.

Both rows print `BASELINE`, not a ratio: the working-tree
`OutsideSudokuComponent.js` is byte-equal to the code `PUZZLE_LINK.txt`
already ships, so `just time` has no candidate to compare against the
committed link. `OPTIMIZATION_LOG.md` has the same numbers and records what
speed work has been considered; see "No `original/` baseline" below for why
there is no second row.

### The local board (#268)

```sh
just time outside-sudoku --board PUZZLE_LINK_local.txt --ring-clues
```

| date | app version | board | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-31 | v2026.08.14-d47fc4b | outside-sudoku (PUZZLE_LINK_local.txt) | 900ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | outside-sudoku (PUZZLE_LINK_local.txt) after-logical | 300ms | — | — | BASELINE |

This is the board that used to ship as `PUZZLE_LINK.txt`, and it times exactly
what it timed then (900 ms / 300 ms on 2026-08-30): the board did not change,
only its name and which lane it wires up. The two boards are not comparable
to each other — they are different boards, seed 101 and seed 123 — so neither
row is a ratio against the other.

### No `original/` baseline

Numbered Rooms, Running Start, and Skyscraper each ship an `original/`
wrapper — real code, pulled verbatim from a ChinStrap "Outside Clues
Interactable" puzzle in the community catalog (`docs/catalog.md`), that does
nothing while its clue cell is blank and, once the clue is filled, swaps
itself for a builtin SudokuMaker class already encoding that rule. The
catalog has no such Outside Sudoku template: `docs/catalog.md`'s spreadsheet
lists interactable templates for Numbered Rooms, Running Start, and
Skyscraper, but none for a plain outside-clue membership rule (checked
2026-08-30 against the live spreadsheet CSV). `docs/builtin-components.md`
does list `RequiredDigitsComponent(name, values, cells)`, which could in
principle stand in for the builtin half of such a wrapper — but no author has
built and shipped that wrapper, so it would be code this repo writes and
maintains, not a verbatim baseline. Keep an `original/` baseline "only where
`just time` actually compares against it" (`docs/example-layout.md`), and
inventing the comparison target defeats that: this example has no
`original/` dir and no `_original` link. `OPTIMIZATION_LOG.md` logs the
`RequiredDigitsComponent` wrapper as a considered-not-built idea for a future
ticket.

## Not covered

Variant clue semantics (Outside Consecutive, "the digit must NOT appear",
several digits per clue), boards over 9x9, and any deduction that couples the
clues of one line or one side. See #259, Out of Scope.
