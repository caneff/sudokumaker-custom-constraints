# Running Start — optimization log

Every speed-up tried on the Running Start components, kept or rejected, with
the numbers that decided it. Read this before trying a new one — a dead end
here does not need a second attempt.

| Variant | Kept / rejected | Hard-board numbers (first / unique / sum) | Clued-board result | Board + timer caveat | Commit |
|---|---|---|---|---|---|
| Ties fix, strict break given up everywhere | rejected | cold 1900 → 6400ms (3.37×), after-logical 400 → 600ms (1.50×) | — | `just time running-start`, 3 reps, baseline = the link at `0baac1c` | not landed |
| Ties fix, strict break kept behind the house test | kept | cold 1800 → 1800ms (1.00×), after-logical 500 → 500ms (1.00×) | — | same run | #239 |

The tie reading (`ALLOW_TIES = false`) ends a run on an equal neighbour, so the
break is only `line[k] <= line[k-1]`. Enforcing that literally on every line is
sound but costs 3.37× on the shipped frame board: `<=` prunes far less than `<`
through `below`, and the app's all-different does not hand the strength back to
the component. On a house two cells never hold the same digit, so `<=` implies
`<` there and the component may still demand the strict drop. Asking
`getCellsCanHaveRepeats` in `update` recovers the whole loss and leaves a drawn
line with the weaker, sound rule it needs. The same test tightens the climb, so
the loose reading gets the floor/ceil window back on a frame line too.

Earlier deduction work (feasible-clue pruning, the cross-line `A+B<=n+1` pair,
the kmin index window and unimodal-pair peak) carries no end-to-end
measurement — the soundness fuzz verified it, but there is no row to rebuild.
