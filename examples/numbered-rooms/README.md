# Numbered Rooms — optimized

A stronger constraint component for the "escape the grid" Numbered Rooms puzzle.

## The rule

A line reads inward from an outside clue cell. The first inside cell holds a
1-based index `k`. The clue equals the digit in the `k`-th inside cell:

    line[k - 1] === clue,   with k = value(line[0]).

The clue is a **cell** (its digit is part of the solution), not a fixed number.
An index of 0, or any index past the end of the line, is out of range.

The line is any group the author draws: a frame row or column, a diagonal, a
bent path. `NumberedRoomsComponent` asks the app at solve time whether the line
is a house and gates the two rules that need distinct digits on the answer
(`docs/line-contract.md`):

| Rule | Needs |
| --- | --- |
| in-range feasible indices only | any line |
| `k = 1` ⇒ the clue is 1 (the target *is* the indexer) | any line |
| one index left ⇒ the target equals the clue | any line |
| `k > 1` ⇒ the target is not `k` | a house |
| clue solved to `c` ⇒ `c` leaves every cell at a dead index | a house |

## What was slow and weak

The shipped version split the work across a wrapper and the built-in
`IndexComponent`:

```js
// original/CustomIndexComponent.js
if (puzzle.hasValue(cell)) {
  yield puzzle.replaceComponent(instance,
    new IndexComponent(instance.name, puzzle.getValue(cell), cells[0], cells))
}
```

`IndexComponent` needs the clue as a constant, so the wrapper waited until the
clue cell `cell` collapsed to one value, then swapped the built-in in. Two costs:

- **Inert until the clue is solved.** Before that it pruned nothing — the line
  cells kept their full candidate sets and the solver got no help.
- **One direction only.** It never pushed information back from the line to the
  clue. Knowing `line[0] = 2` and `line[1] = 3` tells you the clue is `3`, but
  the wrapper could not use that.

## What this does instead

`NumberedRoomsComponent.js` is one self-contained component (the pattern
`docs/gotchas.md` #1 requires). Its `update` prunes candidates every pass, in
both directions, before the clue is solved:

1. Prune the indexer `line[0]`: drop any index that points at a cell whose
   candidates cannot meet the clue's.
2. Prune the clue: it can only hold a digit some still-feasible target allows.
   "Allows" includes the one fact the line's geometry gives: for index `k > 1`
   the target and the indexer are two cells of one row/column, so the clue
   cannot be `k`; for `k = 1` the target *is* the indexer, so the clue must
   be 1.
3. When one index remains, make the target cell and the clue equal both ways —
   before either is a singleton.
4. When no index remains, empty the indexer and the clue so the solver sees
   the dead branch at once.

All four run in one pass over candidate bitmasks
(`puzzle.getCandidatesBitMask`), the shape ISS's `ValueIndexing` handler uses.

## A stronger deduction that did not pay off

Two clues on opposite ends of one line couple: with left index `a` and right
index `b` on a line of length `N`, `a + b === N + 1` exactly when the two clues
land on the same cell, so equal clues fix the index sum. A `NumberedRoomsPair`
component once enforced this. It was sound and it cut search nodes, but on the
shipped board it **tripled** the real solve time (2.3s → 6.7s): the extra
component ran every propagation and cost more than the nodes it saved. Removed,
per "a deduction must pay for itself in solve time" (`CODING_STANDARDS.md`). The
per-line component below carries the whole example.

## Files

- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK_9x9.txt` —
  share-ready boards of each size, built by `build_size.py` on the shared
  interactive-outside frame (`gen_<n>x<n>.json` records each seed):
  `uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 9 3 3`
  (args: `n box_height box_width`). Every one is unique with no interior
  givens — the real app's verdict on each is "unique" — and only the shown
  clues are stored; the rest of the board is empty. Not timing boards: over
  half the ring is shown. After a `main.js` or `NumberedRoomsComponent.js`
  change, re-encode from the recorded seed instead of a fresh search:
  `uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 9`
  (`rebuild_size.py`, args: `n`) loads `gen_<n>x<n>.json` and calls the shared
  frame's `build_doc` directly, so the link's grid, givens, and shown clues
  stay exactly what the seed produced and only the embedded code changes.
- `main.js`, `main-global.js`, `NumberedRoomsComponent.js` — paste
  `NumberedRoomsComponent.js` plus one main file into the SudokuMaker
  constraint editor, replacing the old backend and `CustomIndexComponent`.
  `main.js` (local) reads the drawn `groups` input; `main-global.js`
  (global) builds all 4n frame lines from the board size itself instead —
  no lines to draw.
- `PUZZLE_LINK_local.txt`, `gen_local.json` — the 9x9 **local** board: 36 bent
  paths in place of the frame lines, each shipped as a drawn group on the
  `main.js` lane, so the three rules that hold on a bare line have a board to
  play. All 36 paths repeat a digit, so none is a house and the two house rules
  stand down. Carved to CP-SAT minimality (1 interior given, 16 interactive
  clues), which puts it past what SudokuMaker's own search closes — a stress
  board, proven unique by OR-Tools, not a board to sit down with. Built by
  `uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 9 3 3 3 --paths`.
- `PUZZLE_LINK_6x6_local.txt`, `gen_6x6_local.json` — the 6x6 local twin
  (24 bent paths, 22 of them repeating a digit, 0 interior givens): the local
  board the app finishes, so it is the one to play and the one that carries the
  local timing row. Same command with `6 2 3`.
- `original/` — the shipped wrapper (`main.js`, `CustomIndexComponent.js`),
  kept for reference and used by `build_original.py`.
- `soundness-harness.mjs` — proves `update` removes no true value across a
  fuzz of all three line kinds plus a `minDigit 0` board, and that it prunes
  early: the clue narrows while it is still unsolved, which the shipped
  wrapper never did.
- `PUZZLE_LINK.txt` — the ready-to-open puzzle and the source of truth for this
  example: a hard board with **blank outside clues** (the solver deduces all 36),
  8 arrow bulbs, and one interior given, so the solver must search. Earlier
  fixtures had 24 and then 13 arrows; fewer arrows leave more of the work to
  this component. It runs the **global** lane — `main-global.js`, no drawn
  groups — as every example's bare `PUZZLE_LINK.txt` does
  (`docs/example-layout.md`, #268).
- `PUZZLE_LINK_original.txt` — the same board with the original wrapper code, for
  a same-board timing comparison. The wrapper reads `input.groups`, so this one
  ships the 36 frame lines as drawn groups; `build_original.py` builds them.
- `PUZZLE_LINK_clued.txt` — the same 8-arrow board with all 36 outside clues
  filled from the puzzle's solution (interior unchanged, still blank but for
  the one given): the ordinary, ready-to-play version of the puzzle.
- `PUZZLE_LINK_clued_original.txt` — the clued board with the original wrapper
  code and its drawn groups, for a same-board timing comparison. Both solve
  instantly and uniquely (0ms, one rep each) -- an ordinary,
  mostly-solved-by-logic puzzle does not show the capability gap; see "Timing
  in the real app" below.
- `build_original.py` — rebuilds `PUZZLE_LINK_original.txt` from `PUZZLE_LINK.txt`
  and the `original/` files, changing only the constraint's own code and input.
- `build_clued.py` — rebuilds both `PUZZLE_LINK_clued.txt` and
  `PUZZLE_LINK_clued_original.txt` from `PUZZLE_LINK.txt`, filling the 36
  clues from the board's own solution and checking that solution against the
  sudoku and Numbered Rooms rules before writing anything:
  `uv run --with lzstring examples/numbered-rooms/build_clued.py`.
- `build_link.py` — rebuilds `PUZZLE_LINK.txt` with one named component's code
  swapped for a candidate file, board and clues unchanged:
  `uv run --with lzstring examples/numbered-rooms/build_link.py --component NumberedRoomsComponent.js --out /tmp/candidate.txt`.
  Add `--backend main-global.js` to swap the main code in as well (the
  committed link carries both, and `build_link.test.py` checks both
  round-trip). Add `--board PUZZLE_LINK_local.txt` to swap against the local
  board instead. See `docs/real-app-timing.md`.

## One example, one component (#238)

`examples/numbered-rooms-lines` was a second directory for the same rule, with
its own component and a `distinct` flag that main code set from the group's
shape. It is deleted. `NumberedRoomsComponent` reads the kind off the app
instead, so one component covers the frame lines and any path an author draws,
and `main.js` no longer throws on a group that is not one row or column.

Two link families survive the merge, by an explicit call:

- **`original/` and the `_original` links stay.** They are this example's
  capability evidence: the ~100× row below and the win bar in
  `OPTIMIZATION_LOG.md` both compare against the wrapper on the same board.
  `docs/example-layout.md` keeps an `original/` baseline where a timing
  comparison actually uses it, and this one does.
- **The `_clued` links stay.** `PUZZLE_LINK_clued.txt` is the second half of
  the win bar — a candidate must leave it verdicting `unique` — and it is the
  ordinary, ready-to-play version of the shipped puzzle.

Nothing from `numbered-rooms-lines` was worth carrying over: its board is
replaced by `PUZZLE_LINK_local.txt`, its generator by `build_size.py --paths`,
and its `distinct=false` behaviour by the bare-line rules, which
`update-strength.test.mjs` pins to that component's last commit.

## Run

    node examples/numbered-rooms/soundness-harness.mjs
    uv run --with lzstring examples/numbered-rooms/build_original.py   # rebuild the original-code link

## Why the stronger component wins

The reason is in the original code, not a benchmark. `original/CustomIndexComponent.js`
does nothing until the clue cell has a value:

```js
if (puzzle.hasValue(cell)) {
  yield puzzle.replaceComponent(instance,
    new IndexComponent(instance.name, puzzle.getValue(cell), cells[0], cells))
}
```

A real Numbered Rooms puzzle shows only *some* of its outside clues and leaves the
rest blank for the solver to deduce. On a blank clue the wrapper is inert — it
waits for the clue to be pinned, then runs the built-in index prune — so its only
way to fill a blank clue is to guess it. `NumberedRoomsComponent.js` deduces a
blank clue from its line, both directions, before anything is solved. That
capability gap is the point: a puzzle that is mostly blank clues is one the
original wrapper cannot solve by logic at all, and ours can.

## Timing in the real app

`PUZZLE_LINK.txt` leaves the outside clues blank, so the solver must deduce them
and search — the real Numbered Rooms case, where the capability gap shows. Timed
in the real SudokuMaker solver (empty grid, non-deterministic solve off, the
default "singles only" technique set, median of 3 runs):

| wiring | solve time |
|---|---|
| original wrapper (`CustomIndexComponent`) | >300 s (no rep in three finished) |
| ours, before #87 (`NumberedRoomsComponent`) | ~19–21.5 s |
| **ours** (`NumberedRoomsComponent`, with the clue≠index rule) | **~3.1 s** (5-rep median, 2026-08-26) |

Ours is about 100× faster than the wrapper. The gap is the point of the rewrite: the wrapper is
inert on a blank clue and the solver must guess it, while ours deduces the clue
from its line. See `docs/real-app-timing.md` for the method, the reproduce
commands, and the skyscraper comparison.

Every speed-up tried on this component since — kept or rejected, with its
numbers and commit — is logged in `OPTIMIZATION_LOG.md`. The win bar for a new
attempt: faster on the hard board **and** the clued board still verdicts
unique, both judged on a 5-run median against the current baseline row, and a
difference inside that baseline's run-to-run spread does not count.

## Timing

The three rows below were measured **before #268**, when `PUZZLE_LINK.txt` was
the local-lane board. The same command returns different numbers now that the
plain name is the global-lane board — see "The lane swap (#268)" for the
current rows and the difference between the two lanes.

| 2026-08-27 | v2026.08.14-d47fc4b | numbered-rooms (pre-#268, local lane) | 2300ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | numbered-rooms (pre-#268, local lane) | 1700ms | 1700ms | 1.00 | FAIL |
| 2026-08-31 | v2026.08.14-d47fc4b | numbered-rooms (pre-#268, local lane) after-logical | 1500ms | 1500ms | 1.00 | FAIL |

`just time numbered-rooms --ring-clues`. See `docs/real-app-timing.md` for the
protocol.

The two 2026-08-31 rows are the gate change of #238. Every frame line on this
board is a house, so both house rules still fire and the board's deductions are
exactly what they were; the only new work per `update` is the
`getCellsCanHaveRepeats` call, and it is free at this resolution. The rows read
FAIL because `just time` applies the deduction rule (≤ 0.9× on one row). A gate
change is judged at **≤ 1.1× on both rows** (`docs/real-app-timing.md`, "Bar
for a gate change"), which 1.00 and 1.00 clear.

### The lane swap (#268)

`PUZZLE_LINK.txt` now runs the global lane. Same board, same givens, same
clues, same `NumberedRoomsComponent` — the only change is that
`main-global.js` builds the 36 frame lines from the grid instead of `main.js`
reading them as drawn groups.

| 2026-08-31 | v2026.08.14-d47fc4b | numbered-rooms | 2200ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | numbered-rooms after-logical | 2100ms | — | — | BASELINE |

```sh
just time numbered-rooms --ring-clues
```

**The global lane is slower on this board, past the 1.1× bar.** Both lanes
timed the same day, 3 reps each, three runs apiece — the local lane at
1800–1900 ms cold and 1500–1600 ms after-logical, the global lane at
2200–2400 ms and 2000–2100 ms. That is about **1.2× cold and 1.3×
after-logical**, and `docs/real-app-timing.md` puts a change with no new
deduction at ≤ 1.1× on both rows. The rows above are what the board costs
now, not a pass.

Two candidate causes were measured and ruled out, so what is left is the
backend code itself:

| Probe | Cold | After-logical |
| --- | --- | --- |
| global lane, lines registered in the drawn board's order | 2300ms | 1900ms |
| global lane, the 36 drawn groups added back to the document | 2200ms | 2000ms |

Neither moves the number, so it is neither the order the 4n components are
registered in nor the presence of the groups in the document. The deductions
are identical either way — the same component runs on the same 36 lines — so
this is the app's own cost for a backend that builds its lines with
`puzzle.getCellAt`, not a weaker constraint. Consistency of the example set
was the call (#268); the number is recorded here rather than argued away.

### The local board (#238)

| 2026-08-31 | v2026.08.14-d47fc4b | numbered-rooms (PUZZLE_LINK_6x6_local.txt) | 100ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | numbered-rooms (PUZZLE_LINK_6x6_local.txt) after-logical | 0ms | — | — | BASELINE |

```sh
just time numbered-rooms --board PUZZLE_LINK_6x6_local.txt --ring-clues
```

A new board with no earlier code to compare against, so the candidate is
byte-equal to the baseline and only baseline rows print — what
`docs/real-app-timing.md` says such a run gives. The three bare-line rules
close this board almost without searching.

The 9x9 local board has **no row**, and none has been invented: the same
command with `--board PUZZLE_LINK_local.txt` raises "app-solve.mjs got no timed
reps", because the app finds no verdict on it inside its limit. Skyscraper's
9x9 local board behaves the same way and for the same reason — CP-SAT
minimality carves past what SudokuMaker's search closes. The 6x6 twin exists
for exactly this.

## Not covered

`PUZZLE_LINK.txt` is hand-made and is the committed source of truth: no
generator produces it, so there is no fresh version of that board to make. The
sized and local boards do have one — `build_size.py`, on the shared frame — and
`rebuild_size.py` re-encodes any of them with the current code.
