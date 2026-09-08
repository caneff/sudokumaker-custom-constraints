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

---

# Follow-up (#375): cross-clue order closes the gap

`chris15` — the 15-clue zero-given board the section above could not solve — now
finishes **in 200ms**. The deduction that did it was not a sharper version of
anything here; it was a whole axis the component never used.

## Every clue was reasoning alone

The leading-digit bound reads one clue's rank. The counting identity reads one
clue's window against *unconditional* intervals for the other 63. Neither ever
used the fact that **the other clues' ranks are known too**.

Ranks order the clued windows exactly. Verified at **0 mismatches over 604,800
window pairs** across 300 random 9x9 grids (`proto/order-check.mjs`):

- `rank(a) < rank(b)` **iff** `value(a) < value(b)`
- `rank(a) == rank(b)` **iff** `value(a) == value(b)`, and every tied pair
  measured is **digit-identical** — all four cells

`proto/QuadRankComponent4.js` (C4) adds three things on that:

- **3a, tie equality.** Two clues at the same rank are the same four digits, so
  their candidate sets intersect cell-wise. `chris15` has exactly one such pair
  (rank 35 at R1C8 and R8C1) — four cell equalities C2 discarded.
- **3b, known-rank counting.** In the `L`/`P` count a *clued* window needs no
  interval test: smaller rank is below, anything else is not. Exact precisely
  where the intervals overlap and the interval test gave up.
- **3c, pairwise.** `rank(u) < rank(me)` means `value(u) < value(me)` directly,
  so a digit forcing `value(me) <= lo(u)` is dead. The counting rule only ever
  saw this through the aggregate.

**A wrong first draft, recorded because it is the trap.** 3b alone, written as
"clued window: use the rank, skip the interval test", removed *fewer* candidates
than C2 (52.0 vs 52.2 per state). Skipping the interval test threw away the
cases where rank and intervals **contradict** each other — each of which is a
dead branch C2 was catching via `L`/`P`. The fix is to keep both signals: use
the rank for the count, and check the contradiction explicitly (`pairDead`).

## Offline

`proto/qr-metric.mjs` on `chris15` (real component over a Regin all-different
floor; `QR_COMPONENT` selects the file):

| component | logic pass | search |
|---|---|---|
| C1 | 339 removed, 15 cells solved | **200,001 nodes, 0 solutions [CAPPED]** |
| C2 | 339 removed, 15 cells solved | **200,001 nodes, 0 solutions [CAPPED]** |
| C4 | 394 removed, 16 cells solved | **1,076 nodes, 1 solution** |

Soundness fuzz, **0 violations** for C4 at both sizes, and strictly more pruning
than C2 everywhere:

| fuzz | C2 | C4 |
|---|---|---|
| 9x9, 900 states, 15 clues | 52.6 / state | **62.4** |
| 9x9, 90% pinned | 8.6 | **9.6** |
| 6x6, 180 states, 8 clues | 17.3 | **20.1** |

## In the app

Medians over 3 reps unless noted. Baseline is C2, the component #338 shipped.

| board | mode | C2 | C4 | ratio |
|---|---|---|---|---|
| **chris15** (15 clues, **0 givens**) | cold | **timeout 300s (0/3)** | **200ms** | — |
| **chris15** | after-logical | **timeout 300s (0/3)** | **200ms** | — |
| 6x6 | cold / after | 0ms / 0ms | 0ms / 0ms | no constraint |
| lad_g12 | cold | 100ms | **0ms** | 0.00x |
| lad_g12 | after-logical | 100ms | 100ms | 1.00x |
| p325g16 | cold (7 reps) | **0ms** | **100ms** | regression |
| p325g16 | after-logical | 200ms | 200ms | 1.00x |
| lad_g8 | cold | 1400ms | **600ms** | 0.43x |
| lad_g8 | after-logical | 1400ms | **600ms** | 0.43x |

**Ground-truthed, not taken on trust.** `proto/app_solutions.mjs` taps the
solver worker on the C4 `chris15` link; the single grid it posts is byte-equal
to the grid CP-SAT proved unique. The 200ms is a real solve.

## The one sub-second row, and the rule it produced

`p325g16` cold reads 0ms under C2 and 100ms under C4, stable at **7 of 7 reps
each**. Under the two-row rule as written, a 0ms baseline the candidate does not
match sinks the change, and that board's other row is 1.00x, so nothing rescued
it. Every other fixture was SHIP (0.00x/1.00x on g12, 0.43x on both g8 rows) and
the target board went from a 300s timeout to 200ms.

**Ruled: differences under 1 second are ignorable.** Below 1s the app's readout
is quantised to 100ms ticks and the gate reads its own rounding. That is now the
protocol, not a one-off — `docs/real-app-timing.md` carries it as a noise floor
(`10168f6` on main), and the 0ms-baseline rule applies only once the candidate
is at or over 1s.

**So C4 ships.** The only row in this document at or above 1s is `lad_g8`, which
C4 takes from 1400ms to 600ms — 0.43x on both rows, SHIP outright.

## Is chris15 hard? No — and two boards say C4 is not the end

Every board below is CP-SAT-**unique**. Offline search nodes are `qr-metric.mjs`
under C4, cap 200,000.

| board | clues | givens | CP-SAT uniqueness | C4 search nodes |
|---|---|---|---|---|
| `p325_g16` | 6 | 16 | 0.3s | 876 |
| **`chris15`** | **15** | **0** | **5.3s** | **1,076** |
| `lad_g8` | 13 | 8 | 0.5s | 2,050 |
| `p325_g0` | 13 | 0 | 11.8s | **200,003 CAPPED** |
| `HARD_328_g1` | 16 | 0 | 85.2s | **200,002 CAPPED** |

`chris15` sits with the easy boards — a hair above a 16-given puzzle. **It is not
a hard board for the machine.** Two other zero-given boards, both unique, still
defeat C4 outright, and CP-SAT settles all three in 5-85s.

**The app agrees, board for board.** Built under C4 and run cold:

| board | C4 offline nodes | C4 in the app |
|---|---|---|
| `chris15` | 1,076 | **unique, 200ms** |
| `p325_g0` | 200,003 CAPPED | **timeout 300s** |
| `HARD_328_g1` | 200,002 CAPPED | **timeout 300s** |

That is three boards where `qr-metric.mjs` and the app land on the same verdict,
including both directions — the metric validation #328 asked for and never had.
It is a small sample, but it is the first evidence the offline number tracks the
engine that ships.

So the #375 result is narrower than "zero-given boards are solved": C4 closed
the gap **for this board**, not in general. The remaining two are where any
further deduction work should be measured.

**And "hard for the app" is the wrong target for the shipped example.** A board
the app grinds on is a bad demo — slow for the reader, and one component change
away from being easy anyway, since difficulty here is measured against a solver
we control and keep strengthening. Human solve path (#326) is the axis that
survives a component upgrade; DFS nodes is not.

---

# Follow-up (#381): saturation prunes outward, and ships

`proto/QuadRankComponent5.js` (C5) is C4 plus one deduction. Everything before it
prunes **inward** — a clue only ever removed candidates from its own four cells.
But "exactly `R-1` windows are strictly below me" is a count that can run out:

- the definitely-below set already holds `R-1`, so **nothing else may be below**;
- the possibly-below set holds exactly `R-1`, so **every one of them must be**.

Either way a digit in some *other* window's cell that breaks the settled
relation is dead. `getAffectedCells` already returned the whole grid, so the app
was waking the clue on those cells anyway; only the pruning was missing.

## The gate needed a slower fixture

Once C4 is the baseline, **every board in the #338 fixture set is sub-second** —
`lad_g8` is 600ms, and the noise floor means none of them can rule. `lad_g4` (13
clues, 4 givens, CP-SAT-unique in 1.6s) is the rung below and lands in a band
that can. It is now the ruling fixture for this component.

| board | mode | C4 | C5 | ratio |
|---|---|---|---|---|
| `lad_g4` | cold | 77800ms | **45500ms** | **0.58x PASS** |
| `lad_g4` | after-logical | 85800ms (2/3 reps) | **43500ms** | **0.51x PASS** |
| `lad_g8` | cold / after | 600ms | 300ms | sub-second, no constraint |
| `chris15` | cold / after | 200ms | — | sub-second, no constraint |

**two-row rule: SHIP.** Both rows clear 0.9x outright, on the only fixture above
the noise floor. C4's after-logical row completed 2 of 3 reps, which if anything
flatters it.

Offline and soundness, **0 violations** at both sizes:

| | C4 | C5 |
|---|---|---|
| `chris15` search nodes | 1,076 | **286** |
| `lad_g8` search nodes | 2,050 | **750** |
| `p325_g16` search nodes | 876 | **796** |
| 9x9 fuzz, 900 states | 62.4 / state | **63.9** |
| 9x9 fuzz, 90% pinned | 9.6 | **18.7** |
| 6x6 fuzz | 20.1 | **22.1** |

The pinned-state number is where the deduction lives: nearly double C4's
pruning in the regime the DFS actually spends its time in.

## The benchmark boards are not close, and the chase stopped

`p325_g0` and `HARD_328_g1` still cap under C5, and a probe at a 3,000,000-node
cap on `p325_g0` ran ~20 minutes without returning — deep search, not a
near-miss. Both remain CP-SAT-unique (11.8s and 85.2s), so the gap to CP-SAT on
these two is real and unclosed.

**Recorded as not worth continuing on this axis.** CP-SAT's advantage here is
clause learning, which a component `update` cannot replicate, and nothing the
map needs depends on solving them: the destination is a shipped example, and
`chris15` is 200ms under C4 and faster under C5. They stay on disk as the
benchmark any future deduction should be measured against.
