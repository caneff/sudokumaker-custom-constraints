# Numbered Rooms — optimized

A stronger constraint component for the "escape the grid" Numbered Rooms puzzle.

## The rule

A line reads inward from an outside clue cell. The first inside cell holds a
1-based index `k`. The clue equals the digit in the `k`-th inside cell:

    line[k - 1] === clue,   with k = value(line[0]).

The clue is a **cell** (its digit is part of the solution), not a fixed number.

## What was slow and weak

The shipped version split the work across a wrapper and the built-in
`IndexComponent`:

```js
// ORIGINAL_CustomIndexComponent.js
if (puzzle.hasValue(cell)) {
  yield puzzle.replaceComponent(instance,
    new IndexComponent(instance.name, puzzle.getValue(cell), cells[0], cells))
}
```

`IndexComponent` needs the clue as a constant, so the wrapper waited until the
clue cell `cell` collapsed to one value, then swapped the built-in in. Two costs:

- **Inert until the clue is solved.** Before that it pruned nothing — the line
  cells kept their full candidate sets and the solver got no help.
- **One direction only.** It never pushed information back from the line to the
  clue. Knowing `line[0] = 2` and `line[1] = 3` tells you the clue is `3`, but
  the wrapper could not use that.

## What this does instead

`NumberedRoomsComponent.js` is one self-contained component (the pattern
`docs/gotchas.md` #1 requires). Its `update` prunes candidates every pass, in
both directions, before the clue is solved:

1. Prune the indexer `line[0]`: drop any index that points at a cell whose
   candidates cannot meet the clue's.
2. Prune the clue: it can only hold a digit some still-feasible target allows.
3. When one index remains, make the target cell and the clue equal both ways —
   before either is a singleton.

## The pair fact — two clues on one line

A row (or column) usually carries a clue at each end. Let `a` be the left index
(the digit in the first inside cell) and `b` the right index (the digit in the
last inside cell). The left clue reads `line[a-1]`, the right clue reads
`line[N-b]` — the same cell exactly when `a + b === N + 1`. So:

    a + b === N + 1   =>  left clue === right clue     (always)
    left clue === right clue  =>  a + b === N + 1       (when the line is distinct)

The second direction holds only because a sudoku line has no repeats: equal clues
must be the *same* cell, not two different cells that happen to share a digit.

Two smaller facts fall out and need no extra code:

- **Index 1 forces clue 1.** If the first inside cell is 1, the index points at
  itself, so the clue is 1. The per-line component already deduces this (its
  reachable set collapses to `{1}`).
- The biconditional's easy half (`sum ⟹ equal clues`) is a plain consequence of
  the per-line rule; only the pair adds the cross-clue coupling.

`NumberedRoomsPairComponent.js` enforces the biconditional both ways. Because the
outside clues are often the given digits, "equal clues fix the index sum" prunes
the two index cells on the first pass — a deduction no single-line component can
reach.

## Files

- `main.js`, `NumberedRoomsComponent.js`, `NumberedRoomsPairComponent.js` — paste
  these three into the SudokuMaker constraint editor, replacing the old backend
  and `CustomIndexComponent`.
- `ORIGINAL_*.js` — the shipped version, kept for reference.
- `soundness-harness.mjs` — proves neither `update` removes a true value (405k
  line + 5k distinct-line pair + 13k non-distinct pair fuzz tests) and that each
  prunes early: the line component with the clue unsolved, the pair component
  with the index sum fixed by equal clues. The non-distinct block also proves the
  `getCellsSeeEachOther` guard is load-bearing (remove it and it fails).
- `build_link.py` — rebuilds the puzzle link with the new code, and carves the
  interior down to the givens in `min_givens.json` (drops the `given` flag on the
  rest, so those cells show empty).
- `PUZZLE_LINK.txt` — the ready-to-open puzzle: 36 clues, 3 interior givens.
- `derive_fixture.py` — decodes the hand-made puzzle (`numbered_rooms.url`) into
  `gen_9.json`: the interior solution, the 31 hand-made interior givens, the box
  regions, and the 36 clue+line groups.
- `gen_9.json` — that fixture, the start state the recovery probe seeds.
- `min_givens.json` — the carve result: the 3 interior givens the components need
  to solve by logic. Written by `recovery-probe.mjs`, read by `build_link.py` and
  `verify.py`.
- `recovery-probe.mjs` — runs the real components (the same `main.js` wiring
  SudokuMaker runs) over the fixture on top of a Régin-strength (GAC)
  all-different floor. It **carves** the interior — dropping each hand-made given
  while the components still solve the whole interior by propagation alone — to
  the minimum (3 of 31), writes that set to `min_givens.json`, then reports what
  propagation recovers from it and proves the puzzle unique with a DFS search. It
  reuses the shared engine in `../_shared/recovery-lib.mjs`. From the 3 givens the
  components solve the interior in full (3 → 81 cells) and the puzzle is unique by
  propagation alone — zero search nodes, one solution. It also **times ours against
  the original** wrapper. With the 3 carved givens both finish by propagation, so
  the probe drops to the hardest form — the pure-clue puzzle, 36 clues and zero
  givens, still unique — and makes both wirings solve it by search. The original
  (modelled as our line gated to fire only once its clue is pinned, no pair
  coupling — the same conservative model the Skyscraper probe uses) explores about
  6x more search nodes than our version. **But read that number with care:** the
  6x is specific to this hand-made puzzle, not a general property. On random 9x9
  boards the pair coupling wins about half the time and loses the other half — it
  adds per-node work, and with MRV branching the extra pruning does not reliably
  shrink the search tree; bigger boards just time out the toy engine. The general,
  board-independent wins of the stronger component are elsewhere: it deduces a
  blank clue (the wrapper cannot) and it is sound (the 405k-test soundness
  harness). On this puzzle the smaller search is a bonus, not the headline.
- `verify.py` — the independent OR-Tools check. It re-models the Numbered Rooms
  rule from scratch as a CP-SAT `AddElement` constraint (`line[line[0] - 1] ==
  clue`), never touching the component code, and confirms the shipped puzzle (the
  3 carved givens plus all 36 clues): the interior is uniquely solvable, the one
  solution matches the fixture, and the clues are load-bearing (keep the givens,
  drop every clue, and two completions remain). It also reports the logical floor
  — the clues alone, with zero givens, are already unique — which is why the
  hand-made 31 givens were far more than the puzzle needs.

## Run

    node examples/numbered-rooms/soundness-harness.mjs
    node examples/numbered-rooms/recovery-probe.mjs                    # carves, writes min_givens.json
    uv run --with ortools examples/numbered-rooms/verify.py            # independent OR-Tools check
    node examples/numbered-rooms/verify.test.mjs
    uv run --with lzstring examples/numbered-rooms/derive_fixture.py   # rebuild gen_9.json
    uv run --with lzstring examples/numbered-rooms/build_link.py       # ships the carved givens

## Carving the givens

The hand-made puzzle shipped 31 interior givens. That is far too many: with the
stronger component the 36 border clues do almost all the work. `recovery-probe.mjs`
carves the interior — it drops each given while the components still solve the
whole interior by propagation alone — down to **3 givens** (cells 83, 92, 108).
From those 3 the components solve all 81 cells by logic, no search. `build_link.py`
ships that carved puzzle.

Three givens, not zero: the clues alone are already *logically* unique (`verify.py`
reports this floor), but the components cannot reach that solution by propagation —
from zero givens they stall and a solver would have to search. Three givens is the
fewest that keep the puzzle solvable by the intended logic.

## Two independent checks

`recovery-probe.mjs` proves the carved puzzle unique under the shipped components
(a JS-side check over the sudoku all-different plus the Numbered Rooms rule). It
runs the same component code the app runs, so a bug shared by the component and
the probe would hide from both. `verify.py` is the independent guard against
that: it re-models the rule in OR-Tools from scratch and reaches the same
verdict — one solution, matching the fixture. The soundness harness is the third
guard: it proves the component never removes a true candidate.

## Not covered

Neither check regenerates a fresh puzzle the way `running-start/generate.py`
does; both verify the one hand-made puzzle in `gen_9.json` (carved). Numbered
Rooms has no generator (`derive_fixture.py` decodes the hand-made document), so
there is no fresh puzzle to regenerate.
