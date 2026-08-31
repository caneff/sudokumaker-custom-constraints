# Running Start — a worked custom constraint

Outside cells on clues must contain a digit, and that digit indicates the length
of the first ascending sequence in that direction.

For example, a row with `142356789` gives a left clue of **2** (1, 4) and a
right clue of **1** (9). Reading from the left, `1 < 4`, then `3` drops below
`4`, so the run is the two cells `1 4`. Reading from the right, `9` drops to `8`
at once, so the run is the single cell `9`. The first cell always counts.
The 4x4 and 6x6 puzzles carry the same rule with a size-appropriate example.

## Ties

Two equal digits next to each other are the one case the sentence above does
not settle, and a drawn line can hold them: a bent path is not a house, so its
digits may repeat. `const ALLOW_TIES` at the top of `RunningStartComponent.js`
decides which reading the segment enforces (`docs/line-contract.md`):

| `ALLOW_TIES` | The run | Ends at | Shipped |
| --- | --- | --- | --- |
| `false` | climbs strictly (`<`) | `line[k] <= line[k-1]` | yes |
| `true` | may hold level (`<=`) | `line[k] < line[k-1]` | no |

Flip the constant in the pasted segment to change the reading, and change the
puzzle's rules text with it — `build_size.rule_text` carries the sentence that
states it. There is one constant, not two: the pair component reads the run as
ascending either way, because it only ever prunes on a house, where the two
readings coincide. A second constant would have to be kept in step by hand, and
a pair left on `false` beside a line set to `true` would go on enforcing a cap
that no longer holds. Both components are fuzzed under both readings; see "Run
the tests".

The kind of line the clue sits on then decides how hard each rule may push. On
a **house** no two cells hold the same digit, so `>=` collapses to `<` and
`<=` collapses to `<`: both comparisons go strict whichever way the flag
reads, and the component asks `getCellsCanHaveRepeats` in `update` to find
out. That is not a nicety — the shipped frame board solves 3.4× slower if the
strict break is given up on every line (see `OPTIMIZATION_LOG.md`). On a
**bare** line only the reading the flag names is sound, and the per-cell
floor/ceil window stands down under the loose one (it counts `j` cells strictly
below `line[j]`, which a level run does not supply). The pair component's
`A + B <= n + 1` needs a house outright — a run of equal digits belongs to both
end runs at once — so it prunes on a house and goes quiet everywhere else.

Each puzzle's in-app rule text is prefixed `Running Start:` and ends with a note
that the corner `1`s only fill space for SudokuMaker's solver and should be
deleted before publishing.

## Files

- `main.js` — the local backend segment: one line component per drawn group.
- `main-global.js` — the global backend segment: builds all 4n frame lines
  from the board size, then registers the same line component plus the
  opposite-pair component below (it needs both ends of a line, which only a
  full frame has). `PUZZLE_LINK.txt` and the sized variants ship this file.
- `RunningStartComponent.js` — the per-line component. Both directions of
  propagation plus the final check.
- `RunningStartPairComponent.js` — couples two clues on opposite ends of one
  line through `A + B <= n + 1`.
- `soundness-harness.mjs` — Node soundness test (see below).
- `generate.py` — fresh grid, derived clues, uniqueness proof (OR-Tools).
- `PUZZLE_LINK.txt` — the built SudokuMaker link for the seed-104 grid. Open it
  to play the example.
- `build_link.py` — rebuilds `PUZZLE_LINK.txt` from `main-global.js` and the
  component files. Run it after changing any of them:
  `uv run --with lzstring examples/running-start/build_link.py`.
- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt` — smaller Running Start puzzles.
- `PUZZLE_LINK_local.txt` — the **local** board: 36 bent paths drawn as groups,
  running `main.js`. Every path turns a corner, so the app reads it as a bare
  line and its digits may repeat — the board that exercises the rules a drawn
  line gets. Built by
  `uv run --with ortools --with lzstring examples/running-start/build_size.py 9 3 3 --paths`,
  with its geometry recorded in `gen_local.json`.
- `rebuild_size.py` — re-encodes a committed board (`gen_4x4.json`,
  `gen_6x6.json`, `gen_local.json`) with the current component code and rule
  text, no fresh CP-SAT search, so a sized link never ships a stale component
  snapshot:
  `uv run --with ortools --with lzstring examples/running-start/rebuild_size.py 4`.
  The shipped 9x9 global board is not a framebuild board, so `build_link.py`
  rebuilds that one.
- `build_size.py` — builds the whole document from scratch for any grid size,
  no template needed. It generates a grid, derives every line's clue, carves a
  unique puzzle (OR-Tools), and encodes the link. It shares `main-global.js`
  and the component files, so a fix there flows to every size on the next run:
  `uv run --with ortools --with lzstring examples/running-start/build_size.py 4 2 2`
  `uv run --with ortools --with lzstring examples/running-start/build_size.py 6 2 3`
  The three args are the grid size and the box height and width (`box_height *
  box_width == size`).
- `gen.json` — the puzzle frame (grid, clue ring, groups, regions,
  cosmetics) with the code fields empty. `build_link.py` fills them in.

## Paste into SudokuMaker

To draw your own lines, add a custom local constraint and paste `main.js` as
the main code, plus the `RunningStartComponent` segment. Each group is one
line: cell 0 the outside clue, the rest the line read inward.

To use the whole grid as an interactive-outside frame instead (see
`../../docs/patterns.md`), add a custom global constraint and paste
`main-global.js` as the main code, plus both component segments:
`RunningStartComponent` and `RunningStartPairComponent`. main-global.js adds
one pair component for every line clued on both ends.

## Why one self-contained component

The Skyscraper Lines template uses a wrapper that, once the clue cell has a
value, calls `replaceComponent(instance, new SkyscraperComponent(...))`. That
works only because `SkyscraperComponent` is **built-in**. Swapping in a *custom*
component that way silently does nothing (see `../../docs/gotchas.md`). So
Running Start is a single component that holds the clue cell and the line and
does everything itself.

## What the component deduces

Forward (clue known or partly bounded) and reverse (clue read from the line),
all sound:

- **Reverse, feasible clue set** — `feasibleClues` walks the line once and keeps
  only the clue values the live candidates can still realize. A value `k` needs
  a climbing prefix of length `k` and, unless `k` is the whole line, a break at
  position `k`. The walk tracks the smallest and largest end value a climbing
  prefix can reach; it drops `k` only when even the largest reachable
  predecessor cannot be broken, so it never removes a true clue. This is
  stronger than a min/max interval — it also removes interior values whose
  break is impossible, and a filled cell anywhere on the line counts.
- **Forward, guaranteed prefix** — if the clue's smallest remaining candidate is
  `kmin`, the first `kmin` cells must climb. Enforce the pairwise chain and,
  where the climb is strict, the window `[1+j, 9−(kmin−1−j)]` on each cell
  `line[j]` with `j < kmin`: it needs `j` cells below and `kmin−1−j` above. This
  runs before the clue is pinned and is tighter than the neighbour-only chain,
  which only looks one step.
- **Forward, pinned** — a known clue `k` is the guaranteed prefix above (with
  `kmin == k`) plus the break at `line[k]`. The break is the climb's negation,
  so under the strict reading the run ends on `line[k] <= line[k−1]` — an equal
  neighbour is enough. Demanding a strict drop there on a bare line is what used
  to cut digits a drawn line needed (#195); on a house it is free, because the
  two cells cannot be equal in the first place.
- **Cross-line pair** — two clues on opposite ends of one line share a
  permutation: the left increasing run and the right increasing-inward run can
  share at most one cell (the peak), so `A + B <= n + 1`. A run of equal digits
  would sit in both, so the component asks `getCellsCanHaveRepeats` for a house
  first and goes quiet on a bare line — no loss, since `main-global.js` is the
  only file that registers it and every frame line is a house. The
  pair component
  caps each clue at `n + 1` minus the other's smallest remaining value. When
  `A + B` is forced to exactly `n + 1`, the line is unimodal — strictly up to
  the shared peak, then strictly down — so it propagates both monotone runs and
  tightens every cell (on a full row the peak becomes a 9 once all-different
  joins in). It shines early, when one clue is a given and the line is open.
- **validate** — once clue and line are filled, the count must equal the clue.

## Run the tests

Soundness (needs Node):

```
node soundness-harness.mjs
# -> line + pair components, 0 violations, "PASS"
```

Generation and uniqueness (needs Python with ortools):

```
python generate.py
# -> chosen seed, interior givens, clues kept, "FINAL unique OK"
```

`soundness-harness.mjs` runs every pool twice, once per reading of
`ALLOW_TIES`, editing the constant in the source the way an author edits the
pasted segment. The line component meets bare, house, and full-house lines
(`makeLine`, `docs/line-contract.md`), plus a bare pool whose lines tie right
after the run — the state the break rule reads, and one a uniform random pool
almost never draws. A further pool reads the seed-104 solution from
`seed104_solution.json` (a committed dump of the puzzle's `cells` values and
the constraint's `input.groups` in `[clueCell, lineCells]` form), so the
component also meets the frame lines of a shipped board.

Two checks beyond soundness: `update` and `validate` must agree on a tied line
(on a line pinned to its digits the surviving clue candidates must be exactly
the clue values `validate` accepts), and the pair component must prune on a
bare line under the strict reading and prune nothing there under the loose one.
The pair test also fuzzes a synthetic mountain line, because no line in the
seed-104 puzzle reaches the `A + B == n + 1` case that drives its unimodal
branch.

## Timing

| 2026-08-27 | v2026.08.14-d47fc4b | running-start | 1800ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | running-start | 1800ms | 1800ms | 1.00 | FAIL |
| 2026-08-31 | v2026.08.14-d47fc4b | running-start after-logical | 500ms | 500ms | 1.00 | FAIL |
| 2026-08-31 | v2026.08.14-d47fc4b | running-start (PUZZLE_LINK_local.txt) | 21500ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | running-start (PUZZLE_LINK_local.txt) after-logical | 1600ms | — | — | BASELINE |

The 2026-08-31 pair is the ties change (#239), a gate change: it adds no
deduction, so the bar is ≤ 1.1× on both rows and "unchanged" is the pass
(`docs/real-app-timing.md`, "Bar for a gate change"). Both rows read 1.00×
against the link as it shipped at `0baac1c` — unchanged, which is the pass.
**The `FAIL` in both rows is `just time`'s own per-row verdict, which is the
0.9× result alone; it is not the gate this change is held to, and the change
ships.** The strict break the fix would otherwise have given up is kept behind
the house test — without that test the cold row reads 3.37×.

The last two rows are the local bent-path board, the fixture for the rules a
bare line gets: `just time running-start --board PUZZLE_LINK_local.txt`,
candidate byte-equal to baseline, so only BASELINE rows print. There is no
before-and-after pair to print for it: the board is new with #239, and the
component it replaced is unsound on a bare line, so it has no honest solve time
on this board to compare against. It is a slow board — 36 bent paths, no line a
house, so nothing but the clues constrains a path — which is what makes it
worth timing a bare-line rule on, and the row is the floor a later one moves.

See `docs/real-app-timing.md` for the protocol.
