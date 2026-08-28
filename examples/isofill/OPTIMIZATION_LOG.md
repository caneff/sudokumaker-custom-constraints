# Isofill — optimization log

Every speed-up tried on `IsofillComponent.js`'s `update`, kept or rejected,
with the numbers that decided it. Read this before trying a new one — a dead
end here does not need a second attempt. Background:
`docs/research/connectivity-techniques.md` (the survey these rows come from),
`docs/real-app-timing.md` (the method), `examples/isofill/README.md`
(`## Timing`, the fullest record).

Fixtures changed across these rows — `gen_9x9`/`gen.json` (35 givens) is the
shipped board; `gen_30g`/`gen_32g`/`gen_44g` are harder stripped fixtures from
#141; `gen_35g_silent` is a fixture built to exercise the silent-digit rule —
so a row's caveat says which fixture and app build produced its numbers.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|
| Capacity deduction (a digit whose reach walk meets fewer than ten cells is a dead branch) | Kept | Real app, stripped grids, median of 3: 35 givens — still no verdict with or without capacity; 44 givens — reach alone 25.9 s → reach + capacity 9.1 s (ratio 0.35) | pairs with reach to close the search, alone insufficient at 35 givens | shipped grid + new 44-clue fixture, app v2026.08.14 | 9e32c8f |
| Cut pruning (an open cell whose removal starves or splits a placed digit's walk must hold that digit) (#101, #105) | Kept — closes the shipped instance | With cap, force, reach, capacity alone: no verdict at 35 givens (nor 36, 37, 39; 40 closed in ~35–41 s, 41 in 12 s). With cut: 35-given shipped instance reads unique in 0.2 s (was timeout, 3/3); 41-/44-given fixtures 0 ms | fuzz 60,000 tests, 0 violations; mock DFS finds exactly the grid | shipped 35-given grid + clue ladder, app v2026.08.14 | 9bb1a50 |
| Homeless-digit deduction (a digit with no placed cell needs a ten-cell connected home) (#91) | Rejected — no verdict change and no time change | Real app, stripped grids, median of 3: 35 givens — timeout 3/3 with and without; 44 givens — median 9.1 s with and without (unchanged) | sound, but superseded — a deduction must pay for itself, so it was removed | 35-given + 44-given fixtures, app v2026.08.14-d47fc4b | bea6378 (added), 2f8780f (removed — final 35-given verdict recorded) |
| One-pass `update` (read each cell's candidates once per call, build all four deductions' sets from one scan, instead of one scan per digit) | Kept | Halved the app's verdict on the 44-given fixture: 11.2 s baseline → 5.7 s one-pass, ratio 0.51 (same session, pair). 35-given: still timeout 3/3 | never weaker at the fixpoint: 5,000-state differential against the per-digit scan — equal on 4,816, strictly tighter on 184, looser on none; harness asserts the read count | 44-given fixture, app v2026.08.14-d47fc4b, same session | cef2afd |
| Neighbour lists built once in `setParams`, stamped visit mask on the instance replacing a `Set` per walk (no allocation per walk) | Kept | 32-given fixture, live app, 3/3 unique: 40.4 s → 27.6 s | fuzz 4×2,000, 0 violations | 32-given stripped fixture | c5a7908 |
| Budget deduction (max-flow / Kuhn matching: source → digit (capacity `10 − placed`) → open cell (capacity 1, if in the digit's walk) → sink; if max flow < open-cell count, the branch is dead) | Kept | 32-given fixture, live app, 3/3 unique: 27.6 s → 24.8 s (first pass 26.8 s → 24.8 s after rewriting from dense max-flow to Kuhn's augmenting path); marks-board evidence (not a timing) 7.3 s → 7.2 s | fuzz 4×2,000, 0 violations; 32-given grid CP-SAT-proved unique | 32-given stripped fixture, same commit as the neighbour-list change | c5a7908 |
| Tour bound on the walk (spanning-tree closed-tour lower bound: `1 + ceil(perimeter/2)` cells for any three region points) + Régin prune on the budget matching (unmatched cell–digit pair dead unless its ends share an SCC of the residual graph) | Kept | 32-given fixture, live app, 3/3 unique: 24.9 s → 23.4 s (Régin prune) → 15.3 s (tour bound). Four-point tour variant tried and dropped: 35.6 s (worse). Shipped 35-given puzzle unaffected, still 0.2 s | fuzz 4×2,000, 0 violations | 32-given stripped fixture | 812dfda |
| Cut walks stop early (yes/no answer only, no need to finish the walk); dead-end cells (one allowed neighbour) skip the walk unless it is exactly ten; stamped `Uint32Array` visit mask | Kept | Node profile: reach was 46% of an `update` call, all from cut's per-open-cell walks. 32-given fixture, live app, 3/3 unique: 15.3 s → 5.7 s | fuzz 4×2,000, 0 violations | 32-given stripped fixture | 9e244dc |
| Reused scratch buffers across `update` calls (allowed arrays, walk-mask copy, distance rows, BFS frontiers moved onto the instance from `setParams`, refilled per call instead of allocated fresh) | Kept | GC was 12% of an `update` call. 32-given fixture, live app, 3/3 unique: 5.7 s → **4.1 s** | fuzz 4×2,000, 0 violations | 32-given stripped fixture | 3d141a4 |
| Silent-digit region prune (a digit with no placed cell, or whose allowed cells split below ten cells per connected component, is refined to its surviving components; those components become the digit's walk for budget) (#142) | Kept, then re-measured and kept for real (#143) | Live app, cold, stripped: `gen_30g` 6.6 s → 5.0 s (ratio **0.76**, past the 0.9× bar); `gen_32g` 3.6 s → 3.7 s (ratio 1.03, flat; a second pair read 3.7 s → 3.7 s); `gen_35g_silent` 48.6 s → 45.6 s (ratio 0.94, wash — first-solve time dropped 36.2 s → 0.4 s but uniqueness search rose 12.4 s → 45.2 s) | ranking rests on `gen_30g`; verified independently by `verify.py` (flow-based, does not depend on the app) | three stripped fixtures, app v2026.08.14-d47fc4b, 2026-08-27 | 9615919 (added), c2d680c (timed and kept, #143) |
| 2×2 crossing rule (two disjoint regions cannot sit on the two diagonals of one 2×2 block — ISS's `ConnectedCrossing`) (#148) | Rejected — sound, fires, but no board got faster | `gen_30g` 5.2 s → 5.2 s (ratio 1.00, wash); `gen_32g` 3.7 s → 3.9 s (ratio 1.05, **regression**); `gen_35g_silent` 46.6 s → 47.4 s (ratio 1.02, **regression**) | walk rules already refute nearly every checkerboard the crossing rule would catch | three stripped fixtures, app version not recorded in the commit body ("recorded app offline"), 2026-08-27 | 3512ec7 (added), 647fb99 (removed — timing record kept) |
| Perimeter non-interleaving rule (no four border cells read `a, b, a, b` in cyclic order; split-arc and flank deductions) (#149) | Kept — first connectivity-survey rule that pays | `gen_35g_silent` 48.8 s → 34.9 s (ratio **0.72**, well past the 0.9× bar, outside the board's own spread — two more interleaved pairs read 0.76 and 0.73); `gen_30g` 5.0 s → 4.8 s (ratio 0.96, wash); `gen_32g` 4.0 s → 4.0 s (ratio 1.00, median of 7 interleaved rounds — 5 of 7 leaned 5–13% slow, read as a wash the rule pays for many times over on the hard board) | over the harness fuzz set, 4,037 of 10,000 states end at a strictly tighter fixpoint with the rule than without; app firing rate 30% of `gen_32g`'s `update` calls and 43% of `gen_35g_silent`'s, against crossing's 0.7% | three stripped fixtures, app v2026.08.14-d47fc4b, 2026-08-27 | 332a960 |
| Blob-count gate on the cut rule (count a digit's placed-cell connected components; skip the second "strands a placed cell" walk when there is exactly one blob) (#150) | Rejected — exact, but short of the bar | `gen_30g` 5.2 s → 5.0 s (ratio 0.96, an effect, but under the board's own run-to-run spread); `gen_32g` 3.7 s → 3.7 s (ratio 1.00, wash); `gen_35g_silent` 46.5 s → 45.6 s (ratio 0.98, wash) | exact (skips a third of the strand walks) but only one of three boards clears the spread, none clears the 0.9× bar | three stripped fixtures, app version not recorded in the commit body ("recorded app offline"), 2026-08-27 | bb62a0f (added), 17b4344 (removed — timing record kept) |

## Planned / not yet tried

Issues #168, #169, and #170 (parent #165) are planned attempts on the `cut`
rule, not yet built or timed:

- **#168 — seed walk.** Replace `reach`/`capacity`/the split walk with one
  0-1 BFS per placed digit (placed cells free, open allowed cells cost one
  step, budget `10 − placed`); the walk's cell set becomes `near` for cut and
  budget directly.
- **#169 — split cut into starve/strand.** Time the two halves of cut's test
  separately (without the cell: does the walk drop below ten cells; does a
  placed cell become unreachable) to learn whether either half alone hurts
  the search, as a similar split did for another solver.
- **#170 — profile cut's share of `update`.** Only if cut is over half of
  `update`'s wall time, build a Tarjan lowpoint DFS answering the strand and
  under-ten tests for every open cell in one pass.

## Win bar (for any future attempt against the current baseline)

Per `docs/real-app-timing.md` and the two-row ship rule (#167): a cold row
from the stripped board and an after-logical row from the app's own logical
solver's end state, each a 3-rep median, candidate at or below 0.9× baseline
on the cold row, and the after-logical row must not turn a 0 ms fixture into
a search (an infinite ratio sinks the change). Soundness harness at 0
violations before the change is considered.
