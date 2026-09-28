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

## Clue type: silver bullets (Chris, 2026-09-28)

- A silver bullet is an outside clue pointing along a diagonal. It gives the
  sum of the values of every werewolf on that diagonal; non-wolves count 0.
- A bullet may read 0.
- Bullets may sit on any diagonal of length 2–9, in either direction.
- Rejected earlier as clue themes: dots (boring), clues that name or count
  wolf locations (seers, moonlight, three-wolves-one-moon), "no reflection"
  mirrors, moon lines (two thermometers), clue lines drawn as art.
- Consequence of the complete-set rule: the 27 wolf values total 135, so the
  bullets on every diagonal in one direction would sum to 135.
- Not started: the finder.

## Inherent truths of the setup (2026-09-28)

Oracle: `.scratch/wolf/truths.py`, one CP-SAT feasibility solve per claim,
1 worker, all OPTIMAL/INFEASIBLE (no timeouts). Exhaustive over all 729
(cell, digit) pairs, all 4 band combos per band, all 36 stack combos per stack.

1. Every row, column and box holds exactly 3 wolves, one per set.
   Every digit k is a wolf exactly 3 times (in box k, row k, column k).
2. 63 (cell, digit) pairs are impossible. 39 are the direct no-overlap bans
   (k in row k inside box k; k at rkck; k in column k inside box k for
   k = 1, 5, 9). The other 24 all sit in boxes 1, 5 and 9 and follow from:
   **each diagonal box's three wolves are exactly its band's digit triple**
   — 1,2,3 in box 1; 4,5,6 in box 5; 7,8,9 in box 9. The middle digit
   (1/5/9 = box number) is the box wolf, off its own row and column. The
   other two are the row wolf and column wolf, so each lies in its own row
   or its own column (the 2 of box 1 is in row 2 or column 2, not at r2c2).
   Why: a diagonal box's row numbers and column numbers are both its band
   triple, and the box number is banned for the row and column wolf there.
3. Band structure: in each band the box set's rows and the row set's boxes
   are each a 3-cycle; all 4 combinations are feasible in every band.
4. Stack structure: only the diagonal box and diagonal column carry a ban
   (box-set column map and column-set band map each 4 of 6); all 16
   combinations are feasible in every stack.
5. Rows and columns are not symmetric. Box numbers run along bands, so a
   row's box wolf digit is in its band triple (not its own number); a
   column's box wolf digit is in {s+1, s+4, s+7} for stack s. Transpose is
   not a symmetry (fails on the witness). The symmetry group is the 6 maps
   applying one permutation of {0,1,2} to band, row-in-band, stack,
   column-in-stack and digit (as 3a+b) together; all 6 map the witness to
   a valid grid.
6. Values: each set's lies cancel, Σ(value − digit) = 0 per set; all 27
   values sum to 135. The main diagonal holds only box wolves (at most 3,
   in boxes 1, 5, 9), so its bullet sums at most three box-set values.

## Candidate solve steps (brainstorm, 2026-09-28; derived from the truths above, not solver-checked as steps)

- Diagonal-box switch: in box 1 exactly one of {the 2 lies in row 2, the 3
  lies in row 3}; the other lies in its own column (same in boxes 5, 9).
- Band cycle: one box wolf's row in a band fixes all three (1 of box 1 in
  row 2 ⇒ 2 of box 2 in row 3 ⇒ 3 of box 3 in row 1); same for row wolves.
- Row k's k is never in box k; box k's k is never in row k.
- Bullet 0: every cell on the diagonal loses its box, row and column digit.
- Main-diagonal bullet: only box wolves 1/5/9 (1 at r2c2|r3c3, 5 at
  r4c4|r6c6, 9 at r7c7|r8c8), values distinct, none equal to own digit; a
  large sum forces all three onto the diagonal.
- Values repeat across sets but not within: bullet 2 = one wolf worth 2, or
  two wolves worth 1 from different sets.
- Lies cancel per set; last wolf of a set gets the one leftover value, which
  must differ from its digit.
- (Correction) Box 5's row/column wolves are its 4 and 6; box 9's are its 7 and 8.
- One fixed point per row: each row holds exactly one cell whose digit equals
  its column number (column set); each column exactly one equal to its row
  number; each row and column exactly one equal to its box number; each box
  exactly one equal to its row number and one equal to its column number.
- r1c1, r5c5, r9c9 are never wolves (all three indices equal; no-overlap).
- A cell with two equal indices can be a wolf in only one way (36 cells: 24 where box = row, 6 where row = column, 6 where box = column).
- Corner bullets: diagonal r1c2–r2c1 can hold only a 2 as a wolf (r1c2 as
  column wolf, r2c1 as row wolf), at most one of them; r8c9–r9c8 the same
  with 8s.
- Crossing bullets share cells; a pinned wolf value subtracts from both.
- Box 1 mini-puzzle (solver-enumerated, `.scratch/wolf/box1.py`, all 504
  placements OPTIMAL/INFEASIBLE): digits 1,2,3 have only 10 arrangements.
  1@r2c2: 2@r1c2 3@r3c1 | 2@r1c2 3@r3c2 | 2@r2c1 3@r2c3.
  1@r2c3: 2@r1c2 3@r3c1 | 2@r1c2 3@r3c2.
  1@r3c2: 2@r2c1 3@r1c3 | 2@r2c3 3@r1c3.
  1@r3c3: 2@r2c1 3@r1c3 | 2@r2c3 3@r1c3 | 2@r3c2 3@r3c1.
  Two put all three in one row: row 2 reads 2 1 3, row 3 reads 3 2 1.
- Band link (solver-checked): the 2 of row 2 is in box 1 ⇔ the 1 of row 1
  is in box 3 (the row-wolf 3-cycle), and then box 1's 3 is its column wolf.
- Seven of nine: in each band, of the 9 cells holding the band's digit
  triple, exactly 7 are wolves (3 box, 3 row, 1 column — the diagonal box's
  column wolf). In each stack, of the 9 cells holding the stack's triple,
  exactly 5 are wolves (3 column, 1 box, 1 row). Proof by set membership;
  witness shows 7/9 and 5/9 in every band and stack.
- Corner homes: box k's k (k = 1, 5, 9) sits in the 2x2 avoiding row k and
  column k — box 1's 1 in r2-3c2-3, box 5's 5 on a corner, box 9's 9 in r7-8c7-8.
- Subtler steps (argued from the definitions; not solver-checked as steps):
  - Hidden symbols: each set is one cell per row, column, box and digit, so
    it behaves like an extra sudoku digit spread over different real digits.
    Singles, pairs and fish apply to it: if rows 4 and 7 can only hold
    their own-column digit in columns 2 or 8, then column 2's 2 and column
    8's 8 are in rows 4/7, which removes 2 from column 2 and 8 from column 8
    in every other row.
  - The / total: the r+c diagonals partition the grid and their length-1
    corners r1c1, r9c9 never hold a wolf, so the 15 bullets on / diagonals
    of length 2–9 sum to exactly 135; one missing / bullet is 135 minus the
    rest. The \ family does not close: r1c9 and r9c1 can be wolves.
  - Lie balance: over the / family, Σ value = Σ digit (both 135), so a
    diagonal whose bullet exceeds its wolves' displayed digits forces
    another to fall short by the same total.
  - One full row per band: each row holds its row wolf and box wolf among
    the band's digits; the band's only other such wolf is the diagonal
    box's column wolf, so exactly one row per band has all three of its
    band digits as wolves (the row holding that column wolf).

## Concrete sum setups (2026-09-28)

Per-diagonal wolf types (from the 63 bans): the \ main diagonal holds box
wolves only; / r+c=3 holds only a 2 (r1c2 column wolf, r2c1 row wolf);
/ r+c=4 holds only r1c3 as column-wolf 3, r2c2 as box-wolf 1, r3c1 as
row-wolf 3; / r+c=17 only 8s. Witness bullets (value = digit mod 9 + 1):
/ length 2–9 total 135 exactly; \ length 2–9 total 134, the missing 1 being
r9c1 (row wolf 9, value 1).

- Setup A, the unseen corners: give all 15 \ bullets. Their shortfall from
  135 is the value of the wolves at r1c9 and r9c1, which no bullet sees.
  Shortfall 1 (as in the witness): exactly one corner is a wolf worth 1; not
  r1c9 as row wolf 1 or r9c1 as column wolf 1 (value ≠ digit), so it is
  r1c9 = 3 or 9 as box/column wolf, or r9c1 = 7 or 9 as box/row wolf.
  Shortfall 0: both corners are normal (r1c9 ∉ {1,3,9}, r9c1 ∉ {1,7,9}).
- Setup B, the missing corners: give every / bullet except r+c=3 and r+c=17.
  Their sum is 135 minus the rest; each is 0 or one wolf's value (a 2 not
  worth 2, an 8 not worth 8). Sum 0: box 1's 2 avoids r1c2/r2c1, leaving 3
  of the 10 box-1 arrangements (1r3c2 2r2c3 3r1c3; 1r3c3 2r2c3 3r1c3;
  1r3c3 2r3c2 3r3c1); box 9's 8 likewise.
