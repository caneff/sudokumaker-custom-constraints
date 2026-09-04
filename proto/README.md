# Quad Rank deduction prototype (#324)

Answers the ticket: what is the cheapest `update` that is sound, actually
prunes, and pays for itself in the real app?

**Answer: the leading-digit bound.** A clue's rank bounds its window's
top-left digit, because the top-left is the most significant digit of the
window's concatenated value.

## The law

For an `n x n` board with digits `1..n`, a window whose top-left digit is `d`
has rank in

    [ (n-2)(d-1) + 1 , (n-2)(d-1) + (n-1) ]

*Why.* A window's rank is `1 + #{windows strictly smaller}`. Every window with
a smaller top-left digit is strictly smaller; every larger one is larger. The
`(n-1)^2` windows' top-left cells are exactly the top-left `(n-1) x (n-1)`
sub-board, and in a latin square that sub-board holds one digit `n-1` times and
every other digit `n-2` times — the digit kept whole is the one at
`grid[n-1][n-1]`. So `#{top-left < d}` is `(n-2)(d-1)` or one more, and the
same-digit term runs `0..count-1`. Both extremes are reachable.

Inverting it gives the digits a clued top-left may still hold. At 6x6 that is:

| rank | top-left | rank | top-left |
|---|---|---|---|
| 1–4 | 1 | 14–16 | 4 |
| 5 | 1 or 2 | 17 | 4 or 5 |
| 6–8 | 2 | 18–20 | 5 |
| 9 | 2 or 3 | 21 | 5 or 6 |
| 10–12 | 3 | 22–25 | 6 |
| 13 | 3 or 4 | | |

## Correction to #323

#323 reported this table with **rank 21 pinning to 5**, and 21 of 25 ranks
pinning. That is wrong: rank 21 admits **5 or 6**, and 20 of 25 ranks pin.

A rank-21 window has top-left 6 exactly when `grid[5][5] === 6` — the case
where digit 6 keeps all five of its top-left-sub-board cells. Over 3000 sampled
grids the two counts matched exactly (308 = 308), so this is a structural law,
not a sampling artifact. `proto/rank21.mjs` prints a counterexample grid.

Shipping #323's table would have removed digit 6 from a rank-21 window's
top-left cell — an unsound removal that silently deletes the true solution,
which is the one failure mode `CLAUDE.md` calls out.

## Evidence

| check | result |
|---|---|
| `soundness-harness.mjs` — 3000 spread 6x6 grids, every window | 75,000 tests, **0 violations** |
| `exhaustive4x4.mjs` — all 288 4x4 solutions, every window | 2,592 tests, **0 violations**, predicted sets exactly tight |
| pruning strength at 6x6 | 4.80 of 5 removable candidates per clue; 80.1% of clues pin the top-left outright |

The 4x4 run is exhaustive, and its predicted sets match the observed sets
exactly — so the bound is not merely sound, it is the tightest bound obtainable
from the rank alone.

## Files

| file | what |
|---|---|
| `quadrank-lib.mjs` | geometry + rank oracle ported from `~/src/iss-stuff/quad-rank/quadrank.js`, plus its 6x6 grid sampler |
| `leading-digit.mjs` | the law and its derivation |
| `QuadRankComponent.js` | the component: `update` is the leading-digit removal, `validate` is the full rank check |
| `soundness-harness.mjs` | the 6x6 sweep |
| `exhaustive4x4.mjs` | the exhaustive 4x4 proof |
| `derive_table.mjs` | rebuilds the table from data |
| `rank21.mjs` | the counterexample to #323's table |
| `pick_board.mjs`, `build_board.py` | the timing board, built off a known grid (strategy B's first half) |
| `binds_check.mjs` | proves `validate` binds, so the timing comparison is honest |
| `TIMING.txt` | the raw timing run |

## Timing (real app, `v2026.08.14-d47fc4b`, non-deterministic solve off, 3 reps)

Same board, same `validate`, the only difference being whether `update` makes
the leading-digit removals.

| board | cold | after-logical |
|---|---|---|
| leading-digit deduction | **28.8s** | **25.7s** |
| baseline (deduction removed) | **timeout, 3/3 reps (>300s)** | **timeout, 3/3 reps (>300s)** |

The board is not unique — uniqueness is #325's question. It only has to make the
solver search, which it does.

`binds_check.mjs` rules out the obvious objection: a removal-free `update` could
have been inert (gotcha 2), in which case the baseline would be searching an
unconstrained board and the comparison would mean nothing. It is not inert —
handed a fully-given grid that satisfies sudoku but breaks the clued ranks, the
baseline reports "This puzzle has no solutions". Both boards enforce the same
rule; only the search differs. The deduction board handed the true grid reports
"has a solution / the solution is unique", so the removals do not cut it away.
