# ISOFILL Skyscrapers — an ISOFILL interior in an interactive Skyscrapers ring

A 9x9 ISOFILL board (nine regions of nine orthogonally connected cells, one
digit per region, every digit 1-9 used) inside a ring of Skyscrapers clues.
Each ring cell counts the buildings visible along its row or column, reading
inward; a building the same height as the tallest so far is hidden. Blank ring
cells are interactive: the solver fills them as the line decides them.

Built for spec #855: every given sits in the ring.

## The shipped board

`PUZZLE_LINK.txt`, recorded in `gen.json`: seed 106, **no interior givens,
18 shown clues, 18 interactive**. Every given is a ring clue. 30 of its 36
lines repeat a digit. `verify.py` proves it unique in about 5 s on one
worker (5.05 s and 5.7 s measured 2026-10-20), under a gate limit of 60 s a
solve.

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
- **Carve**: the ring-only search (`ring_only=True`,
  `framebuild.ring_only_search`). Each seed draws a layout; a layout an
  earlier seed drew is skipped. A layout unique on its full ring alone has its
  clues hidden while it stays unique, and the layout with the fewest shown
  clues ships. A step is kept only when it proves inside 3 s a solve
  (`carve_limit=3`), so the shipped proof has margin under `generate`'s
  final 10 s check. A layout whose ring proof reaches no verdict inside 3 s
  is neither unique nor not: when no layout proves unique, each such layout
  is proved again at 10 s before the search gives up. Had none proved unique,
  the search would have fallen back to `generate`'s default carve, interior
  givens first, over the same layouts (spec ruling 2).
- **The search (#859)**: 200 seeds drew 40 distinct layouts (the sampler
  repeats itself; 160 seeds were skipped). 5 were unique on the ring alone
  inside 3 s: seeds 106 and 115 carved to 18 shown clues, 270 to 23, 161 to
  24, 110 to 29. Seed 106 ships, the earlier of the tie. One sampled layout
  proves its full ring in 17.9 s: no verdict inside 3 s, and past the 10 s
  retry too, so the 3 s limit trades such layouts for the margin above. The ambiguity the other layouts
  carry is a pair of neighbouring cells of two regions trading digits where
  neither is a record on any line through it, so no clue changes.

The clue rule is stated three times, and they agree:

- `visible` reads the clue off a line.
- `add_visible` posts it to CP-SAT as a running maximum: a cell is visible
  when it is greater than the maximum before it, so a tie is hidden. Spec #855
  asked for a model of its own on the grounds that skyscraper's `add_visibility`
  assumes a permutation line. It does not (`add_visibility` in
  `skyscraper/build_size.py` compares each cell with every earlier one, which is exact on a repeating
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
uv run examples/isofill-skyscraper/build_size.py 9 3 3 200    # fresh search, 200 seeds
uv run examples/isofill-skyscraper/build_size.py --rebuild 9  # re-encode gen.json
uv run examples/isofill-skyscraper/verify.py
```

The box arguments are the builder's grammar only; this board has no boxes. A
fresh search runs the sampler on the CP-SAT portfolio (8 workers, 1-5 s a
seed), proves each new layout's ring on one worker, and carves each
ring-unique one: the 200-seed search took about 18 minutes. Run it under
`job-run`. The sampler's portfolio races, so a rerun draws other layouts.

## Timing

`just time isofill-skyscraper --ring-clues` (3 reps, non-deterministic solve
off, recorded app replay):

| date | app version | fixture | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-20 | v2026.10.05-a3aef4c | isofill-skyscraper | 200ms | — | — | BASELINE |
| 2026-10-20 | v2026.10.05-a3aef4c | isofill-skyscraper after-logical | 0ms | — | — | BASELINE |

No component changed, so the rows are a baseline with no ratio. After the
app's logical solver the board is solved by logic alone (0 ms).
