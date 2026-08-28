# Numbered Rooms Lines

Numbered Rooms on any drawn line: a diagonal, a bent path, a partial row.
Same rule as `examples/numbered-rooms` — the clue cell equals the digit in the
k-th line cell, where k is the first line cell — but the line need not be one
row or column.

Two of the Numbered Rooms prunes assume the line cells hold distinct digits
(target ≠ k for k > 1; a solved clue sits at exactly one line cell). Here they
run only when `puzzle.getCellsSeeEachOther(line)` is true. The app counts only
constraints defined **above** this one for "sees", so put this constraint last
in the list. On any other line the three prunes that hold regardless still run.

## The shipped board

`PUZZLE_LINK.txt` is a 6x6 sudoku (2x3 boxes) inside a one-cell clue ring,
8x8 in all. Twenty-four lines read inward, one per ring cell. Five of them are
**drawn** rather than straight:

| Clue | Line |
|---|---|
| `T0` | the main diagonal, R1C1 down to R6C6 |
| `T5` | the anti-diagonal, R1C6 down to R6C1 |
| `L2` | a bent path: three cells right along row 3, then down column 3 |
| `L0` | a partial row: the first three cells of row 1 |
| `B3` | a partial column, read upwards: rows 6, 5 and 4 of column 4 |

The other nineteen are whole rows and columns, the shape `examples/numbered-rooms`
ships. They are there because a ring cell belongs to no region and no row or
column house: a ring cell with no line is a free digit, and the board would
have six solutions for each one.

Eight clues are shown; the other sixteen ship **empty** and are part of the
puzzle — the solver deduces them, the interactive Numbered Rooms case. The
interior has no given at all: the lines alone pin the grid. The link's twelve
givens are those eight clues plus a filler `1` in each of the four corners,
which belong to no line and would otherwise be free digits.

That is also the shape of the uniqueness proof. `generate.py` proves the
**interior** unique with CP-SAT; every ring cell owns a line, so its digit is a
function of the solved grid, and the corners are pinned. The whole board is
unique exactly when the interior is.

The two diagonals and the bent path are not houses, so the app runs those lines
with `distinct = false`; the partial row and the partial column are, so they
get the two extra prunes.

## Files

| File | Holds |
|---|---|
| `main.js`, `NumberedRoomsLinesComponent.js` | Paste into the constraint editor. Group = clue cell first, then the line in reading order. |
| `generate.py` | Draws the five lines, generates the grid, and proves the solution unique with CP-SAT. Writes `gen.json`. |
| `gen.json` | The shipped board: grid, line geometry, clues, shown-clue set, givens. |
| `build_link.py` | Builds `PUZZLE_LINK.txt` from `gen.json`, `main.js` and the component. |
| `build_link.test.py` | The committed sources must reproduce `PUZZLE_LINK.txt`; no cell may ship a value it is not given. |
| `soundness-harness.mjs` | Fuzzes both modes; with repeats allowed the distinct-only prunes must stay off. |
| `update-strength.test.mjs` | Never-weaker fuzz against the floor at 56e707a, plus the `distinct` gate both ways. |
| `OPTIMIZATION_LOG.md` | Speed attempts, kept or rejected. |
| `PUZZLE_LINK.txt` | The shipped board. |

## Regenerating

```
uv run --with ortools --with lzstring \
    examples/numbered-rooms-lines/generate.py                       # gen.json
uv run --with lzstring examples/numbered-rooms-lines/build_link.py  # PUZZLE_LINK.txt
```

`generate.py` scans seeds 101 upward and keeps the board with the fewest
interior givens, then the fewest shown clues. It is deterministic: one CP-SAT
worker, fixed seed, so a rerun that changes `gen.json` means something else
changed. Most seeds are rejected — a three-cell line needs its first digit in
1..3, which most grids fail.

Changing a line's geometry means changing `DRAWN` in `generate.py` and
regenerating; the clue depends on the grid, so the board cannot be edited by
hand.

## Timing

No row yet. This example has had no speed measurement: `just time` drives the
live site, and nothing here has changed a deduction since the component
landed. Run `just time numbered-rooms-lines --ring-clues` to open the log with
a baseline (see `docs/real-app-timing.md`).
