# #133: skip `update` when candidates are unchanged — measured, not shipped

**Question.** The app runs every component until a pass removes nothing. If
most `update` calls see the candidates the last call left, a per-instance
signature (the 11 candidate bitmasks of both clues and the line) could skip the
DP on repeats.

**Method.** `SkyscraperLineComponent.update` built the signature with
`puzzle.getCandidatesBitMask`, returned early on a match, and stored the
signature only after a call that removed nothing (a state that yielded removals
must prune again if a backtrack brings it back). A probe copy counted calls and
skips and logged them through the driver's `[probe]` console relay
(`docs/real-app-timing.md`). Board: the shipped 9x9, given-only, ring kept.

**Result (2026-08-27, app v2026.08.14-d47fc4b).**

| measure | value |
| --- | --- |
| `update` calls in one "Find all solutions" run | 57,000 |
| calls skipped (signature matched) | 3,996 (7%) |
| `just time skyscraper --ring-clues`, run 1 (medians of 3 reps) | baseline 4.5 s, candidate 6.4 s |
| `just time skyscraper --ring-clues`, run 2 (medians of 3 reps) | baseline 6.1 s, candidate 6.1 s |
| mock probe gen_9 `--search`, 3 runs each | without 11.0/10.9/13.5 s, with 10.6/10.4/9.5 s |
| soundness harness on the candidate | 0 violations at 2,000 and at `FUZZ=20000`; goldens byte-identical |

The baseline itself moved 2.8 s (table row) → 4.5 s → 6.1 s across the day, so
"not slower" is unproven rather than shown; the drop is the safe side of the
bar either way.

**Board caveat.** The shipped 9x9 shows 21 of 36 ring clues (58%), over the
"more than half specified" line in `CODING_STANDARDS.md`. That rule guards
against a wrapper that hands off on the first pass; this component has no
hand-off, and the 57,000 `update` calls show the search ran. Still, the
timing here is weak evidence; the call/skip ratio (a 7% ceiling) is what
carries the verdict. `examples/skyscraper/PUZZLE_LINK_timing.txt` (#140) is
the harder board this note called for: 15 of 36 ring clues shown, most of the
ring blank, ~6,972 mock search nodes. A re-run of this experiment should time
against it (`just time skyscraper --ring-clues --board
PUZZLE_LINK_timing.txt`), not the shipped board.

**Verdict.** The app re-runs a component almost only when one of its cells
changed, as `docs/component-contract.md` states for `getAffectedCells`. The
skip can save at most 7% of calls and pays a signature on the other 93%; the
app timing is a wash inside its run-to-run noise (baseline moved 4.5 → 6.1 s).
The mock, which re-runs every component to a fixpoint each node, gains ~10%,
but the mock is not the engine that ships. Below the 0.9× pass bar: dropped.

**What the numbers say instead.** 57,000 calls in ~6 s is ~0.1 ms per call.
The lever is the cost of every call, not the count of repeated ones — that is
#134 (bitmask DP in one scratch buffer).

**Kept from this ticket.** The driver's `[probe]` console relay, and
`getCandidatesBitMask` on the recovery-lib mock puzzle (the app has it; the
mock did not, so a component using it crashed the probe).
