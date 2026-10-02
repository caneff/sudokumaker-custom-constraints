# Dutch Flatmates — optimization log

`DutchFlatmatesComponent.js` started validate-only (its `update` removed
nothing), the baseline the pruning deduction was timed against.

| Variant | Kept / rejected | Numbers | Commit |
|---|---|---|---|
| Per-column 1/5/9 pruning in `update`: keep only the 5, 1 and 9 rows some consistent (5, 1, 9) triple supports, skip a column whose 1/5/9 candidates did not change | **Kept** | `just time dutch-flatmates`, 3 runs of 3 reps each: cold 200 ms -> 0 ms (0.00x), after-logical 200 ms -> 0 ms (0.00x); bar is <= 0.9x on one row and <= 1.1x on the other. All three runs read the same, so the gap is outside run-to-run spread. Reps are block-ordered (the driver does not interleave). The app reads in 100 ms steps, so 0 ms means under one step, not zero work. | this PR |
| Partner pointing: when every 5 candidate in a row or box has only 1-support (or only 9-support), confine that 1 (9) to the cells partnering the 5s (#678) | **Not built: not measurable** | Ruling 2026-10-02: time on a harder board against #677's shipped pruning. `generate.py --max-plain 200000` (seed 1) carved 21 givens, `--max-plain 100000000` carved 20 (seed 1) and 18 (seed 4) givens, each unique with a rule-forced flatmate. `just time dutch-flatmates --board <link>` (baseline-only rows, candidate byte-equal) read **0 ms cold and 0 ms after-logical on all three**, so a ratio is 0 vs 0 (NO TIME). Fallback taken: no partner-pointing code written, no improvised timing protocol. The 18-given link stays as the evidence fixture. Ticket to close as not measurable. | this PR |
