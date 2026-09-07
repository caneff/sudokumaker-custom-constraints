# Box-9 circle pairs: which two cells can both carry a circle?

Each of the 36 cell pairs in box 9 was solved as two open circles (rectangle case in-model,
pocket case exact through the placement library, commit efe3ac2). Every pair was proven in
under 30 s at 8 workers; no pair timed out. Witness grids are in `found/pair_*.json`.

| | r7c7 | r7c8 | r7c9 | r8c7 | r8c8 | r8c9 | r9c7 | r9c8 | r9c9 |
|---|---|---|---|---|---|---|---|---|---|
| r7c7 | · | Y | Y | Y | Y | Y | Y | Y | Y |
| r7c8 | Y | · | **N** | Y | Y | Y | Y | Y | Y |
| r7c9 | Y | **N** | · | Y | Y | Y | Y | Y | Y |
| r8c7 | Y | Y | Y | · | Y | Y | **N** | Y | Y |
| r8c8 | Y | Y | Y | Y | · | **N** | Y | **N** | **N** |
| r8c9 | Y | Y | Y | Y | **N** | · | Y | **N** | Y |
| r9c7 | Y | Y | Y | **N** | Y | Y | · | Y | Y |
| r9c8 | Y | Y | Y | Y | **N** | **N** | Y | · | Y |
| r9c9 | Y | Y | Y | Y | **N** | Y | Y | Y | · |

Feasible 30, infeasible 6: r7c8+r7c9, r8c7+r9c7, r8c8+r8c9, r8c8+r9c8, r8c8+r9c9, r8c9+r9c8

Every infeasible pair involves r8c8 with a cell of the bottom-right 2x2 (r8c9, r9c8, r9c9),
or is one of r7c8+r7c9, r8c7+r9c7, r8c9+r9c8.

## Shading kinds per pair

For each feasible pair, can circle A / circle B sit on infected (I) or uninfected (U) cells?
Solved with the pair's shading fixed, both circles open, 120 s limit; nothing timed out.

| pair | II | IU | UI | UU |
|---|---|---|---|---|
| r7c7+r7c8 | - | Y | Y | - |
| r7c7+r7c9 | - | Y | Y | - |
| r7c7+r8c7 | - | Y | - | - |
| r7c7+r8c8 | Y | - | Y | - |
| r7c7+r8c9 | Y | - | Y | - |
| r7c7+r9c7 | - | Y | Y | - |
| r7c7+r9c8 | Y | Y | Y | - |
| r7c7+r9c9 | - | Y | Y | - |
| r7c8+r8c7 | - | Y | - | - |
| r7c8+r8c8 | - | - | Y | - |
| r7c8+r8c9 | - | - | Y | - |
| r7c8+r9c7 | - | Y | Y | - |
| r7c8+r9c8 | - | Y | Y | - |
| r7c8+r9c9 | - | Y | Y | - |
| r7c9+r8c7 | - | Y | Y | - |
| r7c9+r8c8 | - | - | Y | - |
| r7c9+r8c9 | - | - | Y | - |
| r7c9+r9c7 | - | Y | Y | - |
| r7c9+r9c8 | - | Y | Y | - |
| r7c9+r9c9 | - | Y | Y | - |
| r8c7+r8c8 | - | - | Y | - |
| r8c7+r8c9 | - | Y | Y | - |
| r8c7+r9c8 | - | - | Y | - |
| r8c7+r9c9 | - | Y | Y | - |
| r8c8+r9c7 | - | Y | - | - |
| r8c9+r9c7 | - | Y | Y | - |
| r8c9+r9c9 | - | Y | - | - |
| r9c7+r9c8 | - | - | Y | - |
| r9c7+r9c9 | - | Y | Y | - |
| r9c8+r9c9 | - | Y | - | - |

UU never happens: two pockets cannot both be clued inside box 9. II only with r7c7 cut off
from the 9's rectangle (r7c7 with r8c8, r8c9, r9c8). Everything else is one rectangle circle
plus one pocket circle. There is no symmetry to exploit: transposing swaps boxes 2/4, 3/7, 6/8
and moves the patient zeros, so all 30 pairs are distinct configurations.
