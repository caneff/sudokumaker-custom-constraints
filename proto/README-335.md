# A stronger quad-rank `update` — and the boards that were never sudoku (#335)

The ticket asked what deduction makes `update` strong enough for the app to
prove uniqueness on a 9x9 quad-rank board, because #328 had measured every 9x9
board timing out at 300s, up to 44 givens.

**The premise was wrong. `proto/build_board.py` built boards with no rows and no
columns.** Every board #324, #325 and #328 handed the app enforced boxes and
given digits only. With rows and columns added, the shipped component proves the
44-given board unique in 0.0s.

The new deduction is real and worth keeping — it takes a board that searches
from 1.6s to under the app's 0.1s resolution — but it is not what makes 9x9
work. Rows and columns are.

## 1. The bug

`build_board.py` emitted:

```python
{"type": 1, "regions": regions()},   # boxes
{"type": 0},                          # given digits
```

A region constraint does not imply rows and columns (`docs/gotchas.md` #9). The
tell came from tapping the solver worker's messages (`proto/app_solutions.mjs`):
the first grid the app called a solution for the 6x6 board of #324 was

```
4 1 2 2 3 4      <- row 0, two 2s and two 4s
3 5 6 1 5 6
...
```

Boxes hold, givens hold, rows and columns do not. The fix is the two type-301
cage constraints `framebuild.py` already used for the frame boards.

## 2. What the correct boards do

`proto/ground_truth.mjs` counts solutions by brute force from the decoded link,
with no component involved. `proto/app_count.mjs` reads the app's own count with
non-deterministic solve off.

| board | truth | app, box-only | app, rows+columns |
|---|---|---|---|
| 6x6 of #324 | 2 solutions | 5 solutions, 20s | **2 solutions, 0.0s** |
| 9x9, 8 clues / 44 givens | unique | timeout at 300s | **unique, 0.0s** |
| 9x9, 6 clues / 16 givens | unique | — | **unique, 1.6s** |
| 9x9, 13 clues / 0 givens | unique (CP-SAT) | timeout | timeout at 300s |
| 9x9, 16 clues / 0 givens (#328 winner) | unique (CP-SAT) | timeout | timeout at 300s |

The 0-given boards are the real frontier: they time out with **both**
components. Givens are what lets the app finish.

## 3. The deduction: the counting identity as interval arithmetic

`QuadRankComponent2.js` keeps the leading-digit bound and adds the lead #335
named as untouched: a window with rank `R` has exactly `R-1` windows strictly
below it.

Every window's value sits in an interval read off the candidate sets —
concatenation is digit-wise monotone, so the interval is the concatenation of
the per-cell minimum and of the per-cell maximum. Against my clue's interval:

- `L` = windows definitely below (`hi(u) < lo(me)`)
- `P` = windows possibly below (`lo(u) < hi(me)`)

`L <= R-1 <= P` must hold, or the branch is dead. Pinning one of my four cells
to a candidate moves `lo(me)`/`hi(me)`, so a candidate that puts `R-1` outside
`[L, P]` is removed. Other windows keep their unconditional intervals, which is
a relaxation, so overlapping windows stay sound.

Cost: 64 window intervals plus 4 x 9 x 64 comparisons per call.

### Soundness

`proto/soundness-counting.mjs` fuzzes partial STATES (`sweep9x9.mjs` only tests
the static leading-digit table). Every state keeps each cell's true value, so
any removal of a true value, and any `stop()`, is a violation.

| board | states | violations | removed/state, new | old |
|---|---:|---:|---:|---:|
| 9x9, mixed pin rates | 60 | 0 | 43.7 | 43.1 |
| 9x9, 80% pinned | 60 | 0 | 12.7 | 10.6 |
| 9x9, 90% pinned | 60 | 0 | 8.1 | 5.5 |
| 9x9, 95% pinned | 60 | 0 | 3.6 | 2.5 |
| 6x6, mixed | 120 | 0 | 12.5 | — |

Deep in a search — where a uniqueness proof lives — it prunes about 45% more
than the leading-digit bound alone.

### Real-app timing, on a board that searches

9x9, 6 clues / 16 givens, cold, non-deterministic solve off, 3 reps:

| component | first | unique | sum | verdict |
|---|---:|---:|---:|---|
| shipped | 200ms | 1400ms | **1600ms** | unique, 3/3 |
| + counting identity | 0ms | 0ms | **0ms** | unique, 3/3 |

Below the app's 0.1s readout resolution, so the ratio is "faster than the clock
can say", not a number.

## 4. #328's other gotcha survives

Narrowing `getAffectedCells` to the window's four cells, re-tested on a board
that has rows and columns: **5,100 solutions** on the unique 16-given board. A
window's rank depends on every window, so each clue watches the whole grid.

## Files

| file | what |
|---|---|
| `QuadRankComponent2.js` | leading digit + the counting identity |
| `QuadRankComponent_narrow.js` | shipped component with the narrow watch set |
| `QuadRankComponent_nolatch.js` | shipped component with the `done` latch removed |
| `QuadRankComponent2_{inert,nostop,stoponly,empty,probe,log,mask}.js` | bisect variants from the diagnosis |
| `soundness-counting.mjs` | state fuzz for the counting rule (`QR_PIN` sets the pin rate) |
| `root_check.mjs` | run a component over one puzzle's root state |
| `ground_truth.mjs` | brute-force solution count, no component |
| `app_count.mjs` | the app's solution count, non-deterministic solve off |
| `app_solutions.mjs` | the grids behind that count, tapped from the solver worker |
| `link_to_puzzle.py`, `audit_link.py` | decode a built link back to a puzzle / audit it |
| `build_board.py` | rows and columns added; takes `--component <file>` |

Links built with the fix are `proto/LINK_rc_*.txt`.
