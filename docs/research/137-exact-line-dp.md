# #137: exact line DP with digit distinctness — measured and shipped

**Question.** The shipped prefix/suffix DP (#134) held state `(position,
visible count) -> bitmask of running maxima` and ignored that the digits inside
a prefix or suffix are all different. Does tracking the used-digit set cut
search nodes enough to pay for the bigger state space?

**Method.** `prune` now keys each DP layer by the *subset* of sub-peak digits
used, not by position. A subset already fixes the prefix length (its popcount)
and the running max (its highest digit), so the whole state is
`(subset, visible count)` and one `Uint16Array` of count-bitmasks indexed by
subset is the entire DP — 256 entries for `n = 9`. The peak join became exact
too: the prefix and the suffix partition the sub-peak digits, so a left subset
pairs with its complement on the right instead of the two sides matching on
visible counts alone.

Node counts from `recovery-probe.mjs --search --only=ours`; wall time is the
whole probe run (`/usr/bin/time`), one run each, same machine and session.

| Fixture | shipped nodes | exact nodes | shipped wall | exact wall |
| --- | --- | --- | --- | --- |
| `gen_4.json` | 0 | 0 | 0.02 s | 0.03 s |
| `gen_6.json` | 8 | 4 | 0.03 s | 0.04 s |
| `gen_9.json` | 762 | **0** | 0.98 s (2.21 s on the re-run) | 0.06 s |
| `gen_9_timing.json` | 6972 | **16** | 13.00 s (13.18 s on the re-run) | 0.14 s |

`gen_9` now needs no search at all: propagation alone closes it.

**Per-call price.** The exact DP is about 1.8x more work per call —
`FUZZ=20000 node soundness-harness.mjs` reads 0.23 s shipped against 0.41 s
exact, same 19,951 prune firings, 0 violations either way. The node collapse
buys that back many times over.

**Board size.** A layer is one entry per subset, so the per-call work doubles
with the board size. Over 2,000 `update` calls on the soundness fuzz's random
states: n=9 reads 12.0 us/call exact against 4.7 us/call shipped, n=16 reads
352.6 us/call against 8.9 us/call — 40x. The exact DP also removes far more
there (23,439 yields against 12,866), so it may well still pay, but no board
above 9 has ever been timed end-to-end. `MAXN` is therefore 9: a longer line
gets no deduction rather than an unmeasured one.

**Real app** (`--ring-clues`, non-deterministic solve off, median of 3,
v2026.08.14-d47fc4b, 2026-08-27). Timing board `PUZZLE_LINK_timing.txt`
(dropped in #178, along with the `build_timing.py` generator that made it):
baseline **3600 ms** -> candidate **0 ms**. Shipped board `PUZZLE_LINK.txt`:
baseline **300 ms** -> candidate **0 ms**. Per-rep, both boards read
`first 0ms unique 0ms sum 0ms [unique]` 3/3 — the app's readout floor, i.e.
its own solver reaches a unique verdict without measurable search.

**Verdict: shipped.** Well past the 0.9x bar on both boards, and the mock
agrees. Recovery goldens moved in our favour (`gen_6` removed 145 candidates,
was 79 + 66; `gen_9` 762 nodes -> 0) and were regenerated.

**Exactness has a witness.** `soundness-harness.mjs` gained a brute-force
oracle at n=5: over all 120 permutations it computes exactly which values some
line consistent with the starting candidates and both clues uses, and asserts
the component's fixpoint leaves that set and no more. It has teeth — the
position-keyed DP disagrees with the oracle on 1,303 of 2,000 states.

**Soundness.** The true line is a permutation, so its prefix and suffix use
complementary digit subsets and every step it takes is a transition the DP
takes; nothing true is ever dropped. Confirmed empirically: the harness reports
0 violations at the default 2,000 states and at `FUZZ=20000`, and the
interleaved-yield check stays at 0 differences over 500 pairs.
