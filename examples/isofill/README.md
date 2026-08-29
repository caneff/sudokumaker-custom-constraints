# ISOFILL — a worked global constraint

Divide the grid into 10 regions, each with 10 orthogonally connected cells.
Every cell in a region should contain the same digit. All of the digits 0-9
must appear in the grid.

The board is a 10×10 custom grid with digits 0–9 and **no** row, column, or box
houses. Ten regions of ten cells cover the hundred cells, and all ten digits
appear, so each digit is exactly one orthogonally connected blob of ten cells.
Rule source: Marty Sears' *Homogeneous* (Logic Masters Deutschland).

The same code serves any square board whose digit count equals its side: N
regions of N cells on an N×N board with digits 1–N (a 9×9 with 1–9), or N+1
regions of N+1 cells on an (N+1)×(N+1) board with digits 0–N (the 10×10
above). `main.js` reads the side from `puzzle.spec.size.width`; the component
reads the digit range from `helpers.digits` and throws when the cells do not
split evenly among the digits. `gen_9x9.json` / `PUZZLE_LINK_9x9.txt` is
the 9×9 instance (27 givens; sampled and stripped with `verify.py strip 7 9 1`,
the app proves it unique in 0.2 s).

Every other example in this repo is a **local** constraint: the author draws
groups and the main code builds one component per group. ISOFILL is **global**.
There are no groups. The main code takes every cell id and registers one
component over the whole grid. That is the one structural thing this example
exists to teach.

## Files

- `main.js` — the main code. No `input.groups`; it builds the hundred cell ids
  row by row with `helpers.cellIds.getIdFromCoordsSafe` and registers a single
  `IsofillComponent` over them.
- `IsofillComponent.js` — the component code. One whole-grid `update` that
  prunes by count, the seed walk, cut, tour, silent, perimeter, and budget, and a `validate` leaf check (see below).
- `soundness-harness.mjs` — Node soundness harness (see below).
- `verify.py` — uniqueness checker (OR-Tools CP-SAT). Proves a grid plus clue
  set has exactly one solution. It is slow (CP-SAT), so it is not part of
  `just check` or CI. Run it by hand with `just verify-isofill` after a
  puzzle change.
- `gen.json` — the shipped instance: the full solution grid and the list of
  clue cells (35 givens).
- `gen_44g.json` — the same grid with 44 givens: a fixture kept for
  comparing component variants (it closed long before the 35-given instance
  did: ~9.1 s with capacity, ~25.9 s without; 0 ms with cut). Not the shipped instance. The harness asserts
  the two grids stay identical.
- `gen_32g.json` — a different grid (sampled with CP-SAT, stripped in the
  app with `../_shared/app-strip.mjs`) with 32 givens; `verify.py` (CP-SAT)
  proves it unique. The hard fixture: the shipped grid is minimal
  at 35 givens and closes in 0.2 s, too fast to rank rules; this one takes
  the app ~27 s, so a rule change shows. Not the shipped instance. Now
  minimal under the current component (3.7 s; no given can go).
- `gen_30g.json`, `gen_35g_silent.json` — the **silent-digit** fixtures,
  built to attack the component where it was weakest: a digit with no given
  at all got no rule (reach, tour, cut, and the walk that limits budget all
  need a placed cell), so the app found its region by guessing. The **silent**
  deduction (below) closes that gap. Both are CP-SAT strips of one sampled
  grid (`verify.py sample 11`) that remove every given of one digit first,
  then the rest; `verify.py` proves each unique. `gen_30g.json` (digit 3
  silent, 30 givens) is the ranking fixture — it is the one of the three that
  silent speeds up outright. `gen_35g_silent.json` (digit 2 silent, 35
  givens) is the phase fixture: silent shifts the app's work from the first
  solve to the uniqueness search there rather than removing it. Numbers for
  both are the #143 rows in `## Timing` below.
- `build_link.py` — builds `PUZZLE_LINK.txt` from `gen.json`, `main.js`, and
  the component file. Run it after changing any of them:
  `uv run --with lzstring examples/isofill/build_link.py`. Flags: `--component`
  swaps in a candidate component file, `--out` writes elsewhere, `--puzzle`
  builds another instance (`gen_44g.json` for timing).
- `PUZZLE_LINK.txt` — the built SudokuMaker link. Open it to play.
- `gen_9x9.json` / `PUZZLE_LINK_9x9.txt` — the 9×9, digits 1–9 instance.
- `PUZZLE_LINK_30g.txt`, `PUZZLE_LINK_32g.txt`, `PUZZLE_LINK_35g_silent.txt`,
  `PUZZLE_LINK_44g.txt`, `PUZZLE_LINK_28g.txt`, `PUZZLE_LINK_24g.txt` — the
  hard fixtures as
  stripped links (givens only, nothing entered), built by
  `build_hard_links.py` on every `just check`. Open one to see the board the
  timing table is talking about.
- `gen_28g.json` (28 givens), `gen_24g.json` (24 givens) — the two slowest of
  a twenty-grid batch (#166): sample a random full grid with `verify.py
  sample <seed>`, strip it in the app with `app-strip.mjs` under the current
  shipped component, time the result once cold. `gen_28g.json` (seed 9) is
  the only one of the twenty that clears 10 s cold (~28-30 s); `gen_24g.json`
  (seed 21) is the runner-up (~2.6-2.8 s). See the batch table under
  `## Timing` below. `verify.py` proves both unique — CP-SAT takes 2-4
  minutes on these (measured 222 s and 162 s), well inside the 600 s default
  limit `unique()` now carries (raised from 60 s for exactly this).

## Paste into SudokuMaker

Make a custom 10×10 board with digits 0–9 (the app's default palette for a
10-wide custom board). Add a custom **global** constraint — no group input — and
paste `main.js` as the main code. Add one component segment named
`IsofillComponent` with the component file's contents. Enter the givens.

## The global pattern

```js
const cells = []
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) cells.push(helpers.cellIds.getIdFromCoordsSafe({ x, y }))
}
puzzle.addConstraintComponent(new IsofillComponent('ISOFILL', cells))
```

The constructor arguments after the name go to `setParams` and
`getAffectedCells` in order. `getAffectedCells` returns the same cell list, so
the solver re-runs `update` when any cell changes. That is the right trigger for
a rule that counts across the whole grid. The list is built by coordinates, not
from `getAllCellIds()`, because the component finds neighbours by index
arithmetic and so needs row-major order.

## What the component deduces

`update` runs seven sound deductions per digit and one across digits. Ten
regions of ten cells, one digit each, means every digit fills exactly ten
cells:

- **Cap** — once a digit occupies ten cells, remove it from every other cell's
  candidates.
- **Force** — when a digit has exactly ten cells that can still hold it, place
  it in all ten.
- **Seed walk** — one 0-1 breadth-first search per placed digit, from its
  lowest-index placed cell (the *seed*). A cell already holding the digit costs
  nothing to enter; an open cell that still allows the digit costs one step;
  the budget is `10 − placed`, the open cells the region has left. A cell the
  walk never meets loses the candidate. Sound because the region is connected
  and holds the seed, so a path inside the region from the seed to any region
  cell crosses at most `10 − placed` open cells. Three readings of one walk:
  cells outside it lose the digit; a walk of fewer than ten cells cannot hold a
  ten-cell region; and a placed cell the walk never meets cannot join the
  region. The last two are dead branches, and the component empties a placed
  cell of that digit so the solver drops the branch. Charging only open cells,
  and starting from one cell rather than the whole placed set, makes this walk
  a strict subset of the older reach walk it replaced — the harness asserts the
  subset on every fuzz state — so cut, tour, and budget all read a smaller cell
  set. Cell neighbours come from index arithmetic on the row-major list.
- **Cut** — for each open cell the walk met, drop it and walk again. If the
  walk now holds fewer than ten cells, or a placed cell falls out of it, the
  region cannot exist without that cell, so it must hold the digit. Sound by
  the same argument as the seed walk, applied to the grid minus one cell.
  Not free: one or two extra walks per open cell in the digit's walk — but
  it is the rule that lets the app close the shipped instance (below).
  Each of those walks stops as soon as it has its answer — ten cells, or
  every placed cell seen — and a dead-end cell (one allowed neighbour) skips
  the walks: removing it removes only itself. Same rule, and the app's time
  on the 32-given fixture fell 15.3 s → 5.7 s. Scratch buffers (allowed and
  walk masks per digit, BFS frontiers, distance rows) live on the instance
  and are reused per call, so `update` allocates almost nothing: 5.7 s → 4.1 s.
  The `DigitSet` handed to `removeCandidatesFromCell` is the one thing built
  fresh per yield — the app wants a real `DigitSet`, and the harness mock now
  throws on anything else.
- **Tour** — the region is a connected set holding every placed cell and
  the candidate cell, so a walk round its spanning tree is a closed tour
  through all of them: the region has at least 1 + half the perimeter of
  any three of those points (BFS distances through allowed cells). Tighter
  than the depth bound when the placed cells are spread: two placed cells
  nine apart leave only the cells between them, not everything within eight
  steps of either. Cells the bound rejects leave the walk before cut and
  budget read it. Costs one BFS per placed cell. Three points, not four:
  the four-point version (min of the three 4-cycle orders) read 35.6 s on
  the 32-given fixture, against 15.3 s for triples — the loop over triples
  of placed cells per open cell cost more than it pruned.
- **Silent** — a digit with no placed cell at all. Every walk above starts
  from a placed cell, so none of them fires; the digit was the component's
  blind spot (the two silent-digit fixtures above were built to show it).
  The region is still ten connected cells, all of which allow the digit, so
  it lies inside a single orthogonally connected component of the cells that
  allow the digit. Split those cells into components: every component under
  ten cells loses the digit, and if no component reaches ten the branch is
  dead (the component empties a cell). Sound because the region is connected
  and the cells that allow the digit over-approximate it. The surviving
  components also become the digit's walk for budget below, so the matching
  prune sees the restriction too. One flood fill per silent digit, over
  cells the digit already allows.
- **Perimeter** — the only rule that reads the border as a cycle. Two
  disjoint orthogonally connected regions cannot interleave round it: no four
  border cells read `a, b, a, b` in cyclic order. Region `a` holds a path
  joining its two cells and region `b` one joining its own; extend each path's
  ends to the grid edge inside their own cells and the two curves have
  interleaved ends on the rectangle's boundary, so they cross — and two
  axis-aligned centre-to-centre paths cross only at a cell centre, which
  disjoint regions cannot share. Two deductions follow. *Split arc*: a digit
  whose placed border cells fall into two arcs with one other digit placed in
  each is that forbidden `a, b, a, b`, so the branch is dead (the component
  empties a cell). *Flank*: an open border cell whose nearest placed border
  cells in both directions hold digit `a` loses every digit `b` placed
  somewhere else on the border, because `b` there would read `a, b, a, b`. A
  digit placed only in the *interior* gives no such witness and is left alone,
  and interior cells are never touched. This is ISS's `ConnectedBorder`
  (`connected_values.md` §5.3), which handles two sets; ISOFILL's regions
  partition the grid, so the rule runs per digit pair instead of on one
  transition count. One lap of the 36 border cells for the flank pass, and one
  lap per digit that holds two or more border cells for the split-arc pass.
- **Budget** — the one rule that looks across digits. Every open cell needs
  a digit, and digit `d` can take at most `10 − placed` more cells, only
  cells inside its walk. Build the flow network source → digit (capacity
  `10 − placed`) → open cell (capacity 1, if the cell is in the digit's
  walk) → sink; if the max flow covers fewer than all open cells, no
  assignment exists and the branch is dead (the component empties a cell).
  Sound because the walk over-approximates the region. It catches what the
  per-digit rules cannot: a wrong region for one digit that starves the
  others. Done as a bipartite matching (Kuhn's augmenting path per open
  cell, digits with `10 − placed` slots), a few lines and cheap per call.
  Open cells and slots count the same, so a full matching is perfect, and
  the component then prunes on it (Régin): an unmatched cell–digit pair
  lies in some other perfect matching only if cell and digit share a
  strongly connected component of the residual graph; any other pair loses
  the candidate. One Tarjan pass over ~110 nodes per call.

`validate` is the exact leaf check: on a full grid, each digit must be one
connected blob of ten. The solver may not call it (`../../docs/gotchas.md`,
gotcha 2); the deductions above do the work, `validate` states the rule.

All of it reads each cell's candidates as a `DigitSet` (wrap it in
`Array.from`; build one back with `SudokuDigitSet.from`). `update` reads the
grid **once** per call and builds every digit's placed, open, and allowed
sets from that one scan. It runs on every search node, so a scan per digit
(ten reads of each cell) cost real time: the one-pass scan halved the app's
verdict on the 44-given fixture (5.7 s vs 11.2 s, same session). The rules
are the same (cut came later, on the same snapshot); what changes is that every digit sees the grid as it was
at the start of the call, not the removals earlier digits yielded in the
same call. That is sound (fuzz clean) and never weaker at the fixpoint: on
a 5,000-state differential against the per-digit scan it was equal on 4,816
and strictly tighter on 184, looser on none.
The harness asserts the read count.

Reach is required, not a timing-gated stretch: without it the app never
reaches a verdict. Capacity earned its place by timing: on the 44-given
fixture it cut the app's verdict from ~25.9 s to ~9.1 s. Cut is the rule
that closes the shipped instance: with cap, force, reach, and capacity alone
the app reached no verdict at 35 givens (nor at 36, 37, or 39; 40 closed in
~35–41 s, 41 in 12 s); with cut it reads "unique" in 0.2 s, and the 41- and
44-given fixtures in 0 ms. Budget pays on the stripped 32-given fixture
(27.6 s → 24.8 s); its matching prune 24.9 s → 23.4 s; the tour bound on top
24.9 s → 15.3 s; early-stopping cut walks 15.3 s → 5.7 s; reused scratch buffers 5.7 s → **4.1 s** (2026-08-27, 3/3) and, the reason it was written, on the shipped puzzle with a
player's correct two-candidate pencil marks, which steer the app's search
into a bad branch: 12.4 s → 7.2 s. That marks run is evidence of robustness,
not a timing (a run with marks present is never a timing,
`CODING_STANDARDS.md`). The walk itself
builds neighbour lists once in `setParams` and uses a stamped visit mask on
the instance in place of a `Set` (no allocation per walk): same rules, 40.4 s → 27.6 s on the 32-given fixture, because `update`
runs on every search node and its own cost was most of the solve time. See
the next section and `../../docs/real-app-timing.md`.

## What the app checks

The shipped link stores the full solution as entered values (35 black givens,
65 blue entries). Strip it before you time or play it:
`uv run --with lzstring examples/_shared/probe_link.py strip examples/isofill/PUZZLE_LINK.txt /tmp/iso.txt`.

On the stripped grid the app's "Find all solutions" reads **"This is a unique
solution" in 0.2 s** (live app v2026.08.14-d47fc4b, 2026-08-27, `app-solve.mjs`,
3/3 reps, non-deterministic solve off). It did not get there in one step:

- The count-floor-only component returned "Found 10,000 solutions" in 0.3 s.
- Reach, then reach plus capacity, turned that fast wrong answer into no
  answer: the app stopped at its own time limit (about a minute). A clue
  ladder on the same grid showed 36, 37, and 39 givens time out too; 40
  closes in ~35–41 s, 41 in 12 s, 44 in ~9.1 s (5.7 s with the one-pass scan).
- Cut closes it at 35 givens in 0.2 s; the 41- and 44-given fixtures read
  0 ms.

An earlier "unique in 2 s" figure was measured with 36 solution values still
entered in the outer ring and was wrong.

The kept deductions are cap, force, the seed walk, cut, tour,
silent, perimeter, and budget with its matching prune.
*Homeless* — an earlier, weaker form of silent that pruned only when exactly
one component of ten or more cells survived — was tried and removed: sound,
but no verdict change and no time change (#91; the commit stays in git
history). Silent (#142) is the same idea, stronger in two ways: it prunes
every component under ten cells even when several larger ones remain, and it
hands the survivors to budget as the digit's walk. Cut, tour, and budget did
not exist when homeless was measured, and the silent-digit fixtures did not
either. #143 timed silent on them and kept it, on one board of the three:
`gen_30g` 6.6 s → 5.0 s, ratio 0.76, inside the 0.9× bar, with `gen_32g`
flat at 3.7 s either way. `gen_35g_silent` is a wash at 0.94 — silent finds
the first solution there almost at once and pays the time back proving
uniqueness — so the ranking fixture is what the verdict rests on. `verify.py`
stays the independent proof that the puzzle is unique: it models the rule from
scratch (flow-based connectivity) and does not depend on the app.

*Crossing* — two regions cannot sit on the two diagonals of one 2×2 block,
because their paths would have to cross and the crossing cell would belong to
both (`ConnectedCrossing` in Interactive Sudoku Solver) — was tried and
removed (#148): sound, and it fires, but no board got faster and two got
slower, because the walk rules already refute nearly every checkerboard. The
numbers are the #148 rows in `## Timing` below; the rule and its two
directed tests are in git history.

*Perimeter* — kept (#149). It is the third rule tried from ISS's connectivity
handler and the first that pays. Where crossing and the blob gate only saw
what `reach` and `cut` already see, this one fires on border cells the walk
rules cannot decide, because a region can still route around the obstruction
inside the grid: over the harness fuzz set, 4,037 of 10,000 states end at a
strictly tighter fixpoint with the rule than without it. In the app it fired
on 30% of `gen_32g`'s update calls and 43% of `gen_35g_silent`'s, against
crossing's 0.7%. The timing follows the firing: `gen_35g_silent`
48.8 s → 34.9 s, ratio **0.72**, well past the 0.9× bar and far outside that
board's spread, and two more interleaved pairs read 0.76 and 0.73; `gen_30g` flat to slightly better; `gen_32g` flat on
medians (4.0 s either way over seven interleaved baseline/candidate rounds),
though five of those seven rounds leaned 5–13% slow, so read it as a wash the
rule pays for many times over on the hard board. The numbers are the #149 rows
in `## Timing` below and the #149 commit body.

*The blob gate on cut* — the cut rule walks twice per open cell, once to ask
whether removing the cell starves the region below ten and once to ask whether
it strands a placed cell. Count the digit's placed blobs (the connected
components of its placed cells, walking only through placed cells) and the
second walk is pointless when there is one blob: the path joining two placed
cells runs through placed cells, and an open cell lies on no such path. This is
ISS's gate on door forcing (`connected_values.md` §4.4) — read the predicate off
the walk you were doing anyway. It was tried and removed (#150): exact, and it
skips a third of the strand walks, but the three hard fixtures came back at
0.96×, 1.00× and 0.98×, and only the first of those is bigger than the board's
own run-to-run spread. Four percent on one board of three is well short of the
0.9× bar a change has to clear. The numbers are the #150 rows in
`## Timing` below; the gate and its differential test are in git
history.

## Run the tests

Soundness (needs Node):

```
node examples/isofill/soundness-harness.mjs
# -> isofill rows fixture: 2000 tests, 0 violations
# -> isofill bent fixture: 2000 tests, 0 violations
# -> isofill shipped fixture: 2000 tests, 0 violations
# -> isofill hard fixture: 2000 tests, 0 violations
# -> isofill silent35 fixture: 2000 tests, 0 violations
# (FUZZ=20000 node ... for the deep run, ~2 min)
# -> validate: true
# -> cap fired: true | force fired: true | reach fired: true | split fired: true | split at cap: true | capacity fired: true | cut fired: true | tour fired: true | budget fired: true | budget prune fired: true | silent fired: true | silent dead fired: true | one pass: true (100 reads)
# -> PASS
```

The harness mocks only the puzzle methods the component calls, seeds random
partial fills of five valid ISOFILL solutions (one with row *r* holding digit
*r*, one with bent L-shaped regions so reach walks around corners, the shipped
grid from `gen.json`, the hard grid from `gen_32g.json`, and the grid of
`gen_35g_silent.json` — that last one seeded so digit 2 is never pinned, so
it is silent in every state and the silent deduction runs on it every time) in
which every cell still allows its true value, runs `update` to a fixpoint, and asserts every true value survived. It
also builds one state for each deduction — cap, force, reach, split, split
with all ten cells placed, capacity, cut, tour, budget, budget prune, silent,
silent on a dead board — and checks each fired, checks `update`
reads each cell's candidates at most once per call,
and checks `validate` accepts a full valid grid and rejects a count-valid but
split one.

Uniqueness (needs Python; `uv` fetches OR-Tools):

```
uv run --with ortools examples/isofill/verify.py                              # self-check
uv run --with ortools examples/isofill/verify.py examples/isofill/gen.json     # -> unique
uv run --with ortools examples/isofill/verify.py examples/isofill/gen_44g.json # -> unique
```

`verify.py` models the rule as exact counts (ten cells per digit) plus a
single-commodity flow per digit for connectivity: one root cell sends nine
units, every other cell of that digit absorbs one, and flow moves only between
orthogonal neighbours that both hold the digit. A cut-off cell starves, so a
split region is infeasible. Uniqueness is one no-good cut: solve, forbid that
grid, and require `INFEASIBLE`. A solver timeout raises — it is never reported
as unique. The self-check covers a unique clue set, an ambiguous one, a
count-valid but disconnected one, and the timeout path.

The model and the component state the same rule in two places that cannot
share code. Change the rule, and change both in the same diff.

## Authoring a puzzle

There is no generator. Write a full solution grid into `gen.json`, list the
clue cells, and run `verify.py` on it. It must print `unique`. To carve clues,
remove one at a time and re-run; keep any whose removal makes the puzzle
ambiguous. `just check` re-verifies the shipped instance on every run.

## Timing

### Twenty-grid strip batch (#166, 2026-08-28)

Twenty fresh grids, sampled and stripped once each to find boards the app
struggles with, so a future rule change has something to show a real time
difference on. Seeds 1, 7, and 11-20 were already spent by earlier work
(1 -> `gen_32g.json`, 7 -> `gen_9x9.json`, 11-20 explored and discarded as
too fast — commit 72d76c9), so this batch used the next twenty unused seeds:
2-6, 8-10, 21-32. Each grid: `verify.py sample <seed>` for a full 100-given
grid, `app-strip.mjs` to greedily strip it under the current shipped
component (a live-app uniqueness oracle, not CP-SAT), then one cold
`app-solve.mjs` rep on the stripped link. Batch is run once; this table is
the record so it is never re-run.

| seed | givens after strip | cold (1 rep) |
| --- | --- | --- |
| 2 | 32 | 200 ms |
| 3 | 29 | 100 ms |
| 4 | 31 | 200 ms |
| 5 | 32 | 600 ms |
| 6 | 32 | 1800 ms |
| 8 | 13 | 100 ms |
| 9 | 28 | **29600 ms** |
| 10 | 24 | 600 ms |
| 21 | 24 | 2800 ms |
| 22 | 31 | 200 ms |
| 23 | 29 | 400 ms |
| 24 | 33 | 1600 ms |
| 25 | 30 | 100 ms |
| 26 | 29 | 800 ms |
| 27 | 34 | 300 ms |
| 28 | 33 | 400 ms |
| 29 | 33 | 2000 ms |
| 30 | 32 | 100 ms |
| 31 | 38 | 0 ms |
| 32 | 29 | 200 ms |

Only seed 9 clears 10 s cold. The two slowest — seed 9 (29.6 s, 28 givens)
and seed 21 (2.8 s, 24 givens) — ship as `gen_28g.json` and `gen_24g.json`
(the layout convention's given-count naming, in place of the issue's literal
`puzzle-hard-*.json` — see the note in the PR body). Rebuilding their links
and re-timing them cold reads 27.8 s and 2.6 s respectively (`app-solve.mjs`,
live app v2026.08.14-d47fc4b, 2026-08-28) — the same order of magnitude, the
spread `docs/real-app-timing.md` warns is normal run to run. `verify.py`
proves both unique (222 s and 162 s of CP-SAT search, comfortably inside the
600 s default `unique()` now carries).

Seed 31 (38 givens, 0 ms cold) reads like `gen_44g.json` below: at that many
givens the finder never has to search, so it's not evidence of a fast read
error, just a board too easy to be a timing fixture.

Neither new fixture is harder than what the example already ships:
`gen_28g.json`'s ~28-30 s sits below `gen_35g_silent.json`'s 33.3 s, and
`gen_24g.json`'s ~2.6-2.8 s sits between `gen.json`'s 1.2 s and `gen_30g.json`'s
4.9 s. A random twenty-grid sample found nothing beyond the existing hardest
fixture; a grid built to attack a specific weak spot (as `gen_30g.json` and
`gen_35g_silent.json` were, for the silent digit) is the way to go harder —
that's the later, hand-shaped-grid ticket the issue calls out, not this one.

### Two-row baselines, every fixture (2026-08-28)

Each fixture gets a **cold** row (from the stripped board) and an
**after-logical** row (from the state the app's own logical solver reaches).
No code changed here, so every row is a BASELINE.

| 2026-08-28 | v2026.08.14-d47fc4b | isofill | 1200ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill after-logical | 0ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_30g | 4900ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_30g after-logical | 200ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_32g | 4100ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_32g after-logical | 0ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_35g_silent | 33300ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_35g_silent after-logical | 0ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_44g | 0ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_44g after-logical | 0ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_9x9 | 200ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_9x9 after-logical | 0ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_28g | 26800ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_28g after-logical | 0ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_24g | 2400ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | isofill gen_24g after-logical | 0ms | — | — | BASELINE |

`gen_28g` and `gen_24g` (#166) join this table with their own two rows —
3 reps, non-deterministic solve off, same as the rest — rather than getting
a separate one-rep table of their own; the batch table above records the
single exploratory reading that picked them out of twenty candidates.

**The after-logical row is 0 ms on seven of the eight fixtures.** The app's
logical solver, with its full technique set, finishes those boards outright,
so nothing is left to search. Only `gen_30g` leaves work behind (200 ms),
and `gen_44g` reads 0 ms cold too — with 44 givens the finder never has to
search — so it is not a timing fixture in either mode.

A 0 ms row is not a free pass. It places no constraint only while the
candidate also reads 0 ms; a candidate that turns one of these boards back
into a search scores an infinite ratio and sinks the change. That is the
regression the after-logical row exists to catch on ISOFILL, since the cold
row is the one that carries the speed-up.

`gen_35g_silent`'s cold row reads 33.3 s here against the 48.8 s recorded
on 2026-08-27 (below) — the same board and the same app build, a different
machine. Read ratios, not milliseconds (`docs/real-app-timing.md`).

Both rows per fixture were hand-run, because `build_link.py` took no
`--board` at the time and `just time isofill` therefore reached only the
default board. The commands are the strip-then-`app-solve.mjs` pair in
`docs/real-app-timing.md` § Reproduce, once per fixture link. #168 added
`--board` to this example's `build_link.py`, so the rows below come straight
from `just time isofill --board <link>`.

### Seed walk replaces reach, capacity and the split walk (#168, 2026-08-29)

Every fixture, `just time isofill [--board <link>]`, 3 reps, non-deterministic
solve off. Baseline is the committed component; candidate is the seed walk.

| date | app | board | baseline | candidate | ratio | row |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill | 1100ms | 700ms | 0.64 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill after-logical | 0ms | 0ms | — | NO TIME |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_24g.txt) | 2400ms | 1600ms | 0.67 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_24g.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_28g.txt) | 25600ms | 3400ms | 0.13 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_28g.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_30g.txt) | 4500ms | 900ms | 0.20 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_30g.txt) after-logical | 200ms | 0ms | 0.00 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_32g.txt) | 3400ms | 300ms | 0.09 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_32g.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_35g_silent.txt) | 32300ms | 2400ms | 0.07 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_35g_silent.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_44g.txt) | 0ms | 0ms | — | NO TIME |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_44g.txt) after-logical | 0ms | 0ms | — | NO TIME |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_9x9.txt) | 200ms | 100ms | 0.50 | PASS |
| 2026-08-29 | v2026.08.14-d47fc4b | isofill (PUZZLE_LINK_9x9.txt) after-logical | 0ms | 0ms | — | NO TIME |

**Verdict: SHIP, on seven of the eight fixtures; `gen_44g` reads NO TIME.**
Every cold row clears the 0.9x bar and none of them clears it narrowly: the
worst is 0.67x and four are at or under 0.2x. `gen_28g` drops from 25.6 s to
3.4 s and `gen_35g_silent` from 32.3 s to 2.4 s, so the two boards the twenty-grid
batch was run to find are no longer the slow ones.

The after-logical rows read 0 ms on both sides everywhere but `gen_30g`, so
they place no constraint (`docs/real-app-timing.md`); `gen_30g`'s goes 200 ms
to 0 ms, which is the regression check passing, not a speed-up worth a
figure. `gen_44g` reads 0 ms on both rows on both sides, which is the whole
fixture placing no constraint -- with 44 givens the finder never searches.

The walk does the same amount of work per call as the one it replaced -- one
BFS per placed digit -- so the whole gain is the smaller cell set that cut,
tour and budget then read.

### Earlier rows (2026-08-27, #143 / #148 / #150, cold only)

| 2026-08-27 | v2026.08.14-d47fc4b | isofill gen_30g (#143 silent) | 6.6 s | 5.0 s | 0.76 | KEPT; clears the 0.9× bar |
| 2026-08-27 | v2026.08.14-d47fc4b | isofill gen_35g_silent (#143 silent) | 48.6 s | 45.6 s | 0.94 | wash; first solve 36.2 s→0.4 s, uniqueness search 12.4 s→45.2 s |
| 2026-08-27 | v2026.08.14-d47fc4b | isofill gen_32g (#143 silent) | 3.6 s | 3.7 s | 1.03 | flat; second pair 3.7 s→3.7 s |
| 2026-08-27 | — | isofill gen_30g (#148 crossing) | 5.2 s | 5.2 s | 1.00 | wash |
| 2026-08-27 | — | isofill gen_32g (#148 crossing) | 3.7 s | 3.9 s | 1.05 | REMOVED; regression |
| 2026-08-27 | — | isofill gen_35g_silent (#148 crossing) | 46.6 s | 47.4 s | 1.02 | REMOVED; regression |
| 2026-08-27 | — | isofill gen_30g (#150 blob gate) | 5.2 s | 5.0 s | 0.96 | effect, repeatable, still short of the 0.9× bar |
| 2026-08-27 | — | isofill gen_32g (#150 blob gate) | 3.7 s | 3.7 s | 1.00 | wash |
| 2026-08-27 | — | isofill gen_35g_silent (#150 blob gate) | 46.5 s | 45.6 s | 0.98 | wash |

These predate the two-row rule, so they carry a cold row only. App version
is not stated in the #148/#150 commit bodies ("recorded app offline"), so
those cells read `—` rather than reusing the `v2026.08.14-d47fc4b` figure
from the #143 and #149 rows.

### Earlier rows (2026-08-27, cold only)

| 2026-08-27 | v2026.08.14-d47fc4b | isofill | 1500ms | — | — | BASELINE |
| 2026-08-27 | v2026.08.14-d47fc4b | isofill gen_35g_silent (#149 perimeter) | 48.8 s | 34.9 s | 0.72 | KEPT; pairs 0.72/0.76/0.73 |
| 2026-08-27 | v2026.08.14-d47fc4b | isofill gen_30g (#149 perimeter) | 5.0 s | 4.8 s | 0.96 | wash |
| 2026-08-27 | v2026.08.14-d47fc4b | isofill gen_32g (#149 perimeter) | 4.0 s | 4.0 s | 1.00 | median of 7 interleaved rounds; 5 leaned 5–13% slow |

These predate the two-row rule, so they carry a cold row only.

`just time isofill` (candidate byte-equal to baseline, so only BASELINE rows
print). See `docs/real-app-timing.md` for the protocol.

The three #149 rows are hand-run, because `build_link.py` takes no `--board`
and `just time` therefore cannot reach the hard fixtures. Baseline and
candidate links were built from the component at `17b4344` and from this
branch, each stripped to its givens and timed 3 reps with `app-solve.mjs`
against the recorded app. Only `gen_35g_silent` clears the 0.9x bar, and it
is the board the verdict rests on: three separate interleaved
baseline/candidate pairs read 0.72, 0.76 and 0.73, a 14 s gap against a
baseline that spread 4.9 s. `gen_32g`'s row is the median of seven
interleaved rounds (baseline 3.7/4.2/3.8/4.3/4.0/4.3/3.7 s, candidate
4.0/4.4/4.3/4.0/4.4/4.0/4.0 s). The rounds were interleaved because a straight
A-then-B pass drifted: one later baseline block on `gen_32g` read 5.0 s
against an earlier 3.6 s on identical code.
