# How often a narrowed run actually skips suites: a 2026-10-16 count

Question (Chris, 2026-10-16): since Pants started choosing a narrowed run's
suites (#809, landed 2026-10-13 as `825be35`), has it cut how often the whole
seam runs?

## Answer

Partly. About one narrowed run in three skipped any suites; the other two in
three ran every suite. The merge-time seam (`just check-full`, re-run before
every merge under ruling 6a, `AGENTS.md` § End-to-end seam) is never narrowed,
so Pants can save at most the worker's one `--changed` run per PR, never the
merge run.

| Outcome of `bash tests/all.sh --changed` | Runs |
|---|---|
| Narrowed and ran fewer suites | 12 |
| Narrowed, but the dependents were every suite | 8 |
| Widened to the whole seam | 13 |
| **Total** | **33** |

The 8 "narrowed but all" runs changed `examples/_shared`, which every suite
depends on, so they cost a full run.

What caused the 13 widenings:

| Cause | Runs |
|---|---|
| `every suite depends on tests/all.sh` | 3 |
| `every suite depends on .github/workflows/ci.yml` | 3 |
| `no rule places docs/research/humanify-pedagogy/bundle.min.js` | 2 |
| `no rule places BUILD` | 2 |
| `no rule places tests/pants_prelude.py` | 1 |
| `no rule places docs/agents/review-generated-paths.txt` | 1 |
| `widened to the whole seam` (no reason in the line) | 1 |

The `tests/all.sh` and `ci.yml` widenings are correct: a change to the runner
or to CI really does touch every suite. The `no rule places` lines are the
runner's wording from before #819 removed the directory rules, so some of
those runs may predate full Pants selection. A docs-only path widening the run
(`bundle.min.js`, `review-generated-paths.txt`) is the one avoidable class here.

## How it was counted

The runner's last line, `N of M suites passed (narrowed: ...)` or
`(widened: ...)`, was taken from every Claude Code transcript under
`~/.claude/projects/*custom-constraints*` modified since 2026-10-13 (84
files), with repeats inside one transcript counted once. Lines with `M` under
100 were dropped as test-fixture output: the runner's own tests print runs of
18 or 19 suites.

Not covered: a run whose output never reached a transcript (CI, a hand run in
a shell), and wall time saved, which was not measured. A transcript that
quotes another session's run counts it again, so the totals are
approximate.
