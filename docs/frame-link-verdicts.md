# Frame-link app verdicts

Every link that runs the shared frame backends, re-checked in the **live app**
after the round of regeneration that #394 and its fix round forced. This is the
record AC1 asks for — "every regenerated link solves *unique* in the app via
`app-solve.mjs`" — kept here rather than in a scratch file, because a verdict
nobody can find is not evidence.

Run: `node examples/_shared/app-solve.mjs <link> 1 --ring-clues` per link, app
v2026.08.14-d47fc4b, non-deterministic solve off, 1 rep. The time is the
median of `first solve + uniqueness search`; read it as an order of magnitude,
not a measurement — timing rows live in each example's README.

**2026-09-09 — 32 links: 23 unique, 4 not-unique, 5 timeout.** All nine
non-`unique` outcomes are pre-existing and none of them moved: see "The nine"
below.

The four hand-built numbered-rooms links were re-run on the same day after a
second regeneration — round 2 pins `minDigit`/`maxDigit` on them, which the app
otherwise defaults to 0..9 (#394). Every verdict held: `PUZZLE_LINK.txt`
unique 1700 ms, `PUZZLE_LINK_clued.txt` and `PUZZLE_LINK_clued_original.txt`
unique 0 ms, `PUZZLE_LINK_original.txt` timeout. The table carries the first
run's times; both readings are the same order of magnitude, which is all a
time here claims.

| Link | Verdict | Time |
| --- | --- | --- |
| `examples/hit-counts/PUZZLE_LINK.txt` | unique | 7400 ms |
| `examples/hit-counts/PUZZLE_LINK_4x4.txt` | unique | 0 ms |
| `examples/hit-counts/PUZZLE_LINK_6x6.txt` | unique | 100 ms |
| `examples/hit-counts/PUZZLE_LINK_6x6_local.txt` | unique | 300 ms |
| `examples/hit-counts/PUZZLE_LINK_local.txt` | timeout | — |
| `examples/numbered-rooms/PUZZLE_LINK.txt` | unique | 1800 ms |
| `examples/numbered-rooms/PUZZLE_LINK_4x4.txt` | unique | 0 ms |
| `examples/numbered-rooms/PUZZLE_LINK_6x6.txt` | unique | 0 ms |
| `examples/numbered-rooms/PUZZLE_LINK_6x6_local.txt` | unique | 100 ms |
| `examples/numbered-rooms/PUZZLE_LINK_9x9.txt` | unique | 300 ms |
| `examples/numbered-rooms/PUZZLE_LINK_clued.txt` | unique | 0 ms |
| `examples/numbered-rooms/PUZZLE_LINK_clued_original.txt` | unique | 0 ms |
| `examples/numbered-rooms/PUZZLE_LINK_local.txt` | timeout | — |
| `examples/numbered-rooms/PUZZLE_LINK_original.txt` | timeout | — |
| `examples/outside-sudoku/PUZZLE_LINK.txt` | not-unique | 500 ms |
| `examples/outside-sudoku/PUZZLE_LINK_4x4.txt` | not-unique | 200 ms |
| `examples/outside-sudoku/PUZZLE_LINK_6x6.txt` | not-unique | 300 ms |
| `examples/outside-sudoku/PUZZLE_LINK_local.txt` | not-unique | 900 ms |
| `examples/running-start/PUZZLE_LINK.txt` | unique | 1400 ms |
| `examples/running-start/PUZZLE_LINK_4x4.txt` | unique | 0 ms |
| `examples/running-start/PUZZLE_LINK_6x6.txt` | unique | 0 ms |
| `examples/running-start/PUZZLE_LINK_local.txt` | unique | 21100 ms |
| `examples/skyscraper/PUZZLE_LINK.txt` | unique | 7100 ms |
| `examples/skyscraper/PUZZLE_LINK_10x10.txt` | unique | 100 ms |
| `examples/skyscraper/PUZZLE_LINK_10x10_original.txt` | timeout | — |
| `examples/skyscraper/PUZZLE_LINK_4x4.txt` | unique | 0 ms |
| `examples/skyscraper/PUZZLE_LINK_4x4_original.txt` | unique | 0 ms |
| `examples/skyscraper/PUZZLE_LINK_6x6.txt` | unique | 0 ms |
| `examples/skyscraper/PUZZLE_LINK_6x6_local.txt` | unique | 0 ms |
| `examples/skyscraper/PUZZLE_LINK_6x6_original.txt` | unique | 100 ms |
| `examples/skyscraper/PUZZLE_LINK_local.txt` | unique | 4700 ms |
| `examples/skyscraper/PUZZLE_LINK_original.txt` | timeout | — |

## The nine

**Four not-unique — outside-sudoku, all of its boards.** CP-SAT proves each of
them unique (`verify.py`, and the carve loop that made them), and the app
disagrees. That disagreement is **older than #394**: the committed links as of
`311934a`, the commit before the frame change, were re-run in the app for this
record and every one came back not-unique —
`PUZZLE_LINK_4x4.txt` 200 ms, `PUZZLE_LINK_6x6.txt` 300 ms,
`PUZZLE_LINK.txt` 500 ms, `PUZZLE_LINK_local.txt` 900 ms. So neither the frame
change nor its fix round caused it, and nothing here explains it either; it
wants its own ticket.

**Five timeouts — the slow baselines, by design.** The app stops at its own
300 s limit and `app-solve.mjs` reports `[timeout]`:

- `numbered-rooms/PUZZLE_LINK_original.txt`,
  `skyscraper/PUZZLE_LINK_original.txt`,
  `skyscraper/PUZZLE_LINK_10x10_original.txt` — the original-wrapper twins.
  Being unable to finish is the point of them: they are the baseline in the
  capability comparison each example's README draws.
- `hit-counts/PUZZLE_LINK_local.txt` — a recorded DNF, "a deliberate property
  of the board" (`examples/hit-counts/README.md`).
- `numbered-rooms/PUZZLE_LINK_local.txt` — the same, recorded at
  `examples/numbered-rooms/README.md`.

## Re-running it

The sweep is a loop over `app-solve.mjs`, one link at a time; it drives the
live app (through the recorded HAR) and takes about ten minutes. Re-run it
whenever the shared frame backends change and every link is regenerated, and
replace the table above with what it prints.
