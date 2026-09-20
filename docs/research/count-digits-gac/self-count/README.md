# Self-counting CountDigits board (#581)

A board where **every group's counter is its own first target**, the shape
#578 made exact (`../counter-in-targets/NOTES.md`). It exists so the gain from
#578 can be timed: the colleague's board has two givens and no unique solution.

## The two links

Same board, one component swapped (same-board comparison,
`docs/real-app-timing.md`):

| link | component |
|---|---|
| `PUZZLE_LINK_selfcount_current.txt` | `../CountDigitsGacComponent.js` (with #578) |
| `PUZZLE_LINK_selfcount_pre578.txt` | `CountDigitsGacComponent.pre578.js` (`git show d0b1854:docs/research/count-digits-gac/CountDigitsGacComponent.js`) |

Each is a 9x9 sudoku, CP-SAT-unique (the app's `[unique]` readout is the controller's to confirm), `entered: 0`, one custom constraint, digits
`2 4 6 8`. In `input.groups` a group is `[counter, counter, ...others]`, the
colleague's spelling. Cages are cosmetic (a dashed cage over the group with its
digits, a one-cell `#` cage on the counter) and pinned to `input.groups` by the
test. Backend and cages are byte-equal across the two links.

## The board that ships: 6 groups x 10 cells, the largest pre-#578 search

`gen.json`: 17 givens, CP-SAT-unique, 1 of 6 counters holds an even digit (that
does not matter: the coupling prunes on the counter's candidates during search,
whatever its final digit). Picked on **search nodes**, below. Known cosmetic
flaw: in group 3 the counter is the region's top-left cell, so a cage label
draws the digit list and the `#` in one corner; the search now rejects that, but
this draw predates the rule.

Two other draws are kept because they lead on the ratio, not the size
(`--gen <file> --out <dir>` builds their links):

| file | shape | givens | pre-#578 nodes | current nodes | ratio |
|---|---|---|---|---|---|
| `gen.json` (ships) | 6 x 10 | 17 | 212246 | 196359 | 1.08 |
| `gen_5x10_ratio.json` | 5 x 10 | 18 | 59316 | 33745 | 1.76 |
| `gen_6x8_first.json` | 6 x 8 | 18 | 15015 | 5616 | 2.67 |

## The ladder (search nodes, in the app's own bundle, in Node)

My first ladder ranked draws by givens and even-counter counts. Those do not
predict difficulty: the first shipped draw read 100 ms / 100 ms in the browser.
This one counts `SolverState.clone` calls in the real solver bundle
(`node-probe.mjs`, the hall-in-bundle-probe technique) for each link, one run
each (nodes are deterministic; ms is Node's, a ranking only,
`docs/research/429-headless-solver-calibration.md`). Draws do not reproduce from
their seed (the grid comes from CP-SAT's portfolio search). Cell = pre-#578 /
current nodes.

| shape | s1 | s2 | s3 | s4 | s5 | s6 | s7 | s8 |
|---|---|---|---|---|---|---|---|---|
| 5 x 8 | 51867 / 40710 | 23904 / 23240 | 2159 / 2290 | 6102 / 5863 | 906 / 893 | 2251 / 2450 | 800 / 554 | 2418 / 2174 |
| 6 x 8 | 7191 / 6335 | 9017 / 8376 | 19502 / 17393 | 9816 / 12485 | 13207 / 11320 | 23138 / 23634 | 4297 / 4292 | 5364 / 5241 |
| 5 x 10 | 9979 / 8976 | **59316 / 33745** | 5638 / 5279 | 34756 / 32410 | 4628 / 4105 | 7477 / 7160 | 4721 / 4473 | 14760 / 13829 |
| 6 x 10 | 29469 / 27394 | 33683 / 32367 | 115278 / 98126 | **212246 / 196359** | 19236 / 18187 | 10517 / 10540 | 2393 / 2237 | 105093 / 101496 |
| 5 x 12 | 180234 / 178346 | 97198 / 94940 | 59480 / 58785 | 17286 / 17625 | 13057 / 13158 | 37756 / 33670 | 1964 / 1807 | 127232 / 112242 |
| 4 x 12 | 6736 / 7522 | 3791 / 4003 | 12497 / 11800 | 5600 / 5505 | 28166 / 26613 | 892 / 892 | 16962 / 16829 | 2351 / 2318 |

7 groups x 8 cells, 7 x 6 and 8 x 6 (8 draws each): every one exceeded 180 s in
Node on **both** links, so no ratio.

What it says: on 47 of the 48 measured draws the two components search almost the
same tree (pre-#578 / current 0.8 to 1.3); the exception is 5 x 10 seed 2 at
1.76, and the first shipped draw, outside the table, read 2.67. Draw shape and luck move difficulty by orders of magnitude;
#578 moves it by a few percent, and the two large ratios are on the smaller
searches. So #578 buys strength, not speed, on this shape, except on the odd
draw. **The browser time of the shipped and the two ratio candidates is the
controller's to measure.**

## Timing (controller)

```
node examples/_shared/app-solve.mjs docs/research/count-digits-gac/self-count/PUZZLE_LINK_selfcount_pre578.txt 3
node examples/_shared/app-solve.mjs docs/research/count-digits-gac/self-count/PUZZLE_LINK_selfcount_current.txt 3
```

Numbers: _not yet measured_.

## Rebuild and check

```
uv run examples/outside-sudoku/build_count_digits_selfcount.py
uv run examples/outside-sudoku/build_count_digits_selfcount.test.py
```
