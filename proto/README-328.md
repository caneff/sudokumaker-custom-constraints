# Adversarial finder for a hard quad-rank puzzle (#328)

Answers the ticket's three questions: what the offline difficulty metric is,
what makes a quad-rank puzzle hard, and what search finds one.

## 1. The metric: CP-SAT branches on a from-scratch solve

Two candidates were built and measured against each other.

**`proto/qr-metric.mjs`** — the honest one. It runs the REAL
`QuadRankComponent` over the puzzle's start state on a Regin-strength
all-different floor, exactly as `examples/*/recovery-probe.mjs` do, and reports
DFS nodes. Closest in shape to the app, because the app also calls the
component's `update` at every node.

**`proto/qr_stats.py`** — CP-SAT's own `num_branches` on a single-worker solve
from scratch. Not the app's engine, but 2-9x cheaper.

They agree on the ordering of the two #325 puzzles:

| puzzle | JS probe (DFS nodes) | JS wall | CP-SAT branches | CP-SAT wall |
|---|---:|---:|---:|---:|
| 6 clues, 16 givens | 23,966 | 11.8s | 2,530 | 0.27s |
| 13 clues, 0 givens | >200,000 (capped) | 96.7s | 56,622 | 10.9s |

**The JS probe is too slow to steer a search** — about 2,000 nodes/sec, so
minutes per candidate. CP-SAT branches is the search metric; the probe
re-scores the finalists, and the live app is the arbiter.

Single worker matters: with 8 workers the branch count is a sum over portfolio
threads and moves run to run, which makes it useless as a signal.

## 2. What the search moves

Levers from the ticket, all wired into `neighbours()` in `proto/qr_find.py`:
swap a clue for another window (biased 50% toward the eight ambiguous ranks
8, 15, 22, 29, 36, 43, 50, 57 that #324 showed leak least), drop a clue, add a
clue, drop a given, swap a given.

Uniqueness is a hard filter, checked before the metric because it is the
cheaper call.

## 3. The search

Hill-climb with plateau drift: accept any unique neighbour scoring at least as
high, keep the best seen. Seeded from a #325 greedy-minimal clue set, because
**a fully-clued board solves in zero branches and offers the climb no
gradient** — the first run accepted nothing at all from that start.

## Files

| file | what |
|---|---|
| `qr-metric.mjs` | the real-component DFS probe (honest metric, slow) |
| `qr_stats.py` | CP-SAT branch/conflict counts (search metric, fast) |
| `qr_find.py` | the hill-climb; appends to `PROGRESS_328.md` as it runs |
| `build_board.py` | now takes `--puzzle p.json` at any size; the 6x6 default still builds byte-identically to #324's board |

## 4. Live-app validation: the metric could not be validated, because the app
## cannot solve a 9x9 quad-rank board at all

Every 9x9 board built here timed out in the real app at 300s
(`v2026.08.14-d47fc4b`, non-deterministic solve off), across the whole range of
digit givens:

| board | givens | CP-SAT | app (300s cap) |
|---|---:|---:|---|
| 13 clues | 12 | 0 branches, 0.1s | timeout 3/3 |
| 13 clues | 16 | — | timeout |
| 13 clues | 20 | — | timeout |
| 13 clues | 28 | — | timeout |
| 13 clues | 36 | — | timeout |
| 13 clues | 44 | 0.01s | timeout |

44 givens is more than half the grid handed over, and CP-SAT proves uniqueness
in 0.01s. The offline probe in `qr-metric.mjs`, running the REAL component,
finishes it in **0 search nodes** -- propagation alone.

**It is not the harness or the board size.** The identical 44-given board with
the quad-rank clues stripped out solves in **300ms**.

**It is not a broken constraint.** `binds_check.mjs` on a fully-given 9x9:
the true grid gives "This puzzle has a solution. The solution is unique!", and
a different valid sudoku under the same clues gives "This puzzle has no
solutions."

**The cliff is exactly the uniqueness boundary.** At 44 givens, varying only
the clue count:

| clues | unique? (CP-SAT) | app |
|---:|---|---|
| 1 | multiple | 300ms |
| 2 | multiple | 400ms |
| 4 | multiple | 800ms |
| 8 | **unique** | **timeout** |

While a second solution exists the app finds one and stops. The moment it has
to *prove* there is no second solution, it must exhaust a search in which quad
rank gives it almost nothing: `update` fires once on top-left cells only, and
`validate` rejects only at a complete grid.

### Gotcha found: `getAffectedCells` cannot be narrowed

The obvious cost suspect is that each clue returns all 81 cells from
`getAffectedCells`, so every clue watches the whole grid. Narrowing it to the
window's four cells does make the 8-clue/44-given board finish in 300ms -- but
the app then reports it **not-unique**, on a board CP-SAT proves unique. The
constraint is under-enforced. A window's rank depends on all 64 windows, so the
wide watch set is load-bearing; it is the cost, and it is not removable this way.

### What this means

The metric question cannot be answered as the ticket frames it. There is no app
signal to correlate a metric against while no 9x9 board is solvable, so
"validate it against the live app" has no data to work with. The search tool
exists and runs, but steering it by CP-SAT branches is unjustified until the app
can finish a board.
