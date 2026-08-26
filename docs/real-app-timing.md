# Timing the real app solver

The recovery probes (`examples/*/recovery-probe.mjs`) time our own GAC + DFS
mock. That mock measures deduction strength — candidates recovered, search nodes
cut. It does not measure what SudokuMaker does. The app has its own solver, and a
custom component's `update` runs inside it. A deduction that cuts nodes in the
mock can still cost more than it saves in the app.

`examples/_shared/app-solve.mjs` times the real solver. Use it to settle "does
this deduction pay for itself?" (CODING_STANDARDS.md) on the engine that ships.

## How it works

SudokuMaker runs its solver in a Web Worker. The worker speaks a small protocol:

- `start` → `init` — compile the constraint code and set it up.
- `findNext` → `update` — search to the next solution.

"Check unique" finds the first solution, then searches again to prove no second
one exists. `app-solve.mjs` wraps `window.Worker` to timestamp these messages,
loads the link, clicks the "check unique" button, and waits for the verdict.

The link must make the solver **search**. A finished link stores the whole
solution in its cells, so the solver only verifies a filled grid — fast, and
equally fast for every code variant. `probe_link.py` empties the interior first,
leaving the givens and the outside-clue ring, so the solver starts from the
givens.

To compare two code variants you need one board solved by each. The skyscraper
example ships same-board pairs already (`build_original.py`). Numbered rooms does
not — "ours" carved the board down to 7 givens the strong components can solve,
"original" keeps 35 — so `probe_link.py graft` puts the 7-given board onto the
original-code document.

## Reproduce

Install the browser once, build the probe links, then run:

```sh
npm i && npx playwright install chromium
cd examples

# Numbered rooms: same 7-given board, ours vs original code.
uv run --with lzstring ../examples/_shared/probe_link.py empty \
  numbered-rooms/PUZZLE_LINK.txt /tmp/nr_ours.txt
uv run --with lzstring ../examples/_shared/probe_link.py graft \
  numbered-rooms/PUZZLE_LINK.txt numbered-rooms/numbered_rooms.url /tmp/nr_orig.txt

# Skyscraper: the shipped same-board pairs, just emptied.
uv run --with lzstring ../examples/_shared/probe_link.py empty \
  skyscraper/PUZZLE_LINK_9x9.txt /tmp/sky_ours.txt
uv run --with lzstring ../examples/_shared/probe_link.py empty \
  skyscraper/PUZZLE_LINK_9x9_original.txt /tmp/sky_orig.txt

cd ..
node examples/_shared/app-solve.mjs /tmp/nr_ours.txt 7
node examples/_shared/app-solve.mjs /tmp/nr_orig.txt 7
node examples/_shared/app-solve.mjs /tmp/sky_ours.txt 7
node examples/_shared/app-solve.mjs /tmp/sky_orig.txt 4   # slow; fewer reps
```

## Results

Median "check unique" wall time, app v2026.08.14-d47fc4b. Same board within each
row; only the constraint code differs.

| Puzzle                     | Ours    | Original    | Result                 |
| -------------------------- | ------- | ----------- | ---------------------- |
| Numbered rooms (7 givens)  | 55 ms   | 36 ms       | original ~1.5× faster  |
| Skyscraper 6×6             | 44 ms   | 41 ms       | tie                    |
| Skyscraper 9×9             | 444 ms  | ~10,500 ms  | ours ~24× faster       |

Setup (`start` → `init`) is ~20 ms everywhere; the difference is all search.

The stronger components pay off where the search is genuinely hard (skyscraper
9×9) and cost a little where it is not (the easy numbered-rooms board). This is
why the mock's node-count verdict does not transfer: it counts pruning, not the
per-`update` price the app pays for it.

## Caveats

- **Numbers are machine- and run-specific.** Read the ratios and orders of
  magnitude, not the absolute milliseconds.
- **The search is nondeterministic.** The original skyscraper 9×9 swung from ~8 s
  to ~19 s across runs. Take several reps.
- **The button index can drift.** The solver controls are unlabeled icons;
  `app-solve.mjs` addresses "check unique" by position (index 4). SudokuMaker is
  pre-release — if the toolbar order changes, re-probe the indices.
- **This hits the live site.** It is not part of `just check`.
- **Do not empty by the given flag alone.** A clue is not always a given:
  Numbered Rooms stores its outside clues as non-given cell values in the ring.
  "Keep givens, empty the rest" deletes those clues and the app reports the
  puzzle "not unique" (verified). `probe_link.py` keeps the whole outer ring for
  this reason. This rule fits the edge-clue examples in this repo; a puzzle that
  holds no clues in its cells would need a different emptier.
