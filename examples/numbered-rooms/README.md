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

## Files

- `main.js`, `NumberedRoomsComponent.js` — paste these two into the SudokuMaker
  constraint editor, replacing the old backend and `CustomIndexComponent`.
- `ORIGINAL_*.js` — the shipped version, kept for reference.
- `soundness-harness.mjs` — proves `update` never removes a true value
  (405k fuzz tests) and that it prunes with the clue still unsolved.
- `build_link.py` — rebuilds the puzzle link with the new code.
- `PUZZLE_LINK.txt` — the ready-to-open puzzle.

## Run

    node examples/numbered-rooms/soundness-harness.mjs
    uv run --with lzstring examples/numbered-rooms/build_link.py

## Not covered

This rebuilds the existing hand-made puzzle with the stronger component; it does
not regenerate the puzzle or re-check its uniqueness under the new logic (no
OR-Tools pass, unlike `running-start`). The soundness harness proves the
component never removes a true candidate — the property that keeps a real puzzle
solvable.
