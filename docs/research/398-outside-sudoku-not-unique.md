# Outside Sudoku: why the app reads all four links not-unique (#398)

**Verdict: neither side is wrong. They count different things.** CP-SAT
(`verify.py`, the carve loop) proves the **inner grid** has one solution. The
app's "Find all solutions" counts **every cell it holds**, and a blank outside
clue is a cell. In Outside Sudoku a blank clue is not a function of the grid:
the rule only says the clue digit appears *somewhere* in its window. So each
blank clue takes any digit its window holds, and the app's count is the inner
grid's one solution times the number of consistent ways to fill the blank
clues. The generator's model and the component enforce the same rule; the app's
verdict counts cells the proof does not.

## Evidence

Recorded 2026-10-13, app bundle `v2026.10.05-a3aef4c`
(`examples/_shared/vendor/bundle.claude.js`, driven through
`bundle-solve-lib.mjs`), every board as committed on `main` at `0dbd3e1`. The
scripts that produced it are beside this note: `variants.py` and `count.mjs`.
No second solution is printed here: this repo is public and a solve path never
goes into a commit (`AGENTS.md` § Solution paths), so the evidence is counts.

**1. The app's extra solutions differ only in the ring.** Listing the app
solver's solutions on the two boards small enough to list
(`node count.mjs <link>`), split into inner grids and rings:

| Board | Blank clues | App solutions | Distinct inner grids | Distinct rings |
| --- | --- | --- | --- | --- |
| `PUZZLE_LINK_4x4.txt` | 11 | 2048 (= 2^11) | **1** | 2048 |
| `PUZZLE_LINK_6x6.txt` | 11 | 23328 | **1** | 23328 |

On the 4x4 each window holds two distinct digits, so each of the 11 blank clues
takes exactly two values: 2^11.

**2. No second inner grid exists in the app's own model, on all four boards.**
The 9x9 boards have too many ring fillings to list, so this variant drops them:
`variants.py drop` makes every blank clue a given and has the embedded main code
skip that clue's component. The app then counts exactly the inner grids that
satisfy the shown clues. Control: skipping every clue, shown ones too, gives 72
solutions on the 4x4 and 117504 on the 6x6, so the skip does work.

**3. Filling the blank clues makes the app read unique.** `variants.py fill`
sets each blank clue to the digit the CP-SAT solution holds in the first cell of
its window.

| Board | Blank clues | Inner unique (CP-SAT) | (2) drop: app solutions | (3) fill: app solutions | (3) fill: browser verdict (`app-solve.mjs --ring-clues`) |
| --- | --- | --- | --- | --- | --- |
| `PUZZLE_LINK_4x4.txt` | 11 of 16 | yes | 1 | 1 | unique |
| `PUZZLE_LINK_6x6.txt` | 11 of 24 | yes | 1 | 1 | unique |
| `PUZZLE_LINK.txt` | 13 of 36 | yes | 1 | 1 | unique |
| `PUZZLE_LINK_local.txt` | 15 of 36 | yes | 1 | 1 | unique |

Read together: the app's model has one inner grid on every board (2), and the
only multiplier is the blank clues (1), which fixing them removes (3). So there
is no missing constraint on either side.

## Why this only bites Outside Sudoku

Skyscraper, Numbered Rooms and the other edge-clue examples compute the clue
from the line, so a blank clue is forced by the grid and adds no solutions.
Outside Sudoku's clue is a membership test, so a blank one is free within its
window. `verify.py` already says as much (a blank clue "constrains nothing: the
solver may fill it with any window digit"); the app has no way to ignore a cell.

## What this changes

- `docs/frame-link-verdicts.md`: the four verdicts stay `not-unique` (that is
  what the app prints) and now carry this cause.
- The shipped boards, generator and component are unchanged: nothing is wrong
  to fix, and regenerating would change nothing the app counts.
- A solver who clicks "Find all solutions" on these links sees "multiple
  solutions". Removing that changes what the puzzle is, so it is the owner's
  call, filed as #835 with three options: a `_clued` twin per board (as Numbered
  Rooms ships), a canonical digit for a blank clue, or a line in the rules text.

## Reproduction

From the repo root, on a board `<link>`:

    uv run --with lzstring --with ortools python docs/research/398-outside-sudoku-not-unique/variants.py drop <link> <out>
    node examples/_shared/bundle-solve.mjs <out> 1        # solutions: 1
    uv run --with lzstring --with ortools python docs/research/398-outside-sudoku-not-unique/variants.py fill <link> <out>
    node examples/_shared/bundle-solve.mjs <out> 1        # solutions: 1
    node docs/research/398-outside-sudoku-not-unique/count.mjs <4x4 or 6x6 link>
