# Up to N — optimization log

Every speed-up tried on `UpToNComponent`, kept or rejected, with the numbers
that decided it. Read this before trying a new one.

| Variant | Kept / rejected | Mock-probe numbers | Real-app timing | Board + caveat | Commit |
|---|---|---|---|---|---|
| Running bound: prefix-sum feasibility of N's position, N pruned by line kind | kept (first slice) | soundness: 0 violations; states pruned per 20,000: full house 4/6/9 = 17,297 / 18,836 / 19,719, bare 4/6/9 = 9,078 / 9,951 / 13,592 | — | no timing row yet | #368 |
