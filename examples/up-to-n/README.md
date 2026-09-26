# Up to N — a worked custom constraint with no ring

A clue sits in a **marker**: two cells drawn as a group at one end of a whole
row or column. **N** is that row's or column's number (a marker on column 3
aims at the 3). Reading inward from the marker, the digits before the first N
sum to the clue. N itself is never added, so a line whose first cell holds N
has the clue 0.

For example, a clue of 4 at the left end of row 2 is true of the row `3124`:
the row aims at 2, and 3 + 1 = 4. A marker with no number is not a clue.

On an n×n board let TOTAL = n(n+1)/2 (10, 21 and 45 at 4×4, 6×6 and 9×9). A
line aiming at N carries a clue from 0 (N first) to TOTAL - N (N last).

**The far end carries no information.** A row or column holds N exactly once,
so the clues read from its two ends split the rest of the line between them
and always sum to TOTAL - N. A marker at the far end of a clued line is a
wasted clue.

The board is a plain n×n sudoku with nothing around it. There is no clue ring
and no global variant: every clue is typed into a drawn group's value, so a
board with no groups has no clues to read.

## Files

- `main.js` — the backend segment. Reads every drawn group as a marker and
  registers one `UpToNComponent` per clued marker, its line ordered from the
  marker inward.
- `UpToNComponent.js` — the line component: `update` and `validate`.
- `build_link.py` — the component swap `just time` uses.
- `build_size.py` — the rule's Python half (`up_to_n`, the CP-SAT model
  `add_up_to_n`, the rules text and the drawn markers, together as `SPEC`);
  builds a board at any size, or re-encodes a committed one.
- `build_link.test.py` — the CP-SAT model and `validate` agree on hand-built
  lines; every committed board decodes to what its gen JSON records, CP-SAT
  proves it unique, and `--rebuild` reproduces its link byte for byte.
- `marker-contract.test.mjs` — what `main.js` accepts and refuses.
- `end-to-end.test.mjs` — the committed 4×4 and 6×6 links through the app's own
  solver bundle in Node: one solution, the recorded one; empty markers ignored;
  a wrong clue and malformed markers refused.
- `soundness-harness.mjs` — zero removed true candidates.
- `update-strength.test.mjs` — never weaker than the frozen floor in
  `.golden/UpToNComponent.floor.js` (below).
- `PUZZLE_LINK.txt`, `gen.json` — the shipped 9×9: 18 clues, no givens.
- `PUZZLE_LINK_9x9.txt`, `gen_9x9.json` — the carve's minimal 9×9: the same
  solution with 13 clues, no givens. Unique by CP-SAT, but the live app times
  out on it (below). It is the benchmark for a stronger component.
- `PUZZLE_LINK_4x4.txt`, `gen_4x4.json` — a 4×4 (2×2 boxes).
- `PUZZLE_LINK_6x6.txt`, `gen_6x6.json` — a 6×6 (2×3 boxes).

## The marker contract

`main.js` checks every group before it registers anything, so a refusal never
leaves the constraint half set up. A group is a valid marker when it is
exactly two cells, adjacent in one row or column, and the two end cells of
that line; the cell on the border is the reading end. Setup throws, naming the
group's cells, for:

- a group that is not two adjacent cells in one row or column, or not at an
  end of its line;
- two markers on the same line and end, even when one is empty;
- a clued marker whose value is not a whole number 0 or above (a typed 0 is
  a clue: N is the first cell);
- a clued marker whose target digit is outside the puzzle's digit range;
- a clued marker whose value is above TOTAL - N, the most its line can read
  (TOTAL here is the sum of the puzzle's digits, `minDigit..maxDigit`).

A marker with an empty value is checked for shape and then registers nothing.

**What the author sees.** The live app shows a banner under the grid,
"Registering custom constraint 'Up to N' failed", with the message, and
drops the whole constraint: the board then solves as a plain sudoku. Checked
live and through the solver bundle in
`docs/research/368-up-to-n-setup-throw.md`.

## What the component deduces

For each position p a first N could take, the prefix before p sums to at least
the sum of every earlier cell's smallest digit other than N, and at most the
sum of their largest. p is **feasible** when the cell allows N, no earlier cell is
forced to N, and the clue lies inside those bounds.

- N leaves every cell before the first feasible position.
- On a house, where the first N is the only N, N leaves every infeasible
  position. On a bare line a later cell may hold a second N the sum never
  reads, so it keeps N.
- A cell before every feasible position keeps only the digits d some
  feasible position admits: with that position's bounds lo..hi and the cell's
  own smallest and largest non-N digits, lo - smallest + d <= clue <=
  hi - largest + d.
- No feasible position at all stops the branch.
- `validate` walks a filled line to the first N and compares the sum, and
  refuses a line with no N.

Both bounds only grow along the line, so the feasible positions of cells that
allow N form one unbroken run. The line kind comes from
`getCellsCanHaveRepeats`, asked in `update` and cached once true.

## The board

`framebuild.py`'s no-ring mode builds it: a `"custom"` n×n document, its rows
and columns declared by `examples/_shared/grid-rowcol.js`, and all 4n markers
drawn. The live editor opens a `"sudoku"` document as 9×9 whatever its width
says, so the header cannot supply them
(`docs/research/368-up-to-n-setup-throw.md`). The carve fills every clue from
the solution, removes givens while CP-SAT still proves one solution, then
blanks clue values the same way.

A fresh search overwrites that size's pair; 40 seeds take about 4 minutes at
9×9 and seconds at 4×4 and 6×6. A fresh 9×9 lands on the plain names, so move
it to the `_9x9` pair and derive the shipped board from it:

```
uv run examples/up-to-n/build_size.py 6 2 3 --local
uv run examples/up-to-n/build_size.py 4 2 2 --local
uv run examples/up-to-n/build_size.py 9 3 3 --local
git mv examples/up-to-n/PUZZLE_LINK.txt examples/up-to-n/PUZZLE_LINK_9x9.txt
git mv examples/up-to-n/gen.json examples/up-to-n/gen_9x9.json
uv run examples/up-to-n/build_size.py --derive-shipped-9x9
```

After a change to `main.js`, the component, `grid-rowcol.js`, the labels or
the rules text, re-encode every committed board instead, with no search:

```
uv run examples/up-to-n/build_size.py --rebuild 4 --local
uv run examples/up-to-n/build_size.py --rebuild 6 --local
uv run examples/up-to-n/build_size.py --rebuild 9 --local
uv run examples/up-to-n/build_size.py --rebuild-minimal-9x9
```

`--local` is required: a no-ring board has only the drawn-groups lane.

**Clue labels.** A drawn group renders nothing in the app, so the builder
draws each clued marker's number as a text label half a cell outside the grid,
beyond the marker's border cell (a type-2002 cosmetic symbol,
`framebuild.clue_labels`). The label is written from the group's own value,
and `framebuild.check` and `build_link.test.py` hold the two equal; a blank
marker gets no label. The labels exist only on generated boards: a setter who
draws a marker by hand in the editor must add a text cosmetic for its clue by
hand (Add element, "Cosmetic symbols", Text).

**Two 9×9 boards.** The carve's minimal 9×9 shows 13 clues and no givens, and
the live app finds no solution to it within 300 s. The same solution with more
clues shown, still no givens, was timed at 15 (timeout), 18 (unique, 15 s) and
24 (unique, 13 s) clues (`docs/research/368-up-to-n-setup-throw.md`, finding
5). The shipped board is the 18-clue one, derived from the minimal one by
`build_size.py --derive-shipped-9x9`; the minimal one stays as
`PUZZLE_LINK_9x9.txt`.

## Run the tests

```
node examples/up-to-n/marker-contract.test.mjs
node examples/up-to-n/end-to-end.test.mjs
node examples/up-to-n/soundness-harness.mjs
node examples/up-to-n/update-strength.test.mjs
uv run examples/up-to-n/build_link.test.py
```

The soundness harness runs 20,000 states per pool at sizes 4, 6 and 9 over a
full house, a house one cell short of the digit count, a bare line with
repeats, and a bare line holding its target twice. A line without its target
has no true clue, so it is covered by the agreement check instead: on a
filled line, `update` kills the branch exactly when `validate` refuses it.

**The strength floor is a frozen copy, not a commit.** Siblings pin
`REF_COMMIT` and read the floor with `git show`. This example's component and
its floor landed in one squash-merged pull request, which rewrites every
branch commit, so a pinned sha would name a commit main never holds. Raise the
floor by replacing `.golden/UpToNComponent.floor.js` in the commit that makes
the component stronger.

## Timing

| 2026-09-14 | v2026.08.14-d47fc4b | up-to-n | 14500ms | — | — | BASELINE |
| 2026-09-14 | v2026.08.14-d47fc4b | up-to-n after-logical | 10900ms | — | — | BASELINE |

`just time up-to-n` on the shipped 18-clue 9×9, 3 reps, non-deterministic
solve off. Candidate code is byte-equal to the committed link, so only baseline
rows print: this is the floor a later component change is judged against.

**The rule correction (#613) costs nothing.** The component and the board
changed together, so a component swap into the old board would time a
different puzzle; `just time up-to-n` on the corrected tree prints baseline
rows only, 2026-09-26:

| 2026-09-26 | v2026.08.14-d47fc4b | up-to-n | 16400ms | — | — | BASELINE |
| 2026-09-26 | v2026.08.14-d47fc4b | up-to-n after-logical | 12000ms | — | — | BASELINE |

The comparison is link vs link instead: the committed `PUZZLE_LINK.txt` before
the correction against the one after, both stripped, one rep of each per round,
3 rounds interleaved, non-deterministic solve off. It is not a `just time` row.

| board | before | after | ratio |
|---|---|---|---|
| up-to-n | 16200ms | 15800ms | 0.98x |
| up-to-n after-logical | 12000ms | 12000ms | 1.00x |

Both rows sit inside 1.1×, the bar for a change that adds no deduction: the
bounds and the clue shift by N together, so `update` prunes the same cells.

**The prefix-cell prune (#369) pays for itself.** `just time up-to-n` with
the prune stripped from the working-tree component (the committed link, with
the prune, as baseline) refused on its cold row, 2026-09-14:

```
RuntimeError: app-solve.mjs: /tmp/tmpuz1_9pfc/candidate_probe.txt: all 3 reps hit the 300s per-rep timeout (3 timed out)
```

Without the prune the shipped board does not solve inside 300 s; with it, it
solves in 14.5 s. The refusal is the record: there is no ratio to print.

`PUZZLE_LINK_9x9.txt`, the minimal 13-clue board, has no row: the live app
found no solution to it within 300 s in one rep
(`docs/research/368-up-to-n-setup-throw.md`, finding 5), and a DNF on record is
not re-measured.
