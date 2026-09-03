# Fillomino optimization log

Speed attempts against `update`, kept or rejected, with why. The bar is the
two-row rule in `CODING_STANDARDS.md`: `just time fillomino` prints a cold row
and an after-logical row, and a change ships at ≤ 0.9× on either row and ≤ 1.1×
on the other.

The shipped 6x6 board ranks nothing — the baseline's README records it at
100 ms cold, 0 ms after logical. Every number below comes from the frozen
fixture set instead (#307, `docs/research/fillomino-baseline/README.md` —
19 boards, 28-35 givens, each proved unique). Rung 2's full sweep, both
comparisons, is in this example's README under `## Timing`.

| Date | Change | Kept | Why |
| --- | --- | --- | --- |
| 2026-09-02 | Rung 1: island scan, overflow, seal, walk, starve, force, doors (#305) | yes | The floor. No fixture ranked it at the time; the cost choices below were made from the bound, not the clock. |
| 2026-09-03 | Rung 2: the growth test at full scope — the merge rules per (open cell, candidate digit) pair (#308) | no | Rejected by the clock against rung 1: 1.00× to 4.86× on the frozen fixtures, worst on the digits-1-12 boards, where the walk budget is widest. |
| 2026-09-03 | Rung 2: the growth test at #308's named fallback scope — the merge rules at the doors, plus the per-digit component bound (#308) | yes, on a mixed clock | 10 of the 19 fixtures SHIP against rung 1 and 9 do not; all 19 SHIP against the vendored baseline. Read across the set, cold time falls 0.82× and the median fixture 0.68×. The full rows and the reading are in the README's `## Timing`. |

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
  digit.** One flood over all 81 cells per digit, on every call, and each
  component is walked to its end rather than stopped at `k` cells — stopping
  early would leave its far cells unstamped and the next seed would read one of
  them as a component of its own. This is what the three real regressions
  against rung 1 are paying for, and why they cluster on the digits-1-12
  boards. It stays because it is the only rule that reaches a silent region,
  the deduction #308 asks rung 2 to show. Gating it — flood only the digits
  whose allowed set changed since the last call — is the next measurement, and
  needs per-digit change tracking the component does not carry today.
- **Rung 1's own merge-overflow at a door stays where it is.** Rung 2's merge
  overflow is the same deduction on the same set, so the two now share one
  `placedFlood`: rung 2's loop reads the flood's size and rung 1's separate
  copy is gone.

## Cost choices made without a clock

Recorded so a later measurement can overturn them by name.

- **Neighbour lists built once in `setParams`.** `update` runs on every search
  node; index arithmetic per visit was the alternative.
- **One stamped mask for every walk and flood**, pooled on the instance and
  never cleared — the stamp does that. Scratch rows (`members`, `merge`, the
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
