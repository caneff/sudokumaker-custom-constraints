# Dutch Flatmates — optimization log

`DutchFlatmatesComponent.js` started validate-only (its `update` removed
nothing), the baseline the pruning deduction was timed against.

| Variant | Kept / rejected | Numbers | Commit |
|---|---|---|---|
| Per-column 1/5/9 pruning in `update`: keep only the 5, 1 and 9 rows some consistent (5, 1, 9) triple supports, skip a column whose 1/5/9 candidates did not change | **Kept** | `just time dutch-flatmates`, 3 runs of 3 reps each: cold 200 ms -> 0 ms (0.00x), after-logical 200 ms -> 0 ms (0.00x); bar is <= 0.9x on one row and <= 1.1x on the other. All three runs read the same, so the gap is outside run-to-run spread. Reps are block-ordered (the driver does not interleave). The app reads in 100 ms steps, so 0 ms means under one step, not zero work. | this PR |
