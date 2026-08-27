# Per-call cost patterns (from ISS)

`enforceConsistency` — ISS's `update` — runs on every propagation pass, so its
cost is paid millions of times per solve. Source: ISS
`js/solver/handlers.js`, `class Skyscraper` at :1241, `class
HiddenSkyscraper` at :1439 (`~/src/iss-stuff/Interactive-Sudoku-Solver`), and
`js/solver/SOLVER_ENGINE.md` "Writing `enforceConsistency`" (:219-237). Each
item is a pattern to copy into a SudokuMaker `update`. A pattern still has to
pay for itself in real-app solve time (`CODING_STANDARDS.md`,
`docs/real-app-timing.md`) — this is a menu, not a mandate.

## Data layout: bitmasks in a typed array, not Sets of keys

- `forwardStates[i][vis]` is one `Uint16Array` slot per `(cell, visible
  count)`, a bitmask of possible running-max heights (handlers.js:1304-1306,
  1313). No object/key churn per state — a Set of `(count, max)` keys forces
  an allocation and a hash per entry, every call.

## One scratch buffer, zero allocation in the hot loop

- `_baseBuffer` is a single `static Uint16Array`, sized once for the largest
  board; `subarray` views (`_makeStateArrays`) are carved from it once, in
  `initialize`, not per call (handlers.js:1273-1274, 1281-1291).
- `this._allStates.fill(0)` clears the whole buffer in one call at the top of
  `enforceConsistency` — the only per-call write to the whole layer
  (handlers.js:1301). SOLVER_ENGINE.md :224-227: no arrays/objects/closures
  inside the hot loop, ever.

## Bit idioms

- `-(x & -x) << 1` — strictly-above-minimum mask: isolate the lowest set bit
  and shift past it (handlers.js:1323, 1345).
- `(1 << (maxS - 1)) - 1` — strictly-below-maximum mask, from
  `LookupTables.maxValue` (handlers.js:1396).
- Zero propagates without a branch: an empty state's derived mask is also
  empty, so no state needs an `if (state === 0)` guard before deriving from it
  (handlers.js:1343-1344, 1408).
- Narrow-and-detect conflict in one step: `if (!(grid[cell] &= mask)) return
  false` (handlers.js:1361, 1426, 1431; also SOLVER_ENGINE.md :230-233).

## Forward pass + backward pass, one valueMask union per cell

- Forward pass computes every reachable state per cell
  (handlers.js:1316-1357). Backward pass starts from the terminal state and
  walks back, OR-ing every state that can still complete into one
  `valueMask` per cell, applied as a single removal
  (handlers.js:1373-1427). Two passes, one write per cell — not a removal per
  candidate per pass.

## Terminal condition as one precomputed mask

- `_terminalMask` is computed once in `initialize` from `numCells` and
  `numValues`, then AND-ed against the last forward state per call
  (handlers.js:1266, 1367-1368) — no per-call recomputation of what "done"
  looks like.

## Early exit at a fixed dominating cell

- Once a cell reads the max value, the forward pass stops there — nothing
  past it can also be the max, so those cells drop the max bit directly and
  the DP does not run over them (handlers.js:1351-1361).

## One-time deductions at setup, not per call

- `HiddenSkyscraper.initialize` removes the target value from the first cell
  once, before any `enforceConsistency` call — it can never be the first
  hidden value (handlers.js:1450). ISS's one-time hook is `initialize`;
  SudokuMaker's equivalent is `setParams`, called once per instance, not per
  propagation.

## Split handlers per direction vs. one joint component

- ISS's `Skyscraper` takes a single `(cells, numVisible)` — one direction.
  Both ends of a line means two instances sharing the same cells, coupled
  only by writing the same grid (handlers.js:1242-1244).
- SudokuMaker's `SkyscraperLineComponent.js` reads both clues in one
  component instead: the peak join needs both clue candidate sets in the same
  pass, to pair a left-side digit subset with its complement on the right
  (`examples/skyscraper/SkyscraperLineComponent.js`, module docstring and
  `prune`). This joint shape won at 9x9 (#124).
- When each wins: split when each direction's deduction is useful alone and
  coupling adds little. Joint when the deduction only gets strong by sharing
  state across the coupled sides, as here.

## Our DP state departs from ISS's layout

- ISS keys a layer by `(cell index, visible count)` → mask of running maxima
  (handlers.js:1304-1306) — a position-keyed DP.
- Ours keys a layer by `(subset of sub-peak digits used, visible count)` →
  mask of counts (`SkyscraperLineComponent.js`, module docstring: "The DP
  state is (subset of sub-peak digits used, visible count)"). The subset
  encodes both the prefix length (popcount) and the running max (its highest
  bit) and gives exactness via distinctness — a prefix and suffix partition
  the sub-peak digits exactly, so the peak join pairs a left subset with its
  exact complement on the right instead of matching on count alone
  (`SkyscraperLineComponent.js`, `prune`'s join loop). Measured: #134
  (Sets → bitmask scratch, ISS shape) took the timing board from 45.0 s to
  3.6 s; #137 (subset-keyed exact DP) took it from 3.6 s to 0 ms
  (`docs/real-app-timing.md`, `docs/research/137-exact-line-dp.md`).

## Skip-unchanged call: measured, did not pay here

- Do not treat "skip an `update` whose inputs match last call's" as a default
  first step. #133 measured a per-instance candidate signature with early
  return on a match: real-app timing came back inside run-to-run noise, below
  the 0.9x bar in `CODING_STANDARDS.md` — dropped. Try it only alongside a
  real-app timing of your own component (`docs/real-app-timing.md`).

## What ISS has that SudokuMaker does not expose

SudokuMaker's component API has no equivalent of these — do not look for
them:

- `priority(geometry)` — search-order hint based on constrained-cell count
  (handlers.js:70-73, base class default).
- `candidateFinders(grid, geometry)` — a handler nominating its own branching
  candidates to the search loop (handlers.js:75-77).
- `stateAllocator` — a per-branch scratch-state allocator passed into
  `initialize` (handlers.js:60, e.g. used at handlers.js:1836).
