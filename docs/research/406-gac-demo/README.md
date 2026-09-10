# GAC demo: an all-different upgrade the app's own house constraints do not have

Two links, one board, 25 givens, a plain sudoku with **no skyscraper constraint
anywhere**. The only difference between them is one extra custom constraint.

| link | AutoStep (Icon AutoStep, run to fixpoint) |
| --- | --- |
| `PUZZLE_LINK_without_gac.txt` | 25 -> **53/81** |
| `PUZZLE_LINK_with_gac.txt` | 25 -> **81/81** |

The added constraint is `AllDiffGacComponent`, registered once per interior row,
column and box. It is a matching-based (Regin) all-different filter: a digit
survives in a cell only if some perfect matching of the house assigns it there.
That finds every Hall set of every size in one pass.

It adds **no information** — the board, the givens and the solution are
identical, and every row, column and box was already declared all-different by
the Rows & Columns constraint and the region constraint. It only filters
harder. The 81/81 grid was checked against CP-SAT's unique solution: 81 cells
placed, zero disagreements.

## Why this matters (#406)

The app's built-in house constraints are below GAC, and the gap is not naked or
hidden singles:

| Rows & Columns registers | skip 0 lines | skip 4 lines | skip all 18 |
| --- | --- | --- | --- |
| `DifferentDigitsComponent` | 81/81 | 30/81 | 7/81 |
| `HouseComponent` (+ `\| 0`, named Row/Column) | 81/81 | 30/81 | 7/81 |

`HouseComponent` is documented as "every digit exactly once" and is no stronger
than `DifferentDigitsComponent` here — identical at every rung. Swapping in a
GAC filter on just the four affected houses reaches 81/81.

That is what an "unclued" skyscraper line was quietly supplying on the
Skyscrapers board: with both clue ends free, `SkyscraperLineComponent`'s pruning
equals Regin all-different exactly (300 random 9-cell lines, zero differences),
so each line silently upgraded its row or column to GAC. Deleting four of them
dropped four houses to the weaker built-in.

## The catch that makes this hard to see

The extra strength never shows at the visible fixpoint. The stalled state is
already GAC-clean — a full Regin sweep over all 27 houses removes zero
candidates there. The filter pays off **inside the solver's hypothetical
placements**, where AutoStep does trial-based contradiction reasoning and a
stronger filter kills branches a weaker one cannot. Any analysis of the final
drawn state concludes, wrongly, that the component cannot be doing anything.

## Rebuilding

`build_demo.py` in the session scratchpad; the component is
`AllDiffGacComponent.js` with `alldiff-main.js` as its backend.
