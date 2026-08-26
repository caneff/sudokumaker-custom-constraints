# Numbered Rooms — optimized

A stronger constraint component for the "escape the grid" Numbered Rooms puzzle.

## The rule

A line reads inward from an outside clue cell. The first inside cell holds a
1-based index `k`. The clue equals the digit in the `k`-th inside cell:

    line[k - 1] === clue,   with k = value(line[0]).

The clue is a **cell** (its digit is part of the solution), not a fixed number.

## What was slow and weak

The shipped version split the work across a wrapper and the built-in
`IndexComponent`:

```js
// ORIGINAL_CustomIndexComponent.js
if (puzzle.hasValue(cell)) {
  yield puzzle.replaceComponent(instance,
    new IndexComponent(instance.name, puzzle.getValue(cell), cells[0], cells))
}
```

`IndexComponent` needs the clue as a constant, so the wrapper waited until the
clue cell `cell` collapsed to one value, then swapped the built-in in. Two costs:

- **Inert until the clue is solved.** Before that it pruned nothing — the line
  cells kept their full candidate sets and the solver got no help.
- **One direction only.** It never pushed information back from the line to the
  clue. Knowing `line[0] = 2` and `line[1] = 3` tells you the clue is `3`, but
  the wrapper could not use that.

## What this does instead

`NumberedRoomsComponent.js` is one self-contained component (the pattern
`docs/gotchas.md` #1 requires). Its `update` prunes candidates every pass, in
both directions, before the clue is solved:

1. Prune the indexer `line[0]`: drop any index that points at a cell whose
   candidates cannot meet the clue's.
2. Prune the clue: it can only hold a digit some still-feasible target allows.
   "Allows" includes the one fact the line's geometry gives: for index `k > 1`
   the target and the indexer are two cells of one row/column, so the clue
   cannot be `k`; for `k = 1` the target *is* the indexer, so the clue must
   be 1.
3. When one index remains, make the target cell and the clue equal both ways —
   before either is a singleton.
4. When no index remains, empty the indexer and the clue so the solver sees
   the dead branch at once.

All four run in one pass over candidate bitmasks
(`puzzle.getCandidatesBitMask`), the shape ISS's `ValueIndexing` handler uses.

## A stronger deduction that did not pay off

Two clues on opposite ends of one line couple: with left index `a` and right
index `b` on a line of length `N`, `a + b === N + 1` exactly when the two clues
land on the same cell, so equal clues fix the index sum. A `NumberedRoomsPair`
component once enforced this. It was sound and it cut search nodes, but on the
shipped board it **tripled** the real solve time (2.3s → 6.7s): the extra
component ran every propagation and cost more than the nodes it saved. Removed,
per "a deduction must pay for itself in solve time" (`CODING_STANDARDS.md`). The
per-line component below carries the whole example.

## Files

- `main.js`, `NumberedRoomsComponent.js` — paste these two into the SudokuMaker
  constraint editor, replacing the old backend and `CustomIndexComponent`.
- `ORIGINAL_*.js` — the shipped wrapper, kept for reference and used by
  `build_original.py`.
- `soundness-harness.mjs` — proves `update` removes no true value (405k fuzz
  tests) and that it prunes early: the clue narrows while it is still unsolved,
  which the shipped wrapper never did.
- `PUZZLE_LINK.txt` — the ready-to-open puzzle and the source of truth for this
  example: a hard board with **blank outside clues** (the solver deduces all 36),
  8 arrow bulbs, and one interior given, so the solver must search. Earlier
  fixtures had 24 and then 13 arrows; fewer arrows leave more of the work to
  this component.
- `PUZZLE_LINK_original.txt` — the same board with the original wrapper code, for
  a same-board timing comparison.
- `PUZZLE_LINK_clued.txt` — the same 8-arrow board with all 36 outside clues
  filled from the puzzle's solution (interior unchanged, still blank but for
  the one given): the ordinary, ready-to-play version of the puzzle.
- `PUZZLE_LINK_clued_original.txt` — the clued board with the original wrapper
  code, for a same-board timing comparison. Both solve instantly and uniquely
  (0ms, one rep each) -- an ordinary, mostly-solved-by-logic puzzle does not
  show the capability gap; see "Timing in the real app" below.
- `build_original.py` — rebuilds `PUZZLE_LINK_original.txt` from `PUZZLE_LINK.txt`
  and the `ORIGINAL_*.js` files, changing only the constraint code.
- `build_clued.py` — rebuilds both `PUZZLE_LINK_clued.txt` and
  `PUZZLE_LINK_clued_original.txt` from `PUZZLE_LINK.txt`, filling the 36
  clues from the board's own solution and checking that solution against the
  sudoku and Numbered Rooms rules before writing anything:
  `uv run --with lzstring examples/numbered-rooms/build_clued.py`.
- `build_link.py` — rebuilds `PUZZLE_LINK.txt` with one named component's code
  swapped for a candidate file, board and clues unchanged:
  `uv run --with lzstring examples/numbered-rooms/build_link.py --component NumberedRoomsComponent.js --out /tmp/candidate.txt`.
  Add `--backend main.js` to swap the main code in as well (the committed
  link carries both, and `build_link.test.py` checks both round-trip).
  See `docs/real-app-timing.md`.

## Run

    node examples/numbered-rooms/soundness-harness.mjs
    uv run --with lzstring examples/numbered-rooms/build_original.py   # rebuild the original-code link

## Why the stronger component wins

The reason is in the original code, not a benchmark. `ORIGINAL_CustomIndexComponent.js`
does nothing until the clue cell has a value:

```js
if (puzzle.hasValue(cell)) {
  yield puzzle.replaceComponent(instance,
    new IndexComponent(instance.name, puzzle.getValue(cell), cells[0], cells))
}
```

A real Numbered Rooms puzzle shows only *some* of its outside clues and leaves the
rest blank for the solver to deduce. On a blank clue the wrapper is inert — it
waits for the clue to be pinned, then runs the built-in index prune — so its only
way to fill a blank clue is to guess it. `NumberedRoomsComponent.js` deduces a
blank clue from its line, both directions, before anything is solved. That
capability gap is the point: a puzzle that is mostly blank clues is one the
original wrapper cannot solve by logic at all, and ours can.

## Timing in the real app

`PUZZLE_LINK.txt` leaves the outside clues blank, so the solver must deduce them
and search — the real Numbered Rooms case, where the capability gap shows. Timed
in the real SudokuMaker solver (empty grid, non-deterministic solve off, the
default "singles only" technique set, median of 3 runs):

| wiring | solve time |
|---|---|
| original wrapper (`CustomIndexComponent`) | >300 s (no rep in three finished) |
| ours, before #87 (`NumberedRoomsComponent`) | ~19–21.5 s |
| **ours** (`NumberedRoomsComponent`, with the clue≠index rule) | **~3.1 s** (5-rep median, 2026-08-26) |

Ours is about 100× faster than the wrapper. The gap is the point of the rewrite: the wrapper is
inert on a blank clue and the solver must guess it, while ours deduces the clue
from its line. See `docs/real-app-timing.md` for the method, the reproduce
commands, and the skyscraper comparison.

Every speed-up tried on this component since — kept or rejected, with its
numbers and commit — is logged in `OPTIMIZATION_LOG.md`. The win bar for a new
attempt: faster on the hard board **and** the clued board still verdicts
unique, both judged on a 5-run median against the current baseline row, and a
difference inside that baseline's run-to-run spread does not count.

## Not covered

Numbered Rooms has no generator; `PUZZLE_LINK.txt` is a single hand-made puzzle,
now the committed source of truth. There is no fresh puzzle to regenerate.
