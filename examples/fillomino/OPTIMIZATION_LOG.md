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
