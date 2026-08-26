# Testing and generation off the app

You cannot step a component in the SudokuMaker solver. Test the logic outside
the app instead. Two jobs: prove the component is **sound**, and prove the
puzzle has a **unique** solution.

> To time a component in the *real* app solver (not our mock), drive the live
> site with Playwright — see `docs/real-app-timing.md`.

## Soundness: mock the solver in Node

Soundness means the component never removes a candidate that the true solution
needs. Test it by mocking the handful of `puzzle` methods the component calls,
then running `update` against the real solution in many partial states and
checking that every cell still allows its true value.

The mock only needs the methods your component touches. For an edge-clue
component that is: `hasValue`, `getValue`, `getCandidates`, `getCellsAreFilled`,
`removeCandidatesFromCell`, plus globals `helpers.digits` and `SudokuDigitSet`.

```js
globalThis.SudokuDigitSet = { from: a => ({ __s: new Set(a), [Symbol.iterator]() { return this.__s[Symbol.iterator]() } }) }
globalThis.helpers = { digits: { minDigit: 1, maxDigit: 9 } }
// load the component's functions, then for each line and many random
// "filled" subsets: run update, assert every cell keeps its true candidate.
```

See `examples/running-start/soundness-harness.mjs` for a complete version that
runs 20,000 random partial states. A single removed true candidate is a bug in
the rule; zero across a large random sample is strong evidence of soundness.

Why partial states with full candidate sets are enough: real solving only ever
holds *fewer* candidates than the full set, and every removal an arc-consistent
rule makes is justified by the filled values alone. If the rule is sound with
full candidate sets, tighter ones stay sound.

## Uniqueness and generation: OR-Tools CP-SAT

Model the rule as constraints over the 81 interior cells and count solutions
(cap at 2). Uniqueness ≠ presence of a solution — you must show no *second*
solution exists:

1. Solve the model → solution `S1`.
2. Add a clause "not all cells equal `S1`".
3. Solve again. Infeasible → the puzzle is unique.

To generate a puzzle:

1. Build a random valid sudoku (the pattern-and-shuffle trick needs no solver).
2. Derive each clue from the solution.
3. Keep all clues; add interior givens until unique; then carve givens back out
   while it stays unique. Carve clues too if you want fewer.

`examples/running-start/generate.py` does all of this and scans several seeds
for the leanest grid. Note a real finding there: running-start clues are weak,
so all four sides with **no** interior givens is *not* unique — a few givens are
unavoidable.

Modeling tip: express the rule with plain CP-SAT relations when the clue is a
constant. Running Start with clue `k` over line `x[0..8]` is exactly:
`x[0] < x[1] < ... < x[k-1]`, and if `k < 9`, `x[k] < x[k-1]`. Make the CP-SAT
model and the JS component agree on the rule, or your uniqueness proof describes
a different puzzle than the app enforces.
