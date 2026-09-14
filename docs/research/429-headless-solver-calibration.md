# 429: calibrating the headless solver harness against the browser

`bundle-solve.mjs` (examples/_shared) runs the app's real solver bundle in
Node, no browser, so a batch of links can be scored in the time a single
browser tab takes to solve one. This calibrates its number against the
browser rows already on record for three boards, using `bundle-solve.mjs
<link_file> 5` (5 reps, median) against `just time <example>`'s cold row
(non-deterministic solve off, same as the browser driver).

| board | link | Node median | browser cold (on record) | factor (Node / browser) |
| --- | --- | --- | --- | --- |
| Platinum Blonde (21 clues) | `docs/research/406-gac-demo/hard/Platinum_Blonde_base.txt` | 2215 ms | 100 ms (`406-gac-demo/hard/README.md`) | 22.1x slower |
| Fata Morgana (21 clues) | `docs/research/406-gac-demo/hard/Fata_Morgana_base.txt` | 3110 ms | 200 ms (`406-gac-demo/hard/README.md`) | 15.5x slower |
| Skyscrapers frame board | `examples/skyscraper/PUZZLE_LINK.txt` | 1087 ms | 8100 ms (`examples/skyscraper/README.md`, 2026-09-10, same commit that last touched the link) | 0.13x -- **faster** |

Platinum Blonde and Fata Morgana are matched digit for digit against CP-SAT
directly (see "CP-SAT cross-check" below); the frame board is matched against
its own recorded unique verdict.

## The Node number is a ranking, not the number on record

The browser row is what a real player experiences and stays what
`docs/real-app-timing.md`'s "a deduction must pay for itself" gate is judged
against. Node's number moves for reasons that have nothing to do with the
puzzle: `new Function`-compiled custom-component code never gets the same JIT
warmup as code loaded as a real script, and `bundle-solve.mjs` disables
verbose solving (`verbose: false` in the "start" message) where the app's own
Find-All button does not appear to.

## Why the frame board flips sign

The frame board is the one entry where Node comes out *faster* than the
browser, not just less slow. Disabling verbose solving was the first
suspect: `VerboseChangeApplier` (bundle.claude.js:2078) records every
affected cell of every change, expanded through clone sets, for every
component on every step, and the frame board carries far more components
(one `SkyscraperLineComponent` per row and column) than a plain classic
sudoku's box-region and row/column components. Tested directly (not left as
a guess) by loading the bundle a second way and setting `verbose: true` in
the "start" message for the same board:

```
verbose=false: median 1083ms  (1061, 1075, 1083, 1083, 1137)
verbose=true:  median 1506ms  (1472, 1483, 1506, 1516, 1580)
```

Verbose solving costs about 1.4x here -- real, and in the expected
direction, but nowhere near enough to explain the ~7.6x reversal against the
browser's 8100 ms row. **The reversal is not explained by this diff's
harness alone; most of the gap is still open.** Filed as a follow-up rather
than asserted away: something about running the same bundle in the browser
(a different V8 build, DOM/event-loop overhead per posted message, or the
recorded HAR playback itself) costs the frame board specifically far more
than it costs a classic board, and this note does not have the browser-side
instrumentation to say what.

## CP-SAT cross-check

The without-GAC link's CP-SAT solution, used both as the "406 demo without-
GAC link yields exactly one solution" acceptance criterion and as
`bundle-solve.test.mjs`'s literal:

```
uv run python3 -c "
import sys, json
sys.path.insert(0, 'examples/_shared')
from link_codec import decode_puzzle
from cpsat import SOLVED, has_second_solution, solver
from ortools.sat.python import cp_model

doc = decode_puzzle(open('docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt').read().strip())
givens = {}
for i, cell in enumerate(doc['puzzle']['cells']):
    if cell.get('given'):
        r, c = divmod(i, 9)
        givens[(r, c)] = int(cell['value'])

m = cp_model.CpModel()
x = {(r, c): m.NewIntVar(1, 9, f'x{r}{c}') for r in range(9) for c in range(9)}
for (r, c), v in givens.items():
    m.Add(x[r, c] == v)
for i in range(9):
    m.AddAllDifferent([x[i, c] for c in range(9)])
    m.AddAllDifferent([x[r, i] for r in range(9)])
for br in range(3):
    for bc in range(3):
        m.AddAllDifferent([x[br * 3 + i, bc * 3 + j] for i in range(3) for j in range(3)])
s = solver(60)
assert s.Solve(m) in SOLVED
sol = {k: s.Value(v) for k, v in x.items()}
assert not has_second_solution(m, x, sol, 60)
print(''.join(str(sol[r, c]) for r in range(9) for c in range(9)))
"
```

prints `265783149387149562941562783594627831726831495138495627413956278872314956659278314`
-- the literal `bundle-solve.test.mjs` asserts `solveDocument` returns.

## Reproducing

```
node examples/_shared/bundle-solve.mjs docs/research/406-gac-demo/hard/Platinum_Blonde_base.txt 5
node examples/_shared/bundle-solve.mjs docs/research/406-gac-demo/hard/Fata_Morgana_base.txt 5
node examples/_shared/bundle-solve.mjs examples/skyscraper/PUZZLE_LINK.txt 5
```
