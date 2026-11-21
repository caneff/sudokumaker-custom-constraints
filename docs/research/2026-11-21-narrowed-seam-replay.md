# Narrowed seam: replay of the last 30 days (#996)

Ticket #996 stops the gate's own tests and the sandbox-exception suites from
running on every narrowed run. This note records what the change selects on the
last 30 days of `origin/main`.

## Method

The 40 first-parent commits of `origin/main` since 2026-10-22 (squashed PRs and
direct pushes), each diffed against its parent. Each diff was run against the
**current** tree's Pants graph (`pants dependents --transitive --closed <files>`),
and the suites were counted under the old rule and the new one, 164 suites in
the seam. A file the commit deleted, a path Pants cannot place and a Pants
failure widen to the whole seam, as in `tests/all.sh`. A file the commit touched
that a later commit renamed or deleted is dropped from the question, since
Pants cannot be asked about it. The script was a throwaway, not committed.

## Result

| | old rule | new rule |
|---|---|---|
| commits selecting every suite (164) | 6 of 40 (15%) | 6 of 40 (15%) |
| mean suites selected | 73.6 | 67.7 |
| smallest selection (docs-only, AGENTS.md-only) | 37 | 26 |

The six are four commits that delete files and two that touch the runner's
files. The ticket's 42 of 115 counts CI runs, which include every push of a
branch and slice PRs into spec branches, and the old CI selection also widened on
the runner's own files, so the two shares are not comparable: this replay counts
merged diffs only. The replay does not reproduce 42 of 115.

The share of commits selecting every suite did not move: those six are
widened by a deletion or a runner-file change, which this ticket keeps. What
moved is the floor for a change to docs or one example, and the mean. The
ticket's 42 of 115 is not reproduced and not compared.

## What the floor is now

A one-example change (a README) selects, besides lint and that example's suites,
the suites that scan or copy the whole tree: `check_layout`,
`check_research_loads`, `global-backends`, `manifest_spec`, `size_builders`,
`sudoku_kit_source` and the closing tests of specs 649 to 954. The spec closing
tests are out of scope of #996. A change to a `.js` or `.py` file also selects
`app-solve-lib.test.mjs` and `bundle-load.test.mjs`, which grep every script.
The gate's five tests, the other four exception suites and the two humanify
tests are selected only by their own inputs.
