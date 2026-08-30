# Hit Counts — optimization log

Every speed-up tried on the Hit Counts components, kept or rejected, with the
numbers that decided it. Read this before trying a new one — a dead end here
does not need a second attempt.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|
| Régin-style matching clue bound (tighten `[forced, possible]` per line with a bitmask matching over positions and values) | Rejected — sound and strictly tighter, no speed | Search nodes: `gen_6` 261 → 259 (0.8%), `gen_9` 38620 → 38578 (0.1%). Wall-clock, real components: `gen_6` ~4–7% slower, `gen_9` ~13% slower. Per-call cost: matching ~78× the naive scan (O(n·2^n) vs O(n)), 17 us vs 0.2 us at n=9 | not recorded | Recovery-probe measurement (root-fixpoint and `--search` DFS with MRV, Régin all-different floor), shipped `gen_6`/`gen_9` puzzles | 061b780 (added, #17), 305da99 (measured and dropped, #18) |
| Joint line DP (one component per line pair: hits as a matching between digits and positions, the reachable `(A, B)` counts as a convolution over mirrored position pairs) | Kept | Mock search nodes on the shipped board: `gen_9` 39,549 → 15,922 (60% fewer), `gen_6` 1046 → 856. Root fixpoint: `gen_9` unchanged at 281 candidates removed, so the win is search, not propagation | not recorded — app timing is a separate ticket | Recovery-probe measurement (`--search` DFS with MRV, Régin all-different floor), shipped `gen_6`/`gen_9` puzzles | 83ceb04 (#249) |
| Side hit matching (one component per side: the side's positions assigned to its lines as a flow, Régin filtering, change check narrowed to what the assignment reads) | Kept | Mock search nodes on the shipped board: `gen_9` 15,922 → 14,708 (7.7% fewer), `gen_6` 856 → 840. Root fixpoint: `gen_9` unchanged at 281 candidates removed, one pass fewer | not recorded — app timing is #251 | Recovery-probe measurement (`--search` DFS with MRV, Régin all-different floor), shipped `gen_6`/`gen_9` puzzles | this change |

The side matching is the one entry here whose mock number is the wrong way to
rank it. The probe's Régin all-different floor already supplies most of the
cross-line reasoning the side adds, so the side looks nearly redundant against
it; the app's Solutions finder is singles-only and has no such floor, and the
prototype measured the same wiring going from no verdict at all to 14.8 s there
(#233). Rank it by app time, and read the 7.7 % above as a floor, not a
verdict.

The joint DP replaces the per-line component and the opposite-pair component
with one component per line pair. Its new inference is the mirrored-pair
exclusion: position `j` hits for A with digit `j + 1` and its mirror `n - 1 - j`
hits for B with the same digit, so on a house a mirrored pair can never give one
A hit and one B hit. A cap on `A + B` counts positions and cannot see it.

The matching bound is sound and strictly tighter than the naive
`[forced, possible]` count, but the probe found under 1% of search nodes cut
against a Régin-strength all-different floor, and the matching's own cost (78x
the naive scan) pushed real solve time up rather than down. Reverted; the
naive bound shipped instead. General rule recorded in
`docs/agents/design-reasoning.md` and `CODING_STANDARDS.md`: a deduction earns
its place by end-to-end solve time, not strength or node count.
