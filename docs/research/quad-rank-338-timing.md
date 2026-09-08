# Quad rank: which deductions ship, timed on boards that have rows and columns

Resolves [#338](https://github.com/caneff/sudokumaker-custom-constraints/issues/338).
Branch `proto/quad-rank-338`. App build `v2026.08.14-d47fc4b`, replayed from the
checked-in HAR; non-deterministic solve off; medians over 3 reps.

**Verdict: ship both deductions.** The leading-digit bound and the counting
identity are each weak alone and strong together — 53x on the hardest board that
finishes at all, where either one alone times out or crawls.

**And a correction.** This document first concluded that zero-given quad-rank
boards were out of reach. A real 15-clue zero-given puzzle, unique and solved by
CP-SAT in 9 seconds, times out in the app under every component here. The gap is
our component's, not the puzzle's — see the last section.

## The three components

| id | file | deductions in `update` |
|---|---|---|
| C1 | `proto/QuadRankComponent.js` | leading-digit bound only (#324) — the shipped one |
| C2 | `proto/QuadRankComponent2.js` | leading-digit bound + counting identity (#335) |
| C3 | `proto/QuadRankComponent3.js` | counting identity only — built for this ticket |

C3 exists to answer "does the counting identity dominate the bound?". It does not.

## The fixture set

Every #324/#328 board was box-only (#335), so this ticket rebuilt its own from
`proto/lad_g*.json` — one 9x9 grid, 13 clues, a ladder of given counts — plus
`p325_g16` (6 clues / 16 givens) and the 6x6 of #324. Links are
`proto/LINK_rc338_c<n>_<board>.txt`, built by the corrected `build_board.py`
(audited: `constraint types: [1, 301, 301, 0, 1000]` — boxes, rows, columns).

CP-SAT proves every rung unique, all in under 2s:

| rung | g44 | g36 | g28 | g20 | g12 | g8 | g4 | p325_g16 |
|---|---|---|---|---|---|---|---|---|
| verdict | unique | unique | unique | unique | unique | unique | unique | unique |
| CP-SAT | 0.0s | 0.0s | 0.0s | 0.0s | 0.1s | 0.5s | 1.6s | 0.3s |

**Only a narrow band of the ladder constrains anything.** A 1-rep recon with C1:

| givens (13 clues) | 44 | 36 | 28 | 20 | 12 | 8 | 4 |
|---|---|---|---|---|---|---|---|
| app, cold | 0ms | 0ms | 0ms | 0ms | 1.9s | 73.6s | timeout 300s |

At 20 givens and up the app's own logic pass finishes the board and nothing is
timed. At 4 givens nothing finishes. The band that decides is **g12, g8** plus
`p325g16`.

## The timing matrix

Medians over 3 reps, `sum` (first solve + uniqueness search).

| board | mode | C1 | C2 | C3 | C2/C1 | C3/C1 |
|---|---|---|---|---|---|---|
| 6x6 (#324) | cold | 0ms | 0ms | 0ms | — | — |
| 6x6 (#324) | after-logical | 0ms | 0ms | 0ms | — | — |
| lad_g12 | cold | 1900ms | **100ms** | 1500ms | 0.05x | 0.79x |
| lad_g12 | after-logical | 1900ms | **100ms** | 1500ms | 0.05x | 0.79x |
| p325g16 | cold | 1600ms | **0ms** | 1600ms | 0.00x | 1.00x |
| p325g16 | after-logical | 1600ms | **200ms** | 1500ms | 0.13x | 0.94x |
| lad_g8 | cold | 74600ms (2/3 reps) | **1400ms** | timeout (0/3) | 0.02x | — |
| lad_g8 | after-logical | timeout (0/3) | **1400ms** | timeout (0/3) | — | — |

Both 6x6 rows read 0ms on every variant: the logic pass finishes it, so that
fixture places no constraint (`docs/real-app-timing.md`, the two-row rule).

**two-row rule, C2 against the shipped C1: SHIP** — 0.05x / 0.05x on g12,
0.00x / 0.13x on p325g16, 0.02x on the g8 cold row where C1 itself only
completes 2 of 3 reps. Every constraining row clears 0.9x on both sides.

**two-row rule, C3 against C1: NO SHIP** — 0.79x/0.79x on g12 is the only row
that improves at all, p325g16 is a wash, and on g8 C3 times out where C1
finishes. The counting identity alone is *worse* than the bound alone.

## Why both, and not either

The two deductions look near-redundant offline and are not. Soundness-fuzz
pruning (`proto/soundness-counting.mjs`, 300 states at 9x9, 13 clues,
**0 violations for all three components** at 9x9 and 6x6):

| state | C1 | C2 | C3 |
|---|---|---|---|
| random candidate sets | 43.9 / state | 44.7 | 23.1 |
| 90% pinned | 5.4 | 7.7 | 7.6 |

On loose states the bound does the work and the identity adds ~2%; on nearly
pinned states the identity does the work and the bound adds ~1%. Each looks
redundant in the other's regime, which is why C3 read as a plausible
replacement. **In the app they compound instead.** The bound pins a window's
top-left digit outright at 56 of the 64 ranks; that pinned cell narrows the
`[lo, hi]` interval the counting identity reads for that window, which tightens
`L` and `P` for every clue that overlaps it. Strip the bound and the identity
works from intervals a full digit wider, and its own pruning collapses — g8
goes from 1.4s to a 300s timeout.

The bound is also close to free: one pass over one cell, then latched off.
There is no cost case for dropping it.

## The 0-given gap is the component's, not the puzzle's

The first draft of this document concluded "the 0-given regime is out of reach"
and sent #326 off to pick a given count. **That was wrong, and a counterexample
killed it.** The reasoning ran three 0-given boards together — #335's 13- and
16-clue boards and this ticket's `lad_g4` — and generalised from a component
timeout to a claim about what quad-rank puzzles can be.

`proto/chris15.json` is a real 15-clue, **zero-given** 9x9 quad-rank puzzle
(note the deliberate tie: rank 35 on both R1C8 and R8C1). It is not a
generated artefact:

| check | result |
|---|---|
| CP-SAT witness search (no grid supplied) | grid found, **2.9s** |
| CP-SAT uniqueness | **unique**, 5.8s |
| app, C2, cold / after-logical | **timeout 300s, 0/3 reps each** |
| app, C1, cold / after-logical | **timeout 300s, 0/3 reps each** |

CP-SAT settles the whole puzzle from nothing in under 9 seconds. The app with
our strongest component cannot finish it in 300. **That is a 30x-plus deduction
gap on a board that is provably fine**, so the honest statement is:

> Zero-given quad-rank puzzles are ordinary and tractable. *Our component* is
> too weak for them in SudokuMaker's solver, and so is CP-SAT's advantage over
> it a measure of how much deduction we are leaving on the table.

The ISS bench (`~/src/iss-stuff/quad-rank/bench/results.md`) points the same
way and was already on record: its openers are pure clue lists with no givens,
difficulty falls **monotonically as clues are added**, and `opener-18.qr`
completes in 22.0s where 13 clues never converges. This ticket's ladder held
clues fixed at 13 and swept givens — the worst standing point on that curve, and
a sweep along the wrong axis.

**What still holds.** The given ladder is a fair measurement of C1 vs C2 vs C3;
it just does not license a claim about 0-given boards. The deduction verdict
above is unaffected.

**What is open.** Whether more clues (18-22, the ISS-tractable end) let the app
finish a 0-given board, and whether clue *placement* matters — `chris15`'s clues
sit on a structured lattice, every generated board here used random or greedy
placement. Neither was tested.

## Reproduce

```sh
npm ci && npx playwright install chromium
uv run --with lzstring proto/build_board.py proto/LINK_rc338_c2_lad_g8.txt \
  --puzzle proto/lad_g8.json --component QuadRankComponent2.js
node examples/_shared/app-solve.mjs proto/LINK_rc338_c2_lad_g8.txt 3
node examples/_shared/app-solve.mjs proto/LINK_rc338_c2_lad_g8.txt 3 ShowCandidates --after-logical
QR_COMPONENT=QuadRankComponent2.js node proto/soundness-counting.mjs 100 13 9
```
