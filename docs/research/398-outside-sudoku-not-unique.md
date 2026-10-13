# Outside Sudoku: why the app reads all four links not-unique (#398)

**Verdict: neither side is wrong. They count different things.** CP-SAT
(`verify.py`, the carve loop) proves the **inner grid** has one solution. The
app's "Find all solutions" counts **every cell it holds**, and a blank outside
clue is a cell. In Outside Sudoku a blank clue is not a function of the grid —
the rule only says the clue digit appears *somewhere* in its window — so each
blank clue legitimately takes any digit its window holds, and the app's count is
the inner grid's one solution times the number of consistent ways to fill the
blank clues. The links are not broken; the app's verdict is just the wrong
reading of them.

## Evidence

Recorded 2026-10-13, app bundle `v2026.10.05-a3aef4c` (`examples/_shared/vendor/bundle.claude.js`
through `bundle-solve-lib.mjs`), every board as committed on `main` at `0dbd3e1`.

Enumerating the app solver's solutions on the two boards small enough to list
them, then projecting each solution onto the inner grid and onto the ring:

| Board | Blank clues | App solutions | Distinct inner grids | Distinct rings |
| --- | --- | --- | --- | --- |
| `PUZZLE_LINK_4x4.txt` | 11 | 2048 (= 2^11) | **1** | 2048 |
| `PUZZLE_LINK_6x6.txt` | 11 | 23328 | **1** | 23328 |

Every extra solution differs from the first only in ring cells. On the 4x4 each
window has two cells holding two distinct digits, so each of the 11 blank clues
takes exactly two values: 2^11.

The converse, run on all four boards: fill every blank clue with the digit the
CP-SAT solution holds in the first cell of its window (a clue that rule
admits), leave everything else alone, and give the result to the app.

| Board | Inner unique (CP-SAT) | Blank clues filled | App verdict, browser (`app-solve.mjs --ring-clues`) | App solutions, Node bundle |
| --- | --- | --- | --- | --- |
| `PUZZLE_LINK_4x4.txt` | yes | 11 of 16 | unique | 1 |
| `PUZZLE_LINK_6x6.txt` | yes | 11 of 24 | unique | 1 |
| `PUZZLE_LINK.txt` | yes | 13 of 36 | unique | 1 |
| `PUZZLE_LINK_local.txt` | yes | 15 of 36 | unique | 1 |

So the app proves the same boards unique the moment no clue is left free. The
generator's model and the component agree on the rule: no missing constraint on
either side.

## Why this only bites Outside Sudoku

Skyscraper, Numbered Rooms and the other edge-clue examples compute the clue
from the line, so a blank clue is forced by the grid and adds no solutions.
Outside Sudoku's clue is a membership test, so a blank one is free within its
window. `verify.py` already says as much (a hidden clue "constrains nothing: the
solver may fill it with any window digit"); the app has no way to ignore a cell.

## What this changes

- `docs/frame-link-verdicts.md`: the four verdicts stay `not-unique` (that is
  what the app prints) and now carry this cause.
- The shipped boards, generator and component are unchanged: nothing is wrong
  to fix, and regenerating would change nothing the app counts.
- A solver who clicks "Find all solutions" on these links sees "multiple
  solutions". That is a real usability wart, and removing it changes what the
  puzzle is, so it is not done here. Options, for the owner:
  1. Ship a `_clued` twin per board (all clues given), as Numbered Rooms does;
     the app reads each unique (table above), at the cost of handing over every
     clue.
  2. Pin a blank clue to a canonical digit of its window (say the smallest).
     That adds a rule to the puzzle and the rules text, and a shown clue that
     is not the smallest would need the component to tell shown from blank.
  3. Leave it and say so in each link's rules text.

## Reproduction

The fill used a scratch script (not kept): decode the link, rebuild
`verify.py`'s CP-SAT model, solve it, write each blank clue as
`{value, given: true}` from the solution, re-encode. The solution list came from
`solveDocument` in `examples/_shared/bundle-solve-lib.mjs`.
