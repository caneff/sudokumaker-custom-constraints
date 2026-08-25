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

## Why no pair component

Running Start couples two clues on opposite ends of one line, because its two
increasing runs share at most the peak. Hit Counts has no such coupling worth
coding. A left hit and a right hit fall on the same cell only at the exact
middle of the line, so the only cross bound is `A + B <= n` (`+ 1` when `n` is
odd). Fixed points average one per line, so `A` and `B` stay small and that
bound almost never bites. The per-line component is the whole constraint.

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
local constraint, and paste `main.js` as the main code. Add one component
segment, `HitCountsComponent`. Each group is one line: cell 0 the outside clue,
the rest the line read inward.

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
# -> 40000 tests, 0 violations, clue values 0..9 exercised, "PASS"
```

The harness fuzzes random permutations of `1..9` read in a random direction, so
the clue ranges over `0..9`. It seeds partial states that keep each cell's true
value, runs the component to a fixpoint, and checks no true value was removed. It
forces in the identity line (clue 9) and a derangement (clue 0) on every run.
