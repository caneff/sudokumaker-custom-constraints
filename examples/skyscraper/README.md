# Skyscrapers, interactive outside clues — a worked custom constraint

Each outside cell holds a digit. That digit is the number of buildings visible
along its line. A building is visible when it is taller than every building
before it, read inward from the clue. The clue cell is part of the puzzle: many
clues start blank, and the solver reads them off the line. That is what
"interactive" means here.

For example, a line reading `238145679` inward from its clue gives a clue of
**4** — you see 2, 3, 8, 9. Read the other way, `976541832` gives **1**, the 9
alone. The 4x4 and 6x6 puzzles carry the same rule at their size.

## Why replace the built-in

SudokuMaker ships `SkyscraperComponent`, and the built-in "Skyscraper Lines"
template wraps it: a small component watches the clue cell and, once that cell
holds a value, calls `replaceComponent(instance, new SkyscraperComponent(...))`.
Two things follow, and both hurt an interactive clue:

- **It does nothing while the clue is blank.** It removes no candidate from the
  clue and none from the line. So it never helps the solver deduce a blank clue
  — the whole point of an interactive outside clue.
- **It never couples the two ends of a line.** Each clue is on its own.

So this example is one self-contained component per line that reads both end
clues and the whole line together, plus a per-side count. It follows the same
shape as `../running-start/`; see `../../docs/gotchas.md` on why a custom
component must not lean on `replaceComponent`.

## Two variants, one component set

The example ships two links from the same files (`../../docs/line-contract.md`):

- **local** (`main.js`, `PUZZLE_LINK_6x6_local.txt` and
  `PUZZLE_LINK_local.txt`) — the author draws the groups.
  A group is one clue and one line of any shape, clued at one end only, and it
  gets a `SkyscraperOneSidedComponent`: the one-sided DP, sound on a line
  whose digits repeat.
- **global** (`main-global.js`, `PUZZLE_LINK.txt`) — no groups. The backend
  builds all 4n frame lines from the board size and registers the two-clue DP
  alone per line, plus the one-1-per-side component. The DP is a decision
  procedure for a whole line, so it subsumes the one-sided DP and global does
  not run one beside it.

## What the components deduce

**`SkyscraperLineComponent.js` — one per line, both clues at once.** A line is
a full house, so its tallest building is exactly `n`, at one cell: the peak.
The left clue is `1 +` the left-to-right maxima before the peak; the right clue
is `1 +` the right-to-left maxima after it. The prefix and the suffix are
disjoint and together use every digit below `n` exactly once, so each is a DP
over *subsets* of those digits — the state is the subset used so far plus the
count of buildings seen — and the two DPs join at every cell that can still
hold the peak, pairing a subset on one side with its complement on the other.
A subset fixes both how many cells are filled (its popcount) and the tallest so
far (its highest digit), so a whole DP layer is one bitmask of counts per
subset, held in one reused buffer indexed by subset.

The permutation is the whole premise, so `update` and `validate` both ask for
it at solve time: the line must be a house whose live candidates union to
exactly `{1..length}`. That one gate carries everything the DP assumes — the
peak digit is the line's length, no cell holds 0, and no digit appears twice —
and the component asks the app for it rather than reading it off `minDigit` or
off the line's length. It re-asks until the gate opens, so a board that keeps a
0 on the line until a cage takes it away is not locked out for good.

- **Clues from the line:** a clue value is feasible only when some peak position
  realizes it on its side while the other side realizes some value the other
  clue still allows. The component removes every clue value no peak position
  supports.
- **Line from the clues:** each cell keeps `n` only where the peak can sit, and
  keeps a smaller digit only when it lies on some prefix or suffix path that
  finishes with both clues accepted. This is arc consistency for the pair of
  clues, not a min/max bound, and it subsumes the `L + R <= n + 1` cap.

Tracking the digit subset makes the sweep exact for a line: a value survives
only when some full line assignment consistent with the candidates and both
clues uses it. The true line is a permutation, so every one of its steps is a
transition the DP takes and no true value is ever removed.

**`SkyscraperOneSidedComponent.js` — one per drawn group, one clue.** The
local line component, and the only rule that runs on a line an author drew. A DP
over `(position, tallest so far, visible count)`. What a cell may hold depends
on the prefix through nothing but those two numbers, so with the position they
are the whole state. A forward sweep finds the states a prefix can reach; a
backward sweep, seeded at the far end with the clue's own candidates, finds the
states a completion can still finish from; a digit stays where the two meet.
One 32-bit mask of visible counts per `(position, tallest)` is a whole layer,
and the clue keeps exactly the counts the finished line can reach.

The state is exact for a line whose cells are tied to nothing but their own
candidates, which is every line an author draws, so the sweep is a **decision
procedure**: a value survives only when some fill consistent with the candidates
and the clue uses it. The true line is one of those fills, so no true value is
ever removed. None of that needs a house, a full house, or digits starting at 1,
so it runs on every line kind with no gate.

`const ALLOW_TIES = false` at the top of the file decides what a tie means: with
`false` a building level with the tallest so far is hidden, with `true` it
counts as visible. Flip the constant in the pasted segment, and say the same
thing in the puzzle's rules text.

**`SkyscraperSideComponent.js` — one per side, exactly one `1`.** A clue of `1`
means the building next to it hides every other one on its line, which happens
exactly when it is the tallest there. The first cells of one side's lines are
the *nearest rank*, a house of its own, so the tallest building of the whole
side stands on exactly one of them: exactly one of the side's clues is a `1`,
which couples all n clues on a side. The proof needs both halves and the
component checks both in `update` — every line of the side must be a full house
of `{1..n}`, and so must the nearest rank, which it reads off the lines' own
first cells. Take either half away and the count is wrong: on lines that may
repeat, two sides can both start with their own tallest building.

Timed with and without the per-side count on both boards, the two pairs of
medians disagree on sign: a wash, so it stays (#129). Numbers and method in
`../../docs/real-app-timing.md`.

## Is it faster than the original?

Yes, by a wide margin — the original does not solve an interactive puzzle at all
within a sane search budget. `recovery-probe.mjs` runs both wirings over the same
generated puzzle, on top of a Régin-strength all-different floor, and counts the
search nodes a uniqueness solve takes. Fewer nodes means the constraint pruned
more and the solver guessed less.

| puzzle | ours | original |
| --- | --- | --- |
| `gen_4x4` | 0 nodes | did not finish (200k-node cap) |
| `gen_6x6` | 8 nodes | did not finish (200k-node cap) |
| `gen_9x9` (shipped board, seed 610) | 45,731 nodes (~2 min; golden capped at 5k) | not run |

In the real app the shipped `PUZZLE_LINK.txt` is proved unique in **8.0 s**
(`just time skyscraper --ring-clues`). It is the hardest unique board a
560-seed scan found (#140, #161), so it doubles as the timing board. The
first shipped board handed the solver 58% of its ring and read 0.3 s; before
the joint component it ran past the app's 300 s limit. Node counts and app time are different measurements — reps,
dates, and app version in `../../docs/real-app-timing.md`.

The reason is the interactive clue. The puzzle's one solution needs the skyscraper
deductions; the sudoku rule and the shown clues alone do not pin it. Ours deduces
the blank clues and prunes the lines, so it solves by nearly pure logic. The
original deduces nothing about a blank clue, so it must *guess* every blank clue,
and it wanders. The probe models the original's built-in as a one-clue forward
prune, gated to fire only once a clue is pinned — so the original gets every
per-line deduction for a known clue. The gap is exactly the features it lacks:
blank-clue deduction, two-clue coupling, and the one-1-per-side count. Run it:

```
node examples/skyscraper/recovery-probe.mjs gen_6x6.json            # root recovery + soundness
node examples/skyscraper/recovery-probe.mjs gen_6x6.json --search   # solve, count nodes
```

## Files

- `main.js` — the local backend segment: one running-cap component per drawn
  group. A group of one cell is a clue an author has started and not finished,
  so it is skipped.
- `main-global.js` — the global backend segment: builds all 4n frame lines
  from the board size, then registers the two-clue DP per line plus the
  one-1-per-side component (it needs a whole side, which only a full frame
  has).
- `SkyscraperLineComponent.js` — the two-clue DP: both clues, the whole
  line, and the final check. Global only.
- `SkyscraperOneSidedComponent.js` — the one-sided DP: one clue, one drawn
  line of any shape. Local only.
- `SkyscraperSideComponent.js` — exactly one `1` among a side's clues.
  Global only.
- `soundness-harness.mjs` — Node soundness fuzz for the line component.
  Soundness = the component never removes a cell's true value. Run it:
  `node examples/skyscraper/soundness-harness.mjs` (`FUZZ=20000` for the deep
  run).
- `recovery-probe.mjs` — runs both wirings (ours and the original) over a built
  puzzle to compare solve work. Root recovery and soundness by default,
  search-node counts with `--search`. See "Is it faster than the original?".
- `build_size.py` — builds the whole document for any grid size: a grid, the
  derived clues, a minimal set of interior givens and shown clues carved to a
  unique solution (OR-Tools), and the encoded link. Blank clues are the
  interactive ones. It shares `main-global.js` and the component files, so a
  fix there flows to every size on the next run:
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 4 2 2`
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 6 2 3`
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 9 3 3`
  The three args are the grid size, the box height, and the box width
  (`box_height * box_width == size`). An optional fourth arg caps the seed count.
  `--paths` builds the local board instead: bent paths in place of the straight
  frame lines, shipped as drawn groups on the `main.js` lane, so the one-sided
  DP has a board to play and to time:
  `uv run --with ortools --with lzstring examples/skyscraper/build_size.py 9 3 3 3 --paths`
- `rebuild_size.py` — re-encodes a committed board from its `gen_*.json` with
  the current component and backend code, no fresh search, so a shipped link
  never carries a stale snapshot:
  `uv run --with ortools --with lzstring examples/skyscraper/rebuild_size.py 9`
  (`--paths` for the local board).
- `PUZZLE_LINK_local.txt` / `gen_local.json` — the 9x9 local board: 36 bent
  paths, 35 of them repeating a digit, drawn as groups. It is carved to CP-SAT
  minimality (6 interior givens), which puts it past what SudokuMaker's own
  search closes — a stress board, proven unique by OR-Tools, not a board to sit
  down with. `PUZZLE_LINK_6x6_local.txt` / `gen_6x6_local.json` are the 6x6
  twin: the local board the app finishes, so it is the one to play and the one
  that carries the local timing row.
- `PUZZLE_LINK_10x10.txt` / `gen_10x10.json` — the 10x10 (2x5 boxes) board that timed the lifted cap.
- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK.txt` (the 9x9) —
  built links. Open one to play the example.
- `gen_<n>x<n>.json` — the grid, clues, shown clues, and givens for each built size.
- `original/` and `build_original.py` — ChinStrap's original wrapper code, plus
  a re-encoder that rebuilds the same generated puzzle with it. `PUZZLE_LINK_original.txt`
  (9x9) and `PUZZLE_LINK_4x4_original.txt`/`PUZZLE_LINK_6x6_original.txt` are the
  same grid, givens, and clues as the improved links, so you can compare the two
  solve experiences directly:
  `uv run --with ortools --with lzstring examples/skyscraper/build_original.py 9`
- `build_link.py` — rebuilds a committed board link with one named
  component's code swapped for a candidate file, board and clues unchanged:
  `uv run --with lzstring examples/skyscraper/build_link.py --component SkyscraperLineComponent.js --out /tmp/candidate.txt`.
  Defaults to `PUZZLE_LINK.txt`; `--board <file>` swaps against another
  committed link instead. See `docs/real-app-timing.md`.
## Paste into SudokuMaker

To draw your own lines, add a custom local constraint and paste `main.js` as
the main code, plus the `SkyscraperOneSidedComponent` segment. Each group is
one line: cell 0 the outside clue, the rest the line read inward. The line may
bend and may repeat a digit, and it needs no clue at its far end. Leave a clue
cell blank (`given: false`) to make it interactive; mark it given to show it.

To use the whole grid as an interactive-outside frame instead (see
`../../docs/patterns.md`), add a custom global constraint and paste
`main-global.js` as the main code, plus the `SkyscraperLineComponent` and
`SkyscraperSideComponent` segments.

## Timing

| 2026-08-27 | v2026.08.14-d47fc4b | skyscraper | 300ms | — | — | BASELINE |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper | 2700ms | 3700ms | 1.37 | noise |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper | 2700ms | 2300ms | 0.85 | noise |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper | 2000ms | 1900ms | 0.95 | noise |
| 2026-08-28 | v2026.08.14-d47fc4b | skyscraper 10x10 | timeout (no deduction, `MAXN = 9`) | 100ms (`MAXN = 16`) | — | KEEP |

The three 9x9 rows are the cap lift (`MAXN` 9 to 16) timed against the
shipped board: the constant sizes three scratch arrays and nothing on the
n ≤ 9 path, and the ratios land on both sides of 1, so the 9x9 is unchanged
within the app's run-to-run swing. The 300ms row above is the earlier, easier
board; `34991d9` shipped the harder one.

The 10x10 row (`PUZZLE_LINK_10x10.txt`, `gen_10x10.json`, 2x5 boxes, 12 givens,
20 shown clues) is the size that lifted the line cap from 9 to 16: with the
cap the component yields nothing above 9 and the app finds no first solution
inside its limit; with the DP it proves the board unique in 0.1 s, 3/3 reps.
The app accepts `maxDigit` 10 without complaint.

### The gate change (#240)

| 2026-08-30 | v2026.08.14-d47fc4b | skyscraper (previous PUZZLE_LINK.txt) | 8200ms | 8300ms | 1.01 | gate: PASS |
| 2026-08-30 | v2026.08.14-d47fc4b | skyscraper (previous PUZZLE_LINK.txt) after-logical | 0ms | 0ms | — | NO TIME |

Moving the DP's stand-downs into a full-house gate adds no deduction, so the
gate bar applies: **≤ 1.1x on both rows** (`docs/real-app-timing.md`, #197).
The cold row lands at 1.01x and the after-logical row times nothing on either
side, so it places no constraint. `just time` prints `two-row rule: NO SHIP`
because that line reads the 0.9x deduction rule, not the gate rule.

Baseline is the previously committed 9x9 link, timed via `--board`: the shipped
`PUZZLE_LINK.txt` now carries the gated component, so timing against it would
compare the change with itself.

### The local board (#240)

| 2026-08-30 | v2026.08.14-d47fc4b | skyscraper (PUZZLE_LINK_6x6_local.txt) | 1700ms | — | — | BASELINE |
| 2026-08-30 | v2026.08.14-d47fc4b | skyscraper (PUZZLE_LINK_6x6_local.txt) after-logical | 600ms | — | — | BASELINE |

The running cap was a new component on a new board, so there was nothing to
compare it against and the candidate was byte-equal to the baseline: baseline
rows only, which is what `docs/real-app-timing.md` says such a run prints.
Those two rows are the baseline the one-sided DP below beat.

The 9x9 local board (`PUZZLE_LINK_local.txt`) has **no ratio row**, and none has
been invented. `just time skyscraper --ring-clues --board PUZZLE_LINK_local.txt
--component SkyscraperOneSidedComponent` raises "app-solve.mjs got no timed
reps" on the **baseline** probe: with the running cap the app finds no first
solution inside its 300 s limit. The board is carved to CP-SAT minimality —
6 interior givens, 17 interactive clues — and the running cap alone does not
close it. That is the same symptom as **#116** on a different board. The 6x6
local twin exists for exactly this reason and carries the rows above. What the
one-sided DP does on the 9x9 board is a capability row, below.

### The one-sided DP (#241)

| 2026-08-30 | v2026.08.14-d47fc4b | skyscraper (PUZZLE_LINK_6x6_local.txt) | 1600ms | 0ms | 0.00 | PASS |
| 2026-08-30 | v2026.08.14-d47fc4b | skyscraper (PUZZLE_LINK_6x6_local.txt) after-logical | 600ms | 0ms | 0.00 | PASS |
| 2026-08-30 | v2026.08.14-d47fc4b | skyscraper (PUZZLE_LINK_local.txt) | no first solve in 300s (running cap) | 5100ms (one-sided DP) | — | KEEP |

`two-row rule: SHIP`. The DP replaced the running cap in the local line
component: on the 6x6 local board the app finishes without searching at all,
both rows at 0ms against a searching baseline. Command:

```sh
just time skyscraper --ring-clues --board PUZZLE_LINK_6x6_local.txt \
  --component SkyscraperOneSidedComponent
```

`--component` names the component to follow, because skyscraper's global board
registers the two-clue DP and its local boards register this one; without it
the driver follows `build_link.py`'s `TIMED_COMPONENT` and would time an edit
the local board does not run (`docs/real-app-timing.md`).

The baseline in both ratio rows is the link as it stood before this change, on
the same board, when the component was still named `SkyscraperRunningCapComponent`.
Every link has since been rebuilt from its `gen_*.json` seed and carries the DP
under its new name, so the command above now compares the change with itself.

The third row is capability, not a ratio: on the 9x9 local stress board the
running cap gets no first solution inside the app's 300 s limit, and the DP
proves the board unique in 5.1 s, 3/3 reps (`first 4700ms  unique 400ms`).
Read alongside the `MAXN` row above, which is the same kind of row.

`just time skyscraper --ring-clues` on the shipped board (candidate byte-equal
to baseline, so only a BASELINE row prints) read 7400ms cold, 0ms
after-logical on the same day. See `docs/real-app-timing.md` for the protocol.

Earlier verdicts (#128, #133–#137) and their numbers: `docs/research/` and the
commit history; #137 (exact line DP, kept) is `docs/research/137-exact-line-dp.md`.
