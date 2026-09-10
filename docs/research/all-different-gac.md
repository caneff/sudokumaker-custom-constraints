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
GAC" — it misses a quarter of all states. Must also be iterated to a fixpoint,
and it is per house; cross-house techniques (pointing, box/line) are a separate
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
| bitmask subsets | — | — | not measured, expected smallest |

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
