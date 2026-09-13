# All-different at GAC strength: what it buys, what it costs

Consolidated from the #406 investigation. The board-specific story lives in
`406-unclued-line-stall-measurements.md`; this note is the reusable part.

## The finding in one line

SudokuMaker's own house constraints are **below GAC**, and a custom component
that filters an all-different house to generalized arc consistency is a real
strength upgrade even though it adds no information.

`DifferentDigitsComponent` and `HouseComponent` are **identical in strength** —
measured on the Skyscrapers board at every rung of a skip ladder (81/81, 30/81,
7/81 for both). Neither finds Hall sets. `HouseComponent`'s documented "every
digit exactly once" buys nothing extra on a 9-cell house of 9 digits.

Demo: `406-gac-demo/` — one plain 9x9, no skyscraper, two links differing only
by a GAC component. AutoStep reaches **53/81** without and **81/81** with.

## Two engines, and why the benefit hides

- **"Find all solutions"** is a search solver: propagate, guess, backtrack. It
  does not care about technique names. Every classic sudoku lands at 0-200 ms
  (`406-gac-demo/hard/`), including a 17-clue grid that costs a straightforward
  DFS ~1.5e9 cycles.
- **AutoStep** is the *logical* stepper, restricted to named human techniques —
  its log prints each one, including one-level `Placing X causes a
  contradiction`. It stops when the technique set runs dry, even on a board the
  search solver finishes instantly.

So GAC's **benefit** shows in AutoStep reach, on any board where the technique
set runs dry. Its **cost** shows only where the search has many nodes. They are
different axes, which is why the timing rule wants two rows.

Corollary that cost hours in #406: the extra strength is invisible at the
fixpoint. A stalled state is typically already GAC-clean; the filter pays off
*inside* the solver's hypothetical placements (gotchas #11, #12).

## Naked subsets == GAC, but only at the full size

On a house of n cells and n values, naked k-subsets for k = 1..n-1, iterated to
a fixpoint, **is** domain consistency. Naked k and hidden (n-k) are the same
deduction seen from two sides, and Hall's theorem makes those eliminations
exactly the ones Regin's matching finds.

Measured, n=9, 3000 random states per row, against a matching GAC reference
(`tools/subset_gac_equivalence.py`):

| cap | states differing |
| --- | --- |
| k=1..1 | 789 / 3000 |
| k=1..2 | 761 / 3000 |
| k=1..3 | 748 / 3000 |
| k=1..4 | 729 / 3000 |
| k=1..7 | 405 / 3000 |
| **k=1..8** | **0 / 3000** |

The curve barely moves until the top. "We do pairs and triples" is not "we do
GAC" — it misses a quarter of all states. The probe iterated to a fixpoint;
the one-scan form in `examples/_shared/` needs no loop (below). Either way it is per house; cross-house techniques (pointing, box/line) are a separate
axis that neither approach covers.

## Cost

Per house-filter call, node, 20000 random states (`tools/bench.mjs`,
`tools/bench2.mjs`):

| filter | n=9 | n=10 | n=12 | n=14 | n=16 |
| --- | --- | --- | --- | --- | --- |
| naked subsets 2^n | **10.9 us** | 25.1 us | 151 us | 676 us | 2672 us |
| matching GAC (`tools/AllDiffGacComponent.js`) | 14.4 us | 22.2 us | 41 us | 79 us | 122 us |

**Crossover is n=10.** Below it the subset form wins; above it it is unusable,
because 2^n ignores how propagated the house is while matching scales with the
live edge count.

### The shared component (#408)

`examples/_shared/HouseGacComponent.js` is the subset form, with its bit
tricks behind names. It is available to paste, but no shipped link carries it
yet; putting it into frame links, behind the timing bar, is #421. It reads all
2^n groups of cells in one scan, building each group's pooled digits from the
group minus its lowest cell and removing in place as it goes. No fixpoint loop
is needed. One call lands on exactly the matching reference's result: 0 of
3000 states differ at digits 1..9, 0 of 1000 at 0..9 on nine cells, and it
stops on the same 2000 unplanted states (`examples/_shared/house-gac.test.mjs`).
One scan is enough because, while the house still has a filling, a Hall-tight
group pools the same digits under any mix of old and new masks. It refuses a
house above 9 cells in `setParams`.

The bench below runs each component's generator, mask reads and Change building
included, so matching costs more and subsets less than in the bare-function
table above.

### Four forms of one rule, n=9 (#408)

The one-scan rule was written four ways and measured. The shipped component
is the named bitmask form; the other three stay in `408-house-gac/` as the
record behind this table and are not tested or maintained. The bench first runs
every form on 2000 states and requires each to leave exactly what the shipped
form leaves.

- `examples/_shared/HouseGacComponent.js`, **named bitmask** (shipped). Every
  group of cells is an integer, and every trick has a name: `lowestBit`,
  `withoutLowestBit`, `indexOf`, `countOf`, `pooledDigitsOf[group]`,
  `wholeHouse`, `cellsOutside`, `groupOwnsItsDigits`. The header explains the
  two kinds of mask and why counting groups up works.
- `408-house-gac/TerseHouseGacComponent.js`, **terse bitmask**. The same
  algorithm with short names: `s & -s`, `clz32`, `unionOf[s]`.
- `408-house-gac/IncrementalHouseGacComponent.js`, **incremental**. Digit sets
  through `getCandidates`, `union`, `size` and `subtract`. A recursive
  `growGroup` adds one cell at a time: a grown group's pooled digits are its
  parent's copy (`new SudokuDigitSet(groupDigits)`) plus that one cell's. An
  `inGroup` array of flags marks the current group.
- `408-house-gac/ReadableHouseGacComponent.js`, **readable**. The same digit
  sets with `SudokuDigitSet.getUnion` and `equals`. Each group is a new array of
  positions whose digits are pooled from scratch, and `group.includes` finds
  the cells outside it.

Speed comes from `408-house-gac/bench-house-gac.mjs`: 20000 states, 3 reps,
each component through its own `update`, across three runs. Each digit-set form
gets a fresh DigitSet per `getCandidates` call, as in the app, built from the
harness's DigitSet, whose methods are copied from the bundle. Size comes from
`408-house-gac/link-delta-house-gac.py`: the builder's `minify_file` and
`compressToEncodedURIComponent`, for the component on its own and for the
component plus `house-gac.js` added to `examples/skyscraper/PUZZLE_LINK.txt`,
with the backend's constructor name swapped in memory for the non-shipped
forms.

| component | per call, n=9 | vs terse | minified | compressed alone | link grows by |
| --- | --- | --- | --- | --- | --- |
| `HouseGacComponent.js` (named bitmask, shipped) | **4.2-4.6 us** | ~1.1x | 2183 | 1562 B | 1689 |
| `TerseHouseGacComponent.js` (terse bitmask) | 3.9-4.4 us | 1x | 1480 | **1209 B** | **1310** |
| `IncrementalHouseGacComponent.js` (grow one cell) | 14.6-18.5 us | ~4x | 1883 | 1376 B | 1502 |
| `ReadableHouseGacComponent.js` (pool from scratch) | 100-108 us | ~25x | 1835 | 1319 B | 1463 |
| `tools/AllDiffGacComponent.js` (matching, for scale) | 24.5-28.8 us | ~6.5x | 1577 | 1203 B | 1488 |

Naming the bitmask form costs almost no speed. It runs within about 10% of the
terse form, well inside the gap to every other form; the one-line helpers are
small enough for V8 to inline, though that is inferred from the timing, not
profiled. It costs bytes instead. Names survive minification, so it is the
largest form: 353 B more compressed than the terse form on its own, and 379
characters more in a link.

The readable form's cost is allocation, not the rule. For each of the 511
groups per call it builds a position array and pools every member's digits
again. Growing a group by one cell removes both costs and keeps the digit sets:
one small set per group and one union per group, not up to nine. That is about
6x faster than the readable form and faster than the naive matching filter,
but still about 4x slower than either bitmask form, which allocate nothing.

`408-house-gac/build-house-gac-links.py` writes the shipped Skyscrapers board
with each bitmask form added, to try in the app: `PUZZLE_LINK_house_gac.txt`
(named) and `PUZZLE_LINK_terse.txt`. Everything but the added "House GAC"
constraint is identical to `examples/skyscraper/PUZZLE_LINK.txt`.

### Larger houses, both real components (#408)

`408-house-gac/bench-large-n.mjs` runs both `update` functions at n=9..16,
loading the terse bitmask form with `MAX_CELLS` raised to 16 in memory. The
shipped named form has the same algorithm and ran within about 10% of it at
n=9. A state
is n cells over digits 1..n: a hidden permutation plus each other digit at
`rate`. Before timing, both filters ran once on every state (2000 per row,
32000 in all) and left identical candidates, so one scan stays exactly GAC up
to n=16. Best of 3 reps; a second run agreed within about 10% per row.

| n | subsets us | matching us, rate 0.35 | ratio | matching us, rate 0.15 | ratio |
| --- | --- | --- | --- | --- | --- |
| 9 | 4.1 | 24-26 | 0.17x | 11-12 | 0.34x |
| 10 | 7.9 | 32-33 | 0.24x | 15-16 | 0.50x |
| 11 | 16 | 39-40 | 0.41x | 16-17 | **0.97x** |
| 12 | 33 | 52-54 | 0.62x | 22-23 | 1.45x |
| 13 | 68 | 67-68 | **1.01x** | 26-29 | 2.45x |
| 14 | 138-142 | 86 | 1.60x | 33-38 | 4.0x |
| 15 | 283-302 | 111-117 | 2.5x | 42-46 | 6.8x |
| 16 | 580-617 | 138-142 | 4.2x | 51-54 | 11.7x |

Subsets cost only depends on n and doubles with each cell, whatever the
candidates. Matching cost follows the live candidate count, so a sparser,
better-propagated house moves the crossover down. Taking the crossover as the
first n where subsets is slower, it falls at **n=13 for random states (rate
0.35, 3.9-6.4 candidates a cell) and n=12 for sparse ones (rate 0.15, 2.2-3.3
a cell)**, not at the bare-mask probe's n=10. The sparse n=11 row is a near tie
(0.97x here, 0.87x on a reviewer's rerun). A 9x9 or 10x10 house is cheaper with subsets at
either density. At 16x16, subsets is 4-12x slower than the matching filter
this bench compares it with.

### n and m on a sudoku grid

Regin filters one house at a time: **n** = cells = 9, **d** = values = 9, **m** =
edges = the total candidate count across the house, so 9 <= m <= 81. There are
27 houses in a 9x9 grid.

Measured m per house on two real stalled boards: **median 21-25, min 9, max 40**
— well under the bound of 81, because boards spend most of their time
well-propagated.

For 14x14: n=14, d=14, m <= 196 with a realistic m of 60-80, and 42 houses
(14 rows + 14 columns + 14 boxes of 2x7).

### Complexity

- **Proper Regin**: initial maximum matching by Hopcroft-Karp **O(m*sqrt(n))**;
  repair on later calls one augmenting path per broken edge, **O(m*k)** for k
  removals; filtering by residual-graph orientation + Tarjan SCC + alternating
  paths from free value vertices, **O(m + n)**. One pass suffices (Berge).
- **What `AllDiffGacComponent` ships**: a full matching re-run per surviving
  edge, so **O(m^2 * sqrt(n))** — an extra factor of m. That factor is the
  whole gap: ~20x at 9x9 (m~25), ~80x at 14x14 (m~78). Estimated proper-Regin
  cost is ~0.5 us at 9x9 and ~1 us at 14x14. **Estimated, not measured.**

## Size in the link

The whole puzzle rides in the URL (gotchas #7), so component bytes matter.
lz-string compressed, comments stripped:

| component | raw | no comments | compressed |
| --- | --- | --- | --- |
| `tools/AllDiffGacComponent.js` (naive matching GAC) | 2212 | 1576 | **1201 B** |
| `tools/ReginGac.js` (proper Regin **sketch**) | 3306 | 3080 | **2131 B** |
| `408-house-gac/TerseHouseGacComponent.js` (bitmask subsets) | — | 1480 | **1209 B** |
| `examples/_shared/HouseGacComponent.js` (bitmask subsets, named) | — | 2183 | 1562 B |

Measured for #408 with the builder's own `minify_file` and
`compressToEncodedURIComponent`; that method gives the matching component 1203
B, so the terse subset form and matching are the same size on their own, and
the named form is 359 B larger than matching. The difference shows in
a link, where the backend rides too. Appended as one more constraint to
`examples/skyscraper/PUZZLE_LINK.txt` (8276 characters),
`408-house-gac/link-delta-house-gac.py` measures:

| backend + component | link grows by |
| --- | --- |
| `tools/alldiff-main.js` + `tools/AllDiffGacComponent.js` | 1488 |
| `examples/_shared/house-gac.js` + `408-house-gac/TerseHouseGacComponent.js` | **1310** |
| `examples/_shared/house-gac.js` + `HouseGacComponent.js` (named) | 1689 |

`ReginGac.js` is a **size probe, not working code** — it was never verified and
contains a meaningless `|| true` in the SCC loop. Do not ship it as is. Most of
its extra bytes are the filtering half (explicit-stack Tarjan plus the
free-value walk), not the matching.

Follow-up: **#408**, ship a small shared bitmask GAC component.

## Negative results worth keeping

- **Redundant strength buys nothing.** A refutation-only component
  (`tools/Refuter.js`: Hall check, `puzzle.stop()`, never removes a candidate)
  was called ~2400 times on a stalled plain board and fired **zero** times,
  leaving it at 36/81. The app already does that inside a trial — its log prints
  `R9C5, R9C6, R9C7 and R10C5 share only 3 candidates`.
- **Presence is not power.** Duplicating an already-registered line component
  leaves the board at 30/81. So is a component that yields nothing, and so is
  one that yields a Change removing nothing.
- **Classic sudoku cannot stress the search solver.** Platinum Blonde 100 ms,
  Fata Morgana 200 ms, a 17-clue anti-DFS grid 0 ms. Human difficulty and
  naive-backtracker difficulty are both irrelevant to it.
- **A GAC-clean stall cannot be relieved by more all-different.** Adding GAC to
  a plain board already closed under it changes nothing (36/81 -> 36/81). Check
  whether the deduction is available before concluding a component is inert.

## Tools

`tools/` holds every probe. **Paths inside them point at the original session
scratchpad and need fixing up before reuse.**

| file | what it does |
| --- | --- |
| `subset_gac_equivalence.py` | naked subsets k=1..8 vs GAC, the 0/3000 result |
| `bench.mjs`, `bench2.mjs` | per-call cost, n=9..16 |
| `AllDiffGacComponent.js` + `alldiff-main.js` / `gac9-main.js` | the working GAC component (11x11 frame / plain 9x9 backends) |
| `NakedOnly.js` + `naked-main.js` | naked-singles-only probe |
| `Refuter.js` + `refuter-main.js` | refutation-only probe (fires zero times) |
| `ReginGac.js` | proper-Regin size sketch, UNVERIFIED |
| `rowcol9-main.js` | plain 9x9 Rows & Columns backend |
| `logic.mjs` | AutoStep to fixpoint, count filled cells |
| `loud.mjs` | as above, plus relays `[probe]` console lines |
| `marks.mjs` | dump every cell's value and pencil marks after AutoStep |
| `gap2.py` | what deductions are available in a dumped state (subsets k=2..4, Regin sweep) |
| `hard.py`, `build_hard.py` | famous hard classics, verified grid strings |
| `build_plain.py`, `build9.py`, `build_variant.py` | the demo and variant boards |
| `skyscraper-doc.json` | the decoded colleague puzzle, source for every variant |

**Read `docs/gotchas.md` #11 before writing a probe of your own.** A component
runs inside the solver's hypotheses, so its observed candidate state is a branch
and its last logged frame is a teardown. Reading that frame as a board state
produced four wrong diagnoses on #406.
