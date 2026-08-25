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
- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK_9x9.txt` — built
  links. Open one to play the example.
- `gen_<n>.json` — the grid, clues, shown clues, and givens for each built size.

## Paste into SudokuMaker

Build the interactive-outside frame (see `../../docs/patterns.md`), add a custom
local constraint, and paste `main.js` as the main code. Add two component
segments: `SkyscraperComponent` and `SkyscraperPairComponent`. Each group is one
line: cell 0 the outside clue, the rest the line read inward. Leave a clue cell
blank (`given: false`) to make it interactive; mark it given to show it.
