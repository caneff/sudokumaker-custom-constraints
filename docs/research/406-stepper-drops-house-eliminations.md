# 406: the app's logical stepper leaves placed digits unpropagated

The Skyscrapers global board (11x11, interactive ring clues) stalls its logical
solver at 30/81 interior cells when four unclued line components are skipped,
and finishes at 81/81 when any one of them is kept. The four lines carry no
information — CP-SAT says the inner 9x9 has one solution, the same one, in
every variant. This note records what the stall actually is.

## Status

Confirmed, after a retraction and a re-instatement. The reasoning that briefly
retracted this was itself wrong and is recorded below so it is not repeated.

**The bad argument.** Naked-singles closure of the component-visible state C
was computed from the reporter run's FINAL C and found to yield no new
placement, "proving" naked singles could not reach 81/81. That treats the app's
own contribution as already baked into C. It is not: the app's progress is
conditional on C being propagated, so a component that propagates C unlocks
further app progress, which enlarges C's propagation again. Measured: naked
singles alone from the INITIAL C reaches 7 singletons (exactly the givens) and
stops. Weak alone, decisive in the loop.

## Verdict

At the stall, SudokuMaker's own candidate state still holds **52 placements it
has not propagated**: a solved cell's digit still sits in a house-mate's
candidate mask. The board *looks* like an honest hard fixpoint because the
pencil marks it draws are computed by a different, stronger pass — they are
naked-single clean, hidden-single clean, subset clean, and Regin-GAC clean on
all 27 houses. The drawn marks disagree with the solver's own masks on **35 of
81** interior cells.

So this is not an all-different strength gap and not a scheduling wake-up. Any
component registered over those houses that propagates a placed digit fixes the
board, because it is doing house elimination the stepper skipped.

## Evidence

Board wiring matters: the "Rows & Columns" backend sets
`json.metadata.norowcol = true` and registers `DifferentDigitsComponent` per
interior row and column; boxes come from the type-1 region constraint. So the
houses in play are constraint-supplied, not the app's built-in grid.

| probe | interior after AutoStep | what it shows |
| --- | --- | --- |
| skip 4 lines (the stall) | 30/81 | baseline |
| component over all 27 houses yielding nothing | 30/81 | registration alone does nothing |
| component yielding a Change that removes nothing | 30/81 | yielding does not wake the stepper |
| naked singles over the 27 houses | 81/81 | the deduction content is what matters |
| naked singles, instrumented | 81/81, **6195 real removals**, 33 of them before AutoStep was clicked | the removals are real, not no-ops |
| reporter: logs the solver's own masks, yields one no-op Change | 30/81, 27 houses, 4332 passes | inert, so its masks are the stall state |
| removes real digits present in C but absent from the drawn marks (35 cells, 59 digits) | 30/81 | a real, committed state change that adds no information does NOT wake it |

Analysis of the drawn marks at the stall (`gap2.py`): zero naked singles, zero
hidden singles, zero naked or hidden subsets at k=2,3,4, zero pointing or
box/line eliminations, and a full Regin GAC sweep over every row, column and
box removes **zero** candidates. Nothing about the drawn state explains a stall.

Analysis of the reporter's masks at the same moment: **52** cases of a
single-candidate cell whose digit is still a candidate in a house-mate of the
same house.

## What this retires (still holds)

- The GAC hypothesis. `SkyscraperLineComponent` is exactly GAC on its own
  constraint (12000 fuzzed states at n=4,5,6, zero deviation; `just check`
  independently prints "exactness vs brute force (n=5): 2000 states, 0
  disagreements"), and with both clue ends free its pruning equals Regin
  all-different exactly (300 random 9-cell lines, zero differences). True, and
  irrelevant here — the stall state is already GAC-clean.
- The scheduling hypothesis. The no-op-Change control sits at 30/81.

## Also established

- The marks are not stored in the puzzle document (zero pencil-mark fields) and
  are absent before AutoStep, so the app computes the strong state D itself
  during the step.
- D is sound: it never eliminated a digit the final 81/81 grid needs.
- D is a strict subset of C, checked both directions, differing on 35 cells.
- Components gate on `puzzle.getCellsCanHaveRepeats(cells)` and proceed, so the
  app DOES know the inner rows, columns and boxes are all-different. The
  constraint is registered and C still stalls with 52 placements uneliminated.

## Open

Whether this is a general app property or specific to `norowcol` plus
constraint-supplied houses. The check is a stock 9x9 with no custom constraint
code, reading the solver's masks the same way.

## Reproducing

Probe scripts and the variant links live in the session scratchpad, not the
repo; they rebuild cheaply from the decoded link. The two that matter are the
instrumented naked-singles component and the reporter component — both are
ordinary line components registered per house by a main code that slices
`getAllRows()`/`getAllColumns()` at both ends. Read the solver's view with
`puzzle.getCandidatesBitMask`, and read the drawn view from each cell's
`<svg text>` (small `font-size` is a pencil mark, large is a value).
