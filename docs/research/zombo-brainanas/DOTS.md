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

Digit fills of those four UI shadings are finite too (`tools/pair99fills.py`,
all exhausted): 6, 12, 6 and 12 fills, 36 grids in `found/pair99fills_*`.
Most dot options: `pair99fills_n1_f04` (8 black + 18 white, 7 circles, 34
chocolate); best with 9 circles: `pair99digits_UI_d1` (= fill s0_f02, 7 black + 17 white). The s0 fills duplicate the `pair99digits_*` grids, so `found/` holds 27 of the 36.

## Which third circle pins the r9c7 / r9c9 shading (2026-09-07)

`tools/pinx.py`: circles open on r9c7, r9c9 and one cell X outside box 9, no
other constraint; a kind INFEASIBLE for X means a circle on X pins the other
kind. Logs in `probes/pinx_IU.log`, `probes/pinx_UI.log`, every cell decided
(no timeouts). U = pins UI (r9c7 uninfected, r9c9 infected), I = pins IU,
X = neither kind survives, . = no pin.

```
      c1 c2 c3 c4 c5 c6 c7 c8 c9
r1     .  .  .  .  .  U  U  .  .
r2     .  .  .  .  .  U  U  .  .
r3     .  .  .  .  .  U  U  .  .
r4     .  .  .  .  U  U  U  U  .
r5     .  .  .  U  U  U  .  U  U
r6     .  .  .  I  .  .  .  .  U
r7     .  .  X  U  U  U  #  #  #
r8     .  .  I  U  U  U  #  #  #
r9     .  .  U  U  X  U  #  #  #
```

29 cells pin UI, two pin IU (r6c4, r8c3), two kill both (r7c3, r9c5).

## Circles r6c8 + r9c7 + r9c9 with a white dot near r7c5 (2026-09-07)

Ask: a white dot between r7c5 and r7c6. Result: infeasible for both kinds, with
or without the 4-group floor. Splitting it: r7c6 uninfected alone is infeasible
for both kinds once r6c8 carries a circle (with only the box-9 pair, UI allows
it), and r7c5 uninfected alone is feasible only for IU. So r6c6–r7c6 is dead
too. Edge sweep of rows 6–9, cols 4–6 (`probes/tri68w/sweep.txt`, 26 of 34
cases decided before the hunt was stopped): IU allows r6c4–r7c4, r7c4–r7c5,
r7c4–r8c4, r8c4–r8c5, r8c4–r9c4, r8c5–r9c5; UI allows only r9c5–r9c6.
Scripts: `tools/tri68w.py`, `tools/tri68sweep.py`.

## Circles r9c7 + r8c9 + r6c8 (2026-09-07)

Kind = shading of (r9c7, r8c9). II and UU infeasible in seconds; IU and UI both
feasible, 10 circles each, chocolate 27–32 (`found/tri3_*`). With a white dot
on some edge of r6c6 (`tools/tri3w66.py`): **UI is infeasible** (17 s proof),
IU gives four grids (`found/tri3w66_IU_*`), the dot landing on r5c6–r6c6 or
r6c6–r6c7. So a white dot at r6c6 pins IU here (r9c7 infected, r8c9
uninfected), not UI.

With the white dot forced on r6c5–r7c5 instead (`tools/tri3wdot.py`): IU is
infeasible, UI gives three grids (`found/tri3wdot_r6c5r7c5_UI_*`, 10/9/9
circles, 32/29/29 chocolate, two pockets each). So r6c6 pins IU and r6c5–r7c5
pins UI for this circle triple.
