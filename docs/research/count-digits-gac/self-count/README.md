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

Each is a 9x9 sudoku, `[unique]`, `entered: 0`, one custom constraint, digits
`2 4 6 8`. In `input.groups` a group is `[counter, counter, ...others]`, the
colleague's spelling. Cages are cosmetic (a dashed cage over the group with its
digits, a one-cell `#` cage on the counter) and pinned to `input.groups` by the
test. Backend and cages are byte-equal across the two links.

## The board that ships: 6 groups x 8 cells, seed 1

18 givens, 6 groups, **5 of 6 counters hold an even digit** (a counter with an
odd solution digit does not count itself, so it is the old shape in disguise).
`gen.json`; alternates `gen_5x8.json` (5 x 8, 17 givens, 4 even counters) and
`gen_5x10.json` (5 x 10, 18 givens, 4 even counters), rebuilt with
`--gen <file> --out <dir>`.

## The ladder (structural; NOT timed)

Draws: `--search SEED --groups G --targets T`, carved to unique by CP-SAT. This
worker cannot drive the app (no Chromium in the sandbox), so the ladder ranks
draws by what should make a gap: many groups (`../demo/README.md`: count moves
the gap more than size), few givens, many even counters. **The gap itself is the
controller's to measure**; the shipped draw is a structural pick, and the
alternates are there if it shows none.

| shape | seed 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 4 x 8 | 21g / 4e | 20 / 2 | 21 / 2 | 19 / 3 | 19 / 2 | 21 / 2 |
| 5 x 6 | 18 / 2 | 20 / 2 | 18 / 2 | 18 / 2 | 19 / 2 | 19 / 1 |
| 5 x 8 | 17 / 4 | 19 / 2 | 21 / 2 | 19 / 3 | 19 / 3 | 19 / 2 |
| 5 x 10 | 18 / 1 | 18 / 4 | 20 / 1 | 19 / 1 | 20 / 3 | 18 / 4 |
| 6 x 8 | **18 / 5** | 16 / 2 | 18 / 2 | 17 / 4 | 16 / 3 | 17 / 3 |

Cell = givens / even counters.

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
