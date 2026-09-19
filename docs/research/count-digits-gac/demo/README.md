# CountDigits demo board (#568)

A small board a reader can read, carrying **both** count-digits components in
one link, so they can switch between them and feel the difference. The timing
rig (`../sparse/`, #543) proves the gap with 20 undrawn groups; this board
draws the constraint and keeps it to four groups.

## The link

`PUZZLE_LINK_demo.txt` — a plain 9x9 sudoku document, 20 givens, `[unique]`,
nothing entered.

- **Four groups.** Each is a connected region of 10 cells drawn as a coloured
  dashed cage, its listed digits as the cage's label (top-left corner). A
  one-cell cage of the same colour, labelled `#`, marks the group's **counter**.
  The counter's digit is how many of the region's cells hold one of the listed
  digits. The rules text says so.
- **Two custom constraints**, identical except for the class their backend
  registers: `CountDigits (built-in)`, the app's own validate-only rule, and
  `CountDigits (GAC)`, `CountDigitsGacComponent` with its commentary kept (the
  code box reads as a walkthrough of the component). The GAC one ships enabled.

## How to toggle

Elements panel (left) → the three-dot menu on a `CountDigits` element →
**Disable** / **Enable**. Turn one off and the other on (a disabled element is
greyed), then press the "find all solutions" button and read the time. Do
not use "Disable for solver" for this: it is a different flag
(`solverIgnored`) and leaves the element switched on.

On the wire the flag is `"disabled": true`, absent when enabled. `enabled` is
the in-memory name (`createConstraint`, `bundle.claude.js:9762`); the app's
saver writes `disabled` (`Ec.save` in `main-*.js`), and a link carrying
`"enabled": false` loads with the element still on.

## The ladder (2026-09-19, v2026.08.14-d47fc4b)

Draws: `--search SEED --groups G --targets T --digits 3`, carved to unique,
built-in cold, one rep per cell (ms, the app's "sum" readout; GAC in brackets).

| groups x cells | seed 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| 3 x 8 | 0 (0) | 0 (0) | 700 (100) | | | | | | |
| 3 x 12 | 100 (0) | 0 (0) | 0 (0) | | | | | | |
| 4 x 8 | 100 (0) | 300 (0) | 200 (0) | | | | | | |
| 4 x 10 | | | | 500 (100) | 100 (0) | 1000 (100) | **2100 (100)** | 600 (100) | 200 (0) |
| 4 x 12 | 300 (100) | 900 (0) | 100 (0) | | | | | | |
| 4 x 14 | | | | 100 (0) | 200 (0) | 100 (100) | 300 (100) | 100 (0) | 100 (0) |
| 5 x 6 | | | | 100 (0) | 200 (0) | 100 (0) | 1000 (0) | 200 (0) | 100 (0) |
| 5 x 8 | 200 (0) | 3500 (300) | 500 (0) | 600 (100) | **29000 (600)** | 800 (100) | 1600 (0) | 800 (0) | 100 (0) |
| 5 x 12 | 1200 (200) | 2800 (300) | 100 (0) | | | | | | |
| 6 x 8 | 17400 (100) | 300 (0) | 3000 (300) | | | | | | |
| 6 x 12 | no fit | no fit | no fit | | | | | | |

Three things the ladder says:

- **Most draws show nothing.** A board with 3 or 4 groups usually solves in
  under a second under both. The gap is a property of the draw as much as the
  size: 4 x 10 spans 100ms to 2100ms across seeds.
- **Group count moves the gap more than group size.** Larger groups did not
  help (4 x 14 tops out at 300ms); 5 groups gave three draws of 2.8s or more,
  6 groups the 17s one. Six 12-cell groups do not fit on 81 cells.
- **The GAC column never leaves 600ms**, whatever the built-in does.

Three-rep confirmation of the candidates that cleared ~2s (cold / after the
app's logical solver; median sum, ms):

| board | built-in cold | GAC cold | built-in after-logical | GAC after-logical |
|---|---|---|---|---|
| 4 groups x 10, seed 7 **(shipped)** | 2000 | 100 | 900 | 0 |
| 5 x 8, seed 2 | 3500 | 300 | 1400 | 200 |
| 5 x 12, seed 2 | 2700 | 300 | 2200 | 300 |
| 5 x 8, seed 5 | 28100 | 600 | 10600 | 100 |

**Why 4 x 10 seed 7 ships:** it is the smallest rung that clears the ~2s aim
(4 groups, 40 cells, 20 givens), and it is the one a reader waits two seconds
for, not half a minute. The cost: 2000ms is the aim's floor, not a wide margin,
and after the logical solver has run the built-in drops to 900ms. The board
opens cold, so the reader sees 2s against 0.1s. A reader who wants the
dramatic version (28s against 0.6s) can build the 5 x 8 seed-5 draw, kept as
`gen_5x8.json` (a draw is not replayable from its seed: the grid comes from
CP-SAT's portfolio search):
`uv run examples/outside-sudoku/build_count_digits_demo.py --gen docs/research/count-digits-gac/demo/gen_5x8.json --out <dir>`.

Through the app's own menu (Disable on the GAC element, Enable on the built-in,
one rep each, non-deterministic solve off): GAC 100ms, built-in 1900ms, both
"unique solution".

## Decode of the shipped link

Both constraints present, exactly one enabled (`disabled` absent means enabled;
the test asserts this from the committed link):

```
type sudoku   givens 20   entered 0
0     Given digits                              enabled
1     Regions                                   enabled
2001  Group 1: count of 5 6 8                   enabled
2001  Group 2: count of 3 5 6                   enabled
2001  Group 3: count of 5 6 9                   enabled
2001  Group 4: count of 1 4 9                   enabled
1000  CountDigits (built-in)                    disabled   (no component code)
1000  CountDigits (GAC)                         enabled    (annotated component)
```

In the app the disabled element is greyed in the Elements panel.

## Rebuild and check

```
uv run examples/outside-sudoku/build_count_digits_demo.py          # rebuild the link from gen.json
uv run examples/outside-sudoku/build_count_digits_demo.test.py     # board, uniqueness, flags, annotation, reproduction
node examples/_shared/app-solve.mjs docs/research/count-digits-gac/demo/PUZZLE_LINK_demo.txt 3
```

`--enabled builtin --out DIR` writes the same board with the other component
on, for timing outside the app's menu.

**Uniqueness** is proved by CP-SAT through `examples/_shared/cpsat.py` (the
sparse builder's `model()` and `count_solutions()`), from the 20 givens, in the
test. **Readability caveat:** the app draws cosmetic cages as thin dashed
outlines, and the regions grow at random, so two regions that meet can be
hard to tell apart; the colour and the `#` marker are what carry it.
