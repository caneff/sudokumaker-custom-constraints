# Black boundary dots

Decision 2026-09-07: the second clue type is a **black boundary dot** — a black
dot joins an infected cell and an uninfected orthogonal neighbour whose digits
are in a 1:2 ratio. An uninfected neighbour is never smaller than the infected
digit (the infection would have taken it), so the uninfected cell is always the
double. Replaces Cocci Dots (consecutive uninfected digits).

## Why

- Shading is derived from the digits, so every clue is a digit clue. Circles
  say "this group has size N"; with five brainanas most groups are large and
  the box-9 sweep for one circle (`tools/pairone5.py`, 16 cases, 400 s each,
  4 workers) was cut after 11 cases: 7 INFEASIBLE, 4 UNKNOWN, no grid
  (`found/PROGRESS_pairone5.md`; the two shard logs interleave, so per-case
  attribution is not recorded). Chris scrapped the 5-brainana line on
  2026-09-07 ("scrap the idea of the 5 brainana for now"); no more hunting.
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

- Uniqueness from circles plus dots with **no givens** (Chris: circles stay,
  they are what makes it feel like Choco Banana): not measured yet. The model
  now takes `dots=` (`zombo_brainanas_cpsat.py`: a dotted edge is opposite
  shading with the uninfected digit double the infected one; every undotted
  edge forbids that pair), so `unique({}, circles, [], known=sol, dots=D)` is
  the test. Candidate grids by circles/dots: `probe_circ13` (13/5),
  `dist25_400` (12/8), `probe_bal37` and `box9_704` (11/9).

## r9c7 + r9c9 circles, four pockets (2026-09-07)

With circles on r9c7 (uninfected) and r9c9 (infected), at least four
uninfected groups and the circles + chocolate objective, the shading space is
tiny: `tools/pair99g4.py` and `tools/pair99g4near.py` found four shadings in
total (`found/pair99g4_UI_w3_s0`, `found/pair99g4near_UI_w3_s0..s2`) and then
CP-SAT proved INFEASIBLE for any further shading at distance ≥ 1, in about
40 s each. The IU kind (r9c7 infected) has two shadings at distance ≥ 12
(`found/pair99g4_IU_*`), unexplored closer in.
