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

So this example is one self-contained component per line that reads both end
clues and the whole line together, plus a per-side count. It follows the same
shape as `../running-start/`; see `../../docs/gotchas.md` on why a custom
component must not lean on `replaceComponent`.

## What the components deduce

**`SkyscraperLineComponent.js` — one per line, both clues at once.** A line is
a full house, so its tallest building is exactly `n`, at one cell: the peak.
The left clue is `1 +` the left-to-right maxima before the peak; the right clue
is `1 +` the right-to-left maxima after it. The prefix and the suffix are
disjoint and together use every digit below `n` exactly once, so each is a DP
over *subsets* of those digits — the state is the subset used so far plus the
count of buildings seen — and the two DPs join at every cell that can still
hold the peak, pairing a subset on one side with its complement on the other.
A subset fixes both how many cells are filled (its popcount) and the tallest so
far (its highest digit), so a whole DP layer is one bitmask of counts per
subset, held in one reused buffer indexed by subset.

The rule needs a board whose digits start at 1. A clue is a visible count,
which runs `1..n`, but a clue cell holds a board digit, so on a board starting
at 0 the count `n` has no digit and an ascending line cannot be clued. The
component stands down there rather than deduce from a rule that does not
hold.

- **Clues from the line:** a clue value is feasible only when some peak position
  realizes it on its side while the other side realizes some value the other
  clue still allows. The component removes every clue value no peak position
  supports.
- **Line from the clues:** each cell keeps `n` only where the peak can sit, and
  keeps a smaller digit only when it lies on some prefix or suffix path that
  finishes with both clues accepted. This is arc consistency for the pair of
  clues, not a min/max bound, and it subsumes the `L + R <= n + 1` cap.

Tracking the digit subset makes the sweep exact for a line: a value survives
only when some full line assignment consistent with the candidates and both
clues uses it. The true line is a permutation, so every one of its steps is a
transition the DP takes and no true value is ever removed.

**One `1` per side.** `main-global.js` adds a built-in
`ExactDigitCountComponent(name, 1, 1, sideClues)` for each of the four sides. A
clue of `1` means the cell next to it is the tallest building. Each side's
nearest rank is a full row or column, so the tallest building sits under exactly
one clue per side. This couples all nine clues on a side.

Timed with and without it on both boards, the two pairs of medians disagree on
sign: a wash, so it stays (#129). Numbers and method in
`../../docs/real-app-timing.md`.

## Is it faster than the original?

Yes, by a wide margin — the original does not solve an interactive puzzle at all
within a sane search budget. `recovery-probe.mjs` runs both wirings over the same
generated puzzle, on top of a Régin-strength all-different floor, and counts the
search nodes a uniqueness solve takes. Fewer nodes means the constraint pruned
more and the solver guessed less.

| puzzle | ours | original |
| --- | --- | --- |
| `gen_4x4` | 0 nodes | did not finish (200k-node cap) |
| `gen_6x6` | 8 nodes | did not finish (200k-node cap) |
| `gen_9x9` (shipped board, seed 610) | 45,731 nodes (~2 min; golden capped at 5k) | not run |

In the real app the shipped `PUZZLE_LINK.txt` is proved unique in **8.0 s**
(`just time skyscraper --ring-clues`). It is the hardest unique board a
560-seed scan found (#140, #161), so it doubles as the timing board. The
first shipped board handed the solver 58% of its ring and read 0.3 s; before
the joint component it ran past the app's 300 s limit. Node counts and app time are different measurements — reps,
dates, and app version in `../../docs/real-app-timing.md`.

The reason is the interactive clue. The puzzle's one solution needs the skyscraper
deductions; the sudoku rule and the shown clues alone do not pin it. Ours deduces
the blank clues and prunes the lines, so it solves by nearly pure logic. The
original deduces nothing about a blank clue, so it must *guess* every blank clue,
and it wanders. The probe models the original's built-in as a one-clue forward
prune, gated to fire only once a clue is pinned — so the original gets every
per-line deduction for a known clue. The gap is exactly the features it lacks:
blank-clue deduction, two-clue coupling, and the one-1-per-side count. Run it:

```
node examples/skyscraper/recovery-probe.mjs gen_6x6.json            # root recovery + soundness
node examples/skyscraper/recovery-probe.mjs gen_6x6.json --search   # solve, count nodes
```

## Files

- `main.js` — the local backend segment: one line component per pair of
  opposite drawn clues.
- `main-global.js` — the global backend segment: builds all 4n frame lines
  from the board size, then registers the same paired line component plus
  the one-1-per-side count component below (it needs a whole side, which
  only a full frame has).
- `SkyscraperLineComponent.js` — the line component: both clues, the whole
  line, and the final check.
- `soundness-harness.mjs` — Node soundness fuzz for the line component.
  Soundness = the component never removes a cell's true value. Run it:
  `node examples/skyscraper/soundness-harness.mjs` (`FUZZ=20000` for the deep
  run).
- `recovery-probe.mjs` — runs both wirings (ours and the original) over a built
  puzzle to compare solve work. Root recovery and soundness by default,
  search-node counts with `--search`. See "Is it faster than the original?".
- `build_size.py` — builds the whole document for any grid size: a grid, the
  derived clues, a minimal set of interior givens and shown clues carved to a
  unique solution (OR-Tools), and the encoded link. Blank clues are the
  interactive ones. It shares `main-global.js` and the component files, so a
  fix there flows to every size on the next run:
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 4 2 2`
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 6 2 3`
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 9 3 3`
  The three args are the grid size, the box height, and the box width
  (`box_height * box_width == size`). An optional fourth arg caps the seed count.
- `PUZZLE_LINK_10x10.txt` / `gen_10x10.json` — the 10x10 (2x5 boxes) board that timed the lifted cap.
- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK.txt` (the 9x9) —
  built links. Open one to play the example.
- `gen_<n>x<n>.json` — the grid, clues, shown clues, and givens for each built size.
- `original/` and `build_original.py` — ChinStrap's original wrapper code, plus
  a re-encoder that rebuilds the same generated puzzle with it. `PUZZLE_LINK_original.txt`
  (9x9) and `PUZZLE_LINK_4x4_original.txt`/`PUZZLE_LINK_6x6_original.txt` are the
  same grid, givens, and clues as the improved links, so you can compare the two
  solve experiences directly:
  `uv run --with ortools --with lzstring examples/skyscraper/build_original.py 9`
- `build_link.py` — rebuilds a committed board link with one named
  component's code swapped for a candidate file, board and clues unchanged:
  `uv run --with lzstring examples/skyscraper/build_link.py --component SkyscraperLineComponent.js --out /tmp/candidate.txt`.
  Defaults to `PUZZLE_LINK.txt`; `--board <file>` swaps against another
  committed link instead. See `docs/real-app-timing.md`.
## Paste into SudokuMaker

To draw your own lines, add a custom local constraint and paste `main.js` as
the main code, plus the `SkyscraperLineComponent` segment. Each group is one
line: cell 0 the outside clue, the rest the line read inward. Leave a clue
cell blank (`given: false`) to make it interactive; mark it given to show it.

To use the whole grid as an interactive-outside frame instead (see
`../../docs/patterns.md`), add a custom global constraint and paste
`main-global.js` as the main code, plus `SkyscraperLineComponent`.

## Timing

| 2026-08-27 | v2026.08.14-d47fc4b | skyscraper | 300ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper | 2700ms | 3700ms | 1.37 | noise |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper | 2700ms | 2300ms | 0.85 | noise |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper | 2000ms | 1900ms | 0.95 | noise |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper 10x10 | timeout (no deduction, `MAXN = 9`) | 100ms (`MAXN = 16`) | — | KEEP |

The three 9x9 rows are the cap lift (`MAXN` 9 to 16) timed against the
shipped board: the constant sizes three scratch arrays and nothing on the
n ≤ 9 path, and the ratios land on both sides of 1, so the 9x9 is unchanged
within the app's run-to-run swing. The 300ms row above is the earlier, easier
board; `34991d9` shipped the harder one.

The 10x10 row (`PUZZLE_LINK_10x10.txt`, `gen_10x10.json`, 2x5 boxes, 12 givens,
20 shown clues) is the size that lifted the line cap from 9 to 16: with the
cap the component yields nothing above 9 and the app finds no first solution
inside its limit; with the DP it proves the board unique in 0.1 s, 3/3 reps.
The app accepts `maxDigit` 10 without complaint.

`just time skyscraper --ring-clues` (candidate byte-equal to baseline, so
only a BASELINE row prints). See `docs/real-app-timing.md` for the protocol.

Earlier verdicts (#128, #133–#137) and their numbers: `docs/research/` and the
commit history; #137 (exact line DP, kept) is `docs/research/137-exact-line-dp.md`.
