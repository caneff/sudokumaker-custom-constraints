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

- `main.js`, `NumberedRoomsLinesComponent.js` — paste into the constraint
  editor. Group = clue cell first, then the line in reading order.
- `soundness-harness.mjs` — fuzzes both modes; with repeats allowed the
  distinct-only prunes must stay off.

No puzzle link yet: the frame generator builds row/column lines only.
