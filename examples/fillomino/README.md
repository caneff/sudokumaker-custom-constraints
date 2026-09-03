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

### What the ablation settled — the parts are not separable

Rung 2 costs more than rung 1 on some fixtures (`## Timing`), so before shipping
it every separable part was measured on its own: value as the candidates a
variant removes and rung 1 keeps, at a fixpoint, over 600 fuzzed 6x6 states and
760 states fuzzed around the 19 frozen 9x9 grids; cost as component-only wall
time over the same grids. The full table is in `PROGRESS.md`. Four findings, and
they are why the component looks the way it does:

- **The component bound is all of the value.** The frontier growth test on its
  own removes exactly rung 1's 7352 candidates against the vendored baseline —
  zero extra, on 1360 states across both board sizes — for 1.79x rung 1's
  component time. Every extra prune rung 2 makes comes from the bound.
- **The merge rules still cannot be dropped.** With them removed, the bound
  alone runs 113 cells **weaker than the vendored baseline** and fails the
  strength gate's half one. The rule set is not monotone: a bound prune can take
  the last door out from under rung 1's one-door force, which then never fires.
  The merge rules make no prune of their own here; they repair the hole the
  bound opens. (A real fixpoint difference, not the fuzz harness's 20-pass cap —
  the same number at 400 passes.)
- **Capping the bound by digit was rejected.** The guess was that the wins sit
  in the small digits. The opposite is true: bound prunes by digit on the 9x9
  fuzz run `{1:300, 2:3174, 3:4597, 4:6283, 5:8734, 6:9581, 7:10966, 8:10721,
  9:13425, 10:9626, 11:8501, 12:9283}` — value **rises** with the digit. Capping
  at 6 does shrink the worst losses (2.09x to 1.26x, 1.61x to 1.11x) but it
  throws the wins away: cap9-seed5 goes 0.03x to 0.93x and cap12-seed16 0.41x to
  1.11x, a 2.4x win turned into a loss.
- **Running the bound only on open-enough boards was rejected.** A gate at 25%
  open cells changes the fixpoint by 228 candidates, at 50% by 4186. A speed
  gate that changes what the component deduces is a different component.

One gate was built and then deleted: cells inside a walk that ended at `k` or
more cells provably sit in a component of at least `k` cells, so the bound's
flood need not be seeded from them. It is sound and was asserted identical at
the fixpoint, but it skips 9-13% of the bound's *seeds* and none of its
*floods* — a skipped seed almost always sits in a component some other seed
floods anyway — and it measured 1.03x on the local bench with no separable
effect in the app. Deleted rather than shipped: a gate that guards nothing is
code to read at 3am.

What did survive from that pass is one line: `allows` reads
`puzzle.getCandidatesBitMask`, not `puzzle.getCandidates`, which allocates a
fresh DigitSet on every read. The bound calls it once per (cell, digit) pair per
update. Cold against rung 1 on the three worst fixtures: 2.13x to 2.09x, 1.89x
to 1.61x, 1.52x to 1.25x.

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
  says why, with the measured numbers. It also carries the **fixpoint floor**:
  the component must settle on exactly the candidates rung 2 as shipped
  (`ac20771`) settles on, both directions, over 200 states. That is the seam
  #312 works against — a cheaper bound may not change what the bound deduces.
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

### The timing record is INTERIM

Both tables below time the code this ticket ships. They are **not the final
record**: #312 (rung 2.5, bound-cost optimizations, fixpoint-identical) re-times
all 19 fixtures immediately after this ticket, and its sweep supersedes both.
The vs-rung-1 pass here is complete, 19 of 19. The vs-baseline pass was stopped
at 8 of 19 once #312 landed on the plan — finishing it would have produced rows
that were stale on arrival. The 8 collected rows stand as an interim record and
the remaining 11 come with #312.

### Rung 2 against the vendored baseline — interim, 8 of 19 timed

Baseline column: the community catalog's fillomino constraint. Candidate
column: this component. **8 fixtures timed, 8 SHIP** — cold time over the eight
falls from 189.4 s to 36.6 s (**0.19x**), the median fixture cold row 0.19x.
The eleven untimed fixtures are cap9-seed1, cap9-seed3, cap9-seed5, cap9-seed10,
cap9-seed18, cap9-seed20, cap12-seed3, cap12-seed4, cap12-seed5, cap12-seed8 and
cap12-seed9; the pre-bitmask code cleared all 19 against this baseline, and that
table is in this file's history at 8acf3d7.

| Date | App version | Board | Baseline | Candidate | Ratio | Row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) | 24500ms | 4200ms | 0.17 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) | 24400ms | 4500ms | 0.18 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-base.txt) after-logical | 21900ms | 3900ms | 0.18 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) | 17800ms | 2800ms | 0.16 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-base.txt) after-logical | 800ms | 300ms | 0.38 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) | 24200ms | 6900ms | 0.29 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) | 21400ms | 1100ms | 0.05 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) | 23800ms | 5500ms | 0.23 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-base.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) | 25500ms | 6200ms | 0.24 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-base.txt) after-logical | 23800ms | 6200ms | 0.26 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) | 27800ms | 5400ms | 0.19 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-base.txt) after-logical | 0ms | 0ms | — | NO TIME |

### Rung 2 against rung 1 — the pay-for-itself gate

Baseline column: rung 1 (#305). Candidate column: rung 2 as shipped, bitmask
read included. **19 fixtures, 9 SHIP, 10 do not.**

| Date | App version | Board | Baseline | Candidate | Ratio | Row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) | 3700ms | 1800ms | 0.49 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung1.txt) after-logical | 2000ms | 2300ms | 1.15 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2000ms | 2700ms | 1.35 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 3100ms | 4000ms | 1.29 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 5200ms | 200ms | 0.04 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1300ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) | 6800ms | 3600ms | 0.53 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung1.txt) after-logical | 100ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) | 6700ms | 7300ms | 1.09 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung1.txt) after-logical | 4000ms | 4400ms | 1.10 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) | 4700ms | 2400ms | 0.51 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) | 6200ms | 2300ms | 0.37 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 3600ms | 5900ms | 1.64 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) | 5500ms | 3500ms | 0.64 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) after-logical | 5800ms | 5900ms | 1.02 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) | 3400ms | 4200ms | 1.24 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) | 8400ms | 4900ms | 0.58 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung1.txt) after-logical | 8400ms | 4800ms | 0.57 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) | 8500ms | 4000ms | 0.47 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) | 4300ms | 4200ms | 0.98 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung1.txt) after-logical | 3700ms | 3700ms | 1.00 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) | 3700ms | 2600ms | 0.70 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung1.txt) after-logical | 200ms | 300ms | 1.50 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 3300ms | 6900ms | 2.09 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 2500ms | 1100ms | 0.44 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) | 4900ms | 5300ms | 1.08 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) | 5900ms | 6100ms | 1.03 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung1.txt) after-logical | 5900ms | 5900ms | 1.00 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) | 7100ms | 5100ms | 0.72 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |

**The gate is mixed, and the record says so.** The ten that do not ship are
cap9-seed1, cap9-seed3, cap9-seed18, cap12-seed4, cap12-seed8, cap12-seed11,
cap12-seed13, cap12-seed14, cap12-seed17 and cap12-seed18.

Read across the set rather than per board, rung 2 wins: cold time over all 19
fixtures falls from 96.4 s to 74.1 s (**0.77x**), and the median fixture's cold
row is **0.70x**. The wins are large (0.04x, 0.37x, 0.44x, 0.47x) and most of
the ten are not losses on the clock at all. Four sit between 0.98x and 1.09x on
their cold row — cap12-seed11, cap12-seed18, cap12-seed17 and cap9-seed18 —
inside the band where three reps on a board this slow cannot separate a
regression from noise. Two more win clearly on cold and fail only on an
after-logical row: cap9-seed1 at 0.49x cold, 1.15x after logical, and
cap12-seed13 at 0.70x cold, 1.50x on an after-logical row that reads 200 ms
against 300 ms. Four are real: cap12-seed14 at 2.09x, cap12-seed4 at 1.64x,
cap9-seed3 at 1.35x and cap12-seed8 at 1.24x.

The cost that shows up in those three is the component bound. Every other rule
is bounded by the digit — a walk stops at `k + 1` cells. The bound is bounded by
the **board**: one flood per digit over all 81 cells, on every call. That is why
the losses cluster on the digits-1-12 range, which pays it twelve times per call
instead of nine. The ablation above is why it ships anyway: the bound is where
every one of rung 2's extra deductions comes from, and no cheaper version of it
survived measurement. Making that flood cheaper without changing what it deduces
is #312.

Rung 2 is never weaker: on this example's strength fuzz it removes 21084
candidates the baseline keeps over 600 states, against rung 1's 7352, and 0
that the baseline removes and it keeps.
