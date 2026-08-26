# Numbered Rooms — optimization log

Every speed-up tried on `NumberedRoomsComponent.js`, kept or rejected, with the
numbers that decided it. Read this before trying a new one — a dead end here
does not need a second attempt. Background: `docs/real-app-timing.md` (the
method), issue #21 (soundness groundwork), issue #64 (this log's parent).

Boards and the timer changed twice while these were tried (24 arrows → 13
arrows → 8 arrows; one "took" reading → first/unique/sum). Each row's caveat
says which board and timer produced its numbers — earlier rows are not
directly comparable to later ones.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|
| 24-arrow board baseline | Kept (reference) | not split; sum only — ours ~2.7 s, original wrapper ~15.5 s (~6×) | none shipped yet | 24-arrow board, 3 reps median, two-phase timer (just fixed) | 9eeff70 (retime), board from 5b6a3b5 |
| 13-arrow board baseline | Kept (reference) | not split; sum only — ours ~1.4 s, original wrapper ~95 s (~70×, one original rep of three never returned within 300 s) | none shipped yet | 13-arrow board, 3 reps median, two-phase timer | 70b3b30 |
| Pair component (`NumberedRoomsPairComponent`) | Rejected | first phase only — 2.3 s → 6.7 s (tripled) | none shipped yet | 24-arrow shipped board, single measurement, **before** the two-phase timer fix (the "6.7 s" is first-solve time only, not a sum) | added 1116515, removed 5b6a3b5 |
| Early exit on a filled line | Rejected — no gain | no gain over the ~1.3 s baseline (no separate number recorded) | none shipped yet | "a harder blank-clue board" per commit message, close to the 13-arrow board's ~1.4 s; informal note, not a committed fixture | 9eeff70 |
| Hand-off to built-in `IndexComponent` once the clue is solved | Rejected — no gain | no gain over the ~1.3 s baseline (no separate number recorded) | none shipped yet | same board/timer as the row above | 9eeff70 |
| Distinct-line "index k, clue k" prune | Rejected | ~5× slower than the ~1.3 s baseline (~6.5 s) | none shipped yet | same board/timer as the two rows above | 9eeff70 |
| **Current baseline** (`NumberedRoomsComponent`, today) | Kept (reference for #64) | median of 5 reps — first 10100 ms, unique 9000 ms, sum 19000 ms; spread across reps: first 9800–10700 ms, unique 8800–9800 ms, sum 18800–20500 ms | solves instantly — took 100 ms total (first 100 ms, unique 0 ms), verdict unique. Correctness check only, not a timing bar. | 8-arrow `PUZZLE_LINK.txt` / `PUZZLE_LINK_clued.txt`, app v2026.08.14-d47fc4b, non-deterministic solve off, 2026-08-26 | 931c985 (board), this log's commit |
| Single-pass `feasibleIndices` (cheaper, same deductions) | Rejected — no gain | median of 5 reps — first 10100 ms, unique 8900 ms, sum 19200 ms; reps 18700–19600 ms, inside the baseline's 18800–20500 ms spread | verdict unique | 8-arrow board, same app version and day as the baseline row | not committed (#78) |
| **Clue≠index rule in the loop + bitmask single pass + empty-K contradiction** (#87) — **new baseline** | Kept | median of 5 reps — first 1600 ms, unique 1500 ms, sum 3100 ms; reps 3000–3100 ms. `just time` 3-rep row: baseline 19400 ms, candidate 3000 ms, ratio 0.15 | verdict unique, 100 ms | 8-arrow board, app v2026.08.14-d47fc4b, non-deterministic solve off, 2026-08-26 | this row's commit |

The #87 row answers the "distinct-line" rejection above: the rule was never
the cost, the extra pass was. Folded into the one feasibility loop as a match
predicate (`k = 1` → target must be `k`; `k > 1` → target must not be `k`) on
`puzzle.getCandidatesBitMask` it is ~6× faster than the code without it.
`update-strength.test.mjs` is the old-vs-new never-weaker fuzz the trap
section asks for, pinned to the pre-#87 commit.

## The k=1 ordering trap

The single-pass attempt above first looked correct and was not. `update` prunes
the indexer `line[0]` and **yields** that removal before it computes the clue's
reachable set. When the feasible index is `k = 1`, the target *is* `line[0]`, so
the clue prune reads the already-narrowed indexer. Computing everything in one
pass reads `line[0]` before its own prune lands, which leaves the clue wider —
sound, but weaker, and invisible to the soundness harness, which only checks
that no true value is removed. A 60000-state fuzz comparing the old and new
`update` output candidate-for-candidate caught it; 2480 states differed. Any
future rewrite of `update` should run that same old-vs-new comparison, not just
the soundness harness.

## Win bar (for any future attempt against the current baseline)

A candidate beats the baseline only if **both** hold, each on a 5-run median:

1. **Hard board faster.** Its sum median is below 3000 ms — outside the
   #87 baseline's own run-to-run spread (3000–3100 ms). A result inside that
   range is noise, not a win.
2. **Clued board still unique.** `PUZZLE_LINK_clued.txt` still reports verdict
   `unique`. It solves near-instantly either way, so its time is not part of
   the bar — only the verdict is.

Miss either test and the variant is rejected: drop the code, add a row to
this table with its numbers and commit, and stop — do not retry a variant
already rejected above.
