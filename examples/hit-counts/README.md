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
- `frame.py`, `minify.py` — build helpers shared with Running Start (the
  interactive-outside frame cosmetics and the link-shrinking pass).

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

The cut has real teeth at the cap. When `A + B` is forced to `cap`, every cell
is a hit — left or right. So cell `j` is pinned to just `{j + 1, n - j}` (a
single value at the odd-`n` center). That fires from the two clues alone, before
any interior digit is known — a deduction no single-line component can reach.
`HitCountsPairComponent` caps each clue and, at the cap, makes the per-cell cut.
`main.js` pairs two clues whose lines are the exact reverse of each other.

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

- **Reverse, clue from line** — the clue is the hit count, so drop every clue
  candidate below `forced` or above `possible`.
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
forces in the identity line (clue 9) and a derangement (clue 0) on every run. The
pair section drives a line at the `A + B == cap` extreme and counts how often the
per-cell branch fires, so the strong cut stays covered.
