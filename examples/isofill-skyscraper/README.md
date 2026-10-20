# ISOFILL Skyscrapers — an ISOFILL interior in an interactive Skyscrapers ring

A 9x9 ISOFILL board (nine regions of nine orthogonally connected cells, one
digit per region, every digit 1-9 used) inside a ring of Skyscrapers clues.
Each ring cell counts the buildings visible along its row or column, reading
inward; a building the same height as the tallest so far is hidden. Blank ring
cells are interactive: the solver fills them as the line decides them.

Spec #855. This board is its first slice (#858); #859 searches region layouts
for a board whose givens sit in the ring alone, and times the link.

## The shipped board

`PUZZLE_LINK.txt`, recorded in `gen.json`: seed 101, **1 interior given, 22
shown clues, 14 interactive**. 30 of its 36 clued lines repeat a digit. Its
proof takes 2.9 s + 2.3 s (first solve, exclusion solve) on one CP-SAT worker,
against `framebuild`'s 10 s cap per solve.

## How it is built

`build_size.py` hands the shared ring builder (`_shared/framebuild.py`) a
`Spec` that uses its interior hook:

- **Grid**: `isofill_grid` draws a random ISOFILL solution from the sampler in
  `_shared/isofill_model.py`.
- **Model**: every uniqueness proof runs on the ISOFILL CP-SAT model in the same
  file, shared with `examples/isofill`, so both examples prove on one model.
  Exact counts plus a single-commodity flow per digit, rooted at the digit's
  first cell in reading order. Pinning the root took one hard ring board's
  proof from 17.8 s to 2.0 s on one worker.
- **Board**: no box regions and no row/column houses (`box_regions=False`,
  `rowcol_houses=False`); the frame-corners backend still pins the corners.
  The rules text opens on the ISOFILL rule, with no sudoku sentence
  (`rules_prefix=""`).
- **Carve**: `framebuild.generate`'s own: interior givens with every clue
  shown, then clues hidden while the board stays unique. A step is kept only
  when it proves inside 3 s a solve (`carve_limit=3`), so the shipped proof has
  margin under the 10 s cap. Three seeds were carved; seed 101 needed the
  fewest givens (1, against 10 and 18).

The clue rule is stated three times, and they agree:

- `visible` reads the clue off a line.
- `add_visible` posts it to CP-SAT as a running maximum: a cell is visible
  when it is greater than the maximum before it, so a tie is hidden. Spec #855
  asked for a model of its own on the grounds that skyscraper's `add_visibility`
  assumes a permutation line. It does not (`skyscraper/build_size.py:78`
  compares each cell with every earlier one, which is exact on a repeating
  line). Chris ruled for the running-max model anyway (2026-10-20): one max
  and one boolean per cell, where the pairwise model posts one per pair.
- `SkyscraperOneSidedComponent` (`ALLOW_TIES = false`) is the rule in the app.

`build_size.test.py` holds the two Python statements to each other and to
skyscraper's `sky` on random repeating lines; `soundness-harness.mjs` holds the
component to every clue `gen.json` records.

## The backend

`main-global.js` reads the 36 frame lines through the shared frame reader
(`_shared/frame-lines.js`). It registers one `IsofillComponent` over the
interior, whose cell list is the left-clue lines in order (each interior row
read left to right, which is the row-major order the component's index
arithmetic needs), and one `SkyscraperOneSidedComponent` per ring clue. It
throws before registering anything on a board whose interior is not square.

There is no local lane (`example.toml`: `lanes = "global"`).

## Files

| File | Holds |
| --- | --- |
| `build_size.py` | The `Spec`, the clue rule, the ISOFILL interior hooks |
| `main-global.js` | The backend the link runs |
| `IsofillComponent.js`, `SkyscraperOneSidedComponent.js` | Symlinks to the components in `examples/isofill` and `examples/skyscraper`: one file each, so a fix there is the fix here |
| `combined-board.mjs` | The shipped board as the harnesses run it: `main-global.js` against a mock 11x11 puzzle, truth from `gen.json` |
| `soundness-harness.mjs` | Zero removed true candidates over the combined backend, and the clue agreement |
| `update-strength.test.mjs` | The combined backend against both components' frozen floors on this board |
| `verify.py` | The shipped board is the recorded board, its solution solves it, and it is unique (in `just check`) |
| `build_link.py` | A same-board comparison link with one component swapped |

## Regenerate

```
uv run examples/isofill-skyscraper/build_size.py 9 3 3 3      # fresh search, 3 seeds
uv run examples/isofill-skyscraper/build_size.py --rebuild 9  # re-encode gen.json
uv run examples/isofill-skyscraper/verify.py
```

The box arguments are the builder's grammar only; this board has no boxes. A
fresh search runs the sampler on the CP-SAT portfolio (8 workers, ~20 s a
seed), then carves on one worker: about 2-3 minutes a seed.

## Timing

The app solves the shipped link (`app-solve.mjs`, one rep each, recorded app
v2026.10.05-a3aef4c, non-deterministic solve off): cold, unique in 100 ms;
after the app's logical solver, solved by logic alone (0 ms). These are a
check that it solves, not the timing rows: #859 records
`just time isofill-skyscraper`.
