# 406: measurements on the skyscraper unclued-line stall

**Answer: an unclued line is a refutation test, and the app uses refutation.**
SudokuMaker's AutoStep does trial-based contradiction reasoning, custom
components run inside each hypothetical placement, and a line component kills
branches there. Deleting one deletes a refuter. Details in the last section;
the measurements follow first.

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

The app's step log, read off the page after AutoStep, settles it. Nothing here
rests on reading a component's candidate view.

**1. AutoStep does trial-based contradiction reasoning.** Its own log says so:

    Placing 8 in R7C2 causes a contradiction: unable to place 7 and 8 in
    region 7; removed 8 from R7C2

    Placing 5 in R2C3 forces R2C2 -> 2, R2C7 -> 6, ... causing a
    contradiction: unable to place 6 in row 2; removed 5 from R2C3

**2. Custom components run inside those hypotheses.** The reporter's snapshots
were checked against the puzzle's unique solution: 25832 of 55537 snapshots
hold a state impossible for it — 22018 cells forced to the WRONG digit, 50020
missing the true digit. A sound propagator cannot do that on a uniquely
solvable puzzle, so these are branch states. The same shows on the plain board
(1393 of 3274), so it is general app behaviour.

**3. A line component supplies refutations as app steps.** Its own
`puzzle.stop()` text appears in the log:

    no arrangement of heights satisfies both clues of the skyscraper clues at
    R1C10 and R11C10

Realized refutations: 5 on the skip-4 board, 7 on the skip-3 board.

**4. So deleting a line deletes a refuter.** With both clue ends free the line
carries no information, but inside a trial placement it still answers "no
arrangement of heights fits" and kills the branch. Fewer refuters, fewer
contradiction steps, and AutoStep exhausts its techniques earlier. The skip-4
board's log ends ON contradiction steps at 3.0s, versus 3.5s for the board that
finishes — it runs out of steps, not out of time. Step counts: 31 contradiction
and 28 single steps on skip-4, against 47 and 85 on skip-3.

Step 4 is the one inferential link; steps 1-3 are direct evidence.

This also explains the results above that looked impossible. The drawn stall
state being closed under GAC is irrelevant, because the app's strength is
trial-based and far beyond GAC. Naked singles rescued the board by strengthening
propagation *inside* the trials, so more hypotheses reach a contradiction —
invisible to any analysis of the final state. A no-op or an uninformative
removal adds no refutation power, so neither helped. And the plain stalled board
was unmoved by naked singles because its built-in propagation already does that
inside trials.

## Probe lesson

**Never read a component's observed candidate state as a board state.** A
component is called inside hypothetical placements, so most of what it sees is
a branch, and its last logged frame is a branch teardown — that frame is where
this note's earlier "unpropagated placements" numbers came from, and they were
meaningless. Read the app's step log instead; it names the technique for every
step, including a component's own `puzzle.stop()` message.
