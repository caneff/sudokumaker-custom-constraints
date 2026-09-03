# Fillomino

Divide the grid into orthogonally connected **regions**; every cell of a region
of `k` cells holds the digit `k`; two distinct regions of the same size may not
touch orthogonally. No houses, no rows, no boxes — fillomino is not sudoku, so
this example's rules text carries no sudoku sentence, and the shared layout
checker exempts it (`NO_RULES_PREFIX`). It is also a whole-grid constraint with
no drawn groups, so it ships `main.js` alone and no local board
(`NO_LOCAL_GLOBAL_SPLIT`).

Spec #303, on map #277. This is ticket #305: the example scaffold and **rung 1**
of the three-rung ladder. Rung 1 is the floor and never ships as the finished
component — rung 2 (the growth test, #308) and rung 3 (cut starve, #309) come
after it.

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

### Not built at rung 1

The growth test (every open cell, candidate digit pair) is rung 2; cut starve
with the dominator filter is rung 3. Tour, cut strand, perimeter flank, budget
covering, and the walk's outside and missed-placed readings are dead under
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
- `update-strength.test.mjs` — half one of the strength gate: on any state, the
  component never keeps a candidate the vendored baseline removed. Half two
  (more removed somewhere) binds from rung 2. The reference is driven one
  change per call so every island it reads is freshly scanned; the test header
  says why, with the measured numbers.
- `build_link.test.py` — the committed component reproduces `PUZZLE_LINK.txt`
  exactly, and `--component` / `--board` change only the component's code.

## Timing

The app opens `PUZZLE_LINK.txt` and reaches a verdict on it: **unique**.

| Date | App version | Board | Cold | After logical |
| --- | --- | --- | --- | --- |
| 2026-09-02 | v2026.08.14-d47fc4b | fillomino (6x6, 12 givens) | 0 ms | 0 ms |

**These numbers rank nothing.** The shipped 6x6 board is the baseline's own board, and that board
**cannot rank anything** — 100 ms cold and 0 ms after logical is the app
reporting that the puzzle falls over immediately, and a component change moves
neither number. The frozen fixture set that ranks a fillomino component now
exists (#307, 19 boards, 28-35 givens, the baseline's own rows recorded);
the rung-by-rung timing table against them lands with #308/#309. See
`docs/research/fillomino-baseline/README.md`.
