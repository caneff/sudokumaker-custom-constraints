# Spec #649 closing check: every rebuilt link, opened in the live app

#739, 2026-10-04. The `just check-full` seam replays the recorded app
(`examples/_shared/sudokumaker.har`); it never sees sudokumaker.app itself.
This note records the one open of the real thing the closing ticket asks for.

## What was opened

Every `PUZZLE_LINK*.txt` that one of spec #649's 25 merge commits touched and
that still exists: 41 links, all under `examples/` (the 7 that sat under
`docs/research/` were moved byte-for-byte into `examples/count-digits-gac/`
by ac5549b). Each was opened with the app session's live adapter,
`withApp({ live: true })` + `solveInApp`, which loads sudokumaker.app and
records nothing, then the full "find all solutions" search. App version on
every row: `v2026.08.14-d47fc4b`.

First pass: non-deterministic solve left as the app sets it, the app's own
time limit, no ring-clue allowance needed by any link. Then the five links
that did not read `[unique]` were rerun with "Non-deterministic solve" off
(the timing driver's setting), with outside-sudoku's own board beside them,
and `hit-counts/PUZZLE_LINK_local.txt` as it stood before the rename
(5768610^).

## Result

36 of 41 solve `[unique]` on the first pass. The other five:

| Link | First pass | Rerun, deterministic | Before this spec |
|---|---|---|---|
| dutch-flatmates/PUZZLE_LINK_0g.txt | timeout (app limit, 65 s) | **unique**, 14.0 s | 11.8 s baseline in its README |
| dutch-flatmates/PUZZLE_LINK_0g_annotated.txt | timeout (77 s) | **unique**, 14.4 s | new in #693 |
| hit-counts/PUZZLE_LINK_local.txt | timeout (62 s) | timeout (65 s) | pre-rename link: timeout (65 s); README row 2026-08-31: DNF, 300 s, 3/3 reps |
| count-digits-gac/required-digits/PUZZLE_LINK.txt | not-unique | not-unique | moved byte-for-byte (R100) |
| count-digits-gac/required-digits/PUZZLE_LINK_original.txt | not-unique | not-unique | moved byte-for-byte (R100) |

- The two dutch-flatmates boards are unique; the non-deterministic search
  swings past the app's time limit, the 10x-20x swing
  `docs/real-app-timing.md` describes.
- `hit-counts/PUZZLE_LINK_local.txt` runs past the app's limit before and
  after the rename alike: the rename changed component names only, and the
  board's DNF is on record from before this spec.
- The two required-digits boards are outside-sudoku's shipped board with one
  constraint swapped, and `outside-sudoku/PUZZLE_LINK.txt` itself reads the
  same not-unique (400 ms) in the same run. That verdict belongs to the
  board, as `docs/research/required-digits-gac/README.md` § Caveat already
  says; this spec did not change either link's bytes.

All 41, first pass (`sum` is the app's own total readout in ms):

| Link | Verdict | sum |
|---|---|---|
| count-digits-gac/demo-counter-outside/PUZZLE_LINK.txt | unique | 200 |
| count-digits-gac/demo/PUZZLE_LINK.txt | unique | 200 |
| count-digits-gac/required-digits/PUZZLE_LINK.txt | not-unique | 400 |
| count-digits-gac/required-digits/PUZZLE_LINK_original.txt | not-unique | 400 |
| count-digits-gac/required-digits/sparse/PUZZLE_LINK.txt | unique | 3100 |
| count-digits-gac/required-digits/sparse/PUZZLE_LINK_original.txt | unique | 3000 |
| count-digits-gac/self-count/PUZZLE_LINK.txt | unique | 600 |
| count-digits-gac/self-count/PUZZLE_LINK_original.txt | unique | 1100 |
| count-digits-gac/sparse/PUZZLE_LINK.txt | unique | 200 |
| count-digits-gac/sparse/PUZZLE_LINK_annotated.txt | unique | 200 |
| count-digits-gac/sparse/PUZZLE_LINK_original.txt | unique | 4300 |
| dutch-flatmates/PUZZLE_LINK.txt | unique | 0 |
| dutch-flatmates/PUZZLE_LINK_0g.txt | timeout | — |
| dutch-flatmates/PUZZLE_LINK_0g_annotated.txt | timeout | — |
| dutch-flatmates/PUZZLE_LINK_18g.txt | unique | 0 |
| fillomino/PUZZLE_LINK.txt | unique | 21100 |
| hit-counts/PUZZLE_LINK.txt | unique | 2500 |
| hit-counts/PUZZLE_LINK_4x4.txt | unique | 0 |
| hit-counts/PUZZLE_LINK_6x6.txt | unique | 0 |
| hit-counts/PUZZLE_LINK_6x6_local.txt | unique | 200 |
| hit-counts/PUZZLE_LINK_local.txt | timeout | — |
| house-gac/PUZZLE_LINK_annotated.txt | unique | 0 |
| house-gac/base/PUZZLE_LINK.txt | unique | 0 |
| isofill/PUZZLE_LINK.txt | unique | 400 |
| isofill/PUZZLE_LINK_24g.txt | unique | 1200 |
| isofill/PUZZLE_LINK_25g.txt | unique | 7700 |
| isofill/PUZZLE_LINK_26g.txt | unique | 47300 |
| isofill/PUZZLE_LINK_28g.txt | unique | 900 |
| isofill/PUZZLE_LINK_30g.txt | unique | 200 |
| isofill/PUZZLE_LINK_32g.txt | unique | 200 |
| isofill/PUZZLE_LINK_35g_silent.txt | unique | 700 |
| isofill/PUZZLE_LINK_44g.txt | unique | 0 |
| isofill/PUZZLE_LINK_9x9.txt | unique | 0 |
| skyscraper/PUZZLE_LINK.txt | unique | 30800 |
| skyscraper/PUZZLE_LINK_10x10.txt | unique | 100 |
| skyscraper/PUZZLE_LINK_4x4.txt | unique | 0 |
| skyscraper/PUZZLE_LINK_6x6.txt | unique | 0 |
| up-to-n/PUZZLE_LINK.txt | unique | 500 |
| up-to-n/PUZZLE_LINK_4x4.txt | unique | 0 |
| up-to-n/PUZZLE_LINK_6x6.txt | unique | 0 |
| up-to-n/PUZZLE_LINK_9x9.txt | unique | 13900 |

## `just time` resolving its timed component

`just time skyscraper --ring-clues` and `just time up-to-n` both resolved the
timed component from `example.toml` (skyscraper's renamed
`SkyscraperPairComponent`, up-to-n's `UpToNComponent`), found the candidate
byte-equal to the committed link, and printed baseline rows: skyscraper 7700
ms cold, up-to-n 800 ms cold. Both drivers time on the recorded app, by design
(`docs/real-app-timing.md` § Offline runs); the live site is reached only
through `withApp({ live: true })`, above.

## Reproduce

Run from the repo root, one link file per argument; it appends one JSON line
per link to the output file and never prints a link. `DET=1` turns
"Non-deterministic solve" off first.

```js
// live-open.mjs
import fs from 'fs'
import { withApp, solveInApp } from './examples/_shared/app-session.mjs'

const [out, ...files] = process.argv.slice(2)
await withApp({ live: true }, async app => {
  for (const f of files) {
    const link = fs.readFileSync(f, 'utf8').trim()
    const page = await app.newPage()
    try {
      const r = await solveInApp(page, link, { deterministic: process.env.DET === '1', timeoutMs: 600000, name: f })
      fs.appendFileSync(out, JSON.stringify({ file: f, verdict: r.verdict, sum: r.sum, version: r.version }) + '\n')
    } finally {
      await app.closePage(page)
    }
  }
})
```
