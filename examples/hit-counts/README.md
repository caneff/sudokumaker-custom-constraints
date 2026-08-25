# Hit Counts — a worked custom constraint

An outside clue on a line counts the "hits". Read the line inward from the clue.
A cell is a hit when its digit equals its distance from the clue: the first cell
hits on a 1, the second on a 2, and so on. The clue is the number of hits.

For example, the row `184356729` gives a left clue of **5**. Reading from the
left, cells 1, 5, 6, 7, 9 hold the digits 1, 5, 6, 7, 9 — each digit equals its
distance from the left, so five cells hit. The same row gives a right clue of
**3**: reading from the right, the digits 2, 5, 8 sit two, five, and eight steps
in, so three cells hit. A clue of **0** is legal — it means no cell holds its own
distance.

Because the line holds each digit once, a hit is a fixed point of the line read
as a permutation, and the clue counts those fixed points. Each cell hits or
misses on its own, so the clue is a plain count of independent cells — no runs,
no ordering. That makes Hit Counts simpler than Running Start.

## Files

- `main.js` — the backend segment. One component per clued line.
- `HitCountsComponent.js` — the per-line component. It bounds the clue from the
  line and forces or forbids hits when the clue's range demands it.
- `SideSumComponent.js` — the per-side component. The `n` clues on one side sum
  to exactly `n`; it propagates that sum across the side's clue cells.
- `HitCountsPairComponent.js` — the opposite-pair component. It couples the two
  clues on the ends of one line through `A + B <= n` (`+ 1` when `n` is odd), and
  at that cap pins every cell to two values.
- `soundness-harness.mjs` — Node soundness test (see below).
- `recovery-probe.mjs` — measures whether the matching bound actually helps solve a
  real generated puzzle (see "Does the tighter bound help?" below).
- `build_size.py` — builds the whole document from scratch for any grid size. It
  generates a grid, derives every line's hit count, carves a unique puzzle
  (OR-Tools), and encodes the link:
  `uv run --with ortools --with lzstring examples/hit-counts/build_size.py 4 2 2`
  `uv run --with ortools --with lzstring examples/hit-counts/build_size.py 6 2 3`
  `uv run --with ortools --with lzstring examples/hit-counts/build_size.py 9 3 3`
  The three args are the grid size and the box height and width (`box_height *
  box_width == size`).
- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK_9x9.txt` — the built
  SudokuMaker links. Open one to play the example.
- `../_shared/frame.py`, `../_shared/minify.py` — build helpers shared with
  Running Start (the interactive-outside frame cosmetics and the link-shrinking
  pass). `../_shared/harness-lib.mjs` holds the soundness-harness scaffold.

## Side sums — a strong global clue

The `n` clues on one side sum to **exactly** `n`. Take the left side. Its clue on
row `r` counts the columns `j` where row `r` holds digit `j` at column `j`. Sum
the left clues over all rows and regroup by column: for column `j`, how many rows
hold digit `j` in column `j`? Column `j` is a permutation of `1..n`, so digit `j`
sits there exactly once. Every column gives one hit, so the left clues sum to
`n`. Rows are permutations too, so the same holds for every side.

This couples every clue on a side: knowing `n - 1` of them fixes the last, and
partial knowledge tightens the rest. `SideSumComponent` propagates it by bounds.
`main.js` groups the clues by side using the step between a line's first two
cells (`+1` left, `-1` right, `+W` top, `-W` bottom): same step, same side. It
fires only on a full side of `n` clues — the sum is `n` exactly only when every
line on the side is present, which the frame guarantees.

## Opposite pair — a cut from the two clues alone

Two clues on opposite ends of one line couple. Read a cell at 0-based index `j`
on a line of length `n`. It is a **left hit** when its value is `j + 1` (its
distance from the left clue) and a **right hit** when its value is `n - j` (its
distance from the right clue). Those two values are equal only at the exact
center (`n` odd, `j = (n-1)/2`, value `(n+1)/2`). So the left-hit cells and the
right-hit cells are disjoint apart from that one shared center cell. The left
clue `A` counts the first set, the right clue `B` the second, so

    A + B <= n        (n even)
    A + B <= n + 1    (n odd, the center can be a hit from both sides).

Each clue caps the other: `A <= cap - B` and `B <= cap - A`.

The cap is not fixed. It starts at `n` (or `n + 1`) and **drops as the interior
fills in**: once a cell has lost both its left-hit value `j + 1` and its
right-hit value `n - j`, it can never be a hit either way, so it no longer counts
toward the cap. `HitCountsPairComponent` recomputes

    cap = number of cells that can still hit  (the center counted twice)

on every pass, so interior progress feeds straight back into tighter clue bounds.

The cut has real teeth at the cap. When `A + B` is forced to `cap`, every cell
that can still hit must hit. So each such cell is pinned to just `{j + 1, n - j}`
(a single value at the odd-`n` center); a cell that can hit neither is a forced
miss and is left alone. That fires from the two clues alone, before any interior
digit is known — a deduction no single-line component can reach. `main.js` pairs
two clues whose lines are the exact reverse of each other.

Unlike the side sum, this coupling is not a tautology: it constrains the
interior digits directly, not just the hidden clues.

## The clue of 0

A hit count of 0 is a real clue — it means no cell holds its own distance — and
the puzzle shows 0 clues like any other. A sudoku cell cannot normally hold 0,
so the document does two things:

- sets `minDigit: 0` on the puzzle, which lets any cell hold the digit 0;
- adds a look-and-say cage (`type: 304`) with value `"00"` — read as "zero 0s" —
  over all interior cells, which keeps 0 out of the sudoku itself.

Together they let only the outside clue ring hold 0. The component treats a clue
of 0 the same as any other count: a pinned clue of 0 forbids every cell from
holding its own distance.

## Paste into SudokuMaker

Build the interactive-outside frame (see `../../docs/patterns.md`), add a custom
local constraint, and paste `main.js` as the main code. Add three component
segments, `HitCountsComponent`, `SideSumComponent`, and `HitCountsPairComponent`.
Each group is one line: cell 0 the outside clue, the rest the line read inward.

## What the component deduces

Let `forced` be the cells already pinned to their own distance (a hit no matter
what) and `possible` be the cells whose distance is still a candidate (a hit is
still open). The true number of hits lies in `[forced, possible]`.

This naive count reads each cell alone, so it over-counts: it can promise more
hits than any one permutation of the line delivers. Take a line of three,
already arc-consistent for all-different: `L0 ∈ {1,3}`, `L1 ∈ {2,3}`,
`L2 ∈ {1,2}`. The naive `possible` is 2 — `L0` can be a 1 and `L1` a 2 — but
those two together strand `L2` on a 3 it does not hold. Both legal permutations,
`1 3 2` and `3 2 1`, hit once, so the clue is 1, not "up to 2".

The component tightens the bound with a **matching**. A line is a permutation of
`1..n`, so a legal state is a perfect matching of positions to values, each
position taking a value from its candidates; a hit is the edge from position `i`
to value `i + 1`. `matchingBounds` returns the least and most hit edges over any
such matching, and the true hit count lies in that range. This range sits inside
`[forced, possible]`: a forced cell hits in every matching, so the low end never
drops below `forced`, and no matching beats `possible`. For `n ≤ 9` the matching
is a small pass over the set of used values.

### Does the tighter bound help?

Sound and tighter is not the same as useful. `recovery-probe.mjs` measures the
real gain: it runs the actual components — the same `main.js` wiring the app runs
— over a generated puzzle's start state to a propagation fixpoint, with a
Régin-strength (GAC) all-different over every row, column, and box as the floor.
It runs twice, matching bound on and off, and diffs what propagation recovers.

```
node examples/hit-counts/recovery-probe.mjs gen_9.json --floor=regin
```

On the shipped puzzles the extra recovery is **zero**:

- `gen_6` — the matching never even fires: the interior starts empty, so every
  line's candidates stay wide and the matching bound equals the naive one on all
  24 lines. Nothing to bite.
- `gen_9` — the matching *does* fire (tighter than naive on ~14 of 36 lines), yet
  the recovered clues and cells are identical with it on or off. The all-different
  floor plus the side-sum and pair components already reach the same fixpoint, so
  the tighter clue bound is redundant.

The result holds under a weaker singles-only floor too (`--floor=singles`). So the
clue-bound tightening, though correct, buys no measured solving power on the
current puzzles. Any real value would have to come from the interior-facing
deduction — the matching-driven cell eliminations tracked as a follow-up — or from
pruning inside search, which this root-fixpoint probe does not measure.

- **No n − 1 clue** — a line is a permutation, so it can never have exactly
  `n − 1` hits: fix `n − 1` cells on their target and the last value has only its
  home position left, forcing an nth hit. So `n − 1` is never a legal clue. The
  component drops it from every clue cell at load, which narrows the hidden clues
  and feeds the side-sum and pair through the shared cell.

- **Reverse, clue from line** — the clue is the hit count, so drop every clue
  candidate below the matching's low end or above its high end (the naive
  `[forced, possible]` when no matching exists — a dead state).
- **Forward, forbid hits** — if the clue's largest candidate equals `forced`, no
  more cells may hit, so remove the target digit from every free cell.
- **Forward, force hits** — if the clue's smallest candidate needs every free
  cell to hit, pin each free cell to its target digit.
- **validate** — once clue and line are filled, the count of hits must equal the
  clue.

The all-different rule on each line is left to the built-in row/column check;
this component only reasons about hits.

## Run the tests

Soundness (needs Node):

```
node examples/hit-counts/soundness-harness.mjs
# -> line + side-sum + pair components, 0 violations, clue values 0..9, "PASS"
```

The harness fuzzes random permutations of `1..9` read in a random direction, so
the clue ranges over `0..9`. It seeds partial states that keep each cell's true
value, runs the component to a fixpoint, and checks no true value was removed. It
forces in the identity line (clue 9) and a derangement (clue 0) on every run. It
counts the states where the matching bound is tighter than the naive tally (the
`matching-tighter` figure) and asserts a deterministic three-cell guard where the
matching pins the clue to 1 while the naive count leaves `0..2`. The
pair section drives a line at the `A + B == cap` extreme and counts how often the
per-cell branch fires; a second pair loop fuzzes random permutations, whose
can't-hit cells exercise the dynamic cap; and a deterministic guard checks the
pin branch never empties a forced-miss cell.
