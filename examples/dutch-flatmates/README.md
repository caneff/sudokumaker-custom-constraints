# Dutch Flatmates

One shareable link (`PUZZLE_LINK.txt`): a ringless 9x9 sudoku, **23 givens**,
plus one rule. Every 5 needs a flatmate: a 1 in the cell directly above it, or
a 9 in the cell directly below it. A 5 in the top row can only have the 9 below;
a 5 in the bottom row can only have the 1 above.

`validate` checks the rule on a full grid; `update` prunes per column. When the
app says a column cannot repeat (`getCellsCanHaveRepeats`, through
`line-kind.js`), it is a house, so it holds one 5, one 1 and one 9, and `update`
keeps only the rows some arrangement of the three still supports: a 5 with a 1
above it and a 9 elsewhere, or a 9 below it and a 1 elsewhere. A column that can
repeat gets only the per-cell rule: a 5 with no 1 above and no 9 below goes. The board
also keeps plain sudoku's completions few (1,279 on the shipped givens). The
pruning was timed against the validate-only first slice and kept (see Timing).

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
| `DutchFlatmatesComponent.js` | The one component: `validate` on a full grid, an `update` that prunes 1/5/9 per column, house columns by the arrangement rule and the rest per cell |
| `main.js` | Registers **one** component over the whole grid, built by coordinates, row-major |
| `flatmate_model.py` | The rule as a CP-SAT model: the one home of the rule on the Python side |
| `generate.py` | Random grid, then givens carved while the board stays unique (writes `gen.json`); `--max-plain` raises the carve's plain-completions bound for fewer givens |
| `gen.json` | The shipped board: the solution, the given cells, the seed |
| `gen_18g.json`, `PUZZLE_LINK_18g.txt` | The 18-given timing board and its link: evidence that partner pointing (#678) could not be timed (see Timing) |
| `gen_0g.json`, `PUZZLE_LINK_0g.txt`, `NoFiveComponent.js` | The Counting Circles timing board, the one board where the component still searches in the app (see below) |
| `build_link.py` | Builds `PUZZLE_LINK.txt` from `gen.json`, and `PUZZLE_LINK_0g.txt` from `gen_0g.json`; `--component` swaps a candidate in |
| `verify.py` | The uniqueness proof and the rule-forces-a-flatmate check |
| `app-open.mjs` | Opens the link in the app once and prints rules, verdict and solved grid |

No local lane (`main-global.js`, `PUZZLE_LINK_local.txt`, `gen_local.json`):
one whole-grid constraint has no drawn groups to split a lane from, so
`check_layout.py` lists the example in `NO_LOCAL_GLOBAL_SPLIT`; that entry is
what the checker needed. The ticket also asked for a `RINGLESS_SUDOKU` entry,
which is in place but does no work for this board: the link carries the shared
grid backend, so `check_layout.is_no_ring` already gives it the "Normal sudoku
rules apply." opening. It matters only if the board is ever rebuilt without that
backend.

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
is the shape up-to-n's ringless links have (house-gac's carries a research
"Rows & Columns" backend instead).

## Counting Circles board (`PUZZLE_LINK_0g.txt`): the searchable timing board

Every other board here reads 0 ms in the app, so a change to the flatmate code
cannot be timed on them. This one is Flinty's "Dutch Flat Mates (Counting
Circles)" (https://sudokupad.app/pdhr2gqlhe, made in Sudoku Maker v2024.03.28),
committed as a second board. It has **no givens**, hence `0g`. Rules: normal
sudoku; both main diagonals unique; Dutch Flatmates; Counting Circles on 28
cells (a digit in a circle is the number of circles holding that digit); no 5 in
a circle. The rules text opens "Normal sudoku rules apply." and names all five
plus the credit.

- **Document:** the same ringless 9x9 as the plain board, plus the app's
  built-in constraints for the diagonals (types 10 and 11) and Counting Circles
  (type 306), and a second custom constraint, `No 5 in circles`, which registers
  `NoFiveComponent` over the 28 circle cells. The built-in shapes are the ones
  the app's production bundle writes; the app solving the board to a unique
  verdict is the only check they have beyond that.
- **Why `NoFiveComponent` is its own constraint, in its own file.**
  `check_layout.check_components` compares each custom constraint's shipped
  components with what its own backend registers, so a second constraint that
  ships and registers one component passes with no allow-list. It is not a shared
  component: no other example needs it.
- **`just time` leaves it alone.** `link_swap.swap_build` finds the constraint
  that registers `DutchFlatmatesComponent` and replaces only that component's
  code, then asserts the two docs differ nowhere else (`check_and_write`), so the
  diagonals, circles and `NoFiveComponent` stay as committed.
- **Uniqueness, proved two ways.** CP-SAT (`flatmate_model.Extras`, the model's
  diagonals and Counting Circles, one worker, seed 0, about 1.5 s) finds exactly
  one solution and it is `gen_0g.json`'s grid, which is SudokuPad's recorded
  solution; `build_link.test.py` runs `verify()` on it. The app says
  unique too (below). `build_link.test.py` also states every rule independently
  on the recorded grid.
- **Regenerate:** `uv run examples/dutch-flatmates/build_link.py --puzzle
  examples/dutch-flatmates/gen_0g.json --out examples/dutch-flatmates/PUZZLE_LINK_0g.txt`.
  `gen_0g.json` came from the SudokuPad puzzle through
  `sudokupad-art/tools/unzip_scl.py pdhr2gqlhe`: its solution string and the 28
  `underlays` centres (row * 9 + column).

Baseline, `just time dutch-flatmates --board PUZZLE_LINK_0g.txt` (strip mode,
non-deterministic solve off, 3 reps, candidate byte-equal so baseline rows only),
2026-10-02, app `v2026.08.14-d47fc4b`:

| date | app version | fixture | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates (PUZZLE_LINK_0g.txt) | 11800ms | — | — | BASELINE |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates (PUZZLE_LINK_0g.txt) after-logical | 11500ms | — | — | BASELINE |

One `app-solve.mjs` rep reads `[unique]`: 9.6 s to the first solution, 2.5 s to
prove no other.

## Proof of uniqueness

```
uv run examples/dutch-flatmates/verify.py
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
uv run examples/dutch-flatmates/build_link.py
```

`generate.py --max-plain N` raises the plain-completions bound the carve keeps
(default 2,000) for a board with fewer givens. `gen_18g.json` came from
`uv run examples/dutch-flatmates/generate.py --seed 4 --max-plain 100000000
--out examples/dutch-flatmates/gen_18g.json`, and the link from `cd
examples/dutch-flatmates && uv run build_link.py --puzzle gen_18g.json --out
PUZZLE_LINK_18g.txt`.

`generate.py` takes CP-SAT's 8-worker portfolio for the grid search, so one
seed does not give one grid; `gen.json` is the record, and the link is rebuilt
from it. The carve stops removing givens at 2,000 plain-sudoku completions
(`MAX_PLAIN_COMPLETIONS`): the 19-given minimum seed 1's carve reaches without that
bound has over 100,000 completions, and the first slice's validate-only component
left the app to enumerate them. The bound is the default: it keeps the search small
whether or not `update` prunes. `--max-plain` raises it for a harder board.

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
candidates" says unique solution (first solve 100 ms, uniqueness search 100 ms,
read on the first slice's validate-only link; the pruning link shipped now reads 0 ms
and 0 ms, re-run for #685, below)
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
on this example (Timing, below).

## Tests

```
node examples/dutch-flatmates/validate.test.mjs
node examples/dutch-flatmates/soundness-harness.mjs
node examples/dutch-flatmates/update-strength.test.mjs
node examples/dutch-flatmates/update-prune.test.mjs
node examples/dutch-flatmates/no-five.test.mjs
node examples/dutch-flatmates/end-to-end.test.mjs
uv run examples/dutch-flatmates/flatmate_model.test.py
uv run examples/dutch-flatmates/build_link.test.py
```

- `validate.test.mjs` — a full grid satisfying the rule passes; a 5 lacking both
  flatmates fails; the top-row 5 (9 below only) and bottom-row 5 (1 above only)
  cases; a 9 above or a 1 below is not a flatmate; an unfilled grid is not judged;
  the shipped solution passes.
- `soundness-harness.mjs` — `main.js` registers one component over 81 cells
  row-major (an id order scrambled by the mock, so a build by index fails); a
  rectangle or a missing cell throws; 5,000 random partial boards consistent
  with the shipped solution lose no true value, and some lose candidates (the
  prune is live).
- `update-prune.test.mjs` — targeted cases through what a caller sees (columns
  declared houses; a second set with none declared: a column that can repeat
  keeps the 1s the house rule would drop, still loses a 5 with no flatmate, and
  is not stopped for lacking a 5): a 5 with
  no 1 above and no 9 below is pruned, as is a top-row 5 with no 9 below and a
  bottom-row 5 with no 1 above; a pinned 5 pins its flatmate; an open board
  loses nothing; a column with no possible 5 stops the branch; repeat calls are
  idempotent, re-prune after a backtrack restores a candidate, and see a column
  that changed.
- `no-five.test.mjs` — `NoFiveComponent`'s `initialize` removes the 5 from exactly
  the 28 circle cells, `validate` refuses a 5 there, and the recorded solution
  keeps every true value.
- `support-equivalence.test.mjs` — the readable `supportedRows` returns the same
  three row sets as the floor's 9³ triple loop on every 1/5/9 column state: all
  2,396,672 states of 3- to 7-row columns, and 497,336 on the real 9-row column
  (a fixed-seed fuzz across densities plus every state with at most two rows per
  digit). The 9-row column is fuzzed, not exhaustive (2^27 states).
- `update-strength.test.mjs` — the floor is a frozen copy of the pruning
  component, `.golden/DutchFlatmatesComponent.floor.js` (the component and its
  floor land in one squash-merged PR, so a pinned sha would name a commit main
  never holds). Replace that copy in the same commit as a stronger `update`.
- `end-to-end.test.mjs` — the spec as a whole through the app's own solver
  (`bundle-solve-lib.mjs`), on the shipped link and the 18-given one: rules text,
  one whole-grid component, exactly one solution equal to `gen.json`'s, the rule
  needed for uniqueness (1,279 plain completions on the shipped givens), the true
  grid accepted and rule-breaking sudoku grids refused. Its header lists what a
  green run does not cover: the live app and solve time.
- `flatmate_model.test.py` — the CP-SAT model against a plain Python statement of
  the rule on 150 sudoku symmetries of the solution, both verdicts and the edge
  rows covered.
- `build_link.test.py` — the committed link is what the builder writes; it decodes
  to the ringless 9x9, `gen.json`'s givens, the rules text and exactly one
  `DutchFlatmatesComponent`; a swap round-trips; a board missing givens, and a
  grid that is not the board's solution, are refused; and `verify.py` passes on
  both boards, with the Counting Circles board's link, rules text, circles and
  `NoFiveComponent` checked too.

## Timing

`just time dutch-flatmates` (no flags, strip mode, 3 reps, non-deterministic
solve off) on the pruning component against the committed validate-only link,
run three times; every run printed these rows and `two-row rule: SHIP`. The
driver then timed all baseline reps, then all candidate reps, per row, so these
reps were block-ordered, not interleaved as `docs/real-app-timing.md` asks; the
driver interleaves since #682, and these rows were not re-run, as 200 ms -> 0 ms
is far beyond any drift between blocks. The app reads in 100 ms steps, and the three runs agree, so the 200 ms -> 0 ms gap is
outside run-to-run spread.

| date | app version | fixture | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates | 200ms | 0ms | 0.00 | PASS |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates after-logical | 200ms | 0ms | 0.00 | PASS |

Baseline (validate-only, slice 1, `BASELINE` rows): 200 ms cold, 200 ms
after-logical. The shipped `PUZZLE_LINK.txt` carries the pruning component.

**Partner pointing (#678) could not be timed.** The shipped pruning reads 0 ms
on `PUZZLE_LINK.txt`, which leaves no ratio. Boards carved with fewer givens
(`generate.py --max-plain`: 21, 20 and 18 givens) read the same, so the 18-given
board, `PUZZLE_LINK_18g.txt` (`gen_18g.json`), is the committed evidence:

| date | app version | fixture | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates (PUZZLE_LINK_18g.txt) | 0ms | — | — | BASELINE |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates (PUZZLE_LINK_18g.txt) after-logical | 0ms | — | — | BASELINE |

No partner-pointing deduction was written; see `OPTIMIZATION_LOG.md`.

Close-out (#685), 2026-10-02: `app-open.mjs --live` and `just time dutch-flatmates`
re-run on the shipped `PUZZLE_LINK.txt` (app `v2026.08.14-d47fc4b`). The open
matched the Live app section above (23 givens, rules text, unique, grid equal to
the solution). `just time` read 0 ms cold and 0 ms after-logical, as BASELINE
rows because the committed link now is the pruning candidate, so they match the
candidate column above.

Readable rewrite and house gate (#690), 2026-10-02, on the Counting Circles
board (the shipped board reads 0 ms, so it cannot show a ratio). `just time
dutch-flatmates --board PUZZLE_LINK_0g.txt`, 3 reps, interleaved, non-deterministic
solve off, old component (committed link) against the rewrite:

| date | app version | fixture | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates (PUZZLE_LINK_0g.txt) | 11800ms | 11600ms | 0.98 | PASS (≤ 1.1x) |
| 2026-10-02 | v2026.08.14-d47fc4b | dutch-flatmates (PUZZLE_LINK_0g.txt) after-logical | 11200ms | 11200ms | 1.00 | PASS (≤ 1.1x) |

The driver prints FAIL and `NO SHIP` on these rows because it applies the 0.9x
rule of an added deduction. The rewrite adds none, so the bar is the gate-change
bar of `docs/real-app-timing.md`: ≤ 1.1x on both rows. All three links were
rebuilt from the rewrite (`build_link.py`, `--puzzle gen_18g.json`, `--puzzle
gen_0g.json`).
