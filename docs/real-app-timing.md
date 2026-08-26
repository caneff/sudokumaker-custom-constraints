# Timing the real app solver

The recovery probes (`examples/*/recovery-probe.mjs`) time our own GAC + DFS
mock. That mock measures deduction strength — candidates recovered, search nodes
cut. It does not measure what SudokuMaker does. The app has its own solver, and a
custom component's `update` runs inside it. A deduction that cuts nodes in the
mock can still cost more than it saves in the app.

`examples/_shared/app-solve.mjs` times the real solver. Use it to settle "does
this deduction pay for itself?" (CODING_STANDARDS.md) on the engine that ships.

## How it works

`app-solve.mjs` loads the link, clicks the "Find all solutions and valid
candidates" button (the `ShowCandidates` icon), and reads the time the app
prints. That button searches the whole tree to prove uniqueness, so it runs the
custom component's `update` on every node — the work we want to time. Reading
the app's own readout, not a self-computed clock, keeps it honest.

The app prints **two** readouts, one per phase: "✨ Solved — took 2.3s" when it
finds the first solution, then "This is a unique solution. took 0.4s" when the
second search finishes. The driver waits for the verdict text, then sums both.
An earlier version returned at the first "took" it saw; on a slow board that
timed the first phase only and reported nonsense (500 ms for a 19 s search).
A row with verdict `?` means the verdict never appeared and the time is null.

Before each run the driver turns **off** "Non-deterministic solve" (Solver
settings → Solutions finder → Advanced settings). With it on, the same board
swings 10×–20× run to run and the numbers are noise; off, the solver walks a
fixed order and the timing is repeatable. The step fails loud if the toggle is
missing, so a run never silently times a non-deterministic solve. Everything
else stays at the app default — in the Solutions finder that is "singles only",
every heavier technique off.

The link must make the solver **search**. A finished link stores the whole
solution in its cells, so the solver only verifies a filled grid — fast, and
equally fast for every code variant. `probe_link.py` empties the interior first,
leaving the givens and the outside-clue ring, so the solver starts from the
givens.

To compare two code variants you need one board solved by each. Both examples
ship a same-board pair: `PUZZLE_LINK.txt` (ours) and `PUZZLE_LINK_original.txt`
(the original wrapper code on the identical board), built by each example's
`build_original.py`. Empty each and time them.

## Reproduce

Install the browser once, build the probe links, then run:

```sh
npm i && npx playwright install chromium

# Numbered rooms: blank-clue board (8 arrows, one interior given), ours vs
# original code. Already searchable, so no emptying needed.
node examples/_shared/app-solve.mjs examples/numbered-rooms/PUZZLE_LINK.txt 3
node examples/_shared/app-solve.mjs examples/numbered-rooms/PUZZLE_LINK_original.txt 3

# Skyscraper: the shipped same-board pairs, emptied first so the solver searches.
uv run --with lzstring examples/_shared/probe_link.py empty \
  examples/skyscraper/PUZZLE_LINK.txt /tmp/sky_ours.txt
uv run --with lzstring examples/_shared/probe_link.py empty \
  examples/skyscraper/PUZZLE_LINK_original.txt /tmp/sky_orig.txt
node examples/_shared/app-solve.mjs /tmp/sky_ours.txt 3
node examples/_shared/app-solve.mjs /tmp/sky_orig.txt 3
```

## Results

Median "took" readout over 3 runs, app v2026.08.14-d47fc4b, non-deterministic
solve off. Same board within each row; only the constraint code differs.

| Puzzle                        | Ours     | Original    | Result            |
| ----------------------------- | -------- | ----------- | ----------------- |
| Numbered rooms (blank clues)  | ~21.5 s  | >300 s (0/3 finished) | ours >14× faster |
| Skyscraper 9×9                | ~3.0 s   | ~55.7 s     | ours ~19× faster  |

The stronger components pay off where the search is genuinely hard and the clues
are not all handed to the solver. On a board whose clues are all filled the app
solves by logic and the gap closes — even reverses, because the stronger
`update` costs more per call than it saves. So the board matters: time an
outside-clue component on a puzzle that leaves the clues blank (see
CODING_STANDARDS.md), or the fixture flatters the lazy wrapper.

Not every stronger deduction survives this test. Numbered Rooms once shipped a
second `NumberedRoomsPairComponent` that coupled the two clues on a line. It was
sound and cut nodes, but it tripled the real solve time (2.3 s → 6.7 s, first
phase only, before the two-phase readout fix) and was
removed. The mock's node-count verdict does not transfer: it counts pruning, not
the per-`update` price the app pays for it.

## Caveats

- **Numbers are machine- and run-specific.** Read the ratios and orders of
  magnitude, not the absolute milliseconds.
- **Turn non-deterministic solve off.** `app-solve.mjs` does this before every
  run; it is what makes the reps agree (the medians above vary by <5% run to
  run). With it on, the same board swings 10×–20× and the numbers are noise.
- **Match the technique set.** The Solutions finder defaults to "singles only".
  Turning on the heavier techniques (X-Wings, by contradiction, …) makes a weak
  component crawl for minutes on the same board. `app-solve.mjs` leaves the
  defaults; compare like with like.
- **The icon name can drift.** The solver controls are unlabeled icons;
  `app-solve.mjs` addresses them by their `<svg class="Icon NAME">`
  (`ShowCandidates`). SudokuMaker is pre-release — if an icon name changes,
  re-probe.
- **This hits the live site.** It is not part of `just check`.
- **Do not empty by the given flag alone.** A clue is not always a given:
  Numbered Rooms stores its outside clues as non-given cell values in the ring.
  "Keep givens, empty the rest" deletes those clues and the app reports the
  puzzle "not unique" (verified). `probe_link.py` keeps the whole outer ring for
  this reason. This rule fits the edge-clue examples in this repo; a puzzle that
  holds no clues in its cells would need a different emptier.
