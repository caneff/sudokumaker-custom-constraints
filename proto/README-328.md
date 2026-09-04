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
