# SudokuMaker issue #22: "Solver ignores broken puzzle sometimes"

Upstream: https://github.com/SudokuMaker/issues/issues/22 (curlingclips, 2026).
Read and reproduced 2026-09-14 against bundle v2026.08.14-d47fc4b in Node,
using `examples/_shared/bundle-solve-lib.mjs` (#429).

## Verdict

Not a lost abort. `initialize` runs exactly once per component, when it
enters the solve, and is never called again. Both repros put a state
check (`puzzle.hasValue(cellIds[0])`) in `initialize`. At that moment the
cell has candidates but no value, so the check is false, nothing is
yielded, and a component with no `update` never runs again. The search
then sets the cell and finds solutions.

The reporter's observation that `getCandidates(c).size == 1` "fixes" it
is the same fact from the other side: after the givens propagate, R1C1
has one candidate but `value` is unset until a naked-single step or a
branch calls `setValueAtCell`. The candidate form is true at initialize
time; the value form is not.

The "whole grid red / second click says broken" symptom is the same
component evaluated in a state that *does* have the value (the found
solution loaded back), where the abort fires. sirxemic's comment on the
issue calls this a solver-vs-validator inconsistency and wants it
reported as such rather than as "no solution".

## Evidence

Bundle bodies (`docs/research/humanify-pedagogy/bundle.claude.js`):

- `initializeComponent` 8823 and `applyInitialGridToState` 11497: the
  only call of `initialize` on a registered component. An `AbortSolver`
  yielded there becomes a `failed` result and is returned.
- `processChange` ReplaceComponent branch 9091: the replacement's
  `initialize` is drained immediately; an abort there is yielded up and
  the branch returns. Not lost.
- `updateConstraints` 9005: the fixpoint calls `component.update` only.
- Custom-code wrapper 10030: a custom `initialize` runs, then base
  `initialize`, which runs `update` once. No later hook.

Headless runs, one-cell-open grid (R1C1 empty, everything else given),
`docs/research/2026-09-14-sm-issue-22-initialize-is-one-shot.run.mjs`:

| variant | result |
|-|-|
| repro 1 as filed: `initialize` + `hasValue` | 1 solution (bug) |
| repro 1, same check moved to `update` | 0 solutions |
| repro 1, `initialize` + `getCandidates().size == 1` | rejected at initial grid |
| repro 2 as filed: `update` replaces with an `initialize`-only component | 1 solution (bug) |
| repro 2, replacement checks in `update` | 0 solutions |
| repro 2, replacement aborts unconditionally in `initialize` | rejected at initial grid |

Row 3 and row 6 are the proof that an abort from `initialize`, including
from a replacement's `initialize`, is honoured. Only the timing of the
check differs.

## What a fix looks like

For SudokuMaker, in order of cost:

1. Document `initialize` as one-shot: "runs once when the component
   enters the solve; state checks belong in `update`". Cheapest, and
   closes both repros as authoring errors.
2. Warn at compile time when a custom component defines `initialize`
   and no `update` and no `validate`: such a component can only act on
   the initial grid. Catches the pattern where it is written.
3. sirxemic's own proposal: when a found solution, loaded back, fails
   the constraints, report "solver and validator disagree" instead of
   "broken". This is a reporting change, not a solver change.

Not a fix: calling `initialize` again on every state. That would change
the meaning of every existing component that uses `initialize` for
one-time setup.

For this repo: `docs/component-contract.md` should say the same thing in
one line beside `initialize`.
