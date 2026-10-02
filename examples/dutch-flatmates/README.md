# Dutch Flatmates

One shareable link (`PUZZLE_LINK.txt`): a ringless 9x9 sudoku, **23 givens**,
plus one rule. Every 5 needs a flatmate: a 1 in the cell directly above it, or
a 9 in the cell directly below it. A 5 in the top row can only have the 9 below;
a 5 in the bottom row can only have the 1 above.

The component is **validate-only**: `validate` checks the rule on a full grid
and `update` removes nothing. That is the baseline a pruning deduction is timed
against. Because the app then only learns the rule by trying values, the board
keeps plain sudoku's completions few (1,279 on the shipped givens), so the
app's search over them stays quick (see Timing).

The one solution:

```
197523468
526948713
438716952
319854627
652397184
784162539
941235876
275689341
863471295
```

## Files

| File | Holds |
| --- | --- |
| `DutchFlatmatesComponent.js` | The one component: `validate` on a full grid, an `update` that removes nothing |
| `main.js` | Registers **one** component over the whole grid, built by coordinates, row-major |
| `flatmate_model.py` | The rule as a CP-SAT model: the one home of the rule on the Python side |
| `generate.py` | Random grid, then givens carved while the board stays unique (writes `gen.json`) |
| `gen.json` | The shipped board: the solution, the given cells, the seed |
| `build_link.py` | Builds `PUZZLE_LINK.txt` from `gen.json`; `--component` swaps a candidate in |
| `verify.py` | The uniqueness proof and the rule-forces-a-flatmate check |
| `app-open.mjs` | Opens the link in the app once and prints rules, verdict and solved grid |

No local lane (`main-global.js`, `PUZZLE_LINK_local.txt`, `gen_local.json`):
one whole-grid constraint has no drawn groups to split a lane from, so
`check_layout.py` lists the example in `NO_LOCAL_GLOBAL_SPLIT`, and in
`RINGLESS_SUDOKU` for its "Normal sudoku rules apply." opening. Those two
entries were all `check_layout.py` needed.

## Board: a ringless 9x9, built here and not by framebuild

`framebuild` cannot host this board. Its only ringless path (`no_ring_doc`)
reads drawn groups and a per-line clue function from a `Spec`; a flatmate board
has neither. `build_link.py` writes the document itself, in the shape
`no_ring_doc` produces: a `"custom"` document, a region constraint for the
boxes, the given-digits constraint, and the shared whole-grid rows-and-columns
backend (`examples/_shared/grid-rowcol.js`, through
`framebuild.grid_backend_constraint`), then the flatmate constraint. Because the
link carries that backend, `check_layout.py` reads it as a no-ring board.

A `"sudoku"` document would have kept the app's full technique set and given
rows and columns for free, but `check_layout.py` would then need its own
reading of an implicit-houses board; a custom document with the shared backend
is the shape every other ringless link here already has.

## Proof of uniqueness

```
uv run --with lzstring --with ortools examples/dutch-flatmates/verify.py
```

Four checks: the board has exactly one solution (CP-SAT, one worker, seed 0)
and it is `gen.json`'s grid; plain sudoku on the same givens has more than one,
so the rule is needed; at least one 5 has its flatmate forced by the rule
rather than the givens; and the link's givens are `gen.json`'s. `build_link.test.py`
runs it, so `just check` re-proves the board.

**How "a flatmate is forced by the rule, not the givens alone" was checked.**
For each 5 in the solution, `flatmate_model.rule_forced_flatmates` solves plain
sudoku (no flatmate rule) with the shipped givens and asks that the 5's
flatmate cell differ from its solution digit. A feasible answer means the givens
alone leave that cell open, so only the rule pins it. Eight of the nine 5s
qualify: r1c4, r3c8, r4c5, r5c2, r6c7, r7c6, r8c3, r9c9 (r1c4 is a top-row 5 and
r9c9 a bottom-row one, so both edge cases are in play).

## Rebuilding

```
uv run examples/dutch-flatmates/generate.py          # a fresh gen.json (seed 1, then up)
uv run --with lzstring examples/dutch-flatmates/build_link.py
```

`generate.py` takes CP-SAT's 8-worker portfolio for the grid search, so one
seed does not give one grid; `gen.json` is the record, and the link is rebuilt
from it. The carve stops removing givens at 2,000 plain-sudoku completions
(`MAX_PLAIN_COMPLETIONS`): the 19-given minimum the carve reaches without that
bound has over 100,000 completions, and a validate-only component leaves the app
to enumerate them.

## Live app

`app-open.mjs` opens the link once and prints what the app shows:

```
node examples/dutch-flatmates/app-open.mjs --live
```

Run 2026-10-02 against sudokumaker.app, app `v2026.08.14-d47fc4b`: the link
loads with 23 givens drawn; the play page's rules text reads "Normal sudoku
rules apply. Dutch Flatmates: every 5 needs a flatmate, a 1 directly above it
or a 9 directly below it. A 5 in the top row needs the 9 below it, and a 5 in
the bottom row needs the 1 above it."; "Find all solutions and valid
candidates" says unique solution (first solve 100 ms, uniqueness search 100 ms)
and the grid it fills is the solution above, cell for cell. The same run
against the recorded app (`examples/_shared/sudokumaker.har`, no `--live`) gives
the same verdict and grid, and reads no rules text: the recording holds no play
page.

## `just time` on a ringless board

Read from the source (`examples/_shared/time_example.py`, `probe_link.py`):

- `time_example.run` takes `mode = "empty" if ring_clues else "strip"`, so with
  no `--ring-clues` the board is stripped to its givens (`strip_to_givens`: every
  non-given cell cleared, ring or not). A ringless board has no ring to keep and
  needs no flag.
- `check_stripped(..., ring_clues=False)` then insists every non-given cell is
  empty, which a stripped board is. The same strip mode serves isofill.
- The candidate is built by `build_link.py --component FILE --out FILE`
  (`link_swap.swap_main`), the baseline backend found by `resolve_backend_file`
  among `main.js`/`main-global.js` at git HEAD. Both are met here: `main.js`
  has to be committed before the run, or it refuses naming that.

So `just time dutch-flatmates` needs no flag and runs in strip mode. It was run
once on this example (below).

## Tests

```
node examples/dutch-flatmates/validate.test.mjs
node examples/dutch-flatmates/soundness-harness.mjs
node examples/dutch-flatmates/update-strength.test.mjs
uv run examples/dutch-flatmates/flatmate_model.test.py
uv run --with lzstring examples/dutch-flatmates/build_link.test.py
```

- `validate.test.mjs` — a full grid satisfying the rule passes; a 5 lacking both
  flatmates fails; the top-row 5 (9 below only) and bottom-row 5 (1 above only)
  cases; a 9 above or a 1 below is not a flatmate; an unfilled grid is not judged;
  the shipped solution passes.
- `soundness-harness.mjs` — `main.js` registers one component over 81 cells
  row-major (an id order scrambled by the mock, so a build by index fails); a
  rectangle or a missing cell throws; 5,000 random states around the shipped
  solution lose no true value and lose no candidate at all.
- `update-strength.test.mjs` — the floor is a frozen copy of the validate-only
  component, `.golden/DutchFlatmatesComponent.floor.js` (the component and its
  floor land in one squash-merged PR, so a pinned sha would name a commit main
  never holds). Replace that copy in the same commit as a stronger `update`.
- `flatmate_model.test.py` — the CP-SAT model against a plain Python statement of
  the rule on 150 sudoku symmetries of the solution, both verdicts and the edge
  rows covered.
- `build_link.test.py` — the committed link is what the builder writes; it decodes
  to the ringless 9x9, `gen.json`'s givens, the rules text and exactly one
  `DutchFlatmatesComponent`; a swap round-trips; a board missing givens, and a
  grid that is not the board's solution, are refused; and `verify.py` passes.

## Timing

TIMING_PLACEHOLDER
