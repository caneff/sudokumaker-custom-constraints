# Default digit range of a custom puzzle: 1..9, regardless of size

Issue #461. Two comments disagreed about what digits the app assumes when a
document declares no `minDigit`/`maxDigit`: `examples/_shared/framebuild.py`
(`_document`) said 0..9 regardless of size; `examples/_shared/bundle-solve-lib.mjs`
(`buildStartMessage`) said 1..width. **Both are wrong. The live app defaults
`minDigit` to 1 and `maxDigit` to 9, whatever the board's width.**

## Probe

`probe.mjs` (run from the repo root, recorded app `v2026.08.14-d47fc4b`):
a custom board with only the app's built-in "Rows & Columns" constraint
(copied verbatim from `examples/house-gac/PUZZLE_LINK.txt` into
`rows-cols-constraints.json`), no givens, no digit range. "Find all solutions
and valid candidates" then writes every surviving digit into every cell, and
the solution count is a closed-form function of the range.

```
node docs/research/2026-09-20-default-digit-range/probe.mjs 2 4
```

| board | candidates written in every cell | app's count | 1..width | 1..9 | 0..9 |
| --- | --- | --- | --- | --- | --- |
| 2x2 | `123456789` | **4,104** | 2 | **4,104** | 6,570 |
| 4x4 | subsets of `123456789`, no `0` | 10,000 (counting cap) | 576 | >10,000 | >10,000 |

A 2x2 with rows and columns all-different over n symbols has
n(n-1)·[(n-1) + (n-2)²] solutions: 4,104 at n=9, 6,570 at n=10, 2 at n=2.
The app's exact count matches 1..9 and nothing else. Screenshots:
`rangeless-2x2.png`, `rangeless-4x4.png`.

A board with no constraint at all gives no solver output (no verdict, no
marks); the built-in constraint is what makes the solver run.

## What it changes

- `framebuild.py`'s comment: the default is 1..9, not 0..9. The builder pins
  `maxDigit` to n anyway, so no framebuild link relied on the default.
- `bundle-solve-lib.mjs`: `maxDigit = p.maxDigit ?? p.width` is wrong for any
  non-9 board. Of the shipped links that omit `maxDigit`, the 9x9 ones are
  unaffected (1..9 = 1..width). The 6x6 `docs/research/fillomino-baseline`
  link runs 1..9 in the app and 1..6 in the headless library. The isofill
  10x10 links declare `minDigit: 0` and no `maxDigit`, so the app runs them
  0..9 (ten digits, as isofill wants) while the library computes `maxDigit`
  10 and throws its own single-digit guard.
- No shipped link relied on a 0..9 default: every link with `minDigit` 0
  declares it explicitly.

Links omitting a bound (decoded 2026-09-20, all 74 `PUZZLE_LINK*.txt`):
9x9 with neither bound: 406-gac-demo (2), count-digits-gac (7),
required-digits-gac/sparse (2), examples/fillomino, examples/house-gac (2).
Non-9x9: fillomino-baseline 6x6 (neither), isofill 10x10 (`minDigit` 0, no
max, 9 links), isofill 9x9 (`minDigit` 1, no max).
