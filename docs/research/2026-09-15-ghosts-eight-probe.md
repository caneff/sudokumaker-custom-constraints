# Ghosts: a valid grid with a ghost holding 8 exists [verified]

Rule (Ghosts POC, Michael Lefkowitz): normal sudoku; a digit on a ghost equals
the number of ghosts in its up-to-8 king-move neighbours. Only ghost cells
carry a clue. Not all ghosts are visible. Rulings from Chris, 2026-09-15: an
isolated ghost is impossible (no digit 0); uniqueness is out of scope for now;
the first goal is any valid grid plus ghost set where one ghost holds an 8.

## Result

`uv run docs/research/ghosts/probe.py` — CP-SAT, one worker, OPTIMAL in 1.40 s.
An independent Python recheck of sudoku rows/columns/boxes and the ghost count
passed. `*` marks a ghost; the 8-ghost is r4c3.

```
5  8  1  9  2  4  3  6  7
9  3* 4* 7  6  8  1  2  5
2  6* 7* 5* 3* 1* 9  4  8
4* 7* 8* 6* 1  9  2  5  3
3* 5* 6* 4* 7  2* 8  1  9
1  9  2  3* 8  5* 4* 7  6
8  4  3  1  5* 7* 6* 9  2
7  2  9  8  4* 6* 5* 3* 1*
6  1  5  2  9  3* 7  8  4
```

## Model

- `x[r][c][d]` one-hot digits with the usual row/column/box exactly-one.
- `g[r][c]` ghost boolean; `g ⇒ Σ g(neighbours) = digit`, via
  `only_enforce_if`.
- One `e[r][c] ⇒ g ∧ digit 8` per cell, with `bool_or` over all `e`.

## Facts that fall out of the rule

- 9 never sits on a ghost, and a corner ghost holds at most 3, an edge ghost
  at most 5.
- A ghost 8 cannot be a box centre (r2c2, r2c5, …, 0-based box middles): its
  whole 3×3 would be ghosts in one box, needing nine distinct digits ≤ 8.
