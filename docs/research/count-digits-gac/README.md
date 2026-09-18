# CountDigitsGacComponent

A pruning replacement for the app's built-in CountDigits rule
(`CountDigitsComponent(name, digits, counterCell, targetCells)`), which is
validate-only and removes no candidate ever. See
`CountDigitsGacComponent.js`'s own header for the rule, the three deductions
and the soundness argument.

**Verdict: `two-row rule: SHIP`** — 0.04x cold and 0.10x after-logical on a
board the built-in takes 4.6s to search (below, "Recorded rows"). Sound on
24,709 fuzzed states, and exactly arc-consistent where the counter cell is not
one of its own targets.

## Files

| File | What it is |
|---|---|
| `CountDigitsGacComponent.js` | The replacement itself. |
| `BuiltinCountDigitsComponent.js` | The built-in's own rule, ported verbatim from the bundle body, for the offline comparisons below. Not for use in a puzzle — the app already has this one. |
| `count-digits.test.mjs` | One hand-worked case per deduction, plus both stop paths and `validate`. |
| `soundness-harness.mjs` | Soundness, strength against the built-in, and completeness against a brute-force oracle. |
| `bench-count-digits.mjs` | Per-call cost against the built-in, 20,000 states per shape, best of 3. |
| `sparse/` | The real-app timing board (#543), below. |

## What the built-in does, and does not

`CountDigitsComponent` (`bundle.claude.js:5092`,
`docs/research/bundle-api-reference.md`, "CountDigits") defines no `update`. It
is `validateDuringSolve`, so the solver asks it about every state, and it
refuses the ones where the definite hits already exceed the counter's largest
candidate or the possible hits fall short of its smallest. That is the whole
of it: the search learns the rule by trying a digit and being told no, never by
having the digit removed.

**No special-casing to confound the comparison.** `addConstraintComponent`
(`bundle.claude.js:8729`) tests three classes — `HouseComponent`,
`SameDigitComponent`, `RequiredDigitsComponent` — and CountDigits is none of
them, so a built-in CountDigits registers nothing in the app's candidate-set
map. That is what made the sparse required-digits row next door
(`docs/research/required-digits-gac/README.md`) a measurement of "is our
component a good swap" rather than "is the rule worth it"; here the two sides
get the same help from the app, and the row reads as the pruning alone.

## Offline: soundness, strength, completeness

```
node docs/research/count-digits-gac/count-digits.test.mjs
node docs/research/count-digits-gac/soundness-harness.mjs
node docs/research/count-digits-gac/bench-count-digits.mjs
```

Soundness: 24,709 states across seven shapes, 0 violations.

Completeness: the harness enumerates every assignment the candidates allow,
keeps the ones obeying the rule, and reads each cell's supported digits off
them. On the shapes where the counter cell is not one of its own targets the
component removes exactly what that oracle removes — 9,754 candidates, none
missed, over 7,688 states. It is arc consistency, not an approximation of it.
With the counter inside its own target list it stays sound and goes weaker
(986 of 4,211 removable candidates missed): the bounds it reads move as the
counter itself shrinks, and the walk reads one snapshot. The solver's own
fixpoint recovers some of that on the next pass; the harness measures a single
sweep.

Strength: on those 24,709 states, all of which still hold a solution, the
component removed 26,581 candidates and the built-in's `validate` accepted every one of
those states. That is the shape of the comparison, not a close call — a
validate-only rule cannot remove anything, so every number in that column is
the deduction the search would otherwise have to find by trial.

Cost (us/call, best of 3, 20,000 states per shape):

| shape | builtin validate | gac update | gac validate |
|---|---|---|---|
| 5 targets, 2 digits | 0.048 | 0.155 | 0.060 |
| 12 targets, 3 digits | 0.041 | 0.126 | 0.075 |
| 20 targets, 3 digits | 0.073 | 0.181 | 0.134 |
| 30 targets, 4 digits | 0.079 | 0.267 | 0.197 |

Both sides are one pass over the target cells, so the gap is a constant factor
on a fraction of a microsecond. A custom component that defines `validate` gets
`validateDuringSolve` forced true by the wrapper
(`docs/component-contract.md`), so the candidate pays the middle column on
every changed watch cell and the right-hand column on every state, against the
built-in's left-hand column on every state.

## Sparse board timing (#543)

`sparse/` holds the board: `gen.json` (the solution grid, the generated table
of 20 groups, and the carve order the givens come off), `main-sparse-global.js`
(the backend, which registers each group's component directly — no wrapper),
and the two links.

- **Groups**: 20 groups. Each is 14 target cells scattered anywhere on the
  board, a set of 3 digits, and a counter cell outside the group whose solution
  digit is the number of those 14 cells holding one of the 3 digits.
- **Rule**: stated once in `model()` in the build script (the CP-SAT side) and
  once in `CountDigitsGacComponent.js` (the JS side).
- **Uniqueness**: CP-SAT proves the shipped givens unique
  (`build_sparse_count_digits.test.py`, part of `just test`).
- **Two links, one board**: `PUZZLE_LINK_sparse_original.txt` registers the
  built-in `CountDigitsComponent`; `PUZZLE_LINK_sparse.txt` registers
  `CountDigitsGacComponent`. Same board and table; the backend differs in that
  one identifier, and the candidate link also ships the component code.

### Building the boards

```
uv run examples/outside-sudoku/build_sparse_count_digits.py            # rebuild both links
uv run examples/outside-sudoku/build_sparse_count_digits.py --carved K # change the depth, rebuild
```

The script lives in `examples/outside-sudoku/` beside
`build_sparse_required_digits.py`, whose rows-and-columns base and board shape
it reuses; `docs/research/` refuses a new `.py` file
(`check_research_python`, #469).

### Reproduce

Not `just time`: the board sits under `docs/research/`, so the driver has no
example directory to resolve (same reason as the sparse required-digits
board). Timed the way `docs/real-app-timing.md` says for a link-vs-link
comparison: one rep per variant per round, three rounds, non-deterministic
solve off, the app's "sum" readout.

```
D=docs/research/count-digits-gac/sparse
uv run examples/_shared/probe_link.py strip $D/PUZZLE_LINK_sparse.txt cand.txt
uv run examples/_shared/probe_link.py strip $D/PUZZLE_LINK_sparse_original.txt base.txt
node examples/_shared/app-solve.mjs base.txt 1 [--after-logical]   # then cand.txt, alternating
```

### Recorded rows (2026-09-18, v2026.08.14-d47fc4b, 3 reps, non-deterministic solve off)

| date | app version | board | mode | baseline (built-in) | candidate (GAC) | ratio | row PASS/FAIL |
|---|---|---|---|---|---|---|---|
| 2026-09-18 | v2026.08.14-d47fc4b | sparse-count-digits | cold | 4600ms | 200ms | 0.04 | PASS |
| 2026-09-18 | v2026.08.14-d47fc4b | sparse-count-digits | after-logical | 2100ms | 200ms | 0.10 | PASS |

Per-rep sums, cold: built-in 4500/4600/4600, GAC 200/200/300; after-logical:
built-in 2100/2100/2100, GAC 200/200/200.

`two-row rule: SHIP`. Both rows clear 0.9x by more than an order of magnitude.
The rule pays for itself and then some: pruning the counter to its reachable
range, and forcing the open cells once the counter is pinned to a bound, is
work the search otherwise does by trying a digit and being refused.

Read the candidate column as an upper bound, not a measurement. The app's
readout has 100ms granularity, so a 200ms sum is two ticks above zero — the
true ratio is at most what the table says. The board was built to make the
*baseline* search, and against a rule that prunes at all it barely searches.

**The verdict is the same answer, reached faster.** Both links report `[unique]`
in the app, and both, run through the real bundle offline
(`examples/_shared/bundle-solve-lib.mjs`), return exactly one solution equal to
`gen.json`'s grid — 26,952ms for the built-in, 5,443ms for the GAC component.
So the speed-up is not a component pruning its way to a wrong or empty answer,
and the component demonstrably runs: a swap that failed silently
(`docs/gotchas.md` #1) could not make the solve twenty times faster.

### Depth

`gen.json`'s `carved` is the knob (`givens_of` in the build script). The
board's baseline time is a cliff, not a slope, so the ladder is worth keeping:

| carved | givens | built-in, cold |
|---|---|---|
| 35 | 46 | 0ms |
| 52 | 29 | 0ms |
| 60 | 21 | 100ms |
| 62 | 19 | 300ms |
| 63 | 18 | 600ms |
| **64** | **17** | **4600ms** |
| 65 | 16 | 21,400ms |
| 67 | 14 | DNF (the driver's timeout) |
| 70 | 11 | DNF (the whole carve) |

64 is the shipped depth: the first rung where the built-in really searches
(the ticket asked for a baseline median above about 1s) and still finishes.
