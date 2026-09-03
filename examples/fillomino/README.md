# Fillomino

Divide the grid into orthogonally connected **regions**; every cell of a region
of `k` cells holds the digit `k`; two distinct regions of the same size may not
touch orthogonally. No houses, no rows, no boxes — fillomino is not sudoku, so
this example's rules text carries no sudoku sentence, and the shared layout
checker exempts it (`NO_RULES_PREFIX`). It is also a whole-grid constraint with
no drawn groups, so it ships `main.js` alone and no local board
(`NO_LOCAL_GLOBAL_SPLIT`).

Spec #303, on map #277. Tickets #305 (the example scaffold and **rung 1**) and
#308 (**rung 2**, the growth test). Rung 3 (cut starve, #309) comes after.

## What the component deduces

One whole-grid `update`. Each call makes one grid scan that finds the
**islands** — a maximal connected set of placed cells of one digit. Two
adjacent cells holding `k` lie in one region, so an island of digit `k` with
`p` cells sits wholly inside one region and that region needs `k - p` more
cells. Nothing is carried between calls.

Per island, in order:

- **Overflow** — an island of more than `k` cells holding `k` is a dead branch.
- **Seal** — an island of exactly `k` cells is a finished region, so every open
  cell touching it loses `k`.
- **Walk** — a 0-1 breadth-first search out of the island. A cell already
  holding `k` costs nothing to enter, an open cell that still allows `k` costs
  one step, and the budget is the `k - p` open cells the region can still take.
  The walk is a superset of the region.
- **Starve** — a walk under `k` cells is a dead branch.
- **Force** — a walk of exactly `k` cells *is* the region, so every open cell in
  it holds `k`.
- **Doors** — a door is an open cell beside the island that still allows `k`.
  A door that touches islands of `k` adding up past `k` cells cannot hold `k`
  (*merge overflow*); and when one door is left, the region has to grow through
  it, so that cell holds `k` (*one door*).

Then the growth test — rung 2, #308 — at the scope the clock allowed. At each
**door**:

- **Merge** — `M` is the door plus every island of the digit it touches. If the
  door held `k`, Lemma A puts them all in one region.
- **Merge overflow** — `|M| > k`, so the door does not hold `k`.
- **Merge starve** — the 0-1 walk out of `M` with budget `k - |M|` covers the
  whole region, so a walk under `k` cells means no such region exists and the
  door does not hold `k`.

And once per digit, over the whole board:

- **Component bound** — the cells that allow `k` (open cells listing `k`, plus
  cells holding `k`) split into orthogonally connected components. A `k`-region
  is connected and lies inside one of them, so every cell of a component under
  `k` cells loses `k`. This is the only rule that reaches a **silent region** —
  a region with no placed cell in it — because every other rule starts from an
  island.

### Why the growth test is not at full scope

#308 asks for the growth test per **(open cell, candidate digit)** pair, every
open cell on the board. That version was built and timed first. Against the
baseline it wins everywhere; against **rung 1** the clock refused it — 1.00× to
4.86× on the frozen fixtures, worst on the digits-1-12 boards, where the walk
budget is widest. #308 names one fallback for exactly that outcome, and this is
it: frontier-only scope plus the per-digit component bound. It keeps the
silent-region win — the component bound needs no placed cell — and costs one
flood per digit instead of one bounded walk per (cell, digit) pair. On this
example's strength fuzz the two scopes prune the same 21084 cells over 600
states. Both sets of rows are in `## Timing`.

**Merge force is not built, and not deferred — it is unsound.** The transfer
doc's §6 box ends "if it covers exactly `k` and stopped there naturally, every
open cell it covers holds `k`". That reading is sound only when the walk starts
from a *placed* island, which is rung 1's force. Started from an open cell, the
budget `k - |M|` already assumes the cell holds `k`, so the conclusion is
conditional on the very thing under test. Smallest counterexample: `k = 1`,
where `M` is the cell alone, the walk covers exactly one cell, and the rule
would place a 1 in every open cell that still allows one.

`validate` is one flood over a full grid: every same-digit component's cell
count must equal its digit. The separation rule needs no check of its own —
two regions of size `k` touching would be one component of at least `2k` cells.

Rule statements, soundness arguments and per-call costs are in
`docs/research/fillomino-isofill-transfer.md`, sections 0-3 and 9; the
component cites its section per rule.

### Reading a live island, not a scanned one

`update` yields as it goes, so by the time a later island is reached an earlier
deduction may have placed a digit right beside it. Every rule reads the
island's **live** extent, re-flooded from the scan's seed cell, rather than the
extent the scan recorded. This is not a nicety: the vendored baseline reads the
scanned list as fact and, on a stale under-sized island, its seal and its
one-door force are both unsound. Driven as published it removes a true value on
about one state in ten of this example's fuzz.

### Not built yet

Cut starve with the dominator filter is rung 3. Tour, cut strand, perimeter
flank, budget covering, and the walk's outside and missed-placed readings are dead under
fillomino's two-fold indexing and are not planned. See #284 for each parked
rule and its admission bar.

## The board

`gen.json` holds the shipped 6x6 board: the sample fillomino from the puzz.link
rules page, the same board the vendored baseline ships, so the strength gate
and any timing comparison run on one grid. Twelve givens; CP-SAT proves the
clue set has exactly one solution (`docs/research/fillomino_cpsat.py`, the
research prototype — a shipped generator and its own proof are #306).

Rebuild the link:

```
uv run --with lzstring examples/fillomino/build_link.py
```

## Tests

- `soundness-harness.mjs` — the invariant: `update` never removes a cell's true
  value. Two fixtures, 20,000 fuzzed states each, plus one directed check per
  rule. `FUZZ=80000` for a deep run before a ship.
- `update-strength.test.mjs` — both halves of the strength gate: on any state
  the component never keeps a candidate the vendored baseline removed, and on
  some state it removes one the baseline keeps. The count alone does not
  separate the rungs (rung 1 already removed 7352 cells the baseline keeps over
  the 600 fuzzed states, against rung 2's 21084), so half two also carries the
  directed **silent-region demo**: a state with no placed cell anywhere, where
  every baseline rule is idle and the growth test still drops a digit. The
  reference is driven one change per call so every island it reads is freshly scanned; the test header
  says why, with the measured numbers.
- `build_link.test.py` — the committed component reproduces `PUZZLE_LINK.txt`
  exactly, and `--component` / `--board` change only the component's code.

## Timing

The app opens `PUZZLE_LINK.txt` and reaches a verdict on it: **unique**.

| Date | App version | Board | Cold | After logical |
| --- | --- | --- | --- | --- |
| 2026-09-02 | v2026.08.14-d47fc4b | fillomino (6x6, 12 givens) | 0 ms | 0 ms |

**Those numbers rank nothing.** The shipped 6x6 board is the baseline's own
board, and the baseline's README records it at 100 ms cold, 0 ms after logical
— the app reporting that the puzzle falls over immediately, where a component
change moves neither number. Everything below is timed on the frozen fixture
set instead (#307, 19 boards, 28-35 givens, each proved unique;
`docs/research/fillomino-baseline/README.md`). Each board is the fixture link
with one component swapped in, so both sides solve the same grid.

### Rung 2 against the vendored baseline

Baseline column: the community catalog's fillomino constraint. Candidate
column: this component. **19 fixtures, 19 SHIP.**

| Date | App version | Board | Baseline | Candidate | Ratio | Row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-base.txt) | 23300ms | 2300ms | 0.10 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-base.txt) after-logical | 16600ms | 2600ms | 0.16 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-base.txt) | 26400ms | 3600ms | 0.14 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-base.txt) after-logical | 34000ms | 5500ms | 0.16 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-base.txt) | 29500ms | 200ms | 0.01 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-base.txt) after-logical | 3900ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-base.txt) | 24100ms | 3900ms | 0.16 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-base.txt) after-logical | 200ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-base.txt) | 25700ms | 8100ms | 0.32 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-base.txt) after-logical | 15300ms | 4700ms | 0.31 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-base.txt) | 22000ms | 3400ms | 0.15 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-base.txt) | 27700ms | 2900ms | 0.10 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-base.txt) | 27200ms | 7300ms | 0.27 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-base.txt) | 28900ms | 4000ms | 0.14 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-base.txt) after-logical | 28800ms | 6600ms | 0.23 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-base.txt) | 27600ms | 4800ms | 0.17 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-base.txt) | 27900ms | 5400ms | 0.19 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-base.txt) after-logical | 28400ms | 5400ms | 0.19 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) | 24800ms | 4200ms | 0.17 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) | 23400ms | 4800ms | 0.21 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) after-logical | 21700ms | 4200ms | 0.19 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) | 18900ms | 2900ms | 0.15 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) after-logical | 800ms | 300ms | 0.38 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) | 25000ms | 8300ms | 0.33 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) | 22900ms | 1300ms | 0.06 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) | 24200ms | 6400ms | 0.26 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) | 24700ms | 6700ms | 0.27 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) after-logical | 24600ms | 7000ms | 0.28 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) | 28500ms | 6000ms | 0.21 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) after-logical | 0ms | 0ms | — | NO TIME |

### Rung 2 against rung 1 — the pay-for-itself gate

Baseline column: rung 1 (#305, this branch's parent commit). Candidate column:
rung 2.

| Date | App version | Board | Baseline | Candidate | Ratio | Row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) | 3500ms | 2100ms | 0.60 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) after-logical | 2000ms | 3000ms | 1.50 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2100ms | 3200ms | 1.52 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 3400ms | 4500ms | 1.32 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 5300ms | 200ms | 0.04 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1200ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) | 7900ms | 4100ms | 0.52 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) after-logical | 100ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) | 6800ms | 7500ms | 1.10 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) after-logical | 4100ms | 4800ms | 1.17 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) | 4900ms | 2900ms | 0.59 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) | 6100ms | 2900ms | 0.48 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 3700ms | 7000ms | 1.89 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) | 5800ms | 3900ms | 0.67 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) after-logical | 6000ms | 6300ms | 1.05 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) | 3500ms | 4500ms | 1.29 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) | 8800ms | 5200ms | 0.59 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) after-logical | 8500ms | 5300ms | 0.62 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) | 11200ms | 5200ms | 0.46 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) | 5400ms | 5900ms | 1.09 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) after-logical | 4700ms | 4900ms | 1.04 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) | 4700ms | 3200ms | 0.68 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) after-logical | 200ms | 400ms | 2.00 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 4500ms | 9600ms | 2.13 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 3100ms | 1500ms | 0.48 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) | 6600ms | 7400ms | 1.12 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) | 8000ms | 7700ms | 0.96 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) after-logical | 8000ms | 6600ms | 0.82 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) | 7500ms | 5400ms | 0.72 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |

**The gate is mixed, and the record says so: 10 fixtures SHIP, 9 do not.** The
nine are cap9-seed1, cap9-seed18, cap9-seed3, cap12-seed11, cap12-seed13,
cap12-seed14, cap12-seed17, cap12-seed4 and cap12-seed8.

Read across the set rather than per board, rung 2 wins: cold time over all 19
fixtures falls from 109.4 s to 89.4 s (**0.82×**), and the median fixture's
cold row is **0.68×**. The wins are large (0.04×, 0.46×, 0.48×) and the losses
are mostly small — six of the nine sit between 1.04× and 1.29×, inside the
1.1×-to-1.3× band where three reps on a board this slow cannot separate a
regression from noise. Three are real: cap12-seed14 at 2.13×, cap12-seed4 at
1.89×, cap9-seed3 at 1.52×.

The cost that shows up in those three is the component bound. Every other rule
in the component is bounded by the digit — a walk stops at `k + 1` cells. The
component bound is bounded by the **board**: one flood per digit over all 81
cells, on every call. That is why the losses cluster on the digits-1-12 range,
which pays it twelve times per call instead of nine. The bound is not
negotiable at this rung — it is the only rule that reaches a silent region, and
the silent-region deduction is what #308 asks rung 2 to show. Gating it, so it
floods only the digits whose allowed set changed since the last call, is the
obvious next measurement and is not part of this rung.

Rung 2 is also never weaker: on this example's strength fuzz it removes 21084
candidates the baseline keeps over 600 states, against rung 1's 7352, and 0
that the baseline removes and it keeps.
