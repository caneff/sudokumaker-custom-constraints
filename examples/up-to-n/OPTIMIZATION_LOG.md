# Up to N — optimization log

Every speed-up tried on `UpToNComponent`, kept or rejected, with the numbers
that decided it. Read this before trying a new one.

| Variant | Kept / rejected | Mock-probe numbers | Real-app timing | Board + caveat | Commit |
|---|---|---|---|---|---|
| Running bound: prefix-sum feasibility of N's position, N pruned by line kind | kept (first slice) | soundness: 0 violations; states pruned per 20,000: full house 4/6/9 = 17,297 / 18,836 / 19,719, bare 4/6/9 = 9,078 / 9,951 / 13,592 | — | #368's component was never timed on its own; the first timing row carries #369's | #368 |
| Prefix-cell prune: a cell before every feasible position keeps only digits some feasible position's bounds admit | kept | candidates removed on the strength pools (5,000 states each), floor → this: full house 4/6/9 = 5,924 → 9,560 / 9,121 → 15,373 / 13,572 → 20,857; bare 4/6/9 = 2,064 → 4,851 / 3,014 → 8,090 / 5,640 → 14,921. Soundness: 0 violations | — | shipped 18-clue 9×9 baseline 14,500 ms cold / 10,900 ms after-logical (README, Timing); the 13-clue 9×9 times out at 300 s | #369 |
