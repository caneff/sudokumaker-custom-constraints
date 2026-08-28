# Running Start — optimization log

Every speed-up tried on the Running Start components, kept or rejected, with
the numbers that decided it. Read this before trying a new one — a dead end
here does not need a second attempt.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|

No entry yet. `git log -- examples/running-start` shows deduction work
(feasible-clue pruning, the cross-line `A+B<=n+1` pair, the kmin index window
and unimodal-pair peak) verified by soundness fuzz, but none of it carries an
end-to-end solve-time measurement or a kept/rejected speed verdict — nothing
to rebuild a row from.
