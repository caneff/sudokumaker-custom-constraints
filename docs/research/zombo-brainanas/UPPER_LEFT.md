# Chocolate in the upper left

Question (Chris): boxes 1-2 look like one banana clump; can we optimize for
chocolate there so both chocolate and banana deductions exist?

Why it is sparse. Infection flows only to smaller digits. Box 1's patient
zero is a 1 and infects nothing; box 2's 2 catches only an adjacent 1; box 4's
4 catches 1-3. Chocolate in the upper left arrives by chains from the
big-digit boxes, so the corner is banana by default.

Measured (tools/ceiling.py, model 6ec3f89, rows 1-5 x cols 1-5 = 25 cells):

- Pair r7c8 infected + r9c7 uninfected, maximize quadrant chocolate: 7/25,
  proven OPTIMAL in under 30 s, same grid for seeds 5, 8, 9.
- Same pair, maximize colour boundaries in the quadrant instead: 16/40 edges,
  the same grid. With chocolate that sparse, boundaries = chocolate perimeter,
  so both objectives agree.
- Across the 119 found grids the quadrant holds 3-9 infected cells, median 5;
  the 9 is bal36_300 (min-infected 36 arm). The unconstrained ceiling was not
  measured: the objective model without a fixed pair shading exceeds a 14 GB
  virtual cap (bad_alloc); the fixed-shading model runs at ~4 GB.

Conclusion. Under the map #342 rules the upper left cannot carry a "this
banana must grow" deduction: there is not enough chocolate to box a banana in.
Two levers, both untested:

1. `rect=0` (swap: uninfected groups are rectangles, infected groups are
   bananas). Sparse infection then means every infected clump must be
   non-rectangular, i.e. must grow, and the banana-heavy corner becomes
   chocolate-heavy. The model already supports it (RECT global, `rect` CLI arg).
2. Accept it: the upper left resolves by sudoku + Cocci dots, and the
   chocolate/banana interplay lives in the bottom and right thirds.
