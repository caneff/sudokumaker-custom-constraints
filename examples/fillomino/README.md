# Fillomino

Divide the grid into orthogonally connected **regions**; every cell of a region
of `k` cells holds the digit `k`; two distinct regions of the same size may not
touch orthogonally. No houses, no rows, no boxes — fillomino is not sudoku, so
this example's rules text carries no sudoku sentence, and the shared layout
checker exempts it (`NO_RULES_PREFIX`). It is also a whole-grid constraint with
no drawn groups, so it ships `main.js` alone and no local board
(`NO_LOCAL_GLOBAL_SPLIT`).

Spec #303, on map #277. Tickets #305 (the example scaffold and **rung 1**),
#308 (**rung 2**, the growth test), #312 (**rung 2.5**, the bound made cheap)
and #309 (**rung 3**, cut starve). The ladder is complete.

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

And per island again, once the walk is known — rung 3, #309:

- **Cut starve** — take an open cell of the walk and run the walk again
  without it. If that covers fewer than `k` cells the region cannot avoid the
  cell, since the region would otherwise be a subset of a set under `k` cells.
  So the cell is in the region and holds `k`. A dominator-tree filter clears
  most cells before any re-walk (below). ISOFILL's *strand* half does not come
  along: two islands of one digit need not share a region (transfer doc §4).

### The dominator filter — rung 3, #309

`cutFilter` transfers from ISOFILL (`IsofillComponent.js`, #258) unchanged: it
is a statement about reachability alone and never reads a digit or a region
count. One breadth-first search from the island plus the dominator tree of the
shortest-path DAG it builds answers every open cell at once — a cell stays
reachable at its own distance without `y` whenever `y` does not dominate it, so
the walk without `y` keeps at least (cells reached) − (cells `y` dominates).
The bound only ever *clears* a cell; whatever it does not clear pays for a
re-walk of its own.

One thing had to be said differently here. The filter's BFS is the **unit-step**
one, not the walk's 0-1 one, because a dominator tree needs layers a step
apart. Every path costs at least as much in unit steps as in 0-1 steps, so the
unit walk is a subset of the 0-1 walk and its count is a lower bound on it —
which is the direction the filter needs. A looser bound clears fewer cells and
costs a walk; a bound the wrong way round would clear a cell that cuts.

Every test in the pass reads **one** snapshot — that island's extent, that
walk, that allowed row — so the cuts are collected and yielded together at the
end, and the island's rules stop there for the call. Yielding inside the loop
would place a `k` beside the island and leave every later test, and the door
rules below, reading an island a deduction out of date. That is the same trap
the vendored baseline falls into (see *Reading a live island* below).

### The bound made cheap, not smaller — rung 2.5, #312

The bound is the one rule bounded by the **board** rather than by the digit,
and #308's ablation proved its answers cannot be trimmed: every capped, gated
and merge-less variant either threw the wins away or changed the fixpoint.
So #312 left the answers alone and cut the cost, under one bar — the fixpoint
stays **byte-identical**, asserted both directions against rung 2 as shipped.

What ships is **dirty components**. `code[i]` is cell `i`'s allowed-digit
bitmask — the digit it holds, or its candidates — read once per cell per pass
instead of once per `(cell, digit)` pair, and diffed against `prev`, the row
the last completed pass finished on. A component whose cells and whose
bordering cells all read the same code as last time *is* last time's component
and last time's verdict already stands, so only the changed cells and their
neighbours seed a flood. On the first pass `prev` is all `-1` and every cell
seeds one, exactly as before.

A **snapshot, never a dirty flag**: the solver gives no backtrack signal, so a
flag set on our own prunes goes stale the moment the search restores a
candidate, where a diff against the previous pass's codes cannot. `prev` is
written only after the last yield, so a pass the solver abandons half-way
leaves the older snapshot in place and the next pass reads a superset of what
moved. `update-strength.test.mjs` carries the check that hazard needs: one
instance driven over 400 unrelated states has to settle each exactly where a
fresh instance does.

Measured as the bound's share on top of the same component with the bound cut
out: **81% → 20%**, and 0.66× the component's local time. Two other
optimizations were built to the same bar, proved fixpoint-identical, and
dropped on the clock — **bound at quiescence** (1.30×: the island rules already
quiesce in about one pass, so deferring the bound buys no bound passes and pays
for a confirming island pass at every quiet point) and **k-bounded floods**
(1.00×: with dirty components the floods are already small, and stopping early
moves work rather than removing it). The numbers and the pass counts are in
`PROGRESS.md`; **bitboards were not built**, and `## Timing` says why.

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

Tour, cut strand, perimeter flank, budget covering, and the walk's outside and
missed-placed readings are dead under fillomino's two-fold indexing and are not
planned. See #284 for each parked rule and its admission bar.

## The board

`gen.json` holds the shipped instance (#310): a 9x9, digits 1-9 board, 28
givens. Sampled by `generate.py sample 3`, stripped in the live app under the
**shipped** component (`app-strip.mjs`), and picked as the slowest board the
app still closes out of a hunt that ran a blind 18-seed live batch, a 300-board
offline hunt (#317's scorer) across both digit ranges, and an offline
hill-climb of the two live-stripped outliers — none of the offline-hunted or
climbed boards beat the live strip's own two hardest boards, and one of the
two (this one) beat the other in a live 3-rep timing. Full record:
`PROGRESS.md`.

CP-SAT proves the clue set has exactly one solution, no timeout:

```
uv run --with ortools examples/fillomino/generate.py unique examples/fillomino/gen.json
unique
```

(5.4s.) `update-strength.test.mjs` reads this same `gen.json` for its
`shipped`-grid check, so that test's own fuzz now runs against the shipped
instance's grid too.

Rebuild the link:

```
uv run --with lzstring examples/fillomino/build_link.py
```

## Share checklist, walked

`docs/share-checklist.md`, criterion by criterion, against `PUZZLE_LINK.txt`
as it ships. This is the record the checklist asks for; re-walk it whenever
the board or the rules text changes.

**Free gate** — `just check` green: layout, lint, probe goldens, soundness at
zero violations, the never-weaker floor, and `pipeline.test.py`, which drives
sample → CP-SAT proof → the shipped component solving this clue set offline →
the link decode, and fails if any two of them disagree.

The three mechanical criteria, checked by `check_layout.py` on every committed
link in the example (all 51: this board, 19 `-rung1` + 19 `-rung25` + 9
`-base` frozen fixtures, the hunt records):

- **Opens clean** ✓ — 53 non-given cells, every one `{}`. `pipeline.test.py`
  asserts it cell by cell as well.
- **Ring not filled end to end** ✓ — 14 of 32 ring cells hold a given. See
  criterion 3 below for what the ring means on this board.
- **Rules prefix** — **exempt**, and deliberately: fillomino is not sudoku, so
  the example is in `NO_RULES_PREFIX` and `build_link.test.py` asserts the
  rules text does *not* open with the sudoku sentence.

1. **Uniqueness proven on the shipped board** ✓ — `generate.py unique` on this
   exact `gen.json`, 5.4 s, no timeout; the run is recorded under *The board*
   above. Since this ticket it is not only a recorded run: `pipeline.test.py`
   re-proves it on every `just check`, so the board cannot outlive its proof.
2. **Rules text stands alone** ✓ — "Fillomino: Place a digit from 1-9 in every
   cell. Orthogonally connected cells with the same digit are regions; the
   number of cells in a region has to equal its digit. Two regions of the same
   size may not touch orthogonally." Three sentences, no repo jargon, no
   component name, and the separation rule stated — a solver who has never seen
   this repo has the whole rule.
3. **Clue set curated** ✓, read the way the criterion says to read it. There is
   no outside-clue ring on this board: fillomino is a whole-grid constraint, so
   the "ring" is just the grid's outer cells and 14 of 32 filled is the clue
   set falling where it falls, not a ring handed over. 28 givens on 81 cells is
   sane for a 9x9. The carve is recorded: a live-app strip under the shipped
   component (`app-strip.mjs`), one greedy pass that keeps a removal only while
   the app still closes the board — so no given in it is known-droppable by
   that walk. It is a greedy strip, not a CP-SAT minimality proof, and the
   README says so where the board is described.
4. **Component reads well** ✓ — `FillominoComponent.js` opens with an 81-line
   `//!` overview (what the rules are, why the growth test ships at
   frontier-only scope, why merge force is not built) and carries short
   per-step comments through the scan, the walk, the doors and the bound. The
   recipient reads that source inside the 10.4 KB link blob.

## Paste into SudokuMaker

Make a custom board (any square side) with digits 1 through the cap. Add a
custom **global** constraint — no group input — and paste `main.js` as the
main code. Add one component segment named `FillominoComponent` with the
component file's contents. Enter the givens.

## Generator

`generate.py` (OR-Tools CP-SAT), grown from the research prototype
(`docs/research/fillomino_cpsat.py`, #280/#288):

```
uv run --with ortools examples/fillomino/generate.py               # self-check
uv run --with ortools examples/fillomino/generate.py sample 7      # seed 7, 9x9, digits 1-9
uv run --with ortools examples/fillomino/generate.py sample 7 9 12 # seed 7, side 9, cap 12
uv run --with ortools examples/fillomino/generate.py unique examples/fillomino/gen.json
```

Knobs on `sample(seed, side=None, cap=None, pins=4, max_tries=50)`: `side`
and `cap` default to 9 and to `side`; `cap` above `side` widens the digit
range without changing the board size (one pin is then forced above `side`
so the wide cap actually gets used). `pins` random cells are seeded with a
random digit before each solve — diversity against CP-SAT's own
`randomize_search`, which alone still hands back dull striped grids on some
seeds. A pin combination with no solution, or that solves to a striped grid,
is dropped and retried with a fresh sub-seed, up to `max_tries`. `unique`
wraps the same model's `solutions()` capped at 2 and raises `TimeoutError`
past its `limit` (600s default) rather than returning a verdict — a timeout
is never read as proof.

`app-strip.mjs` strips a sampled grid's 81 (or `side`²) givens down to a
minimal clue set in the live app; the generator itself carries no strip step.

## Tests

- `soundness-harness.mjs` — the invariant: `update` never removes a cell's true
  value. Two fixtures, 20,000 fuzzed states each, plus one directed check per
  rule. `FUZZ=80000` for a deep run before a ship.
- `update-strength.test.mjs` — both halves of the strength gate: on any state
  the component never keeps a candidate the vendored baseline removed, and on
  some state it removes one the baseline keeps. The count alone does not
  separate the rungs (rung 1 already removed 7352 cells the baseline keeps over
  the 600 fuzzed states, rung 2 21084 and rung 3 23432), so half two also carries the
  directed **silent-region demo**: a state with no placed cell anywhere, where
  every baseline rule is idle and the growth test still drops a digit. The
  reference is driven one change per call so every island it reads is freshly scanned; the test header
  says why, with the measured numbers. It also carries the **fixpoint floor**:
  the component must settle on exactly the candidates rung 2 as shipped
  (`ac20771`) settles on, both directions, over 200 states. That is the seam
  #312 worked against. Rung 3 adds a deduction, so the floor is now one
  direction — never a candidate less than `ac20771`, ever — paired with its
  own directed **cut-starve demo**: an island whose walk forks and closes
  again, where the force, the one-door rule, the merge rules and the component
  bound are all idle and cut starve still places two digits.
  Last, the **reused instance** (#312, 400 states): the bound carries a
  snapshot between calls, so one instance driven over a run of unrelated states
  must settle each exactly where a fresh instance does. That is the hazard the
  snapshot introduces and the one the fixpoint floor cannot see — the floor
  builds a fresh instance per state.
- `build_link.test.py` — the committed component reproduces `PUZZLE_LINK.txt`
  exactly, and `--component` / `--board` change only the component's code.
- `pipeline.test.py` — the whole chain on one board: `generate.py sample` draws
  a grid and CP-SAT proves it; CP-SAT proves the shipped clue set; the shipped
  component solves that clue set offline out of `PUZZLE_LINK.txt` and must land
  on `gen.json`'s grid; the link decodes with every non-given cell empty. Each
  step is covered on its own elsewhere — what only this test covers is that the
  generator, the proof, the component and the link cannot drift apart quietly.
  About 30 s.
- `generate.test.py` — the generator's acceptance criteria, including that a
  dropped grid (no solution, striped, or a uniqueness solve that timed out)
  logs its seed and clue set instead of vanishing.

## Minimum givens — the strength headline

#303's headline for solving strength is *the fewest givens the component still
closes a board from*, run once over the fixture set. **27**, on the frozen
9x9 digits-1-12 boards cap12-seed3 and cap12-seed4.

Method: the **offline strip** (`hunt.mjs strip`, HUNT.md) at seed 7 over the
19 frozen fixtures — the same greedy walk `app-strip.mjs` runs in the app, with
the app swapped out for the offline scorer, whose only propagator is the
shipped `FillominoComponent.js`. The walk starts from the full grid and keeps a
removal only when the board still closes, so the count is the clue set this
component needs on that grid, not the fixture's own. An offline number ranks;
it is not an app claim (`docs/real-app-timing.md`).

    for f in examples/fillomino/timing-fixture-*-rung25.txt; do
        node examples/fillomino/hunt.mjs strip "$f" /tmp/$(basename "$f" .txt).json 7
    done

**18 of 19 boards.** Spread 27–37, median 30. The nineteenth, cap9-seed3, is
the board HUNT.md already names: it spends the scorer's default 200,000-node
budget and scores `capped`, so the strip has no verdict to strip against and
refuses to start. A spent budget is not an answer.

For reference, the shipped instance (`gen.json`) carries **28** givens, cut by
the *live* strip under the same component — the same neighbourhood, from a
different grid and a different stripper.

## Timing

The app opens `PUZZLE_LINK.txt` and reaches a verdict on it: **unique**.

| Date | App version | Board | Cold (median of 3) | After logical (median of 3) |
| --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9, digits 1-9, 28 givens) | **7700 ms** | 0 ms |

**How this board was found (#310).** A blind 18-seed live-app strip under
this shipped component, a 300-board offline hunt across both digit ranges
(#317's scorer, CP-SAT-sampled and offline-stripped), and an offline
hill-climb of the two live-stripped outliers — full record in `PROGRESS.md`.
The live strip's own harder boards beat everything the offline hunt or the
climb found; two cap12 finalists from the offline hunt timed out live and
were dropped (a timeout is never a verdict). The shipped board is the one
that beat its closest rival (6600 ms) in a live 3-rep timing, out of the two
boards the app still closes fastest among the hardest the hunt found.

Everything below this point predates the shipped instance and ranks the
**component's rungs against each other and against the vendored baseline**,
not this specific board — it is timed on the frozen fixture set instead
(#307, 19 boards, 28-35 givens, each proved unique;
`docs/research/fillomino-baseline/README.md`). Each board there is the
fixture link with one component swapped in, so both sides solve the same
grid.

### Which table is the record

Two tables answer two questions.

**Against the vendored baseline** — the #303 headline — is the first table
below: the shipped component next to the catalog's, on the 8 fixtures the
baseline was ever timed on at this app version. Every number in it is reused,
and each names the sweep it came from.

**Against the rung under it** — the pay-for-itself gate, and the
strength/speed record for the ladder itself — is the rung 3 vs rung 2.5 table
after it: all 19 frozen fixtures, on the code in the tree. Every row
in it is **#309's original sweep, reused as-is** — the component has not
changed since that sweep ran, so #310 added no fresh rows here (per
`docs/real-app-timing.md`, a row is only re-timed when the code it measures
changed). The single **fresh** row #310 adds is the shipped-instance row at
the top of this section (7700 ms / 0 ms, 9x9 digits 1-9, 28 givens) — a
different board from any of the 19 frozen fixtures, timed for the first time
this ticket. The tables under the rung 3 table are further history — #312's
7-board panel and #308's two passes time rung 2.5 and rung 2 against what
came before them, not the shipped code.

### Rung 3 against the vendored baseline — the headline comparison

Baseline column: the community catalog's fillomino constraint, timed log-free
(`docs/research/fillomino-baseline/`). Candidate column: rung 3, the shipped
component. **8 fixtures, 8 SHIP.**

Every number here is **reused, not re-timed**, and each names the sweep it came
from: the baseline column is #308's interim baseline sweep (the `-base.txt`
fixtures) and the rung 3 column is #309's sweep (the `-rung25.txt` fixtures).
That reuse is legitimate on three counts — the two sweeps ran on the same day
against the same app version (2026-09-03, v2026.08.14-d47fc4b); `-base`,
`-rung1` and `-rung25` for one seed are *byte-identical boards* with one
component swapped in, asserted by decoding the 9 seeds that carry a baseline
fixture (cap12 seeds 3, 10, 11, 13, 14, 16, 17, 18, 20) — the same 9 whose
`-rung1`/`-rung25` rows this table reuses; and neither
component has changed since its sweep ran, which is the condition
`docs/real-app-timing.md` puts on reusing a row.

Cold time over the eight falls from **189.4 s to 1.7 s (0.009x)**, and the
median fixture's cold row is **0.004x**. Six of the eight now read 0 ms or
100 ms — the app's own timer resolution.

| Date | App version | Board (one grid, two components) | Baseline (#308 sweep) | Rung 3 (#309 sweep) | Ratio | Row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed10) | 24500ms | 100ms | 0.004 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed10) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed11) | 24400ms | 1000ms | 0.041 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed11) after-logical | 21900ms | 700ms | 0.032 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed13) | 17800ms | 100ms | 0.006 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed13) after-logical | 800ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed14) | 24200ms | 100ms | 0.004 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed14) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed16) | 21400ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed16) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed17) | 23800ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed17) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed18) | 25500ms | 400ms | 0.016 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed18) after-logical | 23800ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed20) | 27800ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (9x9-cap12-seed20) after-logical | 0ms | 0ms | — | NO TIME |

**Eleven fixtures are untimed against the baseline at this app version** — the
same eleven #308's own table names: cap9-seed1, cap9-seed3, cap9-seed5,
cap9-seed10, cap9-seed18, cap9-seed20, cap12-seed3, cap12-seed4, cap12-seed5,
cap12-seed8 and cap12-seed9. cap12-seed3 does carry a `-base` fixture (one of
the 9 above), but its row was never taken at this app version, so it stays
on the untimed list with the other ten. The pre-bitmask code cleared all 19
against this baseline; that table is in this file's history at `8acf3d7`. Rung 3 beats
rung 2.5 on all 19 (below) and rung 2.5 traces back to rung 2, so nothing here
suggests the eleven would read differently — but they are not measured against
the baseline at this version, and this table does not claim them.

### Rung 3 against rung 2.5 — the pay-for-itself gate

Baseline column: rung 2.5 (#312). Candidate column: rung 3, cut starve behind
the dominator filter. **19 fixtures, 18 SHIP.**

Read across the set: cold time over all 19 falls from **74.0 s to 6.1 s
(0.08x)**, and the median fixture's cold row is **0.04x**. Twelve boards drop to
0 ms or 100 ms — the app's logic pass now finishes them, search and all. The
board rung 2.5 could never ship, cap12-seed14 (1.84x against rung 1, and 1.18x
even with the component bound deleted outright), goes 6700 ms to 100 ms, and
the app still reads `unique` on it.

| Date | App version | Board | Baseline | Candidate | Ratio | Row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung25.txt) | 3800ms | 100ms | 0.03 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed10-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung25.txt) | 4200ms | 1000ms | 0.24 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed11-rung25.txt) after-logical | 3800ms | 700ms | 0.18 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung25.txt) | 2600ms | 100ms | 0.04 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed13-rung25.txt) after-logical | 300ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung25.txt) | 6700ms | 100ms | 0.01 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung25.txt) | 1100ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung25.txt) | 5400ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed17-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung25.txt) | 6200ms | 400ms | 0.06 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed18-rung25.txt) after-logical | 6200ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung25.txt) | 5000ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed20-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung25.txt) | 2300ms | 100ms | 0.04 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed3-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung25.txt) | 6300ms | 100ms | 0.02 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung25.txt) | 3500ms | 300ms | 0.09 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung25.txt) after-logical | 6100ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung25.txt) | 4800ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung25.txt) | 4900ms | 100ms | 0.02 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed9-rung25.txt) after-logical | 4900ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung25.txt) | 1800ms | 500ms | 0.28 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed1-rung25.txt) after-logical | 2300ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung25.txt) | 3200ms | 1800ms | 0.56 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed10-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung25.txt) | 7100ms | 100ms | 0.01 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed18-rung25.txt) after-logical | 4400ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung25.txt) | 2400ms | 200ms | 0.08 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed20-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung25.txt) | 2600ms | 1000ms | 0.38 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung25.txt) after-logical | 4000ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) | 100ms | 100ms | 1.00 | FLOOR |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung25.txt) after-logical | 0ms | 0ms | — | NO TIME |

**cap9-seed5 is a measurement-floor row, not a failure.** Rung 2.5 already
finishes that board in 100 ms and its after-logical row is 0 ms on both sides,
so there is no time left on it to win: rung 3 reads the same 100 ms, 1.00x. It
cannot reach 0.9x for the same reason `docs/real-app-timing.md` exempts a gate
change — "unchanged is the pass" (#197). The first sweep read 200 ms there, one
tick of the app's 100 ms readout; two re-runs both read 100 ms, and the row
above is the re-run.

### Rung 2.5 against rung 1 — the #312 panel

Baseline column: rung 1 (#305). Candidate column: rung 2.5, dirty components.
The panel is the three worst rung-2 losses, the two biggest rung-2 wins, and
the two slowest boards of the original five-fixture freeze. **7 boards, 3
SHIP.**

| Date | App version | Board | Baseline | Candidate | Ratio | Row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) | 3700ms | 6800ms | 1.84 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed14-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) | 4300ms | 6100ms | 1.42 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed4-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) | 2300ms | 2500ms | 1.09 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed3-rung1.txt) after-logical | 3500ms | 3600ms | 1.03 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) | 5200ms | 100ms | 0.02 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap9-seed5-rung1.txt) after-logical | 1300ms | 0ms | 0.00 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) | 2700ms | 1100ms | 0.41 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed16-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) | 3800ms | 4400ms | 1.16 | FAIL |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed8-rung1.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) | 6200ms | 3400ms | 0.55 | PASS |
| 2026-09-03 | v2026.08.14-d47fc4b | fillomino (timing-fixture-9x9-cap12-seed5-rung1.txt) after-logical | 6400ms | 6200ms | 0.97 | FAIL |

**Every loss shrank; none flipped.** Against the same boards under rung 2
(#308's rows below), cold: cap12-seed14 2.09× → 1.84×, cap12-seed4 1.64× →
1.42×, cap9-seed3 1.35× → 1.09× and its after-logical row 1.29× → 1.03×,
cap12-seed8 1.24× → 1.16×. cap9-seed3 crosses out of a real regression and
into the band where three reps cannot separate one from noise. The wins hold
(0.02×, 0.41×, 0.55×). The SHIP count does not move: the same three ship.

**#312's target was all seven, and it is out of reach from the bound.** The
ticket's fourth optimization — a bitboard flood — was not built, because the
board that decides it was measured with the bound **removed entirely**:
cap12-seed14 still reads **1.18× cold**, over the 1.1× bar. Deleting the rule
outright does not ship that board, so no way of making the rule cheaper can.
What is left to attack is the island-indexed merge rules, which #308 measured
at 1.74–1.79× rung 1 on their own and proved cannot be dropped without going
weaker than the vendored baseline. That is a rung-3 question about their
scope, not a bound-cost question.

### The #308 tables — rung 2 as it shipped at `ac20771`

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

No rung is ever weaker than the one under it. On this example's strength fuzz
the shipped component removes 23432 candidates the vendored baseline keeps over
600 states — against rung 2's 21084 and rung 1's 7352 — and 0 that the baseline
removes and it keeps. Against rung 2 itself, over the fixpoint floor's 200
states, cut starve removes 856 candidates rung 2 settles on and gives none
back.
