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
