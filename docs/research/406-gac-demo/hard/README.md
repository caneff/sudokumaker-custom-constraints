# Famous hard classics, with and without the GAC component

Each puzzle has two links, identical except that `_gac` adds
`AllDiffGacComponent` (matching-based Regin all-different) on every row, column
and 3x3 box. Plain 9x9, no other custom constraint.

Grids from forum.enjoysudoku.com "The hardest sudokus (new thread)" and the
published AI Escargot.

| puzzle | clues | links |
| --- | --- | --- |
| Platinum Blonde | 21 | `Platinum_Blonde_base.txt` / `Platinum_Blonde_gac.txt` |
| Golden Nugget | 21 | `Golden_Nugget_base.txt` / `Golden_Nugget_gac.txt` |
| AI Escargot | 23 | `AI_Escargot_base.txt` / `AI_Escargot_gac.txt` |
| Fata Morgana | 21 | `Fata_Morgana_base.txt` / `Fata_Morgana_gac.txt` |

Built by `build_hard.py` from the grid strings in `hard.py` (session scratchpad).
Every link was decoded back and its givens compared against the source grid
character for character. Not timed and not solution-checked here.
scratchpad). Not timed or solution-checked here.

## Timing result: classic sudoku cannot stress SudokuMaker's solver

Measured with `app-solve.mjs` ("Find all solutions and valid candidates"),
non-deterministic solve off, app `v2026.08.14-d47fc4b`:

| puzzle | clues | SM verdict | SM solve |
| --- | --- | --- | --- |
| Platinum Blonde | 21 | unique | 100 ms |
| Fata Morgana | 21 | unique | 200 ms |
| AntiDFS (dcc.fc.up.pt paper, ~1.5e9 SDFS cycles) | 17 | unique | **0 ms**, with and without the component |

Human difficulty and naive-backtracker difficulty both mean nothing here — SM's
solver propagates and orders well, so every classic lands at or near zero. The
GAC component's cost and its benefit are therefore both unmeasurable on classic
boards; the earlier 2.6x cold figure (8100 ms -> 20900 ms) came from the
Skyscrapers frame board, where a custom component runs at every search node.

**So: to time this component, use a board whose search is genuinely large.** A
plain 9x9 is not one, at any human difficulty.
