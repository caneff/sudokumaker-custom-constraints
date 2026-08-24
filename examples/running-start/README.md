# Running Start — a worked custom constraint

Running Start is a Skyscrapers variant. Each outside clue counts how many digits
keep increasing, starting from the cell next to the clue and reading inward,
until the first digit smaller than its predecessor.

Example line `1 2 4 5 3 9 6 8 7`:
- From the left: `1 < 2 < 4 < 5`, then `3` drops → clue **4**.
- From the right (`7 8 6 …`): `7 < 8`, then `6` drops → clue **2**.

A line's clue is `1 + (length of the strictly increasing run from the clued
end)`. In a sudoku line all digits differ, so "not increasing" always means a
strict drop.

## Files

- `main.js` — the backend segment. One component per line, plus a pair
  component for any two clues on opposite ends of one line.
- `RunningStartComponent.js` — the per-line component. Both directions of
  propagation plus the final check.
- `RunningStartPairComponent.js` — couples two clues on opposite ends of one
  line through `A + B <= n + 1`.
- `soundness-harness.mjs` — Node soundness test (see below).
- `generate.py` — fresh grid, derived clues, uniqueness proof (OR-Tools).
- `PUZZLE_LINK.txt` — the built SudokuMaker link for the seed-104 grid. Open it
  to play the example.
- `build_link.py` — rebuilds `PUZZLE_LINK.txt` from `main.js` and the component
  files. Run it after changing any of them:
  `uv run --with lzstring examples/running-start/build_link.py`.
- `puzzle_template.json` — the puzzle frame (grid, clue ring, groups, regions,
  cosmetics) with the code fields empty. `build_link.py` fills them in.

## Paste into SudokuMaker

Build the interactive-outside frame (see `../../docs/patterns.md`), add a custom
local constraint, and paste `main.js` as the main code. Add two component
segments: `RunningStartComponent` and `RunningStartPairComponent`. Each group is
one line: cell 0 the outside clue, the rest the line read inward. When a puzzle
clues both ends of a line, the backend adds one pair component for that line.

## Why one self-contained component

The Skyscraper Lines template uses a wrapper that, once the clue cell has a
value, calls `replaceComponent(instance, new SkyscraperComponent(...))`. That
works only because `SkyscraperComponent` is **built-in**. Swapping in a *custom*
component that way silently does nothing (see `../../docs/gotchas.md`). So
Running Start is a single component that holds the clue cell and the line and
does everything itself.

## What the component deduces

Forward (clue known or partly bounded) and reverse (clue read from the line),
all sound:

- **Reverse, feasible clue set** — `feasibleClues` walks the line once and keeps
  only the clue values the live candidates can still realize. A value `k` needs
  an increasing prefix of length `k` and, unless `k` is the whole line, a
  descent at position `k`. The walk tracks the smallest and largest end value an
  increasing prefix can reach; it drops `k` only when even the largest reachable
  predecessor cannot be beaten, so it never removes a true clue. This is
  stronger than a min/max interval — it also removes interior values whose
  descent is impossible, and a filled cell anywhere on the line counts.
- **Forward, guaranteed prefix** — if the clue's smallest remaining candidate is
  `kmin`, the first `kmin` cells must strictly increase. Enforce the pairwise
  `<` chain and, for each cell `line[j]` with `j < kmin`, the window
  `[1+j, 9−(kmin−1−j)]`: it needs `j` cells below and `kmin−1−j` above. This runs
  before the clue is pinned and is tighter than the neighbour-only chain, which
  only looks one step.
- **Forward, pinned** — a known clue `k` is the guaranteed prefix above (with
  `kmin == k`) plus the descent `line[k] < line[k−1]`.
- **Cross-line pair** — two clues on opposite ends of one line share a
  permutation: the left increasing run and the right increasing-inward run can
  share at most one cell (the peak), so `A + B <= n + 1`. The pair component
  caps each clue at `n + 1` minus the other's smallest remaining value. When
  `A + B` is forced to exactly `n + 1`, the line is unimodal — strictly up to
  the shared peak, then strictly down — so it propagates both monotone runs and
  tightens every cell (on a full row the peak becomes a 9 once all-different
  joins in). It shines early, when one clue is a given and the line is open.
- **validate** — once clue and line are filled, the count must equal the clue.

## Run the tests

Soundness (needs Node):

```
node soundness-harness.mjs
# -> line + pair components, 0 violations, "PASS"
```

Generation and uniqueness (needs Python with ortools):

```
python generate.py
# -> chosen seed, interior givens, clues kept, "FINAL unique OK"
```

`soundness-harness.mjs` reads the seed-104 solution from `seed104_solution.json` (a
committed dump of the puzzle's `cells` values and the constraint's
`input.groups` in `[clueCell, lineCells]` form). The pair test also fuzzes a
synthetic mountain line, because no line in this puzzle reaches the
`A + B == n + 1` case that drives the pair's unimodal branch.
