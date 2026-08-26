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
3. When one index remains, make the target cell and the clue equal both ways —
   before either is a singleton.

## The pair fact — two clues on one line

A row (or column) usually carries a clue at each end. Let `a` be the left index
(the digit in the first inside cell) and `b` the right index (the digit in the
last inside cell). The left clue reads `line[a-1]`, the right clue reads
`line[N-b]` — the same cell exactly when `a + b === N + 1`. So:

    a + b === N + 1   =>  left clue === right clue     (always)
    left clue === right clue  =>  a + b === N + 1       (when the line is distinct)

The second direction holds only because a sudoku line has no repeats: equal clues
must be the *same* cell, not two different cells that happen to share a digit.

Two smaller facts fall out and need no extra code:

- **Index 1 forces clue 1.** If the first inside cell is 1, the index points at
  itself, so the clue is 1. The per-line component already deduces this (its
  reachable set collapses to `{1}`).
- The biconditional's easy half (`sum ⟹ equal clues`) is a plain consequence of
  the per-line rule; only the pair adds the cross-clue coupling.

`NumberedRoomsPairComponent.js` enforces the biconditional both ways. Because the
outside clues are often the given digits, "equal clues fix the index sum" prunes
the two index cells on the first pass — a deduction no single-line component can
reach.

## Files

- `main.js`, `NumberedRoomsComponent.js`, `NumberedRoomsPairComponent.js` — paste
  these three into the SudokuMaker constraint editor, replacing the old backend
  and `CustomIndexComponent`.
- `ORIGINAL_*.js` — the shipped wrapper, kept for reference and used by
  `build_original.py`.
- `soundness-harness.mjs` — proves neither `update` removes a true value (405k
  line + 5k distinct-line pair + 13k non-distinct pair fuzz tests) and that each
  prunes early: the line component with the clue unsolved, the pair component
  with the index sum fixed by equal clues. The non-distinct block also proves the
  `getCellsSeeEachOther` guard is load-bearing (remove it and it fails).
- `PUZZLE_LINK.txt` — the ready-to-open puzzle and the source of truth for this
  example: 36 clues, 3 interior givens.
- `PUZZLE_LINK_original.txt` — the same board with the original wrapper code, for
  a same-board timing comparison.
- `build_original.py` — rebuilds `PUZZLE_LINK_original.txt` from `PUZZLE_LINK.txt`
  and the `ORIGINAL_*.js` files, changing only the constraint code.

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

`PUZZLE_LINK.txt` shows all 36 clues, so both wirings solve it by logic and the
capability gap above never shows. On that shipped puzzle ours is in fact a little
*slower* (~55 ms vs ~36 ms) — the stronger deductions cost more per solver call
than they save when no clue is blank. See `docs/real-app-timing.md` for the
method and the full ours-vs-original table, timed in the real SudokuMaker solver.

## Not covered

Numbered Rooms has no generator; `PUZZLE_LINK.txt` is a single hand-made puzzle,
now the committed source of truth. There is no fresh puzzle to regenerate, and no
interactable (some-clues-blank) puzzle is shipped — the blank-clue win above is
argued from the code, not measured here.
