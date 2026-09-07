# Black boundary dots

Decision 2026-09-07: the second clue type is a **black boundary dot** — a black
dot joins an infected cell and an uninfected orthogonal neighbour whose digits
are in a 1:2 ratio. An uninfected neighbour is never smaller than the infected
digit (the infection would have taken it), so the uninfected cell is always the
double. Replaces Cocci Dots (consecutive uninfected digits).

## Why

- Shading is derived from the digits, so every clue is a digit clue. Circles
  say "this group has size N"; with five brainanas most groups are large and
  the box-9 sweep for one circle (`tools/pairone5.py`, 16 cases) returned only
  INFEASIBLE / UNKNOWN in its first 8 cases, no grid.
- Cocci Dots mark two uninfected cells, the default state in a brainana-heavy
  grid, and add kropki information only. A boundary dot marks a rectangle
  edge, which is where the propagation research puts the deductions.

## How many exist naturally

Count of infected–uninfected neighbour pairs in 1:2 ratio, over the 410 grids
in `found/` (no dot objective, just what the shading gives):

| dots | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|------|---|---|---|---|---|---|---|---|---|----|----|
| grids | 1 | 10 | 21 | 25 | 37 | 34 | 28 | 17 | 14 | 7 | 2 |

The 5-brainana witness `found/groups_5.json` has 58 boundary edges, 6 black
dots (r2c2/r2c3, r2c7/r2c6, r3c2/r3c1, r5c5/r5c4, r6c9/r5c9, r7c6/r7c7) and 6
white-style (+1) pairs.

## Open

- Uniqueness with dots as the only non-given clue: not measured yet. Next step
  in #345: add a dot term to the CP-SAT model (every 1:2 boundary pair is a
  dot, negative constraint for undotted boundary edges) and count how few dots
  plus givens make the grid unique.
