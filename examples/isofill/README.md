# ISOFILL — a worked global constraint

Divide the grid into 10 regions, each with 10 orthogonally connected cells.
Every cell in a region should contain the same digit. All of the digits 0-9
must appear in the grid.

The board is a 10×10 custom grid with digits 0–9 and **no** row, column, or box
houses. Ten regions of ten cells cover the hundred cells, and all ten digits
appear, so each digit is exactly one orthogonally connected blob of ten cells.
Rule source: Marty Sears' *Homogeneous* (Logic Masters Deutschland).

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
  prunes by count, reach, capacity, cut, tour, and budget, and a `validate` leaf check (see below).
- `soundness-harness.mjs` — Node soundness harness (see below).
- `verify.py` — uniqueness checker (OR-Tools CP-SAT). Proves a grid plus clue
  set has exactly one solution.
- `puzzle.json` — the shipped instance: the full solution grid and the list of
  clue cells (35 givens).
- `puzzle-44.json` — the same grid with 44 givens: a fixture kept for
  comparing component variants (it closed long before the 35-given instance
  did: ~9.1 s with capacity, ~25.9 s without; 0 ms with cut). Not the shipped instance. The harness asserts
  the two grids stay identical.
- `puzzle-32.json` — a different grid (sampled with CP-SAT, stripped in the
  app with `../_shared/app-strip.mjs`) with 32 givens; `verify.py` (CP-SAT)
  proves it unique. The hard fixture: the shipped grid is minimal
  at 35 givens and closes in 0.2 s, too fast to rank rules; this one takes
  the app ~27 s, so a rule change shows. Not the shipped instance. Now
  minimal under the current component (4.1 s; no given can go).
- `puzzle-30.json`, `puzzle-35-silent.json` — the **silent-digit** fixtures,
  built to attack the component where it is weakest: a digit with no given
  at all gets no rule (reach, tour, cut, and the walk that limits budget all
  need a placed cell), so the app finds its region by guessing. Both are
  CP-SAT strips of one sampled grid (`verify.py sample 11`) that remove every
  given of one digit first, then the rest; `verify.py` proves each unique.
  `puzzle-30.json` (digit 3 silent, 30 givens) reads unique in **6.7 s** —
  the ranking fixture. `puzzle-35-silent.json` (digit 2 silent, 35 givens)
  gets **no verdict** inside the app's minute; give it one cell of digit 2
  back and it closes in 0.1 s. That is the gap to close next: a deduction
  for a digit with zero placed cells.
- `build_link.py` — builds `PUZZLE_LINK.txt` from `puzzle.json`, `main.js`, and
  the component file. Run it after changing any of them:
  `uv run --with lzstring examples/isofill/build_link.py`. Flags: `--component`
  swaps in a candidate component file, `--out` writes elsewhere, `--puzzle`
  builds another instance (`puzzle-44.json` for timing).
- `PUZZLE_LINK.txt` — the built SudokuMaker link. Open it to play.
- `PUZZLE_LINK-30.txt`, `PUZZLE_LINK-32.txt`, `PUZZLE_LINK-35-silent.txt`,
  `PUZZLE_LINK-44.txt` — the hard fixtures as
  stripped links (givens only, nothing entered), built by
  `build_hard_links.py` on every `just check`. Open one to see the board the
  timing table is talking about.

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

`update` runs six sound deductions per digit and one across digits. Ten
regions of ten cells, one digit each, means every digit fills exactly ten
cells:

- **Cap** — once a digit occupies ten cells, remove it from every other cell's
  candidates.
- **Force** — when a digit has exactly ten cells that can still hold it, place
  it in all ten.
- **Reach** — walk outward from the digit's placed cells, stepping only into
  orthogonal neighbours that still allow the digit, at most `10 − placed`
  steps. A cell the walk never meets loses the candidate. Sound because a
  ten-cell region with `k` placed cells has at most `10 − k` open cells, so
  every region cell is within that many steps of a placed one. When two placed
  cells of one digit cannot join within nine steps the region is split; the
  component empties the stranded cell's candidates so the solver sees the dead
  branch. Cell neighbours come from index arithmetic on the row-major list.
- **Capacity** — the same walk, read the other way: every cell of the region
  lies inside it, so if the walk meets fewer than ten cells the region can
  never reach ten. The component empties a placed cell of that digit, as for a
  split, and the solver drops the branch. Free — the walk is already computed.
- **Cut** — for each open cell the walk met, drop it and walk again. If the
  walk now holds fewer than ten cells, or a placed cell falls out of it, the
  region cannot exist without that cell, so it must hold the digit. Sound by
  the same argument as reach and capacity, applied to the grid minus one cell.
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

The kept deductions are cap, force, reach (with split), capacity, cut, tour,
and budget with its matching prune.
*Homeless* (a digit with no placed cell must still have a connected ten-cell
home) was tried and removed: sound, but no verdict change and no time change
(#91; the commit stays in git history). `verify.py` stays the independent
proof that the puzzle is unique: it models the rule from scratch (flow-based
connectivity) and does not depend on the app.

## Run the tests

Soundness (needs Node):

```
node examples/isofill/soundness-harness.mjs
# -> isofill rows fixture: 2000 tests, 0 violations
# -> isofill bent fixture: 2000 tests, 0 violations
# -> isofill shipped fixture: 2000 tests, 0 violations
# (FUZZ=20000 node ... for the deep run, ~2 min)
# -> validate: true
# -> cap fired: true | force fired: true | reach fired: true | split fired: true | split at cap: true | capacity fired: true | cut fired: true | tour fired: true | budget fired: true | budget prune fired: true | one pass: true (100 reads)
# -> PASS
```

The harness mocks only the puzzle methods the component calls, seeds random
partial fills of three valid ISOFILL solutions (one with row *r* holding digit
*r*, one with bent L-shaped regions so reach walks around corners, and the
shipped grid from `puzzle.json`) in which every cell still allows its true
value, runs `update` to a fixpoint, and asserts every true value survived. It
also builds one state for each deduction — cap, force, reach, split, split
with all ten cells placed, capacity, cut, tour, budget, budget prune — and
checks each fired, checks `update`
reads each cell's candidates at most once per call,
and checks `validate` accepts a full valid grid and rejects a count-valid but
split one.

Uniqueness (needs Python; `uv` fetches OR-Tools):

```
uv run --with ortools examples/isofill/verify.py                                # self-check
uv run --with ortools examples/isofill/verify.py examples/isofill/puzzle.json   # -> unique
uv run --with ortools examples/isofill/verify.py examples/isofill/puzzle-44.json # -> unique
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

There is no generator. Write a full solution grid into `puzzle.json`, list the
clue cells, and run `verify.py` on it. It must print `unique`. To carve clues,
remove one at a time and re-run; keep any whose removal makes the puzzle
ambiguous. `just check` re-verifies the shipped instance on every run.
