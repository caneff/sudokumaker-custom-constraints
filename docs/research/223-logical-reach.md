# How far does the app's logical solver get, and on what? (#223)

Board: `examples/hit-counts/PUZZLE_LINK.txt` (9x9 Hit Counts, 27 shown outside
clues, 9 blank clues, 4 interior givens, 4 corner cells given 1), loaded as-is
— every clue is a **given**, so no stripping applies. App v2026.08.14-d47fc4b,
replayed from `examples/_shared/sudokumaker.har`.

Method: three one-off Playwright probes against the same app the timing driver
uses (`examples/_shared/app-dom.mjs`), not committed.

1. **Step log.** Click `Icon SingleStep` until the log panel (`.LogsView li`)
   prints "No logical steps found", and record every message. `Icon AutoStep`
   (the run-to-fixpoint button `app-solve.mjs --after-logical` uses) prints the
   same 31 deductions in a slightly different order and reaches the same board.
2. **Board readout.** Snapshot every `svg text` with its bounding box, map it
   onto the 11x11 grid, and read each open cell's candidate string. This gives
   cells set, cells open, and candidates left.
3. **Component attribution.** Build same-board links with one or more of the
   three components' `update` and `initialize` emptied (`link_swap.py`,
   `build_link.py`'s machinery), and re-run probe 2 on each. `validate` stays
   intact in every variant, so each link still has the same solution set.
   A separate instrumented build counts each deduction branch as it fires.

## What the logical solver reaches

The pass stalls after 31 deductions with "No logical steps found." It sets
**8 of the 86 unknown cells** and leaves **78 open with 486 candidates**
(6.2 per cell; 76 of those cells are interior, holding 480 candidates).

| Cell | Clue | Value | Announced as |
| :--- | :--- | ----: | :--- |
| R1C8  | top, column 6    | 1 | Naked single |
| R11C8 | bottom, column 6 | 1 | Naked single |
| R2C11  | right, row 0 | 0 | Naked single |
| R4C11  | right, row 2 | 0 | Naked single |
| R6C11  | right, row 4 | 0 | Naked single |
| R8C11  | right, row 6 | 0 | Naked single |
| R10C11 | right, row 8 | 0 | Naked single |
| R3C5 (interior) | — | 6 | Naked single, after 5 contradiction removals |

Seven of the nine blank clues close. The two that stay open are the left
clues R2C1 and R5C1, both narrowed to `{0,1,2}` — exactly the side-sum bound
(the seven shown left clues total 7, so the two blanks total 2). Exactly one
interior cell is solved. The other 76 interior cells stay open.

## Technique tally, whole run

| Technique | Count | Group |
| --- | ---: | --- |
| Placing X causes a contradiction (forcing) | 23 | plain sudoku, heavier (bifurcation) |
| Naked single | 8 | plain sudoku |

No step is announced by a Hit Counts component. Every contradiction step names
a plain sudoku house as the thing that broke — "unable to place 9 different
values in the cage at R2C5" (a row or column cage) or "…in region 2" (a box).
The components narrate nothing at all; their pruning is silent, folded into
the naked single that closes on top of it.

Step counts vary run to run (30, 31, 32 across three runs) because the logical
solver has "Try out restricted cells at random" on. The fixpoint does not: 8
cells set and 486 candidates on every run.

## Which component deductions fire

Component code emptied one variant at a time, same board each time. "Log
entries" counts the closing "No logical steps found." line too.

| Live components | Log entries | Cells set | Open | Candidates left |
| :--- | ---: | ---: | ---: | ---: |
| all three (shipped) | 32 | 8 | 78 | **486** |
| line + side sum (pair inert) | 32 | 8 | 78 | **486** |
| line + pair (side sum inert) | 20 | 2 | 84 | 591 |
| line only | 20 | 2 | 84 | 591 |
| side sum only | 8 | 7 | 79 | 623 |
| none (all three inert) | 28 | 2 | 84 | 680 |

- **`SideSumComponent` sets all seven closed clues, by itself.** Its
  `initialize` alone pins them: the four shown right clues already total 9, so
  the five blanks are forced to 0, and the eight shown top clues total 8, so
  the ninth is 1 (same on the bottom). The app then reports each as a naked
  single. With side sum inert, none of the seven closes.
- **`HitCountsComponent` pays in candidates, not cells.** Alone it takes the
  board from 680 candidates to 591 (−89) but sets nothing. Its per-branch
  counts at load: `initialize` drops the illegal clue value 8 on all 9 blank
  clues; the reverse clue bound fires 6 times (6 candidates); the "no more
  hits allowed" rule fires 10 times (85 candidates); the "every free cell must
  hit" rule never fires.
- **`HitCountsPairComponent` changes nothing.** Making it inert reproduces the
  shipped fixpoint exactly — same 8 cells, same 486 candidates. Its clue cap
  fires twice at load (2 candidates), and both are recovered by the other two
  components. Its at-cap pin never fires on the real board; the firings seen
  during the pass (10–26) are all inside the solver's hypothetical trials.
- The two live rules compound: 89 + 57 candidates separately, 194 together.
- With every component inert, the contradiction technique **rediscovers** some
  of the same cuts through `validate`, and the message then names the
  component: "Placing 8 in R2C1 causes a contradiction: unable to satisfy
  R2C1 … R2C10" is `HitCountsComponent.validate`, and "unable to satisfy side
  sum step 11" is `SideSumComponent.validate`. That is 25 expensive
  contradiction steps to reach a board 194 candidates looser than the shipped
  components reach for free.

## Does the logical run use a step the search lacks?

Yes. The two solvers ship with different technique sets, read straight off
Solver settings on this board:

| Setting | Logical solver | Solutions finder |
| :--- | :--- | :--- |
| Naked and hidden singles | on | on |
| Naked/hidden/pointing pairs, X-Wings, Y-Wings, fishes, sum logic, … | all on | all off |
| **By contradiction** | **on** | **off** |
| Try out restricted cells at random | on | (not offered) |

Turning the logical solver down to the Solutions finder's set — naked and
hidden singles only — and re-running the pass on the shipped link gives:

    steps=8  setByLogic=7  open=79  candidates=510

So the search's own technique set reaches 7 cells and 510 candidates. The
contradiction step is worth exactly **one more cell (R3C5) and 24 more
candidates** on top of that. The heavier logical techniques carry the run's
whole middle: 23 of the 31 steps are contradiction steps, and the one interior
cell needs five of them before its naked single appears.

## Read

The board hands the search almost nothing. After the app's own logical solver
runs to its fixpoint, 76 of 81 interior cells are still open with 480
candidates between them — an average of 6.3 of 9 per cell. Four interior
givens and one deduced digit is the whole grid the search starts from, so a
[timeout] at 300 s (#222) is what that state predicts.

The three components split cleanly by what they buy. `SideSumComponent` is the
only one that closes a cell: it resolves 7 of the 9 blank clues at load, from
the shown clues alone, before any interior digit is known. `HitCountsComponent`
buys candidates and no cells. `HitCountsPairComponent` buys nothing measurable
here — the shipped fixpoint is bit-identical without it — which makes it the
first thing to question against the pay-for-itself rule.

Two cautions for #222. First, the logical solver's reach is not the search's
reach: the `--after-logical` row in `just time` hands the search a board that
the search's own singles-only technique set could not have produced, because
`AutoStep` runs contradiction chains the Solutions finder has switched off. The
cold row and the after-logical row therefore differ by more than a warm start.
Second, a new deduction is worth most where the components are currently
silent — the interior. Both live rules stop at the clue ring and its immediate
consequences; nothing in the shipped code reaches the 76 open interior cells
except through candidates the clue bound happens to strip.
