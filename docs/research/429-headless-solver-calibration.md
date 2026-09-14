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

Both are the CP-SAT-unique solution, matched digit for digit (Platinum Blonde
and Fata Morgana against CP-SAT directly; the frame board against its own
recorded unique verdict).

## The Node number is a ranking, not the number on record

The browser row is what a real player experiences and stays what
`docs/real-app-timing.md`'s "a deduction must pay for itself" gate is judged
against. Node's number moves for reasons that have nothing to do with the
puzzle: `new Function`-compiled custom-component code never gets the same JIT
warmup as code loaded as a real script, and `bundle-solve.mjs` disables
verbose solving (`verbose: false` in the "start" message) where the app's own
Find-All button does not appear to. That second difference is the likely
reason the frame board flips sign (Node *faster* than the browser) while the
two classic boards do not:

- The frame board carries far more constraint components (one
  `SkyscraperLineComponent` per row and column) than a plain classic sudoku
  does. `VerboseChangeApplier` (bundle.claude.js:2078) records every
  affected cell of every change, expanded through clone sets, for every
  component on every step -- a cost that scales with component count, not
  with search size.
- A classic board (Platinum Blonde, Fata Morgana) has only the box-region and
  row/column components, so the same verbose bookkeeping is cheap there; the
  slowdown Node shows on those two boards is dominated by the interpreter
  cost the frame board pays too, just not enough to outweigh what disabling
  verbose solving saves it.

This is the leading explanation, not a proven one -- `bundle-solve.mjs` has
no lever to turn verbose solving on and measure the difference directly (the
app's own Find-All path was not instrumented for this ticket). Worth
revisiting if a future ticket needs Node and browser numbers to agree in
sign as well as order of magnitude.

## Reproducing

```
node examples/_shared/bundle-solve.mjs docs/research/406-gac-demo/hard/Platinum_Blonde_base.txt 5
node examples/_shared/bundle-solve.mjs docs/research/406-gac-demo/hard/Fata_Morgana_base.txt 5
node examples/_shared/bundle-solve.mjs examples/skyscraper/PUZZLE_LINK.txt 5
```
