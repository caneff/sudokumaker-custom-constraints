# Hit Counts — optimization log

Every speed-up tried on the Hit Counts components, kept or rejected, with the
numbers that decided it. Read this before trying a new one — a dead end here
does not need a second attempt.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|
| Régin-style matching clue bound (tighten `[forced, possible]` per line with a bitmask matching over positions and values) | Rejected — sound and strictly tighter, no speed | Search nodes: `gen_6` 261 → 259 (0.8%), `gen_9` 38620 → 38578 (0.1%). Wall-clock, real components: `gen_6` ~4–7% slower, `gen_9` ~13% slower. Per-call cost: matching ~78× the naive scan (O(n·2^n) vs O(n)), 17 us vs 0.2 us at n=9 | not recorded | Recovery-probe measurement (root-fixpoint and `--search` DFS with MRV, Régin all-different floor), shipped `gen_6`/`gen_9` puzzles | 061b780 (added, #17), 305da99 (measured and dropped, #18) |
| Joint line DP (one component per line pair: hits as a matching between digits and positions, the reachable `(A, B)` counts as a convolution over mirrored position pairs) | Kept | Mock search nodes on the shipped board: `gen_9` 39,549 → 15,922 (60% fewer), `gen_6` 1046 → 856. Root fixpoint: `gen_9` unchanged at 281 candidates removed, so the win is search, not propagation | not recorded — app timing is a separate ticket | Recovery-probe measurement (`--search` DFS with MRV, Régin all-different floor), shipped `gen_6`/`gen_9` puzzles | 83ceb04 (#249) |
| Side hit matching (one component per side: the side's positions assigned to its lines as a flow, Régin filtering, change check narrowed to what the assignment reads) | Kept | Mock search nodes on the shipped board: `gen_9` 15,922 → 14,708 (7.7% fewer), `gen_6` 856 → 840. Root fixpoint: `gen_9` unchanged at 281 candidates removed, one pass fewer | not recorded — app timing is #251 | Recovery-probe measurement (`--search` DFS with MRV, Régin all-different floor), shipped `gen_6`/`gen_9` puzzles | 83ceb04 lineage, #250 |
| Permutation sweep (on a line holding 1..n once each, the joint component's forward/backward sweep runs over permutations instead of cases: the state is the set of digits placed, and a (position, digit) pair survives only when some permutation through it lands both clues on a live candidate) | Kept | Mock search nodes on the shipped board: `gen_9` 14,708 → 2,033 (86% fewer), `gen_6` 840 → 29 (97% fewer). Root fixpoint: `gen_9` unchanged at 281 candidates removed in one pass fewer, `gen_6` 64 → 69. App time: cold 1.05×, after-logical 0.89× medians — two-row rule SHIP, but marginal | 6300ms → 6500ms cold, 6300ms → 5600ms after-logical | Real-app timing, shipped `PUZZLE_LINK.txt`, 3 reps, non-deterministic solve off; **seven** runs, five clearing the 0.9 bar and two reading 0.90/0.91 — the baseline wanders 6100–6900ms while the candidate tracks it | this change (#16) |

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

The permutation sweep is the second attempt at the idea the first row rejected, and
it lands the other way for a reason worth keeping. #12 bought a *bound*: a
tighter range for the clue, at 78× the naive scan's cost, and the app's own
all-different already knew most of it. This sweep buys *cell eliminations* as
well, off the same table, and it replaces the case sweep rather than running
beside it — so the whole per-line cost is one set of tables, not two. It reads
the misses, not only the hits, which is the half the case sweep cannot see: a
case it keeps is a case some real permutation of the line realises.

The two rows of the gate split, and that is the shape to expect from a
deduction that trades per-call cost for search. Cold, the sweep is 1.05× — it
costs more per call and the board still has enough search left that the cut does
not repay it. After the app's own logical solver has run, what remains is
search, and there the sweep is 0.89×. The two-row rule is built for exactly this
case: ≤ 0.9× on one row, ≤ 1.1× on the other.

Record the marginality, because the next agent to touch this will re-time it and
may get a `NO SHIP`. The after-logical ratio sits on the bar: over seven runs it
read 0.86, 0.88, 0.89, 0.89, 0.89, 0.90, 0.91 — five clear, two do not. What
moves is the baseline, not the candidate. The rule for the next reading is the
median of several runs, not one run's verdict, and a single 0.90 is not evidence
the sweep stopped paying. The full seven-run table is in `README.md`,
`## Timing`.

Read the mock's 86%/97% node cuts as strength, not as speed. The gap between
them and the 0.88× is the same gap the side matching's row warns about, running
the other way: the mock counts nodes and the app charges for the work each node
costs.

The matching bound is sound and strictly tighter than the naive
`[forced, possible]` count, but the probe found under 1% of search nodes cut
against a Régin-strength all-different floor, and the matching's own cost (78x
the naive scan) pushed real solve time up rather than down. Reverted; the
naive bound shipped instead. General rule recorded in
`docs/agents/design-reasoning.md` and `CODING_STANDARDS.md`: a deduction earns
its place by end-to-end solve time, not strength or node count.
