# Timing the real app solver

The recovery probes (`examples/*/recovery-probe.mjs`) time our own GAC + DFS
mock. That mock measures deduction strength — candidates recovered, search nodes
cut. It does not measure what SudokuMaker does. The app has its own solver, and a
custom component's `update` runs inside it. A deduction that cuts nodes in the
mock can still cost more than it saves in the app.

`examples/_shared/app-solve.mjs` times the real solver. Use it to settle "does
this deduction pay for itself?" (CODING_STANDARDS.md) on the engine that ships.

For an example with a `build_link.py` (hit-counts, isofill, numbered-rooms,
running-start, skyscraper), `just time <example>` runs the whole loop below in
one command: it builds a candidate link from the working-tree component,
times baseline and candidate 3 reps each, and prints one paste-ready row
(date, app version, board, both medians, ratio, PASS/FAIL at candidate <=
0.9x baseline). Byte-equal candidate code prints a baseline-only row. The
manual steps below are what it automates, and still apply to an example with
no `build_link.py` yet.

An example that registers more than one component (hit-counts,
running-start, skyscraper each register a `Pair` component alongside the
main one) declares which one `just time` follows: `build_link.py` sets
`TIMED_COMPONENT = "<ComponentName>"`, a sibling of the existing
`CONSTRAINT_NAME` constant. Without that declaration, the driver falls back
to the one registered component that has a same-named `.js` file in the
example directory, and still fails loud — `FileNotFoundError` for zero
matches, `ValueError` for several — rather than guess which edit to time.

## How it works

`app-solve.mjs` loads the link, clicks the "Find all solutions and valid
candidates" button (the `ShowCandidates` icon), and reads the time the app
prints. That button searches the whole tree to prove uniqueness, so it runs the
custom component's `update` on every node — the work we want to time. Reading
the app's own readout, not a self-computed clock, keeps it honest.

The app prints **two** readouts, one per phase: "✨ Solved — took 2.3s" when it
finds the first solution, then "This is a unique solution. took 0.4s" when the
second search finishes. The driver waits for the verdict text, then reports
the first-solve time, the uniqueness-search time, and their sum, per rep,
plus a median line for each of the three. An earlier version returned at the
first "took" it saw; on a slow board that timed the first phase only and
reported nonsense (500 ms for a 19 s search).
A rep with verdict `?` means the verdict never appeared: it reports `null`
for all three times and is excluded from the medians.

Before each run the driver turns **off** "Non-deterministic solve" (Solver
settings → Solutions finder → Advanced settings). With it on, the same board
swings 10×–20× run to run and the numbers are noise; off, the solver walks a
fixed order and the timing is repeatable. The step fails loud if the toggle is
missing, so a run never silently times a non-deterministic solve. Everything
else stays at the app default — in the Solutions finder that is "singles only",
every heavier technique off.

The link must make the solver **search**. A finished link stores the whole
solution in its cells, so the solver only verifies a filled grid — fast, and
equally fast for every code variant. **Strip the link first, every time.**
`probe_link.py strip` keeps only given cells and drops every value and pencil
mark; `probe_link.py empty` keeps the outer ring too, for puzzles whose clues
sit there as non-given values (Numbered Rooms, Skyscraper). Pick the mode by
where the clues live, never by habit: `empty` on ISOFILL left 36 solution
values in the ring and produced a false "unique in 2 s". The app tells you when
you got it wrong — its verdict reads "based on already entered values and pencil
marks". A number read off such a run is not a timing — and the tools refuse
it: `app-solve.mjs` counts the blue (entered) digits on the loaded board and
exits with an error unless you pass `--ring-clues`; `probe_link.py` refuses to
write a probe that is not stripped; `time_example.py` strips by default.

To compare two code variants you need one board solved by each. Both examples
ship a same-board pair: `PUZZLE_LINK.txt` (ours) and `PUZZLE_LINK_original.txt`
(the original wrapper code on the identical board), built by each example's
`build_original.py`. Empty each and time them.

## app-strip.mjs: unattended greedy clue removal

`examples/_shared/app-strip.mjs` uses the same app, and the same solve
button, as a uniqueness oracle for greedy clue removal — finding how few
givens a puzzle can ship with. Unlike a driver that rebuilds a link and
launches a fresh browser per trial (several seconds of reload overhead every
removal), it loads the puzzle link **once** and drives the app's own puzzle
editor directly for every trial after that:

```sh
node examples/_shared/app-strip.mjs <link_file> <out.json> [seed] --grid <puzzle.json>
```

For each given cell, in a seeded-random order: click the cell, press Delete,
click `ShowCandidates`, and read the verdict. `unique` keeps the cell
removed; anything else (not-unique, a timeout, or a `?` that still has no
verdict after one retry) restores the digit — as a GIVEN, by clicking the
cell again and pressing the digit key, never as an entered (played) value.
Between trials it clicks "Stop solving" (the verdict search keeps running in
the background after the first readout) and then SelectAll + ClearAll, which
wipes stray candidate marks without touching any given — both a no-op when
there's nothing to clear. Left unclean, those marks silently redirect the
next digit keystroke from "set given" to "toggle candidate mark," so the
driver throws rather than continue on a board it can't confirm is clean; it
also throws if a verdict comes back "based on already entered values and
pencil marks" — that's not a real uniqueness proof, and passing it through
would drop clues the puzzle needs. The output JSON
(`{"grid": [...], "clues": [[r,c], ...]}`) is written after every successful
removal, and a `timeout` rung's clue set is also written to
`<out>.timeout-<n>.json` — a candidate hard grid, worth a CP-SAT check.

Verified against `examples/isofill/PUZZLE_LINK.txt` (35 givens, every single
removal known non-unique by construction): `minimum 35 givens` on three
separate seeded runs (seeds 1, 3, 7), roughly 8 s per trial end to end. A
100-given board (the `puzzle-32.json` grid with every cell given) confirms the other direction — early
removals come back `unique` at 0 ms, straight off the app's own readout.

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
node examples/_shared/app-solve.mjs /tmp/sky_ours.txt 3 --ring-clues
node examples/_shared/app-solve.mjs /tmp/sky_orig.txt 3 --ring-clues

# ISOFILL: no ring clues, so STRIP (givens only), never `empty`. "Original" is
# the count-floor-only component before #79; take its link from history.
git show c5569cd~1:examples/isofill/PUZZLE_LINK.txt > /tmp/iso_orig_full.txt
uv run --with lzstring examples/_shared/probe_link.py strip \
  examples/isofill/PUZZLE_LINK.txt /tmp/iso_strip.txt
uv run --with lzstring examples/_shared/probe_link.py strip \
  /tmp/iso_orig_full.txt /tmp/iso_orig_strip.txt
node examples/_shared/app-solve.mjs /tmp/iso_strip.txt 3
node examples/_shared/app-solve.mjs /tmp/iso_orig_strip.txt 3
```

## Results

Median "took" readout over 3 runs, app v2026.08.14-d47fc4b, non-deterministic
solve off. Same board within each row; only the constraint code differs.

| Puzzle                        | Ours     | Original    | Result            |
| ----------------------------- | -------- | ----------- | ----------------- |
| Numbered rooms (blank clues)  | ~21.5 s  | >300 s (0/3 finished) | ours >14× faster |
| Skyscraper 9×9 (given-only link, 21 active clues, 15 blank) | >300 s (`[timeout]`, 2026-08-27) | — | not yet timed: the true board exceeds the app limit. The earlier ~3.0 s vs ~55.7 s pair was timed with the 15 blank clues shipped as entered digits (fixed in a04b390) and is void (#113) |
| Hit counts 9×9 (given-only link, 27 active clues) | >300 s (`[timeout]`, 2026-08-27) | — | same as Skyscraper: the true board exceeds the app limit (#113) |
| ISOFILL (stripped, 35 givens) | **unique in 0.2 s** with cut (2026-08-27, 3/3, reps 0.2/0.2/0.2). Before cut: **no verdict** (app time limit, `[timeout]` 3/3, 2026-08-26) with reach, reach + capacity, reach + capacity + homeless, and the one-pass scan alike | "Found 10,000 solutions" in 0.3 s | cut kept (#101): the one rule that closes the search. Kept: cap, force, reach, capacity, cut, one-pass scan. Homeless removed (#91) |
| ISOFILL clue ladder, no cut (stripped, 2026-08-27, 3 reps, #98) | 36/37/39 givens `[timeout]` 3/3; 40 givens 34.3 s or 41.4 s (one extra each); 41 givens 12.0 s | — | the search shrinks fast past 40 givens; with cut every rung reads 0–0.2 s |
| ISOFILL hard grid (stripped, 32 givens, `puzzle-32.json`, 2026-08-27, 3 reps) | cut only **40.4 s**; walk with neighbour lists built once and a byte mask for `reach` **27.6 s**; + budget matching **24.8 s** (Kuhn; the same rule as a max flow read 26.8 s); + Régin prune on that matching 24.9 s → 23.4 s (same session); + tour bound (three-point closed-tour lower bound on region size, tightening the walk) **15.3 s** (2026-08-27, 3/3, ratio 0.61 against 24.9 s). Four-point tour bound tried and removed: 35.6 s. Cut walks that stop at ten cells / all placed cells, dead-end cells skipped, stamped mask: **5.7 s** (2026-08-27, 3/3, ratio 0.37 against 15.3 s; Node profile had `reach` at 46 % of a call, now 23 %). Scratch buffers reused across calls (no per-call allocation; GC was 12 %): **4.1 s** (2026-08-27, 3/3, ratio 0.72 against 5.7 s). Evidence, not a timing (marks present): the shipped 35-given puzzle with a player's correct 2-candidate marks (link 2) 15.2 s → 12.4 s → **7.2 s** | — | the 35-given shipped grid is minimal (every removal breaks uniqueness) and solves in 0.2 s, too fast to rank rules; this grid is a CP-SAT sample stripped in the app (`app-strip.mjs`), `verify.py` proves it unique. Trace: 94% of calls sat under one wrong guess of the digit with no given (4 at the corner), which only cross-digit budget refutes. Component-size rule tried and removed: 44.2 s (no gain) |
| ISOFILL (stripped, 44 givens, `puzzle-44.json`) | with cut **0 ms** (2026-08-27, 3/3; 41 givens also 0 ms); reach only ~25.9 s; reach + capacity **~9.1 s** (2026-08-26, 3/3 unique); + homeless ~9.1 s (reps 9.6/9.1/9.1 s, no change); one-pass scan **5.7 s vs 11.2 s** same-session pair (reps 5.6/5.7/6.2 vs 11.8/11.2/11.2), ratio 0.51 | — | capacity kept: 2.8× faster where the app closes at all (#90); homeless removed: no gain (#91); one-pass scan kept: 2× faster, same four rules on a per-call snapshot, no weaker at fixpoint (#97) |

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
- **Never time with entered values present.** The app solves from the cells as
  loaded, givens and entered values alike, and says so: "This is a unique
  solution (based on already entered values and pencil marks)". Strip first.
  `app-solve.mjs` enforces it: any entered (blue) digit on the board, or that
  phrase in the verdict, is an error unless `--ring-clues` is passed.
  `app-solve.mjs` reports `[timeout]` when the app stops at its own limit and
  `[not-unique]` on "Found N solutions"; both carry null times.
- **Pick the strip mode by where the clues live.** `strip` keeps givens only.
  `empty` also keeps the outer ring, because a clue is not always a given:
  Numbered Rooms stores its outside clues as non-given cell values in the ring,
  and stripping them makes the app report "not unique" (verified). Use `empty`
  for the edge-clue examples and `strip` for everything else (ISOFILL).
