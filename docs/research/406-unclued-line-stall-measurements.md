# 406: measurements on the skyscraper unclued-line stall

**Answer: the app's built-in house constraints are below GAC, and an unclued
line was the upgrade.** With both clue ends free `SkyscraperLineComponent`'s
pruning equals Regin all-different exactly, so each line silently filtered its
row or column to generalized arc consistency. It adds no information; it filters
harder. Details in the last section; the measurements follow first. A shareable
two-link demo with no skyscraper is in `docs/research/406-gac-demo/`.

## The board

The Skyscrapers global board: 11x11, an inner 9x9 ringed by one interactive
clue cell per row and per column. Constraint 0 registers one
`SkyscraperLineComponent` per line, gated by
`name.match(/R3|R4|C3/)` in the backend so named lines are skipped. Constraint 1
supplies the boxes as regions; constraint 2 ("Rows & Columns") registers a
`DifferentDigitsComponent` per interior row and column. Board naming `R3`/`R4`
are inner rows 2 and 3; `C3`/`C4` are inner columns 2 and 3.

## The ladder

Interior cells filled by the app's own logical solver (Icon AutoStep, run to
fixpoint), app `v2026.08.14-d47fc4b` replayed from the recorded HAR.

| lines skipped | interior | frame |
| --- | --- | --- |
| none | 81/81 | 36/36 |
| R3, R4, C3 | 81/81 | — |
| C4 only | 81/81 | — |
| R3, R4, C3, C4 | 30/81 | 24/36 |
| all 18 | 7/81 | 20/36 |

CP-SAT says the inner 9x9 has exactly one solution, and the same one, in every
variant. Pinning the eight freed clue cells to their true values as givens does
not move the 30/81.

## Components added to the 30/81 board

| component, registered over all 27 interior houses | interior |
| --- | --- |
| yields nothing | 30/81 |
| yields a Change that removes nothing | 30/81 |
| removes real digits that the app's drawn marks had already ruled out (35 cells, 59 digits) | 30/81 |
| naked singles | 81/81 |
| naked singles, rows only / columns only / boxes only | 81/81 each |
| matching-based all-different (Regin strength) | 81/81, cold solve 8100ms -> 20900ms |

## The drawn state at 30/81

Read from each cell's `<svg text>` (large `font-size` is a value, small is a
pencil mark). No marks exist before AutoStep and none are stored in the puzzle
document, so the app computes them during the step.

- Zero naked singles, zero hidden singles.
- Zero naked or hidden subsets at k=2, 3, 4.
- Zero pointing / box-line eliminations.
- A full Regin GAC sweep over all 27 houses removes zero candidates.
- It contains the true solution: the 81/81 grid violates none of it.

## What a component is shown

Through `puzzle.getCandidatesBitMask`, from a reporter registered per house that
yields one no-op Change so it keeps being called (27 houses, 4332 passes,
logging only on change; leaves the board at 30/81).

**Read the trajectory, not the last frame** — see the section at the end of this
note. The final frame is a teardown state and every number taken from it is an
artifact. Through the run the view is clean: violations 0-6, and it contains the
true solution digit everywhere.

## The skyscraper-free control

Same 11x11 frame, skyscraper constraint deleted, only the boxes and Rows &
Columns constraints left, 24 givens chosen so naked and hidden singles alone
finish the grid: AutoStep goes 24 -> 81/81. So `DifferentDigitsComponent`
propagates. Build it with `build_plain.py`.

With all 18 lines present but the Rows & Columns component registration removed,
the board drops to 7/81 — `SkyscraperLineComponent` gates on
`puzzle.getCellsCanHaveRepeats` and stands down when nothing declares the rows
all-different.

## Component facts, independent of the stall

- `SkyscraperLineComponent` is exactly GAC on its own constraint: 12000 fuzzed
  states at n=4,5,6 against brute force over permutations, zero deviation.
  `just check` prints the same independently at n=5.
- With both clue ends free its pruning equals Regin all-different exactly:
  300 random 9-cell lines, zero differences.

## Reproducing

Probe scripts and every variant link are in the session scratchpad, not the
repo, and rebuild from the decoded link: `build_variant.py` (skip sets),
`build_plain.py` (the control), `logic.mjs` (AutoStep and count),
`loud.mjs` (AutoStep, count, and relay `[probe]` console lines).

## `getCandidatesBitMask` is fine — the "unpropagated placements" were a probe artifact

Earlier revisions of this note reported that a component sees a state missing
the app's own house eliminations (52 such cases on the skip-4 board, 468 on a
plain stalled board). **That is wrong.** Both numbers came from reading the
reporter's LAST logged frame, and that frame is a teardown/reset state, not the
fixpoint.

The trajectory is the tell — total candidates summed over all 27 houses, and
the count of "a singleton whose digit a house-mate still lists":

| skip-4 board | plain stalled board |
| --- | --- |
| report 41652: 3 violations, 576 cands | report 2454: 8 violations, 481 cands |
| report 48594: 6 violations, 584 cands | report 2863: 15 violations, 486 cands |
| report 55536: **52** violations, **833** cands | report 3273: **468** violations, **1323** cands |

Candidates nearly triple on the final frame. Through the whole run the view is
clean. `docs/puzzle-api.md` describes `getCandidatesBitMask` as the raw
candidate bitmask, the same source as `getCandidates`, and nothing here
contradicts that.

**Probe lesson:** a component is only called when its cells change, so it can
never observe the fixpoint, and its last frame may be a reset. Never read a
component's final logged state as the board's final state.



## Why an unclued line still does work

**It supplies GAC all-different that nothing else on the board supplies.**

Directly measured on the skip-4 board:

| variant | interior |
| --- | --- |
| skip 4 lines | 30/81 |
| + a duplicate of an already-registered line component | 30/81 |
| + GAC all-different on **only the 4 orphaned houses** | **81/81** |
| + GAC all-different on all 27 houses | 81/81 |

The duplicate rules out "any perturbation works". The four-house GAC pins the
missing ingredient to exactly those houses.

And the built-ins are below GAC. Registering one or the other for every interior
row and column:

| Rows & Columns registers | skip 0 | skip 4 | skip all 18 |
| --- | --- | --- | --- |
| `DifferentDigitsComponent` | 81/81 | 30/81 | 7/81 |
| `HouseComponent` (+ `| 0`, named Row/Column) | 81/81 | 30/81 | 7/81 |

Identical at every rung, so the gap is not "every digit is used", and the
component facts above already show it is not naked or hidden singles. It is Hall
sets of every size.

The link back to the skyscraper line is a measurement recorded above: with both
clue ends free its pruning equals Regin all-different exactly, 300 random 9-cell
lines, zero differences. So each unclued line was a GAC filter on its house.

**Why this is nearly invisible, and why several earlier explanations died on
it.** The extra strength never shows at the fixpoint — the stalled state is
GAC-clean and a full Regin sweep removes zero candidates. It pays off inside the
solver's hypothetical placements. AutoStep does trial-based contradiction
reasoning, its own log says so:

    Placing 5 in R2C3 forces R2C2 -> 2, R2C7 -> 6, ... causing a
    contradiction: unable to place 6 in row 2; removed 5 from R2C3

and components run inside those trials: of the reporter's 55537 snapshots,
25832 hold a state impossible for the puzzle's unique solution (22018 cells
forced to the WRONG digit). A sound propagator cannot do that, so those are
branch states. A stronger filter kills branches a weaker one cannot.

**Redundant strength buys nothing.** A refutation-only component — Hall check,
`puzzle.stop()`, never removes a candidate — was called about 2400 times on a
stalled plain board and fired zero times, leaving it at 36/81; the app already
does that inside a trial (`R9C5, R9C6, R9C7 and R10C5 share only 3 candidates`).
The duplicate-line result says the same. What earns its keep is filtering harder
than what is already registered.

## Probe lesson

**Never read a component's observed candidate state as a board state.** A
component is called inside hypothetical placements, so most of what it sees is
a branch, and its last logged frame is a branch teardown — that frame is where
this note's earlier "unpropagated placements" numbers came from, and they were
meaningless. Read the app's step log instead; it names the technique for every
step, including a component's own `puzzle.stop()` message.
