# Renbanana feasibility — German Chocolate + renban bananas

Question (#347): does a grid exist under standalone Choco Banana sudoku with a
German whisper on chocolate and a renban on every banana group? And if so, how
much does the rule set constrain on its own — enough to need no clues?

**Verdict: SAT, in 29 s. The rule set alone is far too loose to be clue-free —
one shading admits 312 digit grids.**

## The rules modelled

1. Normal 9x9 sudoku.
2. A free binary shading of every cell: chocolate or banana. Nothing derives
   it, and it is **not part of the solution check** — in the app it is colouring
   the solver does for themselves. A digit grid is valid iff *some* shading
   satisfies 3-6.
3. Every maximal orthogonally connected chocolate group is a rectangle.
4. Every maximal orthogonally connected banana group is not a rectangle. A 1x1
   cell and a 1xN strip are rectangles, so a banana group needs >= 3 cells in
   an L or worse.
5. German Chocolate: orthogonally adjacent chocolate digits differ by >= 5.
   (Dutch is the same rule at >= 4, so German is strictly stronger.)
6. Renbanana: every banana group's digits are distinct and consecutive — hence
   at most 9 cells.

"Group" is a *maximal* component, so no two chocolate groups touch orthogonally
and no two banana groups do: every rectangle's whole orthogonal border is
banana, and vice versa. Chocolate walls therefore cannot cross — a plus or a T
is not a rectangle.

## Witness

Chocolate in brackets, banana bare.

```
 4   6   2   7  [5]  9   1  [8] [3]
 9   3  [1] [6]  8  [2]  7   5   4
 5   8  [7] [1]  4   3  [9]  6   2
 1  [5]  6   2  [9]  7  [4]  3   8
[2]  9  [8]  4  [3]  6   5  [7] [1]
[7]  4  [3]  5   1  [8] [2]  9   6
 6   7  [9]  3  [2]  1   8   4   5
 8   1   5  [9]  6  [4]  3   2   7
 3   2  [4]  8   7   5  [6] [1] [9]
```

Verified independently of the model that produced it (`verify.py`, rewritten
from the rules rather than reusing the solver's encoding): sudoku holds, all 16
chocolate groups are rectangles, all 7 banana groups are non-rectangles, every
banana group is a renban, every chocolate adjacency differs by >= 5.

- Chocolate group sizes: 1x7, 2x6, 3x2, 4x1 — sixteen groups, the largest four
  cells.
- Banana group sizes: 4, 6, 6, 9, 9, 9, 9.

## How tight is it?

- **Shading is the easy half.** The shape rules plus the size cap yielded legal
  shadings in seconds — 33 cuts to the first one.
- **Digits are the filter.** Of the first 3 shadings passing rules 3, 4 and the
  cap, 2 admitted no digit fill at all; the third did.
- **But a surviving shading is loose.** Enumerating digit grids on the witness
  shading alone: **312**, exhaustively, in 0.7 s. Across all shadings the count
  is far larger.

So a clue-free puzzle is dead: the rules do not come close to pinning a grid.
Clues are needed, and circles (group size) are the ones that speak about the
shading — kropki and givens only constrain digits, which is not the
under-determined layer.

## Two hand lemmas worth having as solve deductions

Both derived by hand, both consistent with the witness.

- **No 5 in a chocolate group of size >= 2.** A chocolate neighbour of a 5 must
  differ by >= 5, so it would have to be <= 0 or >= 10. Every 5 on the grid is
  therefore banana or a lone 1x1 chocolate cell. The witness has its chocolate
  5 at r1c5 as a 1x1 group.
- **Chocolate rectangles are low/high checkerboards.** Two digits from
  {1,2,3,4} differ by <= 3, as do two from {6,7,8,9}. So every chocolate
  adjacency pairs a low with a high, and the rectangle's parity classes are
  fixed before any digit is placed. A width-*b* row of a rectangle holds
  ceil(b/2) cells of one class in one grid row, all distinct from a 4-element
  set, so no chocolate rectangle has a side longer than 8.

## Method and caveats

Two stages, because solving shading and digits jointly converged badly.

- Stage 1 searches shadings only. Rule 3 goes in exactly via the standard
  lemma: a colour's components are all rectangles iff no 2x2 window holds
  exactly three of that colour. The renban size cap goes in structurally with
  component labels — adjacent banana cells share a label, and at most 9 banana
  cells may carry one label. Distinct components can always choose distinct
  labels, so this is equivalent to the cap, not stricter. Rule 4 stays lazy:
  solve, find a banana component that is a rectangle, cut exactly that pattern
  (its cells banana, its whole border chocolate).
- Stage 2 fixes the shading and solves digits: sudoku, the whisper on chocolate
  adjacencies, and per banana group AllDifferent plus max - min == size - 1.
  A shading whose stage 2 is UNSAT is cut whole and stage 1 continues.

Caveat: an earlier attempt enforced the size cap by cutting one oversized
banana component at a time. It never found a legal shading in 150 s (2313
cuts) — the solver simply kept producing one large blob. The cap has to be
structural. Anyone re-running this should not read that earlier failure as
evidence of infeasibility.

Scripts are throwaway and live in the session scratchpad, not the repo; the
model is short enough that the description above is the artifact.
