# CountDigits demo board (#568)

A small board a reader can read, carrying **both** count-digits components in
one link, so they can switch between them and feel the difference. The timing
rig (`../sparse/`, #543) proves the gap with 20 undrawn groups; this board
draws the constraint and keeps it to five groups of eight cells.

## The link

`PUZZLE_LINK_demo.txt` — a plain 9x9 sudoku document, 17 givens, `[unique]`,
nothing entered.

- **Five groups, on the local lane.** The groups reach the solver through
  `input.groups`, the way an author would draw them: each group's `value` is its
  digit list (`5 6 8`), its **first cell is the counter** and the rest are the
  targets. The backend (`main-demo.js`) parses the digit mask out of `value`;
  there is no parallel table. The counter's digit is how many of the group's
  cells hold one of the listed digits. The rules text says so.
- **Two custom constraints**, identical except for the class their backend
  registers: `CountDigits (built-in)`, the app's own validate-only rule, and
  `CountDigits (GAC)`, `CountDigitsGacComponent` with its commentary kept (the
  code box reads as a walkthrough of the component). The GAC one ships enabled.
  **Both carry the same `input.groups`**, emitted once from `gen.json`, and the
  test asserts the two lists are equal cell for cell, counter included: if they
  ever differed the link would time two different puzzles.

### What the app draws, and why the cages stay

Looked at with `shot-scraper`, on the shipped link:

- **Unselected**, a custom constraint's groups are not drawn at all: the grid
  shows only the givens. (`framebuild.clue_labels` says the same for the frame
  boards.)
- **Selected** in the Elements panel, the app opens the group editor: one tab
  per group (1-5), a `Value:` field (`5 6 8`), and the group's cells shaded blue
  and numbered in draw order, **0 on the counter cell**, 1..10 down the
  targets. So the order and the `value` are both reachable, but every group is
  the same blue, and it is only there while the element is selected.

That is not a coloured, labelled, always-visible drawing, so the cosmetic
cages stay (one element per group: a dashed cage in the group's colour labelled
with the digits, a one-cell `#` cage on the counter). They are decoration the
solver never reads, so the test pins them to `input.groups`: each cage is its
group's targets, each `#` cage its counter, each label its `value`.

**Round trip, checked in the app** (Share → link → clipboard, then decoded):
both constraints' `input.groups` come back equal cell for cell with the counter
first, and `disabled` is kept. The only differences in the whole document are
`type`, `width` and `height`, which the app drops as defaults.

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
| 4 groups x 10, seed 7 (kept alternative) | 2000 | 100 | 900 | 0 |
| 5 x 8, seed 2 | 3500 | 300 | 1400 | 200 |
| 5 x 12, seed 2 | 2700 | 300 | 2200 | 300 |
| 5 x 8, seed 5 (**shipped**) | 28100 | 600 | 10600 | 100 |

**Why 5 x 8 seed 5 ships (owner ruling, #568):** it is the dramatic board, and
that is the demonstration. The 4 x 10 draw's 2000ms sat exactly on the ~2s aim
with no margin, so a faster machine or a luckier search order could bring the
built-in under a second and the demo would stop showing anything. The cost
recorded: a half-minute wait for the built-in solve, and a busier grid (five
cages, 40 cells, 5 counters, on 17 givens) than the four-cage one. The 4 x 10
draw is kept as the smaller alternative, `gen_4x10.json` (a draw is not
replayable from its seed: the grid comes from CP-SAT's portfolio search, so
neither draw is re-derived; a swap is a rename plus a rebuild):
`uv run examples/outside-sudoku/build_count_digits_demo.py --gen docs/research/count-digits-gac/demo/gen_4x10.json --out <dir>`.

### Confirmation run on the shipped link (2026-09-19, v2026.08.14-d47fc4b)

`PUZZLE_LINK_demo.txt` as committed (groups through `input.groups`), the other
component switched on with `--enabled builtin`, 3 reps each, non-deterministic
solve off, the app's "sum" readout (ms):

| mode | built-in reps | built-in median | GAC reps | GAC median | ratio |
|---|---|---|---|---|---|
| cold | 29400 / 29600 / 30000 | 29600 | 600 / 700 / 800 | 700 | 0.02 |
| after-logical | 11200 / 11000 / 10900 | 11000 | 100 / 100 / 100 | 100 | 0.01 |

All twelve runs read `[unique]`. Through the app's own menu (Disable on the GAC
element, Enable on the built-in, one rep): built-in 29600ms, `unique solution`.
The ladder's one-rep and the older 3-rep figures above are the evidence for the
choice; these are the measurement of the board that ships.

## After #578 (counter-in-targets)

The component now reads the counter's own contribution to its count. This board
has no counter-in-targets group, so the extra work should cost it nothing:
link vs link, the committed link before the change against the rebuilt one
(`just time` has no candidate to build for a board that carries the component
inline), 3 reps, non-deterministic solve off, the app's "sum" readout (ms).

| mode | before reps | before median | after reps | after median | ratio |
|---|---|---|---|---|---|
| cold | 600 / 600 / 600 | 600 | 600 / 600 / 600 | 600 | 1.00 |
| after-logical | 100 / 100 / 100 | 100 | 100 / 100 / 100 | 100 | 1.00 |

Bar: this change adds no deduction to a board that uses it, so the
"adds no deduction" bar of `docs/real-app-timing.md` applies, <= 1.1x on both
rows; both read 1.00x, though at the app's 100 ms readout that resolves only a
large regression. Both links read `[unique]` on every run (medians as the driver printed them).

## Decode of the shipped link

Both constraints present, exactly one enabled (`disabled` absent means enabled;
the test asserts this from the committed link):

```
type sudoku   givens 17   entered 0
0     Given digits                              enabled
1     Regions                                   enabled
2001  Group 1: count of 2 6 7                   enabled
2001  Group 2: count of 2 3 5                   enabled
2001  Group 3: count of 1 3 8                   enabled
2001  Group 4: count of 2 7 8                   enabled
2001  Group 5: count of 2 3 4                   enabled
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
sparse builder's `model()` and `count_solutions()`), from the 17 givens, in the
test. **Readability caveat:** the app draws cosmetic cages as thin dashed
outlines, and the regions grow at random, so two regions that meet can be
hard to tell apart; the colour and the `#` marker are what carry it.
