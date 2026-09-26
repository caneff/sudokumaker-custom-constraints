# Up to N — optimization log

Every speed-up tried on `UpToNComponent`, kept or rejected, with the numbers
that decided it. Read this before trying a new one.

| Variant | Kept / rejected | Mock-probe numbers | Real-app timing | Board + caveat | Commit |
|---|---|---|---|---|---|
| Running bound: prefix-sum feasibility of N's position, N pruned by line kind | kept (first slice) | soundness: 0 violations; states pruned per 20,000: full house 4/6/9 = 17,297 / 18,836 / 19,719, bare 4/6/9 = 9,078 / 9,951 / 13,592 | — | #368's component was never timed on its own; the first timing row carries #369's | #368 |
| Prefix-cell prune: a cell before every feasible position keeps only digits some feasible position's bounds admit | kept | candidates removed on the strength pools (5,000 states each), floor → this: full house 4/6/9 = 5,924 → 9,560 / 9,121 → 15,373 / 13,572 → 20,857; bare 4/6/9 = 2,064 → 4,851 / 3,014 → 8,090 / 5,640 → 14,921. Soundness: 0 violations | 14,500 ms cold / 10,900 ms after-logical with the prune; without it `just time` refused, all 3 cold reps hitting the 300 s cap, so there is no ratio (README, Timing) | shipped 18-clue 9×9, 3 reps, non-deterministic solve off. The 13-clue 9×9 times out at 300 s even with the prune | #369 |
| Rule corrected to strictly-before-N: bounds start at 0, not N | kept (rule fix, no new deduction) | soundness: 0 violations; strength floor corrected in the same commit, 0 weaker cells | link vs link, stripped, 3 interleaved rounds: 16,200 → 15,800 ms cold (0.98×), 12,000 → 12,000 ms after-logical (1.00×) (README, Timing) | shipped 18-clue 9×9, clues recomputed from the same grid | #613 |
