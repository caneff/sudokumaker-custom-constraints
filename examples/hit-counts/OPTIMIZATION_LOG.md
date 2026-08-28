# Hit Counts — optimization log

Every speed-up tried on the Hit Counts components, kept or rejected, with the
numbers that decided it. Read this before trying a new one — a dead end here
does not need a second attempt.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|
| Régin-style matching clue bound (tighten `[forced, possible]` per line with a bitmask matching over positions and values) | Rejected — sound and strictly tighter, no speed | Search nodes: `gen_6` 261 → 259 (0.8%), `gen_9` 38620 → 38578 (0.1%). Wall-clock, real components: `gen_6` ~4–7% slower, `gen_9` ~13% slower. Per-call cost: matching ~78× the naive scan (O(n·2^n) vs O(n)), 17 us vs 0.2 us at n=9 | not recorded | Recovery-probe measurement (root-fixpoint and `--search` DFS with MRV, Régin all-different floor), shipped `gen_6`/`gen_9` puzzles | 061b780 (added, #17), 305da99 (measured and dropped, #18) |

The matching bound is sound and strictly tighter than the naive
`[forced, possible]` count, but the probe found under 1% of search nodes cut
against a Régin-strength all-different floor, and the matching's own cost (77x
the naive scan) pushed real solve time up rather than down. Reverted; the
naive bound shipped instead. General rule recorded in
`docs/agents/design-reasoning.md` and `CODING_STANDARDS.md`: a deduction earns
its place by end-to-end solve time, not strength or node count.
