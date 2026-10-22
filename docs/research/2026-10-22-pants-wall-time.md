# Has Pants made the gate faster? A 2026-10-22 count

Question (Chris, 2026-10-22): has Pants sped things up in this repo?

## Answer

Not measurably. Pants was brought in to choose a narrowed run's suites
(#809, `825be35`, 2026-10-13), not as a cache: `pants.toml` runs one process
at a time with no result cache, and each Pants call costs about 2 s of
start-up (`2026-10-13-pants-first-unit.md`). The full gate on CI took about
as long after Pants as before it. The saving shows only on a per-change run
that Pants narrows, which is about one in three
(`2026-10-16-pants-narrowing-rate.md`), and is worth one to three minutes on
CI there.

| Successful CI runs on `main` | Dates | Wall time |
|---|---|---|
| Full gate on every push, before Pants | 2026-10-03 to 2026-10-10 | mostly 5 to 6 min (range 4 to 7, 45 runs) |
| Full gate, nightly schedule, after Pants and #846 | 2026-10-17 to 2026-10-22 | 4 to 7 min (6, 6, 4, 5, 7, 4) |
| Narrowed seam on push, after #846 | 2026-10-19 to 2026-10-22 | 3, 3, 3, 4, 4, 6, 10 min |

## How it was counted

`gh run list --repo caneff/sudokumaker-custom-constraints --limit 200`,
successful runs on `main`, wall time `updatedAt - startedAt` rounded down to
the minute. 2026-10-11 to 2026-10-16 were left out of the before/after
comparison: 2026-10-11 ran 5 to 12 min while the gate itself was changing,
and push runs from 2026-10-16 mix the full and narrowed gates around #846.

Not controlled for: the suite count grew over the period, CI runs four suites
at once (`GATE_JOBS: 4`), and GitHub runner speed varies between runs. No
local seam was timed. A real before/after needs the same commit's full seam
timed with and without Pants selection on one box.

## Where the time goes, and the next levers

The `check` job is CI's critical path (275 s of the nightly 2026-10-22 run;
the heavy and soundness jobs take 70 to 96 s beside it). Inside it, the one
Pants call for the wired suites prints nothing for 168 s, then every result
at once: `process_execution_local_parallelism = 1` runs them one at a time on
a 4-vCPU runner. Locally, the merge-time `just check-full` is the largest
cost per PR (about 3½ min on one core, #809).

Levers, cheapest first, checked against the #809 rulings (caching off for
now, CI full and uncached, one core by default on this box):

1. CI only: let that Pants call use the runner's 4 cores
   (`PANTS_PROCESS_EXECUTION_LOCAL_PARALLELISM` in `ci.yml`). It keeps CI full
   and uncached and leaves the box default at one core. Expected, not
   measured: the 168 s block toward a quarter of that.
2. Drop the merge-time full seam once #809's bar is met: 50 merges with zero
   selector misses, plus the planted break. At 2026-10-22, 29 merged PRs since
   `825be35` carry a selector verdict (24 `clean`, 5 in the newer `listed`
   form, no `miss`) and 3 carry none.
3. Narrow better: 8 of 33 narrowed runs changed `examples/_shared` and so
   selected every suite (`2026-10-16-pants-narrowing-rate.md`).
4. Result caching: the largest saving, ruled a later step; its stated
   preconditions are pinned toolchains and a per-suite determinism check.
