# Three Wolf Moon: does a grid exist?

**Yes.** Both CP-SAT encodings return a grid on 1 worker in under 0.03 s, and
an independent checker passes it.

## Rules as ruled (Chris, 2026-09-28)

- Normal 9x9 sudoku rules apply to the entered digits.
- Three werewolf sets, fixed by the grid:
  - box set: the cell of box k holding k — one per row and column;
  - row set: the cell of row k holding k — one per column and box;
  - column set: the cell of column k holding k — one per row and box.
  Boxes are numbered 1–9 in row-major order.
- No cell belongs to two sets (27 distinct werewolf cells). A cell in two sets
  would carry two values.
- A werewolf's value is another digit of its own set, never its own; each
  set's values are 1–9. The rule does not constrain the grid:
  value = digit mod 9 + 1 satisfies it for every set.

## Witness

Tag after each digit: B box set, R row set, C column set.

```
5. 9. 3C | 2B 7. 8. | 1R 6. 4.
7. 4. 2R | 5. 6. 1. | 9. 8C 3B
8. 1B 6. | 4C 9. 3R | 2. 7. 5.
--------------------------------
2. 3. 5. | 8. 4R 7. | 6B 1. 9C
4B 7. 9. | 1. 3. 6C | 8. 5R 2.
1C 6R 8. | 9. 2. 5B | 4. 3. 7.
--------------------------------
3. 2C 1. | 7R 8B 9. | 5. 4. 6.
6. 5. 4. | 3. 1. 2. | 7C 9B 8R
9R 8. 7B | 6. 5C 4. | 3. 2. 1.
```

Values: each werewolf's value is its digit + 1, with 9 becoming 1, in all three sets.

## Method

- Bool model: `x[r,c,d]` with `AddExactlyOne` houses. Each set condition is
  an `AddExactlyOne` over existing literals (e.g. `x[r,c,box(r,c)]` across a
  row), so no auxiliary variables. No-overlap = fix `x[r,c,d]=0` wherever `d`
  equals two of (box, row, column).
- Second encoding sharing no structure: int cells, `AddAllDifferent`, three
  reified membership booleans per cell, sums per house.
- Checker: plain loops over the 1-based grid, no solver code. Control: swapping
  r1c1/r1c2 is rejected.
- Scripts were run from `.scratch/wolf/` (git-ignored): `solve.py`, `check.py`.

## Preflight answers (docs/agents/grid-finder-lessons.md)

1. No base-puzzle bound applies; this asks for feasibility, not uniqueness.
2. No corpus used. 3. No sampler. 4. It departs from "start from `finders/hunt/`"
   because this is a single solve, not a hunt.
5. Artefact risk: a model bug that admits a bad grid — ruled out by the
   independent checker and its control.
6. The solver answers directly; it did.
7. Cheap condition derived but not needed: in each band the box set's rows and
   the row set's boxes are each a 3-cycle (2x2 options per band and per stack).

Open follow-ups, not run: solution count (ii) and a puzzle built on a grid (iii).
