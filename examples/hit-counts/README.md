# Hit Counts — a worked custom constraint

An outside clue on a line counts the "hits". Read the line inward from the clue.
A cell is a hit when its digit equals its distance from the clue: the first cell
hits on a 1, the second on a 2, and so on. The clue is the number of hits.

For example, the row `184356729` gives a left clue of **5**. Reading from the
left, cells 1, 5, 6, 7, 9 hold the digits 1, 5, 6, 7, 9 — each digit equals its
distance from the left, so five cells hit. The same row gives a right clue of
**3**: reading from the right, the digits 2, 5, 8 sit two, five, and eight steps
in, so three cells hit. A clue of **0** is legal — it means no cell holds its own
distance.

Because the line holds each digit once, a hit is a fixed point of the line read
as a permutation, and the clue counts those fixed points. Each cell hits or
misses on its own, so the clue is a plain count of independent cells — no runs,
no ordering. That makes Hit Counts simpler than Running Start.

## Files

- `main.js` — the local backend segment: one line component per drawn group.
- `main-global.js` — the global backend segment: builds all 4n frame lines
  from the board size, then registers the line component plus the
  opposite-pair and side-sum components below (they need both ends of a
  line, or a whole side, which only a full frame has).
- `HitCountsComponent.js` — the per-line component. It bounds the clue from the
  line and forces or forbids hits when the clue's range demands it. Those bounds
  hold on any line an author draws. Its one rule that needs more — a clue can
  never be `n - 1` — sits behind a gate the component checks at solve time (see
  "Line kinds and gates" below).
- `SideSumComponent.js` — the per-side component. The `n` clues on one side sum
  to exactly `n`; it propagates that sum across the side's clue cells. It takes
  the `n` perpendicular lines its proof rests on and fires only while each one
  is a full house of `{1..n}`.
- `HitCountsPairComponent.js` — the opposite-pair component. It couples the two
  clues on the ends of one line through `A + B <= n` (`+ 1` when `n` is odd), and
  at that cap pins every cell to two values.
- `soundness-harness.mjs` — Node soundness test (see below).
- `recovery-probe.mjs` — measures whether the matching bound actually helps solve a
  real generated puzzle (see "Does the tighter bound help?" below).
- `build_size.py` — builds the whole document from scratch for any grid size. It
  generates a grid, derives every line's hit count, carves a unique puzzle
  (OR-Tools), and encodes the link:
  `uv run --with ortools --with lzstring examples/hit-counts/build_size.py 4 2 2`
  `uv run --with ortools --with lzstring examples/hit-counts/build_size.py 6 2 3`
  `uv run --with ortools --with lzstring examples/hit-counts/build_size.py 9 3 3`
  The three args are the grid size and the box height and width (`box_height *
  box_width == size`). `--paths` builds the local board instead — see
  "The local board" below.
- `PUZZLE_LINK_4x4.txt`, `PUZZLE_LINK_6x6.txt`, `PUZZLE_LINK.txt` (the 9x9) —
  the built global SudokuMaker links. Open one to play the example. The 9x9
  takes the plain name because `build_link.py` and the timing loop reuse that
  board.
- `PUZZLE_LINK_local.txt`, `gen_local.json` — the local board: the same 9x9
  frame, but every line is a drawn bent path. See "The local board".
- `rebuild_size.py` — re-encodes a shipped link from its committed
  `gen_<n>x<n>.json` (or `gen_local.json`, with `--paths`) with the component
  code and backend as they stand in the repo now, on the same board and givens
  (no fresh CP-SAT search). Run it after any component edit, or the shipped
  links keep an old snapshot:
  `uv run --with ortools --with lzstring examples/hit-counts/rebuild_size.py 9`
  `uv run --with ortools --with lzstring examples/hit-counts/rebuild_size.py 9 --paths`
- `build_link.py` — rebuilds `PUZZLE_LINK.txt` with one component's code
  swapped for a candidate file, leaving the board and the sibling components
  untouched. It is the same-board pair `just time hit-counts` needs:
  `uv run --with lzstring examples/hit-counts/build_link.py --component HitCountsComponent.js --out /tmp/candidate.txt`
- `../_shared/frame.py`, `../_shared/minify.py` — build helpers shared with
  Running Start (the interactive-outside frame cosmetics and the link-shrinking
  pass). `../_shared/harness-lib.mjs` holds the soundness-harness scaffold.

## Side sums — a strong global clue

The `n` clues on one side sum to **exactly** `n`. Take the left side. Its clue on
row `r` counts the columns `j` where row `r` holds digit `j` at column `j`. Sum
the left clues over all rows and regroup by column: for column `j`, how many rows
hold digit `j` in column `j`? Column `j` is a permutation of `1..n`, so digit `j`
sits there exactly once. Every column gives one hit, so the left clues sum to
`n`. Rows are permutations too, so the same holds for every side.

This couples every clue on a side: knowing `n - 1` of them fixes the last, and
partial knowledge tightens the rest. `SideSumComponent` propagates it by bounds.
`main-global.js` builds the interior's rows and columns once and names the four
sides off them, so each side comes with its `n` clue cells and a full frame is
what makes the sum exactly `n`.

The proof leans on the **crossing** lines, not the clued ones: it is column `j`
holding digit `j` exactly once that gives the one hit per column. So each side
hands the component the `n` lines that cross it — the columns for a side of
rows, the rows for a side of columns — and the component checks every one of
them is a full house of `{1..n}` before it prunes anything. Where that is not
provable it stays silent.

## Line kinds and gates

A rule may assume nothing about a line beyond what the component can prove at
solve time (`docs/line-contract.md`). Hit Counts splits this way:

| Rule | Needs | Where |
|-|-|-|
| reverse clue bound `[forced, possible]` | nothing — a bare line | line component |
| forward "no more hits" / "all must hit" | nothing — a bare line | line component |
| a clue is never `n - 1` | a full house of `{1..n}` | line component |
| pair cap `A + B <= n (+1)` | nothing — a bare line, both ends | global |
| side sum `= n` | `n` perpendicular full houses of `{1..n}` | global |

The count bounds read each cell alone, so they hold on a line with repeats, gaps,
or any length. The `n - 1` rule does not: it is the pigeonhole on a line that
holds `1..n` once each, and on a hand-drawn line of `[1,2,3,4,5,6,7,8,1]` the
true clue IS `8`. The component therefore asks the app — `getCellsCanHaveRepeats`
on the line alone — and counts the live candidates across the line.

Two facts make the check awkward, and both are why it runs in `update` rather
than in the main code or once at load:

- Main code runs before the built-in row and column houses are registered, so a
  question asked there reads every line as bare (gotcha 6).
- These boards run `minDigit 0` so the clue ring can hold a `0`, with a
  look-and-say cage keeping `0` off the inner grid. Until that cage bites, `0`
  is still a live candidate on every line cell, so the line is not yet a full
  house of `{1..n}`. The kind is re-tested each `update` until it proves a full
  house, then cached on the instance.

A digit set of `{0..8}` is the case that makes the count alone insufficient: nine
different digits over nine cells passes any full-house test, yet such a line can
hit `n - 1` times. So the rule tests the digit set itself.

## Opposite pair — a cut from the two clues alone

Two clues on opposite ends of one line couple. Read a cell at 0-based index `j`
on a line of length `n`. It is a **left hit** when its value is `j + 1` (its
distance from the left clue) and a **right hit** when its value is `n - j` (its
distance from the right clue). Those two values are equal only at the exact
center (`n` odd, `j = (n-1)/2`, value `(n+1)/2`). So the left-hit cells and the
right-hit cells are disjoint apart from that one shared center cell. The left
clue `A` counts the first set, the right clue `B` the second, so

    A + B <= n        (n even)
    A + B <= n + 1    (n odd, the center can be a hit from both sides).

Each clue caps the other: `A <= cap - B` and `B <= cap - A`.

The cap is not fixed. It starts at `n` (or `n + 1`) and **drops as the interior
fills in**: once a cell has lost both its left-hit value `j + 1` and its
right-hit value `n - j`, it can never be a hit either way, so it no longer counts
toward the cap. `HitCountsPairComponent` recomputes

    cap = number of cells that can still hit  (the center counted twice)

on every pass, so interior progress feeds straight back into tighter clue bounds.

The cut has real teeth at the cap. When `A + B` is forced to `cap`, every cell
that can still hit must hit. So each such cell is pinned to just `{j + 1, n - j}`
(a single value at the odd-`n` center); a cell that can hit neither is a forced
miss and is left alone. That fires from the two clues alone, before any interior
digit is known — a deduction no single-line component can reach. `main-global.js`
pairs two clues whose lines are the exact reverse of each other.

Unlike the side sum, this coupling is not a tautology: it constrains the
interior digits directly, not just the hidden clues.

## The clue of 0

A hit count of 0 is a real clue — it means no cell holds its own distance — and
the puzzle shows 0 clues like any other. A sudoku cell cannot normally hold 0,
so the document does two things:

- sets `minDigit: 0` on the puzzle, which lets any cell hold the digit 0;
- adds a look-and-say cage (`type: 304`) with value `"00"` — read as "zero 0s" —
  over all interior cells, which keeps 0 out of the sudoku itself.

Together they let only the outside clue ring hold 0. The component treats a clue
of 0 the same as any other count: a pinned clue of 0 forbids every cell from
holding its own distance.

## The local board

`PUZZLE_LINK.txt` is a frame board: every line is a whole row or column, so
every line is a full house and the rules that need one always fire. That hides
every bare-line bug. `PUZZLE_LINK_local.txt` is the board that does not:

```
uv run --with ortools --with lzstring \
    examples/hit-counts/build_size.py 9 3 3 3 --paths
```

`--paths` swaps the straight frame lines for **bent paths**, one per ring clue.
A path is an L: two or more cells straight in from the clue, then a turn and
the rest across, nine cells in all. Both legs are non-empty, so a path spans
more than one row and more than one column; its cells do not all see each
other, the app reads the line as bare through `getCellsCanHaveRepeats`, and
digits repeat along it. On the committed board 35 of the 36 paths really do
repeat a digit — `build_link.test.py` asserts at least one does, so a
regeneration cannot quietly lose the property.

Everything else matches the global builder: each clue is the true hit count of
its path read off the generated solution, the CP-SAT proof models that same
count on the path's own cells with **no** all-different among them, and the
board is carved to a single solution and proved unique the same way. The paths
ship as `input.groups` on the `main.js` lane — the local variant — so the app
hands each drawn group to one `HitCountsComponent` and nothing builds a frame.

Its rules text carries one extra sentence the global board does not — the
line is drawn, so it is not a house and a digit may repeat along it
(`framebuild.LOCAL_RULES_SUFFIX`, shared by every example's local link).

The committed board is seed 103: 2 interior givens, 32 shown clues, 4
interactive.

## Paste into SudokuMaker

To draw your own lines, add a custom local constraint and paste `main.js` as
the main code, plus the `HitCountsComponent` segment. Each group is one line:
cell 0 the outside clue, the rest the line read inward.

To use the whole grid as an interactive-outside frame instead (see
`../../docs/patterns.md`), add a custom global constraint and paste
`main-global.js` as the main code, plus all three component segments:
`HitCountsComponent`, `SideSumComponent`, and `HitCountsPairComponent`.

## What the component deduces

Let `forced` be the cells already pinned to their own distance (a hit no matter
what) and `possible` be the cells whose distance is still a candidate (a hit is
still open). The true number of hits lies in `[forced, possible]`.

### A tighter bound we measured and did not ship

The naive count reads each cell alone, so it over-counts: it can promise more hits
than any one permutation of the line delivers. Take a line of three, already
arc-consistent for all-different: `L0 ∈ {1,3}`, `L1 ∈ {2,3}`, `L2 ∈ {1,2}`. The
naive `possible` is 2 — `L0` can be a 1 and `L1` a 2 — but those two together
strand `L2` on a 3 it does not hold. Both legal permutations, `1 3 2` and `3 2 1`,
hit once, so the true clue is 1, not "up to 2".

A **matching** captures this. A line is a permutation of `1..n`, so a legal state
is a perfect matching of positions to values, each from its candidates; a hit is
the edge from position `i` to value `i + 1`. The least and most hit edges over any
such matching bound the true hit count, and that range sits inside
`[forced, possible]`. It is sound and strictly tighter — and it earns nothing on
these puzzles, so the component keeps the naive bound. `recovery-probe.mjs` is how
we found that out; it is worth keeping as the way to test the next candidate
deduction.

The probe runs the real components — the same `main-global.js` wiring the app runs — to a
propagation fixpoint, with a Régin-strength (GAC) all-different over every row,
column, and box as the floor. It runs three ways and diffs what propagation
recovers: the floor alone (no hit-counts components — the baseline before any
hit-counts deduction), the components with the naive clue bound (`off`), and the
components plus the candidate matching bound (`on`).

```
node examples/hit-counts/recovery-probe.mjs gen_9x9.json --floor=regin
```

The components as a whole earn their keep — over the sudoku floor, which recovers
no hidden clue on its own, they recover 4 hidden clues on `gen_6` and 10 on
`gen_9`. But the matching refinement adds **zero** on top of the naive bound:

- `gen_6` — the matching never even fires: the interior starts empty, so every
  line's candidates stay wide and the matching bound equals the naive one on all
  24 lines. Nothing to bite.
- `gen_9` — the matching *does* fire (tighter than naive on ~14 of 36 lines), yet
  the recovered clues and cells are identical with it on or off. The all-different
  floor plus the side-sum and pair components already reach the same fixpoint, so
  the tighter clue bound is redundant.

The result holds under a weaker singles-only floor too (`--floor=singles`).

The `--search` mode closes the last gap — pruning inside search, where pinned
cells turn line domains partial and the matching should bite most:

```
node examples/hit-counts/recovery-probe.mjs gen_9x9.json --search --only=on
```

It runs a full DFS that proves uniqueness (MRV branching, one solution) and counts
the nodes explored, matching off vs on. The matching cuts almost nothing:

- `gen_6` — 261 nodes off, 259 on (2 fewer, 0.8%);
- `gen_9` — 38620 nodes off, 38578 on (42 fewer, 0.1%).

Nodes are only a proxy; the goal is a solver that is *faster*. The matching runs
an `O(n · 2ⁿ)` pass per line per propagation — about 78x the naive `O(n)` scan on
`n = 9` (17 µs vs 0.2 µs per call) — to save under 1% of nodes. That per-call cost
is steep enough to suspect the matching is a net loss on wall-clock time, but the
mock probe cannot settle it: it measures deduction strength (candidates
recovered, search nodes cut), not speed. The question is a real-app timing one —
see `docs/real-app-timing.md`.

So on the current puzzles the clue-bound tightening is inert at the root and
barely prunes search. Whether it costs real time is still open. Any real value
would have to come from the interior-facing deduction — the matching-driven cell
eliminations tracked as a follow-up — and that path is even heavier per call, so
it must clear the same bar: real-app timing, not mock-probe nodes, before
committing. (Each `--search` run on `n = 9` takes a few minutes; run one mode at
a time with `--only`.)

- **No n − 1 clue** — a line is a permutation, so it can never have exactly
  `n − 1` hits: fix `n − 1` cells on their target and the last value has only its
  home position left, forcing an nth hit. So `n − 1` is never a legal clue. The
  component drops it from every clue cell at load, which narrows the hidden clues
  and feeds the side-sum and pair through the shared cell.

- **Reverse, clue from line** — the clue is the hit count, so drop every clue
  candidate below `forced` or above `possible`.
- **Forward, forbid hits** — if the clue's largest candidate equals `forced`, no
  more cells may hit, so remove the target digit from every free cell.
- **Forward, force hits** — if the clue's smallest candidate needs every free
  cell to hit, pin each free cell to its target digit.
- **validate** — once clue and line are filled, the count of hits must equal the
  clue.

The all-different rule on each line is left to the built-in row/column check;
this component only reasons about hits.

## Run the tests

Soundness (needs Node):

```
node examples/hit-counts/soundness-harness.mjs
# -> line + side-sum + pair components, 0 violations, clue values 0..9, "PASS"
```

The harness seeds partial states that keep each cell's true value, runs the
component to a fixpoint, and checks no true value was removed. It fuzzes the line
component on all three line kinds — bare, house, and full house — plus a
nine-cell house of `{0..8}`, and each of those three pools carries a line whose
true clue really is `n - 1`, so an ungated rule loses that true value and the run
goes red. It forces in the identity line (clue 9) and a derangement (clue 0) on
every full-house run. Two deterministic checks cover the gate itself: one drops
`0` off the line between two `update` calls and asserts the same instance holds
`n - 1` while `0` is live and takes it afterwards, and one checks `validate`
accepts a clue of `n - 1` on a bare line and rejects it on a full house. The
side-sum section runs twice, on full-house perpendiculars (where it must prune)
and on bare ones (where it must remove nothing). The
pair section drives a line at the `A + B == cap` extreme and counts how often the
per-cell branch fires; a second pair loop fuzzes random permutations, whose
can't-hit cells exercise the dynamic cap; and a deterministic guard checks the
pin branch never empties a forced-miss cell.

## Timing

No row recorded. Both paths fail on the **baseline** probe, before the candidate
link is ever timed, so this is not a property of any component change:

- `just time hit-counts` — the entered-values guard used to refuse the
  baseline with "1 entered values on the board": it counted non-black
  `svg text`, and the cage's white `00` label tripped it even though the link
  decodes to 35 givens and 0 entered values. That was **#231**, fixed: the
  guard now reads cell digits by their board position, so it gets past the
  guard, then raises "app-solve.mjs got no timed reps" -- the app's search
  never closes on this given-only 9x9. That is **#116** (#157 records both
  halves).

The local board hit the same two, in the same order:

- `just time hit-counts --board PUZZLE_LINK_local.txt` — after #231, gets
  past the guard (38 givens, 0 entered values; `PUZZLE_LINK_local.txt`
  carries the same white `00` cage label as the shipped board) and then
  raises "app-solve.mjs got no timed reps": the app's search does not close
  on this board either. That is the same symptom as **#116**, on a different
  board — #116 is filed against the given-only 9x9 frame board (27 shown
  clues, 4 givens), not this one.

Both failures are on the **baseline** probe, so no local row can be recorded
and none has been invented. The gate row this example owes (`≤ 1.1×` on the
cold and after-logical rows, 3 reps, #236) and the local row for its bare-line
rules (#237) are both blocked until #231 and #116 are fixed. See
`docs/real-app-timing.md` for the protocol.
