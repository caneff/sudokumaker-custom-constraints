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
