# Fillomino optimization log

Speed attempts against `update`, kept or rejected, with why. The bar is the
two-row rule in `CODING_STANDARDS.md`: `just time fillomino` prints a cold row
and an after-logical row, and a change ships at ≤ 0.9× on either row and ≤ 1.1×
on the other.

The shipped 6x6 board ranks nothing — the baseline's README records it at
100 ms cold, 0 ms after logical. Every number below comes from the frozen
fixture set instead (#307, `docs/research/fillomino-baseline/README.md` —
19 boards, 28-35 givens, each proved unique). Every sweep, rung by rung, is in
this example's README under `## Timing`.

| Date | Change | Kept | Why |
| --- | --- | --- | --- |
| 2026-09-02 | Rung 1: island scan, overflow, seal, walk, starve, force, doors (#305) | yes | The floor. No fixture ranked it at the time; the cost choices below were made from the bound, not the clock. |
| 2026-09-03 | Rung 2: the growth test at full scope — the merge rules per (open cell, candidate digit) pair (#308) | no | Rejected by the clock against rung 1: 1.00× to 4.86× on the frozen fixtures, worst on the digits-1-12 boards, where the walk budget is widest. |
| 2026-09-03 | Rung 2: the growth test at #308's named fallback scope — the merge rules at the doors, plus the per-digit component bound (#308) | yes, on a mixed clock | 10 of the 19 fixtures SHIP against rung 1 and 9 do not; all 19 SHIP against the vendored baseline. Read across the set, cold time falls 0.82× and the median fixture 0.68×. The full rows and the reading are in the README's `## Timing`. |
| 2026-09-03 | Rung 2.5: dirty components — the bound diffs a per-cell allowed-digit row against the row the last pass finished on and re-floods only the changed cells and their neighbours (#312) | yes | Fixpoint-identical by assertion, both directions. Cuts the bound from 81% on top of the island rules to 20%, 0.66× the component's local time. The panel rows are in the README's `## Timing`. |
| 2026-09-03 | Rung 2.5: bound at quiescence — island rules to a standstill, then one bound pass (#312) | no | Fixpoint-identical and 1.30× slower. Buys no bound passes (3.05 → 3.18 per state) because the island rules already quiesce in about one pass, and pays for a confirming island pass at every quiet point (3.05 → 5.49). |
| 2026-09-03 | Rung 2.5: k-bounded floods with safe marks — stop a flood at `k` cells (#312) | no | Fixpoint-identical and 1.00× — with dirty components the floods are already small, and stopping early moves work rather than removing it. Fifteen lines and one ordering trap (the safe mark must be read before the visited stamp) for no signal. |
| 2026-09-03 | Rung 3: cut starve per island, behind ISOFILL's dominator-tree `cutFilter` (#309) | yes | 18 of the 19 fixtures SHIP against rung 2.5; cold time over the set falls **0.08×** and the median fixture **0.04×**. The nineteenth, cap9-seed5, is a measurement-floor row — rung 2.5 already finishes it in 100 ms and rung 3 reads the same 100 ms. The full rows are in the README's `## Timing`. |
| 2026-10-14 | Rung 3: a running open-cell count as a fast reject ahead of the walks (#327) | no | Fixpoint-identical; 1.03× (incremental diff) and 1.09× (recount) over the 19 fixtures. Nodes fall on two boards (cap12-seed18 0.51×, cap12-seed9 0.61×) and the check's cost shows on the other 17. Full table in `## #327` below. |

## Rung 2's own cost choices

- **Frontier-only scope, not full scope — the clock chose it.** Full scope was
  built and timed first, and rung 1 beat it outright (the row above). #308 names one
  fallback for exactly that outcome, and this is it: the merge rules at the
  doors plus the per-digit component bound (transfer doc §6(i)). The fallback
  keeps the silent-region win, because the component bound needs no placed
  cell, and on this example's strength fuzz the two scopes prune the same
  21084 cells over 600 states.
- **The merged set is one `placedFlood` from the door.** Seeding the flood at
  the door itself, which joins whether or not it is placed, returns `M` — the
  door plus every island of the digit it touches — with no separate neighbour
  scan.
- **The component bound is the one rule bounded by the board, not by the
  digit.** It stays because it is the only rule that reaches a silent region,
  the deduction #308 asks rung 2 to show, and #308's three real regressions
  against rung 1 were what it cost. **#312 made it cheap** rather than skipping
  it: it now re-floods only the cells whose allowed-digit code changed since
  the last pass, and their neighbours, and it reads each cell's code once per
  pass instead of once per (cell, digit) pair. Byte-identical fixpoint, 81% on
  top of the island rules down to 20%. Each component is still walked to its
  end rather than stopped at `k` cells — that bound was built and measured at
  1.00× (see PROGRESS).
- **Rung 1's own merge-overflow at a door stays where it is.** Rung 2's merge
  overflow is the same deduction on the same set, so the two now share one
  `placedFlood`: rung 2's loop reads the flood's size and rung 1's separate
  copy is gone.

## Cost choices made without a clock

Recorded so a later measurement can overturn them by name.

- **Neighbour lists built once in `setParams`.** `update` runs on every search
  node; index arithmetic per visit was the alternative.
- **One stamped mask for every walk and flood**, pooled on the instance and
  never cleared — the stamp does that. #312 added three more pooled rows for
  the bound (`code`, `prev`, `seeds`) on the same principle. Scratch rows (`members`, `merge`, the
  two frontiers) are allocated once, so a call allocates almost nothing.
- **Every walk stops at `k + 1` cells.** No rung-1 rule reads a walk past its
  digit, and in fillomino no region exceeds `D`, so a walk is bounded by the
  digit rather than by the board — the structural reason the transfer doc
  expects these rules to cost far less than their ISOFILL originals
  (`fillomino-isofill-transfer.md` §3).
- **Each island is re-flooded live before its rules run.** This is a soundness
  fix, not a speed choice, and it costs one flood per island per call on top of
  the scan. If the clock later objects, the alternative is a dirty flag that
  re-floods only after `update` has yielded — same result, more state.

## #327: a running open-cell count as a fast reject (rejected on the screen)

The idea: keep a board-wide count of placed cells per digit and of open cells,
and kill a state before any walk runs when the digits placed need more open
cells than are left. A digit `d` with a placed cell has a region of `d` cells
holding at most every placed `d`, so it needs at least `d - placed(d)` open
cells, and regions of different digits are disjoint, so the needs add. `need >
open` has no fill.

Two variants, both source patches over the shipped component
(`open-count-lib.mjs`), neither a second component file:

- **incremental** — the count the ticket asked for. The solver sends no change
  events and no backtrack signal, so a count survives only by a per-call diff
  of each cell's placed digit against the row the last call saw, moving the
  counts by the difference. That diff is one 81-cell read loop per call.
- **recount** — the same check taking the per-digit counts from `scan`'s
  islands, which already visit every placed cell: no extra read, no snapshot.

Seams: `open-count-lib.test.mjs` — both variants give the baseline's verdict and
grid on small boards, kill a directed state no other rule kills in one call,
follow the board down and back up on one instance, match the baseline's
fixpoint in both directions on 150 states around a solution, and keep every
true value over 3000 fuzzed states per variant on each of the shipped and
varied fixtures (0 violations).

The screen is `node examples/fillomino/open-count-screen.mjs`, the 19 frozen
fixtures, best of 5 whole solves, one core. Both variants return the
baseline's verdict and grid on every fixture. cap9-seed3 spends the 200,000
node budget in all three, so its row compares time at an equal, unfinished
search.

| Fixture | Nodes, baseline | Nodes, variant | ms, baseline | ms, incremental | Ratio | ms, recount | Ratio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 9x9-cap12-seed10 | 2715 | 2715 | 116.2 | 109.0 | 0.94× | 125.8 | 1.08× |
| 9x9-cap12-seed11 | 27888 | 27888 | 1998.8 | 1987.2 | 0.99× | 2122.9 | 1.06× |
| 9x9-cap12-seed13 | 1032 | 1032 | 85.9 | 88.3 | 1.03× | 92.7 | 1.08× |
| 9x9-cap12-seed14 | 50 | 50 | 6.3 | 6.8 | 1.08× | 7.1 | 1.12× |
| 9x9-cap12-seed16 | 0 | 0 | 0.7 | 0.7 | 1.05× | 0.7 | 1.04× |
| 9x9-cap12-seed17 | 115 | 115 | 7.6 | 8.0 | 1.06× | 8.3 | 1.10× |
| 9x9-cap12-seed18 | 11907 | 8764 | 665.8 | 341.2 | 0.51× | 375.7 | 0.56× |
| 9x9-cap12-seed20 | 242 | 242 | 20.3 | 20.8 | 1.03× | 21.7 | 1.07× |
| 9x9-cap12-seed3 | 456 | 456 | 39.9 | 41.9 | 1.05× | 42.8 | 1.07× |
| 9x9-cap12-seed4 | 7 | 7 | 1.5 | 1.5 | 1.03× | 1.6 | 1.06× |
| 9x9-cap12-seed5 | 125499 | 125499 | 6952.2 | 7232.1 | 1.04× | 7603.1 | 1.09× |
| 9x9-cap12-seed8 | 0 | 0 | 0.7 | 0.8 | 1.12× | 0.8 | 1.13× |
| 9x9-cap12-seed9 | 4755 | 3348 | 205.4 | 126.2 | 0.61× | 135.0 | 0.66× |
| 9x9-cap9-seed1 | 34321 | 34321 | 3162.1 | 3235.5 | 1.02× | 3421.0 | 1.08× |
| 9x9-cap9-seed10 | 110 | 110 | 8.1 | 8.4 | 1.04× | 9.3 | 1.15× |
| 9x9-cap9-seed18 | 1760 | 1760 | 101.4 | 106.7 | 1.05× | 112.9 | 1.11× |
| 9x9-cap9-seed20 | 21 | 21 | 2.3 | 2.4 | 1.08× | 2.5 | 1.11× |
| 9x9-cap9-seed3 | 200000 | 200000 | 12856.1 | 13661.8 | 1.06× | 14452.2 | 1.12× |
| 9x9-cap9-seed5 | 2219 | 2219 | 170.7 | 179.3 | 1.05× | 187.7 | 1.10× |
| **Total** | 413097 | 408547 | 26402.0 | 27158.8 | 1.03× | 28723.8 | 1.09× |

**Verdict: rejected.** The set's time goes **1.03×** (incremental) and **1.09×**
(recount); neither is near the 0.9× the gate asks for. The count has a
mechanism: it removes dead subtrees, taking cap12-seed18 from 11907 to 8764
nodes (0.51× time) and cap12-seed9 from 4755 to 3348 (0.61×). On the other
17 fixtures the node count does not move, so what shows is the cost of the
check, 0.94× to 1.12× per board at millisecond scale. The two wins are on
boards that take 0.7 s and 0.2 s, while the set's time sits in cap12-seed5
(7 s), cap9-seed3 (13 s) and cap9-seed1 (3 s), where the check buys nothing.
The recount costs more than the diff because the island walk it rides on runs
every call, and the early return it adds sits before `islandRule` regardless.

The component is unchanged and nothing was timed in the live app: the screen
does not clear the bar that earns the clock, the same call #312 made for the
bound at quiescence and k-bounded floods. The check is dominated on the
fixtures that matter; if a later hunt wants the two boards it speeds up, the
patch is in `open-count-lib.mjs`.
