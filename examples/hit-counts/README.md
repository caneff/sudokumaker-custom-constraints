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

- `main.js` — the local backend segment: one joint component per pair of drawn
  groups that cover the same line from opposite ends, and the per-line component
  for every group with no such partner.
- `main-global.js` — the global backend segment: builds all 4n frame lines
  from the board size, then registers the joint component per line plus the
  side-sum and side-hit-matching components below (both need a whole side, so
  only a full frame has them).
- `HitCountsJointComponent.js` — one component for a whole line and both its
  clues, used wherever a line is clued at both ends. It reads the hits as a
  matching between digits and positions and prunes cells and clues against the
  `(A, B)` hit counts the line can still reach. On a line that holds `1..n` once
  each it runs that sweep over whole permutations instead, which reads the misses
  as well as the hits. Its rules that need more than a bare line — that sweep,
  the mirrored-pair exclusion and "a clue is never `n - 1`" — sit behind gates
  the component checks at solve time (see "Line kinds and gates" below).
- `HitCountsComponent.js` — the per-line component, for a line clued at one end
  only: a drawn path, or half a frame an author is still drawing. It bounds the
  clue from the line and forces or forbids hits when the clue's range demands
  it. Those bounds hold on any line an author draws; its `n - 1` rule sits
  behind the same gate.
- `SideSumComponent.js` — the per-side component. The `n` clues on one side sum
  to exactly `n`; it propagates that sum across the side's clue cells. It takes
  the `n` perpendicular lines its proof rests on and fires only while each one
  is a full house of `{1..n}`.
- `SideHitMatchingComponent.js` — the other per-side component. It reads the
  side by position instead of by line and assigns the `n` positions to the `n`
  lines, which lets it *force* a hit into a cell where the line rules can only
  forbid one (see "Side hit matching" below). It builds each position's cell
  list itself and fires only while every position is a house of `{1..n}`.
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
  `uv run --with lzstring examples/hit-counts/build_link.py --component HitCountsJointComponent.js --out /tmp/candidate.txt`
- `rebuild_size.py` — re-encodes a shipped link from its committed
  `gen_<n>x<n>.json` with the component code as it stands in the repo, with no
  fresh CP-SAT search: same board, current code.
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

## Side hit matching — the same regrouping, assigned

The side sum counts the hits column by column and stops there. Assign them
instead. Call the cells that sit `i + 1` steps in from each of the side's `n`
clues **position `i`**. Those are the same `n` cells the sum's proof used — a
column for a side of rows — so digit `i + 1` sits in exactly one of them, and
that one cell tells you which line **hosts** position `i`. Line `L` hosts
exactly `clue(L)` positions.

So the side is a bipartite assignment: positions on one side, lines on the
other. Edge `(i, L)` is live while digit `i + 1` is still a candidate in line
`L`'s cell at position `i`, and line `L` may take between the least and the
greatest value its clue still allows. `SideHitMatchingComponent` solves that
assignment as a flow and filters it Régin's way — an edge no valid assignment
uses loses its digit, and an edge **every** valid assignment uses pins its cell
to the target.

That second half is the new inference. The line rules only ever forbid a hit or,
when the clue's own count leaves no choice, force every remaining candidate hit
on that one line. The side can force a hit that no single line can pick out: two
lines each with two possible hits and one clued hit apiece decide nothing on
their own, and the side decides both as soon as a third line's only home is
taken. `update-strength.test.mjs` pins that case.

The component sees `4n` cells on the 9x9 board and the solver calls `update`
after every change to any of them, so it hashes exactly what the assignment
reads — one bit per line per position, plus each clue's candidate mask — and
returns at once when nothing it reads has moved. The prototype measured that
narrowing at about a third of the deduction's whole win (#233).

## Line kinds and gates

A rule may assume nothing about a line beyond what the component can prove at
solve time (`docs/line-contract.md`). Hit Counts splits this way:

| Rule | Needs | Where |
|-|-|-|
| reverse clue bound `[forced, possible]` | nothing — a bare line | line component |
| forward "no more hits" / "all must hit" | nothing — a bare line | line component |
| the hit sweep: cells and clues against the reachable `(A, B)` | nothing — a bare line | joint component |
| a mirrored pair never gives one A hit and one B hit | a house | joint component |
| the permutation sweep: cells and clues against the reachable `(A, B)` over whole permutations | a full house of `{1..n}` | joint component |
| a clue is never `n - 1` | a full house of `{1..n}` | both line components |
| side sum `= n` | `n` perpendicular full houses of `{1..n}` | side-sum component |
| the position-to-line assignment | every position a house of `{1..n}` | side-hit-matching component |

The count bounds read each cell alone and the sweep enforces the hit matching
and each cell's own candidates, so both hold on a line with repeats, gaps, or
any length. The other two rules do not. The
mirrored-pair exclusion says one digit cannot sit in two cells, which is a house.
The `n - 1` rule is the pigeonhole on a line that holds `1..n` once each, and on
a hand-drawn line of `[1,2,3,4,5,6,7,8,1]` the true clue IS `8`. The component
therefore asks the app — `getCellsCanHaveRepeats` on the line alone — and counts
the live candidates across the line.

Two facts make the check awkward, and both are why it runs in `update` rather
than in the main code or once at load:

- Main code runs before the built-in row and column houses are registered, so a
  question asked there reads every line as bare (gotcha 6).
- These boards run `minDigit 0` so the clue ring can hold a `0`, with a
  look-and-say cage keeping `0` off the inner grid. Until that cage bites, `0`
  is still a live candidate on every line cell, so the line is not yet a full
  house of `{1..n}`. The kind is re-tested each `update` until the digit set
  proves out, then cached on the instance.

A digit set of `{0..8}` is the case that makes the count alone insufficient: nine
different digits over nine cells passes any full-house test, yet such a line can
hit `n - 1` times. So the rule tests the digit set itself — and the answer is
cached on that test, not on the kind, which would hold the gate shut for good
once the cage removed the `0`.

A `0` on a line is also an ordinary miss for the sweep: it is neither of the
position's two target digits, so it keeps the "hit for neither" case open like
any other digit.

## The joint line — both clues at once

Two clues on opposite ends of one line couple, and the coupling is much stronger
than a bound on `A + B`. Number the line's positions `j = 0 … n-1` from clue A.
Position `j` is a hit for A when it holds digit `j + 1`, and a hit for B when it
holds digit `n - j`. So **digit `d` can hit in exactly two places**: position
`d - 1` for A, position `n - d` for B.

Read that as a graph — positions on one side, digits on the other, one edge per
possible hit. Every node has degree at most 2, so the graph is a union of paths
and cycles. Follow the edges from position `j`: its A-edge takes digit `j + 1`,
whose B-edge sits at position `n - 1 - j`, whose A-edge takes digit `n - j`,
whose B-edge returns to `j`. The graph therefore splits into `⌊n/2⌋`
four-cycles, each joining a position to its **mirror** `n - 1 - j`, plus the
centre position alone when `n` is odd.

The mirrored pairs share no digit and no position, so they are independent, and
the `(A, B)` hit counts the whole line can reach are the **convolution** of one
small set per pair.

Each mirrored pair allows five outcomes. Each of its two positions takes one of
three cases: hit for A (`L`), hit for B (`R`), or neither (`M`). A case is open
only while the cell still holds that candidate. On a house, two of the nine
combinations are impossible — `(L, R)` and `(R, L)` both put the same digit in
both cells — and what survives contributes `(0,0)`, `(1,0)`, `(0,1)`, `(2,0)` or
`(0,2)`. The centre contributes `(1,1)` when it holds its own digit and `(0,0)`
when it does not.

Note what the exclusion says: **a mirrored pair can never give one A hit and one
B hit.** A cap on `A + B` counts positions and knows nothing about digits, so it
cannot see this at all.

`HitCountsJointComponent` runs the standard forward and backward sweep over
those sets:

- `F[u]` — the `(A, B)` sums reachable from the pairs before `u`.
- `H[u]` — the sums from which the pairs from `u` on can still land inside the
  **clue box**, the `(a, b)` with `a` a candidate of clue A and `b` of clue B.
- A case of one position is impossible when no combination containing it joins
  an `F[u]` state to an `H[u+1]` state. Then `L` impossible drops digit `j + 1`
  from the cell, `R` impossible drops digit `n - j`, and `M` impossible pins the
  cell to `{j + 1, n - j}`.
- The clues keep only the values that appear in `F[end]` inside the box.
- An empty intersection means the branch is dead, and the component empties clue
  A as the contradiction signal.

The mirrored-pair exclusion is one of two rules that read outside the line's own
candidates, so it is gated: the component asks `getCellsCanHaveRepeats` about
the line, and on a bare line `(L, R)` and `(R, L)` stay open while the rest of
the sweep still holds.

### The permutation sweep, on a line that holds `1..n` once each

The case sweep asks of each position only whether it can hit for A, hit for B,
or miss. It never asks whether the misses can be filled with the digits that are
left, so it keeps cases no filling of the line reaches. On a line that holds
`1..n` once each every filling **is** a permutation, and the same two sweeps can
run over permutations instead of cases:

- A state is the set of digits already placed. Its size names the position to
  fill next, so one number does the work of two.
- `F[mask][a]` — the B counts a prefix can reach with A count `a`, having used
  exactly the digits in `mask`.
- `H[mask][a]` — the B counts that, added to a prefix already holding `(a, b)`,
  let the rest of the line finish inside the clue box.
- Digit `d` at position `i` survives when some state meets its own future: the
  prefix reaches `(a, b)` and the suffix after `d` finishes from there. A digit
  no state supports is a digit no permutation can put in that cell — which is a
  removal the case sweep cannot make, because it never tracked which digit a
  miss would need.

That answers everything the case sweep answers and more, since every case it
keeps is realised by a real permutation. So a line takes one sweep or the other,
never both: the gate is the same full house of `{1..n}` the `n - 1` rule needs,
and a line that fails it keeps the case sweep. Both sweeps cost `O(n * 2^n)`
tables in `n`, so the component runs the matching only up to nine cells, the
length the shipped boards use and the only length it has been timed on.

`HitCountsComponent`, the one-ended component, keeps its naive per-cell scan and
gets no sweep of its own. It takes a line only where no clue sits at the far end,
which on the shipped boards means a drawn bent path — and a bent path crosses
rows and columns, so it repeats digits and is a bare line. The gate could never
open there, so the sweep would be code no board runs. Give that component a
straight full-house line at one end and it becomes worth writing; nothing ships
one today.

The example that separates the two: `n = 4`, clue A pinned to 2, with digit 4
live in every cell and digits 1, 2 and 3 each with one home. A permutation is
then named by which cell takes the 4. Put it at position 0, 1 or 2 and the other
two digits land on their own targets for two A hits; put it at position 3 and all
three land at home for four. So clue A = 2 forbids digit 4 at position 3. The
board's own all-different keeps it — `(1, 2, 3, 4)` is a permutation — and so
does the case sweep, which counts two A hits from the mirrored pair `(0, 3)` and
none from `(1, 2)` without asking what digits those misses would need.

The sweep does not subsume everything. A clue can never equal `n - 1` — fix
`n - 1` cells on target and the last value has only its home left, forcing an
`n`th hit — and that is a permutation fact the hit matching alone cannot see, so
the component keeps it as a rule of its own for both clues. It is the second
gated rule, and it needs more than a house: the line's live digits must be
exactly `1..n`, which the component checks itself (see
`../../docs/line-contract.md`). Both gates are re-tested on every `update`
until they open, because the app's exclusion groups grow as it builds the
puzzle.

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
A path has a clue at one end only. On the committed seed, `R2` and `T2` trace
the identical nine-cell route in opposite directions, so that one pair does
get a joint component -- gated to its non-house mode, since a bent path is
never a house. Every other path is unpaired and runs the per-line component
alone.

A second local board ships at 6x6 (`PUZZLE_LINK_6x6_local.txt`,
`gen_6x6_local.json`), built the same way:

```
uv run --with ortools --with lzstring \
    examples/hit-counts/build_size.py 6 2 3 --paths
```

Same bent-path shape, same CP-SAT model, same test coverage
(`build_link.test.py`) -- the point of the smaller board is that the app
finishes it inside the rep cap, which the 9x9 does not. See "Timing" below.

Its rules text carries one extra sentence the global board does not — the
line is drawn, so it is not a house and a digit may repeat along it
(`framebuild.LOCAL_RULES_SUFFIX`, shared by every example's local link).

The committed 9x9 board is seed 103: 2 interior givens, 32 shown clues, 4
interactive. The 6x6 board is seed 102: 0 interior givens, 11 shown clues, 13
interactive.

## Paste into SudokuMaker

To draw your own lines, add a custom local constraint and paste `main.js` as
the main code, plus the `HitCountsJointComponent` and `HitCountsComponent`
segments. Each group is one line: cell 0 the outside clue, the rest the line
read inward. Draw both ends of a line and it gets the joint component, which is
much the stronger of the two; draw one end, or a bent path, and it gets the
per-line component.

To use the whole grid as an interactive-outside frame instead (see
`../../docs/patterns.md`), add a custom global constraint and paste
`main-global.js` as the main code, plus the component segments:
`HitCountsJointComponent`, `SideSumComponent` and `SideHitMatchingComponent`.

## What the component deduces

Everything in "The joint line" above: the reachable `(A, B)` hit counts, the
cases each position can still take, and the clue values that survive. The
subsection below is about a different bound — the one the recovery probe
measures and the component does not use.

Let `forced` be the cells already pinned to their own distance (a hit no matter
what) and `possible` be the cells whose distance is still a candidate (a hit is
still open). The naive bound says the hit count lies in `[forced, possible]`.

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
node examples/hit-counts/recovery-probe.mjs gen.json --floor=regin
```

The components as a whole earn their keep — over the sudoku floor, which recovers
no hidden clue on its own, they recover 7 of the 9 hidden clues on `gen_9` and
remove 205 candidates the floor leaves standing. But the matching refinement
adds **zero** on top:

- `gen_6` — the matching never even fires: the interior starts empty, so every
  line's candidates stay wide and the matching bound equals the naive one on all
  24 lines. Nothing to bite.
- `gen_9` — the matching *does* fire (tighter than naive on 14 of 36 lines), yet
  the recovered clues and cells are identical with it on or off. The all-different
  floor plus the joint and side-sum components already reach the same fixpoint,
  so the tighter clue bound is redundant.

The result holds under a weaker singles-only floor too (`--floor=singles`).

The `--search` mode closes the last gap — pruning inside search, where pinned
cells turn line domains partial and the matching should bite most:

```
node examples/hit-counts/recovery-probe.mjs gen.json --search --only=on
```

It runs a full DFS that proves uniqueness (MRV branching, one solution) and counts
the nodes explored, matching off vs on:

- `gen_6` — 840 nodes off, 774 on (66 fewer, 7.9%);
- `gen_9` — 14,708 nodes off.

Those are the counts the goldens pin. `OPTIMIZATION_LOG.md` records what the
joint line DP bought against the wiring before it.

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
committing. (A `--search` run on `n = 9` takes about a minute; run one mode at
a time with `--only`.)

### The rules, in one list

- **No n − 1 clue** — a line whose digits are exactly `1..n` can never have
  exactly `n − 1` hits: fix `n − 1` cells on their target and the last value has
  only its home position left, forcing an nth hit. The component drops `n − 1`
  from both clue cells as soon as the line's digits settle, which narrows the
  hidden clues and feeds the side sum through the shared cell.
- **Clue from line** — a clue keeps only the values that appear in an `(A, B)`
  pair the line can still reach.
- **Line from clues** — a position loses its A digit, or its B digit, or every
  other digit, when the matching case behind it joins no reachable forward state
  to a reachable backward one.
- **Dead branch** — when no reachable `(A, B)` lies inside the clue box, the
  component empties clue A as the contradiction signal.
- **validate** — once both clues and the whole line are filled, each clue must
  equal its own hit count exactly.

The all-different rule on each line is left to the built-in row/column check;
this component only reasons about hits.

## Run the tests

Soundness (needs Node):

```
node examples/hit-counts/soundness-harness.mjs
# -> joint + side-sum components, 0 violations, "PASS"
```

The harness seeds partial states that keep each cell's true value, runs the
component to a fixpoint, and checks no true value was removed. It fuzzes both
line components on all three line kinds — bare, house, and full house — plus a
nine-cell house of `{0..8}`, and each of those pools carries a line whose true
clue really is `n - 1`, so an ungated rule loses that true value and the run goes
red. It forces in the identity line (clue 9) and a derangement (clue 0) on every
full-house run.

A second pass runs the component over real grids: each `gen_*.json` grid plus
band/stack shuffles of it, which keep a grid valid while moving every hit. There
both clues of a line are true together, which is what the component actually
reads on a board. Digit relabelling is not a safe shuffle here: a hit compares a
digit to a position, so relabelling changes the rule, not just the grid.

A third pass names the mirrored-pair exclusion rather than counting any removal:
it runs one state twice, declared a full house and declared bare, and counts the
states where the house run pruned strictly more. The clue seeds drop `n - 1`
first, so the other gated rule cannot account for the difference.

A fourth does the same for the permutation sweep, against the case sweep it
replaced on a full house: the same state through the component as it stands and
through the code at the commit before it, counting the states where the matching
pruned more. It fires on about nine states in ten. Every state there is seeded
around a real permutation and its two true clues, so a state where the matching
removed a true value is a soundness failure, not a strength win, and the run
goes red.

Three deterministic checks cover the gates themselves: one drops `0` off the line
between two `update` calls and asserts the same instance holds `n - 1` while `0`
is live and takes it afterwards; one does the same for a full house whose digit
set is `{0..n-1}`, which must not lock the gate shut for good; and one checks
`validate` accepts a clue of `n - 1` on a bare line and rejects it on a full
house. The side-sum section runs twice, on full-house perpendiculars (where it
must prune) and on bare ones (where it must remove nothing).

Strength (needs Node):

```
node examples/hit-counts/update-strength.test.mjs
```

The joint component's floor is the per-line and pair components it replaced, run
together at the commit that last shipped them: on random states it must never
leave a candidate they removed. Two deterministic cases pin the inferences it
adds. The first is the mirrored pair that can never give one A hit and one B hit,
which the pair component's count-only cap cannot reach; it runs on a line with a
live `0`, five digits over four cells, so the permutation sweep stands down and the
exclusion is what the case reaches. The second is the permutation sweep's own: the
`n = 4` line above, where the sweep drops a digit that the case sweep at the
previous commit keeps.

## Timing

```
just time hit-counts
```

| date | app version | board | baseline | candidate | ratio | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-30 | v2026.08.14-d47fc4b | hit-counts | 7000ms | — | — | BASELINE |
| 2026-08-30 | v2026.08.14-d47fc4b | hit-counts after-logical | 6900ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | hit-counts | 6300ms | 6500ms | 1.03 | FAIL |
| 2026-08-31 | v2026.08.14-d47fc4b | hit-counts after-logical | 6300ms | 5600ms | 0.89 | PASS |
| 2026-08-31 | v2026.08.14-d47fc4b | hit-counts (PUZZLE_LINK_local.txt) | — | — | — | DNF (300s timeout, 3/3 reps) |
| 2026-09-03 | v2026.08.14-d47fc4b | hit-counts (PUZZLE_LINK_6x6_local.txt) | 200ms | — | — | BASELINE |
| 2026-09-03 | v2026.08.14-d47fc4b | hit-counts (PUZZLE_LINK_6x6_local.txt) after-logical | 200ms | — | — | BASELINE |
| 2026-08-31 | v2026.08.14-d47fc4b | hit-counts (cell-id coercion, #276) | 7200ms | 7200ms | 1.00 | gate: PASS |
| 2026-08-31 | v2026.08.14-d47fc4b | hit-counts (cell-id coercion, #276) after-logical | 6100ms | 6100ms | 1.00 | gate: PASS |
| 2026-09-04 | v2026.08.14-d47fc4b | hit-counts (stopped-prune memo, #329) | 9100ms | 9600ms | 1.05 | gate: PASS |
| 2026-09-04 | v2026.08.14-d47fc4b | hit-counts (stopped-prune memo, #329) after-logical | 8100ms | 8900ms | 1.10 | gate: PASS |

The #329 pair drops the `instance.sig` write on a `permutationPrune` that
stopped, so a state the sweep declared dead is swept again rather than skipped
by the memo the backtrack left behind. It removes no deduction and adds none,
so it takes the ≤ 1.1× on both rows bar. Three runs: 1.05/1.14, 1.02/1.09 and
the recorded 1.05/1.10 — the after-logical row sits on the bar, and the run
that missed it is noise of the same size as the spread in the baseline column
(8600–10300ms across the three).

The last pair is #276, which makes `main-global.js` coerce every cell id it
derives from the board size with `| 0`. A cell id built that way is numerically
equal to the id a drawn group carries and compares `===` to it, but the app's
solver reads candidates through it more slowly until it is a plain integer
again. The fix adds no deduction, so the bar is **≤ 1.1× on both rows** and
"unchanged" is the pass. On this board it is exactly unchanged: the permutation
sweep dominates the per-call cost here, so the coercion has little left to
save. `examples/numbered-rooms/README.md`, "What it actually was (#276)", has
the probes and the board where the effect is plain. Baseline is the committed
link before the coercion, candidate the same board with it, 3 reps, arms
interleaved.

The 6300/6500 pair gates the permutation sweep (#16): the two-row rule ships a
change at ≤ 0.9× on one row and ≤ 1.1× on the other, and this clears both. The
rows split the way a deduction that trades per-call cost for search should. Cold,
the sweep is a little slower — it costs more per call, and the board still has
enough search left that the cut does not repay it. After the app's own logical
solver has run, what is left is search, and there the sweep is 0.89×.

**The verdict is marginal, and the row above is a median, not a single run.**
Seven runs stand behind it, because the first two disagreed. The after-logical
ratio sits right on the 0.9 bar: five of the seven cleared it, two did not, and
the ones that did not read 0.90 and 0.91. Anyone re-timing this should expect the
same, and should not read a single `NO SHIP` as a regression.

| run | cold | after-logical | verdict |
| --- | --- | --- | --- |
| 1 | 6500 → 6900 (1.06) | 6400 → 5800 (0.91) | NO SHIP |
| 2 | 6900 → 6900 (1.00) | 6500 → 5800 (0.89) | SHIP |
| 3 | 6400 → 6900 (1.08) | 6600 → 5700 (0.86) | SHIP |
| 4 | 6400 → 6900 (1.08) | 6600 → 5800 (0.88) | SHIP |
| 5 | 6200 → 6500 (1.05) | 6100 → 5500 (0.90) | NO SHIP |
| 6 | 6300 → 6500 (1.03) | 6300 → 5600 (0.89) | SHIP |
| 7 | 6300 → 6500 (1.03) | 6300 → 5600 (0.89) | SHIP |

Median over the seven: 1.05× cold, 0.89× after-logical. What moves between runs
is the **baseline**, not the candidate: the baseline wandered from 6100ms to
6900ms while the candidate tracked it a fixed distance below, which is a machine
warming up under a readout that prints in 100ms steps. Runs 6 and 7 are byte-for
-byte identical, so by then the machine had settled; run 6 is the row in the
table above.

Runs 1–3 timed the sweep with its length cap at twelve cells and runs 4–7 the
nine it ships with; runs 5–7 also carry the review's rename and the buffers
hoisted out of the per-call path. The cap moved because nothing has measured a
line longer than the shipped boards.

**#116 is fixed:** the shipped 9x9 (35 givens, 0 entered values) now returns a
verdict in seconds, where the old per-line and pair components gave no verdict
at all. The 2026-08-30 rows print `BASELINE`, not a ratio, because on that day
the working-tree `HitCountsJointComponent.js` was byte-equal to the code
`PUZZLE_LINK.txt` already shipped — C′ and D landed in #249/#250, so the command
had no candidate edit to gate. See `docs/real-app-timing.md` for what a
`BASELINE` row means and #248 for the prototype's 0.40×/0.41× measurement
against the old components.

The 9x9 local board (`PUZZLE_LINK_local.txt`) is a DNF: its 36 bent paths are
not full houses, so the components' strong deductions rarely fire and the
app's own search runs past the 300s per-rep timeout on every rep (`just time
hit-counts --board PUZZLE_LINK_local.txt`). That DNF is a deliberate property
of the board, not an open bug -- **it is not #116** and it does not get
regenerated or eased to close. The board exists as a coverage fixture: it
proves the bare-line rules never remove a candidate the true solution needs,
which `soundness-harness.mjs` already holds by fuzzing 400 random bare lines
plus the `[1,2,3,4,5,6,7,8,1]` counterexample at 40,000 iterations on every
`just check`. What that fixture cannot show is that the real app finishes a
bare-line board at all -- three reps that all hit the cap prove nothing about
app-side timing either way. The 6x6 local board carries that evidence
instead: same paths, same CP-SAT model, small enough that the app returns a
real verdict (`just time hit-counts --board PUZZLE_LINK_6x6_local.txt`),
timed above. It is an existence proof, not a gate board: both rows read
200ms, two ticks of a readout that prints in 100ms steps, so a future
candidate's 0.9x/1.1x ratio is unmeasurable on it. The after-logical row
being non-zero is what says search ran — the app's logic pass alone does
not finish this board.
