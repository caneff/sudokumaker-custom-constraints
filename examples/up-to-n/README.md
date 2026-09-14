# Up to N — a worked custom constraint with no ring

A clue sits in a **marker**: two cells drawn as a group at one end of a whole
row or column. **N** is that row's or column's number (a marker on column 3
aims at the 3). Reading inward from the marker, the digits up to and including
the first N sum to the clue.

For example, a clue of 6 at the left end of row 2 is true of the row `3124`:
the row aims at 2, and 3 + 1 + 2 = 6. A marker with no number is not a clue.

The board is a plain n×n sudoku with nothing around it. There is no clue ring
and no global variant: every clue is typed into a drawn group's value, so a
board with no groups has no clues to read.

## Files

- `main.js` — the backend segment. Reads every drawn group as a marker and
  registers one `UpToNComponent` per clued marker, its line ordered from the
  marker inward.
- `UpToNComponent.js` — the line component: `update` and `validate`.
- `build_link.py` — the rule's Python half (`up_to_n`, the CP-SAT model
  `add_up_to_n`, the rules text and the drawn markers, together as `SPEC`), the
  board generator, and the component swap `just time` uses.
- `build_link.test.py` — the CP-SAT model and `validate` agree on hand-built
  lines; the shipped board decodes to what `gen.json` records and CP-SAT proves
  it unique.
- `marker-contract.test.mjs` — what `main.js` accepts and refuses.
- `soundness-harness.mjs` — zero removed true candidates.
- `update-strength.test.mjs` — never weaker than the frozen floor in
  `.golden/UpToNComponent.floor.js` (below).
- `PUZZLE_LINK.txt`, `gen.json` — the shipped 4×4 board (2×2 boxes) and its
  record.

## The marker contract

`main.js` checks every group before it registers anything, so a refusal never
leaves the constraint half set up. A group is a valid marker when it is
exactly two cells, adjacent in one row or column, and the two end cells of
that line; the cell on the border is the reading end. Setup throws, naming the
group's cells, for:

- a group that is not two adjacent cells in one row or column, or not at an
  end of its line;
- two markers on the same line and end, even when one is empty;
- a clued marker whose value is not a positive integer;
- a clued marker whose target digit is outside the puzzle's digit range.

A marker with an empty value is checked for shape and then registers nothing.

**What the author sees.** The live app shows a banner under the grid,
"Registering custom constraint 'Up to N' failed", with the message, and
drops the whole constraint: the board then solves as a plain sudoku. Checked
live and through the solver bundle in
`docs/research/368-up-to-n-setup-throw.md`.

## What the component deduces

For each position p a first N could take, the prefix before p sums to at least
N plus every earlier cell's smallest digit other than N, and at most N plus
their largest. p is **feasible** when the cell allows N, no earlier cell is
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
blanks clue values the same way. The shipped 4×4 needs no givens and three
clues.

Regenerate it (overwrites `PUZZLE_LINK.txt` and `gen.json`):

```
uv run examples/up-to-n/build_link.py generate 4 2 2
```

**Known gap.** A drawn group renders nothing, so the markers and their clues
do not show on the board.

## Run the tests

```
node examples/up-to-n/marker-contract.test.mjs
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

No `just time` row yet.
