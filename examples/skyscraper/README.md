# Skyscrapers, interactive outside clues — a worked custom constraint

Each outside cell holds a digit. That digit is the number of buildings visible
along its line. A building is visible when it is taller than every building
before it, read inward from the clue. The clue cell is part of the puzzle: many
clues start blank, and the solver reads them off the line. That is what
"interactive" means here.

For example, a row `142356789` gives a left clue of **4** — you see 1, 4, 6, 9 —
and a right clue of **1**, the 9 alone. The 4x4 and 6x6 puzzles carry the same
rule at their size.

## Why replace the built-in

SudokuMaker ships `SkyscraperComponent`, and the built-in "Skyscraper Lines"
template wraps it: a small component watches the clue cell and, once that cell
holds a value, calls `replaceComponent(instance, new SkyscraperComponent(...))`.
Two things follow, and both hurt an interactive clue:

- **It does nothing while the clue is blank.** It removes no candidate from the
  clue and none from the line. So it never helps the solver deduce a blank clue
  — the whole point of an interactive outside clue.
- **It never couples the two ends of a line.** Each clue is on its own.

So this example is one self-contained component per line that prunes both
directions itself, plus a pair component and a per-side count. It follows the
same shape as `../running-start/`; see `../../docs/gotchas.md` on why a custom
component must not lean on `replaceComponent`.

## What the components deduce

**`SkyscraperComponent.js` — one per line, both directions.** It runs a
forward/backward visibility DP over the line's live candidates, in the spirit of
the Interactive Sudoku Solver's skyscraper handler but in plain digit sets. The
state at each cell is the count of buildings seen so far and the tallest so far.

- **Reverse (clue from line):** a clue value `k` is feasible only when some
  candidate assignment makes exactly `k` buildings visible. The component removes
  every clue value the line cannot realize.
- **Forward (line from clue):** for the clue values still open, it keeps in each
  line cell only the candidates that take part in some assignment reaching one of
  those counts. This is full arc consistency for the clue, not a min/max bound.

The DP ignores that a line's digits are all different. That makes its sets a
little larger, never smaller, so it never removes a true value. The solver's own
row/column rule recovers the rest.

**`SkyscraperPairComponent.js` — two clues on one line.** The left clue `L` and
the right clue `R` on the same line satisfy `L + R <= n + 1`. Only the tallest
building is visible from both ends; every other building is visible from at most
one end, so the two counts share exactly the peak. The component caps each clue
by the other. When `L + R == n + 1` the line is unimodal — it rises to the peak,
then falls — and the component propagates both runs, which pins the peak.

**One `1` per side.** `main.js` adds a built-in
`ExactDigitCountComponent(name, 1, 1, sideClues)` for each of the four sides. A
clue of `1` means the cell next to it is the tallest building. Each side's
nearest rank is a full row or column, so the tallest building sits under exactly
one clue per side. This couples all nine clues on a side.

## Is it faster than the original?

Yes, by a wide margin — the original does not solve an interactive puzzle at all
within a sane search budget. `recovery-probe.mjs` runs both wirings over the same
generated puzzle, on top of a Régin-strength all-different floor, and counts the
search nodes a uniqueness solve takes. Fewer nodes means the constraint pruned
more and the solver guessed less.

| puzzle | ours | original |
| --- | --- | --- |
| `gen_4` | 2 nodes | did not finish (200k-node cap) |
| `gen_6` | 36 nodes | did not finish (200k-node cap) |
| `gen_9` | 2652 nodes | did not finish (30k-node cap) |

The reason is the interactive clue. The puzzle's one solution needs the skyscraper
deductions; the sudoku rule and the shown clues alone do not pin it. Ours deduces
the blank clues and prunes the lines, so it solves by nearly pure logic. The
original deduces nothing about a blank clue, so it must *guess* every blank clue,
and it wanders. The probe models the original's built-in as our own forward prune,
gated to fire only once a clue is pinned — so the original gets every per-line
deduction ours has for a known clue. The gap is exactly the three features it
lacks: blank-clue deduction, pair coupling, and the one-1-per-side count. Run it:

```
node examples/skyscraper/recovery-probe.mjs gen_6.json            # root recovery + soundness
node examples/skyscraper/recovery-probe.mjs gen_6.json --search   # solve, count nodes
```

## Files

- `main.js` — the backend segment. One component per line, one pair component
  per doubly-clued line, and one count component per side.
- `SkyscraperComponent.js` — the per-line component. Both directions plus the
  final check.
- `SkyscraperPairComponent.js` — couples the two clues on one line through
  `L + R <= n + 1`.
- `soundness-harness.mjs` — Node soundness fuzz for both components. Soundness =
  the component never removes a cell's true value. Run it:
  `node examples/skyscraper/soundness-harness.mjs`.
- `recovery-probe.mjs` — runs both wirings (ours and the original) over a built
  puzzle to compare solve work. Root recovery and soundness by default,
  search-node counts with `--search`. See "Is it faster than the original?".
- `build_size.py` — builds the whole document for any grid size: a grid, the
  derived clues, a minimal set of interior givens and shown clues carved to a
  unique solution (OR-Tools), and the encoded link. Blank clues are the
  interactive ones. It shares `main.js` and the component files, so a fix there
  flows to every size on the next run:
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 4 2 2`
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 6 2 3`
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 9 3 3`
  The three args are the grid size, the box height, and the box width
  (`box_height * box_width == size`). An optional fourth arg caps the seed count.
- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK.txt` (the 9x9) —
  built links. Open one to play the example.
- `gen_<n>.json` — the grid, clues, shown clues, and givens for each built size.
- `original/` and `build_original.py` — ChinStrap's original wrapper code, plus
  a re-encoder that rebuilds the same generated puzzle with it. `PUZZLE_LINK_original.txt`
  (9x9) and `PUZZLE_LINK_4x4_original.txt`/`PUZZLE_LINK_6x6_original.txt` are the
  same grid, givens, and clues as the improved links, so you can compare the two
  solve experiences directly:
  `uv run --with ortools --with lzstring examples/skyscraper/build_original.py 9`
- `build_link.py` — rebuilds the committed `PUZZLE_LINK.txt` (9x9) with one
  named component's code swapped for a candidate file, board and clues
  unchanged: `uv run --with lzstring examples/skyscraper/build_link.py --component SkyscraperComponent.js --out /tmp/candidate.txt`.
  See `docs/real-app-timing.md`.

## Paste into SudokuMaker

Build the interactive-outside frame (see `../../docs/patterns.md`), add a custom
local constraint, and paste `main.js` as the main code. Add two component
segments: `SkyscraperComponent` and `SkyscraperPairComponent`. Each group is one
line: cell 0 the outside clue, the rest the line read inward. Leave a clue cell
blank (`given: false`) to make it interactive; mark it given to show it.
