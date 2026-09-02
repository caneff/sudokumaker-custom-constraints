# Fillomino optimization log

Speed attempts against `update`, kept or rejected, with why. The bar is the
two-row rule in `CODING_STANDARDS.md`: `just time fillomino` prints a cold row
and an after-logical row, and a change ships at ≤ 0.9× on either row and ≤ 1.1×
on the other.

**Nothing is timed yet, and no row here is a measurement.** The shipped 6x6
board is the vendored baseline's own board, which the baseline's README already
records as unable to rank anything: 100 ms cold, 0 ms after logical. A board
that ranks a fillomino component does not exist yet — that is the generator
(#306) and the frozen fixture set (#307). Rung 2 (#308) and rung 3 (#309) each
merge with fixture rows against the baseline and against the rung before them.

| Date | Change | Kept | Why |
| --- | --- | --- | --- |
| 2026-09-02 | Rung 1: island scan, overflow, seal, walk, starve, force, doors (#305) | yes | The floor. No fixture ranks it yet; the cost choices below are made from the bound, not the clock. |

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
