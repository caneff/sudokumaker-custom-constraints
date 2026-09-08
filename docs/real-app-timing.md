# Timing the real app solver

The recovery probes (`examples/*/recovery-probe.mjs`) time our own GAC + DFS
mock. That mock measures deduction strength — candidates recovered, search nodes
cut. It does not measure what SudokuMaker does. The app has its own solver, and a
custom component's `update` runs inside it. A deduction that cuts nodes in the
mock can still cost more than it saves in the app.

`examples/_shared/app-solve.mjs` times the real solver. Use it to settle "does
this deduction pay for itself?" (CODING_STANDARDS.md) on the engine that ships.

## Protocol

- **Trigger.** Time a change whenever a deduction is added to or removed from a
  component's `update`.
- **Tool.** Run `just time <example>` (add `--ring-clues` for an example whose
  clues live in the ring: numbered-rooms, skyscraper).
- **Two rows per fixture.** Every fixture is timed twice: **cold**, from the
  stripped board, and **after-logical**, from the state a player reaches once
  the app's own logical solver has run. A deduction can pay off from an empty
  board and be worthless once the app's logic pass has already made those
  cuts, or the other way round. `just time` prints both rows.
- **Bar (the two-row ship rule).** A change ships when it clears **≤ 0.9×** on
  one of the two rows and stays **≤ 1.1×** on the other, each median measured
  over 3 reps with non-deterministic solve off. A row where **both** sides
  read 0 ms places no constraint — the logic pass finished the board, so
  nothing was timed — and the other row decides. A 0 ms baseline the candidate
  does *not* match is the opposite: the board used to need no search and now
  does, which sinks the change. `just time` prints the
  `two-row rule: SHIP` / `NO SHIP` line; each row's own `PASS`/`FAIL` is that
  row's 0.9× result alone, not the gate.
- **Bar for a gate change.** A change that adds or moves a gate in front of
  an existing rule and adds no deduction cannot reach 0.9× — on the shipped
  board every line is a house, so the rule runs as before. Such a change ships
  at **≤ 1.1× on both rows**, 3 reps, non-deterministic solve off; "unchanged"
  is the pass (#197). The same bar covers any change that adds no deduction and
  so cannot reach 0.9× — dropping a memo, say, which strictly adds work (#329).
- **Local fixture.** Each example's local link (`PUZZLE_LINK_local.txt`) gets
  one local row in the README: `just time <example> --board
  PUZZLE_LINK_local.txt` (#197). On most examples that board is bent paths
  (`build_size.py --paths`), the board for timing a rule that runs on a bare
  line; on outside-sudoku, whose rule needs a straight line, it is the frame
  lines drawn as groups (`build_size.py --local`, #268).
- **Record.** Paste both printed rows into the example's README, under a
  `## Timing` section.

The rest of this doc is the mechanics behind that command: how the driver
reads the app's readout, how to strip a link so the solver searches, and how
the offline recording works.

For an example with a `build_link.py` (hit-counts, isofill, numbered-rooms,
running-start, skyscraper), `just time <example>` runs the whole loop below in
one command: it builds a candidate link from the working-tree component,
times baseline and candidate 3 reps each in both modes, and prints one
paste-ready row per mode (date, app version, board, both medians, ratio, and
that row's PASS/FAIL at candidate <= 0.9x baseline) followed by the
`two-row rule:` line. Byte-equal candidate code prints baseline-only rows.
`--board <file>` times a different committed link in the example dir instead
of `PUZZLE_LINK.txt`; only an example whose `build_link.py` takes `--board`
accepts it, and the row's board column then names the file. The
manual steps below are what it automates, and still apply to an example with
no `build_link.py` yet.

An example that registers more than one component (hit-counts and
running-start each register a `Pair` component alongside the main one)
declares which one `just time` follows: `build_link.py` sets
`TIMED_COMPONENT = "<ComponentName>"`, a sibling of the existing
`CONSTRAINT_NAME` constant. Without that declaration, the driver falls back
to the one registered component that has a same-named `.js` file in the
example directory, and still fails loud — `FileNotFoundError` for zero
matches, `ValueError` for several — rather than guess which edit to time.

`--component <ComponentName>` overrides that declaration for one run. An
example whose boards register different components has no single right answer
to declare: skyscraper's global board runs the two-clue DP and its local
boards run the one-sided DP, so timing a local board names it —
`just time skyscraper --ring-clues --board PUZZLE_LINK_6x6_local.txt
--component SkyscraperOneSidedComponent`. The name is checked against the
board's registered components and its working-tree file, and fails the same
loud way.

## How it works

`app-solve.mjs` loads the link, clicks the "Find all solutions and valid
candidates" button (the `ShowCandidates` icon), and reads the time the app
prints. That button searches the whole tree to prove uniqueness, so it runs the
custom component's `update` on every node — the work we want to time. Reading
the app's own readout, not a self-computed clock, keeps it honest.

With `--after-logical` the driver first clicks the app's own logical solver
(the `AutoStep` icon) and waits for the board to stop changing, then clicks the
same button and reads the same readout. The printed row has the shape of the
cold row; the header line names the mode.

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

To count how often the app calls a component's `update` on one run:
`uv run --with lzstring examples/_shared/count_calls.py skyscraper
examples/skyscraper/SkyscraperLineComponent.js --ring-clues`. It makes a probe
copy of the component that `console.log('[probe] calls=...')` every 500
calls, builds a link from it with `build_link.py --component`, and runs
`app-solve.mjs` on the emptied link; the driver relays every browser console
line that starts with `[probe]` and drops the rest. To count anything else
(how often a branch fires), patch the probe copy by hand the same way. Worked
example: `docs/research/133-skip-unchanged.md`.

## Offline runs: the recorded app

Both drivers serve the app from `examples/_shared/sudokumaker.har` through
Playwright's `routeFromHAR`, so a run never touches the network. The file is
**checked in** (3.7 MB, 30 requests, one host), which is what makes a timing
reproducible: every machine and every rerun measures the same app build. The
puzzle rides in the `?puzzle=` query; on replay that document request is
rewritten to `/` (the same app index), so one recording covers every puzzle.

Re-record after a SudokuMaker release, and only then — the recording pins the
version every recorded timing was measured against:

```sh
SM_LIVE=1 node examples/_shared/app-solve.mjs <link> 1   # loads live, rewrites the HAR
```

Check the version the readout prints, and say in the commit which build the
new recording holds. `SM_OFFLINE=1` cuts the browser's network, which proves
a replay is complete rather than quietly falling through to the live site.
With no HAR on disk (a fresh clone that skipped it), the first run records one
itself.

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
100-given board (the `gen_32g.json` grid with every cell given) confirms the other direction — early
removals come back `unique` at 0 ms, straight off the app's own readout.

**A digit above 9 needs the on-screen pad, not the keyboard** — SudokuMaker
has no hotkey past 9 (#293). `app-dom.mjs`'s `openWidePad`/`enterDigit`
(called by `restoreGiven` for every digit) open the pad and click through it
instead. The pad has two screens (1-9, then 10-12 behind its "..." pager,
`Icon VerticalDots`), and once the pad is open, keyboard hotkeys 1-9 stop
working while the second screen shows — pressing "2" then does nothing at
all, found live with a fillomino 9x9-digits-1-12 board (#307) and fixed by
paging back before every keypress, not just every click. Verified against a
9x9 cap-12 sampled grid stripped from 81 to 27 givens with no restore
failures, mixing digits 1-9 and 10-12 throughout the run.

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

# The after-logical row for the same board: the app's logic pass first, then
# the timed search.
node examples/_shared/app-solve.mjs /tmp/iso_strip.txt 3 ShowCandidates --after-logical
```

Past results live with the change that produced them: each example README's
`## Timing` section, `docs/research/`, and the commit history. This doc states
the method, not a running log.

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
  **The one exception:** marks the app's own logical solver made inside the
  same driver run, under `--after-logical`. The driver still checks the board
  it *loaded* is stripped, before the logic pass runs, so the only marks the
  timed search can meet are the ones that pass put there.
  `app-solve.mjs` reports `[timeout]` when the app stops at its own limit and
  `[not-unique]` on "Found N solutions"; both carry null times.
- **Pick the strip mode by where the clues live.** `strip` keeps givens only.
  `empty` also keeps the outer ring, because a clue is not always a given:
  Numbered Rooms stores its outside clues as non-given cell values in the ring,
  and stripping them makes the app report "not unique" (verified). Use `empty`
  for the edge-clue examples and `strip` for everything else (ISOFILL).
