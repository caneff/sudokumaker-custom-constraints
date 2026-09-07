# How many brainanas can a grid have?

Question (Chris): maximize the number of uninfected groups, clued or not.

## Counting them in the model

Two attempts, one that works:

1. Sum over the pocket placement library (a placement whose cells are all
   uninfected and whose border is all infected IS a whole group). As an
   objective term it runs (`pairopt.py ... pock`, 37 grids, best 4 groups) but
   one solve peaks at 7.7 GB RSS at 8 workers, so pock hunts need a 13 GB cap
   and two processes. As a constraint (`sum >= 5`) one solve climbed past
   16 GB and died: CP-SAT turns `>= 1` over 200k literals into a clause, a
   `>= 5` cardinality it does not. A Euler-number count (Gray's formula on
   2x2 windows) is cheap but undercounts: 135 of 195 found grids have holes,
   chocolate rectangles floating inside a banana.
2. Spanning-tree labeling (model d2cdd33, `min_groups`, `pocket_weight`):
   every uninfected cell carries the label of its group and a distance to
   the group's one root (label == own index); a non-root needs a neighbour
   with the same label one step closer; adjacent uninfected cells share a
   label. ~300 bools, exact. Verified against the flood fill on want3_200
   (4 groups feasible, 5 infeasible with that shading fixed).

## Results (tools/groups.py, box-9 pair open, no pocket library)

| brainanas | verdict | time |
|---|---|---|
| 5 | FEASIBLE | 20 s, grid `found/groups_5` (sizes 21, 12, 7, 6, 5) |
| 6 | unknown | 600 s timeout at 8 workers; 1 h run at 16 workers pending |

Before this the record across every arm was 4 (5 grids of 195). The
`pairpock` arm (37 grids) maximized the library count and never beat 4.
