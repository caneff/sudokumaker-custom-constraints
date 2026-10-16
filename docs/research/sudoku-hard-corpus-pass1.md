# Pass 1: ranking two public hard-sudoku lists by SM search time (#430, spec #427)

**Result: no grid clears 5 s cold.** The slowest of 50,710 grids takes 2.65 s in
the Node harness, which is about 0.12-0.17 s in the browser. A classic 9x9 from
these lists does not make SudokuMaker's solver search long enough to time
GAC on; the cutoff would be 78-113 s of Node time.

## What was scored

| source | file | grids | origin |
| --- | --- | --- | --- |
| Royle's 17-clue collection | `sudoku-hard-corpus-pass1/royle17.txt` | 49,151 | `http://staffhome.ecm.uwa.edu.au/~00013890/sudoku17`, read from the Wayback Machine copy `https://web.archive.org/web/2020/http://staffhome.ecm.uwa.edu.au/~00013890/sudoku17` (the live host did not answer) |
| enjoysudoku "hardest" list, top1465 | `sudoku-hard-corpus-pass1/top1465.txt` | 1,465 | `http://magictour.free.fr/top1465`; one trailing blank line dropped |
| enjoysudoku "hardest" list, top95 | `sudoku-hard-corpus-pass1/top95.txt` | 95 | `http://magictour.free.fr/top95`; a trailing DOS end-of-file byte (`^Z`) dropped |

The enjoysudoku lists come from a mirror (magictour.free.fr), not from
forum.enjoysudoku.com; I did not check them against the forum thread. Both
are 81-character grid strings, `.` for blank. Royle's uses `0`.

`sha256` of the committed files:

```
71755fa5646701ae543b1435012492ec5b99f3d42b08da847e6d48d8b87676d7  royle17.txt
21d82f285082dc0db051f407cf23103af76bf077b368b04bd9e619f2bf6d2c1b  top1465.txt
b16eff35fbe41fb7b122f21c5c6ba30b85861b47946d33257070df1a69cddd36  top95.txt
```

`known-misses.txt` holds the 11 grids of `406-gac-demo/tools/hard.py`, which
were already measured at 0-200 ms in the browser. One of them (AntiDFS, a
17-clue grid) is in `royle17.txt` and was skipped, so 50,710 grids were scored.

## How

- `examples/_shared/grid_to_link.py`: 81 characters in, a puzzle link out. The
  board is the 406 hard-classics shape (custom 9x9, boxes as a region
  constraint, rows and columns from the shared whole-grid backend), with the
  ringless rules text. Its test decodes the link and compares the 81 givens.
  The 406 builder used its own `rowcol9-main.js` for rows and columns; this
  one uses the shared `grid-rowcol.js`, so the calibration below was redone.
- `examples/_shared/hard-sweep.mjs`: per grid, a fresh bundle load and one
  solve through `bundle-solve-lib.mjs`'s `solveDocument` (the #429 harness),
  find-all, so every row also checks uniqueness. The document is a template
  with the grid's cells swapped in; its test holds that equal to
  `grid_to_link.py`'s document.
- Run: 8 shards under `job-run` (`smcc-430-sweep`), each with `ulimit -v 2 GB`,
  box load average 2.6 at launch. Wall clock under 4 minutes.
- Failure signatures: all 8 shards exited 0, no solver error (no `.err` file),
  no stale `.cur` file, and 50,710 rows = 49,150 + 1,465 + 95. Every row
  has exactly one solution.

The full table is `sudoku-hard-corpus-pass1/sweep-table.tsv`: `source`, `line`
(1-based line of the committed corpus file), `solutions`, `ms`, slowest first.

## Distribution

| source | grids | grids >= 500 ms | mean |
| --- | --- | --- | --- |
| royle17 | 49,150 | 31 | 17 ms |
| top1465 | 1,465 | 85 | 194 ms |
| top95 | 95 | 2 | 145 ms |

Across all 50,710 grids the median is 5.6 ms and the 99th percentile 271 ms. The enjoysudoku lists are about ten times slower on average than Royle's, and
still two orders of magnitude short.

## Top five

Cold = the sweep row (fresh bundle load, one solve). Fresh-process = a
separate `bundle-solve.mjs <link> 5` run, median of 5 reps in one process.

| rank | grid | cold ms | fresh-process ms |
| --- | --- | --- | --- |
| 1 | `royle17.txt` line 45949 | 2646.6 | 1752 |
| 2 | `royle17.txt` line 4237 | 2175.1 | 1529 |
| 3 | `top1465.txt` line 61 | 1941.5 | 1454 |
| 4 | `royle17.txt` line 7975 | 1431.8 | 1008 |
| 5 | `top1465.txt` line 811 | 1363.9 | 992 |

Every one is a unique grid in the sweep. Read the grids off the line numbers.

## Does any clear 5 s cold?

No. The calibration factor is Node time over browser time. Redone with this
builder on the two boards `429-headless-solver-calibration.md` used (5 reps,
`bundle-solve.mjs`):

| board | Node median | browser cold on record | factor |
| --- | --- | --- | --- |
| Platinum Blonde | 2270 ms | 100 ms | 22.7x |
| Fata Morgana | 3404 ms | 200 ms | 17.0x |

(#429 measured 22.1x and 15.5x with the other builder.) The browser rows have
100 ms resolution, so the factor is good to about +/-25%. The slowest cold
row, 2646.6 ms, divided by 15.5-22.7, is 117-171 ms in the browser. To clear
5 s, a grid needs 77-113 s in Node.

**Caveat on the calibration.** Both calibration boards are fast 21-clue
grids. The one board on record whose browser time is long (the Skyscrapers
frame board) runs *faster* in Node (0.13x, #429). If a grid's search cost
scales like the frame board's, not like these two, the factor may not hold at
the top of the range. That is a reason to time the top five in the browser
(`just time-link`) before ruling a classic out completely; it does not
change the ranking.

## Reproduce

```
uv run examples/_shared/grid_to_link.py "$(printf '.%.0s' $(seq 81))" blank.txt
node examples/_shared/hard-sweep.mjs run --template blank.txt --out out --shard 0/8 \
  --skip docs/research/sudoku-hard-corpus-pass1/known-misses.txt \
  royle17=docs/research/sudoku-hard-corpus-pass1/royle17.txt \
  top1465=docs/research/sudoku-hard-corpus-pass1/top1465.txt \
  top95=docs/research/sudoku-hard-corpus-pass1/top95.txt   # shards 0/8 .. 7/8
node examples/_shared/hard-sweep.mjs merge --out out --table table.tsv
```

## Browser rows for the top five, and the miss record (#432)

The top five, built with `grid_to_link.py` and timed in the recorded app
(`just time-link`, 3 reps, non-deterministic solve off, app
v2026.10.05-a3aef4c, 2026-10-16). The driver refused none of them. Rows have
100 ms resolution.

| rank | grid | cold | after-logical |
| --- | --- | --- | --- |
| 1 | `royle17.txt` line 45949 | 0 ms | 0 ms |
| 2 | `royle17.txt` line 4237 | 100 ms | 0 ms |
| 3 | `top1465.txt` line 61 | 100 ms | 0 ms |
| 4 | `royle17.txt` line 7975 | 0 ms | 0 ms |
| 5 | `top1465.txt` line 811 | 0 ms | 0 ms |

**Miss.** Nothing reaches 5 s, so `examples/house-gac/PUZZLE_LINK.txt` stays
the 25-given demo. The slowest grid is rank 1 (`royle17.txt` line 45949):
2646.6 ms cold in Node, 0 ms cold and 0 ms after-logical in the browser. The
corpus was 50,710 scored grids (49,150 Royle 17-clue, 1,465 top1465, 95 top95).
Pass 2 (#431) was closed unpursued: 40 distinct 21-clue grids, none at 20, no
sweep. The Node-to-browser calibration (17-23x) held at the top of the range:
the top five read 0-100 ms. #427 is relabelled `backlog`.
