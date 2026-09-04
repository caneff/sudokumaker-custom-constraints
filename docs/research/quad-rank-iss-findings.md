# What the ISS quad-rank effort proved

Resolves [#323](https://github.com/caneff/sudokumaker-custom-constraints/issues/323),
part of the quad-rank map [#321](https://github.com/caneff/sudokumaker-custom-constraints/issues/321).

Source: `~/src/iss-stuff/quad-rank` (read-only). ~30 resolved tickets under
`.scratch/quad-rank/issues/`, 4 more under `.scratch/quad-rank-givens/issues/`.
Everything below cites a file or a ticket there rather than restating it.

Scope: **plain** quad rank, 6x6 destination. The Schrödinger variant
(`.scratch/quad-rank-schrodinger/`) is out of scope and is not read here except
where the plain code carries its scaffolding.

**Every number in that project is 9x9 unless said otherwise.** 9x9 has 64
windows; our 6x6 has 25. The final section says which findings survive the shrink.

---

## 1. What lifts

### Confirmed API-free (`quadrank.js`)

`quadrank.js` deliberately takes ISS's constraint classes as an injected `C`
argument instead of importing them, so the module has **no ISS import and no
`node:*` import at all** (`comparator-cache.js` holds the Node bits precisely to
keep that true). The following are pure array/number code and lift verbatim:

| export | what it is |
| --- | --- |
| `windowList(rows, cols)` | top-lefts of every 2x2 window, row-major, `R{r}C{c}` ids, 1-based |
| `windowCells({r, c})` | the four cell ids in TL/TR/BL/BR order |
| `windowValue(grid, w)` | the four digits concatenated and read as a number |
| `ranks(grid)` | the oracle: `Map` of window id -> SQL RANK. **This is the definition of the constraint**; everything else in the project is checked against it |
| `cluesFor(grid, ids)` | finished grid + chosen window ids -> `[[id, rank], ...]`, throwing on a non-window id |
| `duplicateRanks(clues)` | reports clues sharing a rank (information, not an error — see ties, below) |

Two caveats on lifting them as-is:

- `windowDigits` runs every cell through `asDigits`, which is S-cell
  scaffolding (`Array.isArray(cell) ? sorted pair : [cell]`). On plain grids it
  is the identity. Drop it on the port; it is the only Schrödinger residue in the
  plain path.
- `validateSchrodinger` is Schrödinger-only. Do not port.

### Not API-free — do not lift

`buildQuadRank`, `comparatorSpec`, `leadDigitSpec`, `lexSpec`, the machine
memos, `MAX_CELLS`/`ORDERS`/`MAX_DEFAULT_PACK`. All of these are ISS NFA/Var/Sum
encoding, and all of them were **abandoned as the solving route** by ticket 21+
anyway (see §2). Their *ideas* — leading digit, pairwise order — port; their code
does not.

### Also worth taking

- **`grids.js`** — `SIZES` (`6: { box: [2,3], solutions: 28200960 }`) plus
  `sampleGrids(size, want, stride)`, a lexicographic-order solution enumerator
  with deterministic striding. Pure JS, no deps. This is the natural driver for
  a soundness fuzz harness, and its 6x6 entry is already correct for our board.
  Warning carried by tickets 12/13/16: the lexicographically-first grid is the
  *most structured* grid there is; do not draw conclusions from it alone.
- **The `.qr` fixture format** — a text file of `RxCy rank` lines, `#` comments,
  optional `6x6`-style shape header, extended by the givens work with
  `given RxCy digit` and `cand RxCy digits` lines. Setter-typeable, one file per
  state, and the `given` keyword disambiguates a placed digit from a clued
  window's top-left. Worth copying wholesale if the generator wants fixtures.
- **`bench/population.js` + `manifest.json`** (ticket 16) — the *methodology*
  more than the data: sat openers whose clues are true ranks read off a known
  source grid are **sat by construction** (that grid is the witness, no solver
  asked); unsat openers are built by clueing one window twice with different
  ranks, **unsat by construction** because a window has exactly one rank in any
  grid. A `--check` mode asserts both invariants against the oracle. Copy that
  discipline: never certify a fixture on the solver's word when the solver is
  the thing under test.
- **`CONTEXT.md`** — the vocabulary (clue, opener, witness, found/broke/unknown,
  given, restricted candidate). Its Schrödinger half is out of scope.
- **`comparator-cache.js`** — cited by #323 as a candidate. **Skip it.** It
  exists only to cache a compiled ISS NFA (an 11s compile), which we never build.
  The one transferable idea is its stale-cache key: hash the *spec source* into
  the cache filename so an edit to the rule can never be served an old artifact.

---

## 2. Deduction cost

The whole arc: ISS's constraint encoding **never propagated early enough**, and
after four attempts the project gave up on it and moved the solver to CP-SAT in
Python. The deduction findings are still directly useful, because they say which
facts about rank are strong and which are worthless.

### The diagnosis (ticket 12)

Rank is a **global ordinal**: a window's rank counts how many of the *other*
windows hold a smaller value. One cell sits in up to four windows, so changing a
cell can move many windows in the total order at once. There is no locality.

Consequence, measured: with the base comparator+tally encoding, a loose opener's
clue **prunes nothing until the grid is nearly full**. Ticket 12's probe showed
every unsolved run doing tens of thousands of cheap guesses at 1,400-3,900
nodes/s — the search wandering an under-constrained space, *not* propagation
dying. Related corrections it made: difficulty is **monotonic** in clue count
(the earlier "mid-range hole" was cell-choice variance between three different
hand-picked clue sets), and **scattered clues are easier to search than
clustered** ones at equal count, the reverse of the assumption in `bench/README.md`.

### What was tried, and what it bought

| deduction | verdict | evidence |
| --- | --- | --- |
| **Leading digit** — the rank names the window's top-left digit | **Kept, and not close.** With it off, a broken opener ran past a 30-minute cut-off; with it on, 6.4s | ticket 06 |
| **Pairwise order among clued windows** — `rank(A)<rank(B) => value(A)<value(B)`, `rank(A)==rank(B) => value(A)==value(B)` | **The one real encoding win.** Cleared 9 of 12 known-wanderers from a hard 60s timeout to a witness; base cleared 0 of 12 | tickets 17, 18 |
| **Bounds / interval on a window's value** (min/max from cells set so far, fail-fast when the required strictly-less count is unreachable) | **Dead end. Vacuous.** On the target fixture it was indistinguishable from base (145k guesses vs 147k), and stacked on pairwise it changed nothing at all (42ms/58 guesses vs 41ms/58). Fail-fast bounds prune nothing the tally count did not already | ticket 17 |
| **`pack`** — how many window comparisons share one tally cell | Real but small; pack 8 gave 58,887 guesses against 87,711 at pack 4. **pack 1 is catastrophic**: 2.8M guesses, nine minutes | ticket 06 |
| **Comparison ordering** (overlap-first vs row-major inside a tally group) | Minor: 61,331 guesses / 27.7s vs 87,711 / 36.9s | ticket 06 |
| **Memoising the leading-digit machine by `(n,k)`** | **Killed by its own number** — encoding a whole clue set costs 1-9ms. No ticket written | ticket 06 |
| **ISS search steering** (`SearchPriority`, decision hooks) | Reasoned out, never built: the global-ordinal non-locality means there is no gradient for a cell/value heuristic to exploit | tickets 15, 17, 19 |
| **Min-conflicts / simulated annealing** (own loop, oracle scoring) | 76% on the population but 339ms-59.5s variance, and every miss stranded as *a valid sudoku one rank-unit off target* — the endgame cannot be closed by 1- or 2-swaps because nudging one window's rank ripples through the global ordinal | tickets 20, 21 |

### The two structural facts worth carrying

**(a) The leading digit is a genuinely cheap, sound, single-cell deduction.**
In an n x n grid over 1..n, the top-left digit dominates the window's value, and
the window top-lefts form the (n-1)x(n-1) subgrid, so:

```
rank = 1 + (n-2)(TL-1) + [grid[n][n] < TL] + tiebreak,   tiebreak in 0..count-1
```

Read backwards, a rank clue names the top-left cell's digit. Verified for 6x6 in
this session against the oracle: 200 grids x 25 windows = 5,000 windows, **zero
violations**, and the rank -> TL map on 6x6 is:

| TL digit | achievable ranks |
| --- | --- |
| 1 | 1-5 |
| 2 | 5-9 |
| 3 | 9-13 |
| 4 | 13-17 |
| 5 | 17-21 |
| 6 | 22-25 |

So on 6x6, **21 of the 25 possible ranks pin the clued window's top-left cell to
exactly one digit**, and the other four (5, 9, 13, 17) narrow it to two. That is
the deduction to build the SudokuMaker `update` around: it fires on the first
pass, before anything else is known, and costs a table lookup. Guard: it is
sound only when `rows == cols == numValues` (our 6x6 qualifies).

**(b) Tie clues are strong, not a nuisance.** `value(A) > value(B) => rank(A) >
rank(B)`; the contrapositive both ways gives **same rank <=> digit-identical
windows** on plain (fixed-length) grids. Two clues sharing a rank force those
eight cells to match pairwise. Ticket 04 treats this as a first-class opening
technique and reports it as *information*, never a warning. Ticket 24 records the
corollary: any "assign each window a distinct position" reformulation is
**unsound** because ties break the bijection — the strict-`<` count encoding is
the one that gets ties right.

### The wall nothing moved

Ticket 18 read the pairwise build against the real population and got **47% sat
against a 90% bar**, with the failures clustered at the loosest openers (k5/k6).
Diagnosis, confirmed at population scale: pairwise pins the order only among the
5-8 *clued* windows, and a loose opener's witness lives mostly in the ~56
**unclued** ones. Ticket 24 restates it as the **unclued-window count wall**: a
clued window's rank counts every free window, and no encoding-layer lever moves
that. The only thing that ever did move it was **givens** — pinning actual cells
(§3).

---

## 3. Uniqueness and clue counts

### Clue counts (all 9x9)

- **5-8 quad-rank clues** is what the project calls an *opener* — the loose end,
  what a setter actually hand-builds. This is genuinely loose: a five-clue set
  cuts a ~6.7e21 space by only ~64^5, so witnesses are abundant and the space is
  huge.
- Solvability by count, ISS, nested clue family, 60s budget (ticket 12): counts
  6-17 **never found a solution**; 18-22 did, faster with each added clue (22
  clues: 697 guesses, 2.3s). Difficulty falls monotonically with clue count.
- **Clue-count difficulty is dominated by clue *placement* at the loose end.**
  Same count, opposite outcome: one hand-picked six-clue set solved in ~30s while
  the nested six-clue set did not solve in 60s.
- The ISS encoding's own clue ceiling was 114 clues at pack 8 (57 at pack 4) —
  a cell-budget artifact of that encoding, irrelevant to us.

### Uniqueness

Ticket 07 built it and then the map **dropped it**.

- Mechanically it is `solver.solutions(puzzle, 2)`: none / exactly one / more
  than one, with the second grid returned so the setter can see what is left to
  rule out.
- **Cost: proving uniqueness exhausts the search space — the same cost as proving
  unsat.** On the ISS encoding that made it intractable across most of a setter's
  clue range (a 13-clue opener was still searching at 707s). Ticket 07 shipped an
  up-front "this may not finish" notice rather than a silent timeout.
- The map then **redrew uniqueness out of scope entirely**: the tool's only job
  became a non-futility check ("does any solution exist"), and *which* valid
  puzzle the setter wants, typos and uniqueness included, is the setter's job
  while setting. Ticket 13 was closed `wontfix` on the same grounds.

**So there is no ISS finding about what clue count yields a unique puzzle.** The
project never measured it. Our map's strategy B (hunt a minimal clue subset,
CP-SAT as the uniqueness checker) is answering a question that effort abandoned,
and the abandonment was about *ISS being too slow to prove it*, not about the
question being wrong. CP-SAT changes that calculus — see below.

### The cost picture, once the solver became CP-SAT

Tickets 22-25 rebuilt the whole thing as an OR-Tools CP-SAT model in Python
(`bench/cpsat_witness.py`, `bench/cpsat_tool.py`). Model shape, which is close to
what our generator will want:

- 81 `IntVar`s 1..9, `AddAllDifferent` per row/column/box.
- Per window, `winval = 1000*TL + 100*TR + 10*BL + BR`.
- Rank of a **clued** window i: `1 + sum_{j != i} b_{ji}` with `b_{ji}` a reified
  bool `winval_j < winval_i`. Only the clued windows need comparators, so ~500
  bools rather than all 2,016 pairs.
- `num_search_workers = 8`, `max_time_in_seconds` = budget.

Measured (9x9, 24 sat / 6 unsat fixtures, 60s):

| what | number |
| --- | --- |
| pure-sat witness search | 14-16/24 (58-66%), 0.9-50s, high variance, non-monotonic in clue count |
| `--objective` (soften ranks to `minimize sum \|rank - target\|`, sudoku stays hard) | **20/24 = 83%**, median 10.2s |
| `--objective --deterministic` (`interleave_search`) | 19/24 = 79% but **reproducible**, median 8.9s, **p90 19.5s** |
| **unsat proof, local/trivial broke** (two ranks on one window) | **36-42ms** with pure-sat; **6.5-14.5s** (200x slower) with the objective model |
| **unsat proof, emergent broke** (ticket 23: swap two clues' rank targets, so the contradiction is purely ordinal) | **124-279ms, every one of 9 tested**, independent of clue count and base looseness |
| **with givens** (8 or 24 pinned cells, ticket givens-02) | 12/12 correct verdicts, **all under 1.3s**; sat coverage 6/6 with zero UNKNOWN |
| with restricted candidates instead of givens (givens-03) | 20/21 correct, broke still 0.56-1.4s, but the found side degrades to up to 27.9s |

Five findings from that block that matter to us:

1. **Refuting is cheap; witnessing is expensive.** A refutation only has to expose
   the ordinal contradiction the clues already pin; a witness search has to
   wander every unclued window. Every ambiguous `budget` verdict the project chased
   down turned out to be a **slow sat**, never a slow unsat.
2. **The objective reformulation is the single biggest sat-side win** (58-66% ->
   79-83%) and it is *complete* — no false-broke, because a sat opener's witness
   scores 0. But it is 200x worse at proving unsat, so the shipped tool races the
   two models and takes the first definitive answer.
3. **CP-SAT's 8-worker portfolio is a wall-clock coin flip.** The same fixture,
   same config, clocked 1.36 / 2.2 / 8.3s across runs, and elsewhere 2.6s vs 60s.
   `interleave_search` (`--deterministic`) plus `max_deterministic_time` makes the
   outcome a function of the fixture, not scheduling luck — and then one run per
   fixture is enough, which makes a generation sweep far cheaper.
4. **Givens collapse the whole problem.** With >=8 well-placed givens, plain
   pure-sat wins both sides in under 1.3s. That is the only lever that ever moved
   the unclued-window wall.
5. **z3 is dead.** Every emergent unsat CP-SAT proved in ~130-280ms, z3 returned
   `unknown` on — including 120s on two of them. Do not reach for z3-in-node as a
   fallback.

### What an opener looked like

A `.qr` file of 5-8 `RxCy rank` lines, ranks read true off a source grid,
windows **scattered** (no two touching). Example (`bench/population/sat-g0-k5.qr`,
9x9): `R4C8 11 / R1C6 10 / R6C2 60 / R8C4 25 / R4C5 27`.

---

## 4. Traps a SudokuMaker port would otherwise walk into

1. **Do not expect a quad-rank clue to prune anything mid-solve without the
   leading-digit deduction.** The comparator/count formulation is inert until the
   grid is nearly full. Our map already requires the component's `update` to
   remove candidates, and §2(a) is the deduction that actually can: rank -> TL
   digit, table lookup, first pass, sound on 6x6.
2. **Ties are load-bearing, in both directions.** Same rank <=> digit-identical
   windows. Any encoding or deduction that assumes distinct ranks (an "assign
   each window a position" formulation, an all-different over ranks) is
   **unsound**. Ticket 24 buried that lever for exactly this reason. It also means
   a tie clue is *strong* pruning, worth exploiting, not a degenerate case to
   reject.
3. **SQL RANK skips.** `rank = 1 + count strictly smaller`. After a two-way tie at
   rank 7 the next rank is 9, not 8. Ranks are *not* a permutation of 1..W.
4. **Never certify a fixture on the solver's word when the solver is under test.**
   Ticket 16's whole design: sat by construction (true ranks off a known grid),
   unsat by construction (one window clued twice with different ranks), asserted
   against the oracle in a `--check` mode.
5. **The lexicographically-first solution grid is atypical.** Tickets 12, 13 and
   16 all warn about it; 16 explicitly regenerated its population from seed-
   shuffled DFS grids to escape it. `sampleGrids(6, n, 1)` returns exactly the
   biased grids — use a stride or a shuffle for anything you will draw a
   conclusion from.
6. **Non-monotonic solver behaviour by clue count.** More clues does not reliably
   mean faster; both the SA prototype (worse at k8 than k5) and CP-SAT (k5 6/6,
   k6 3/6, k7 2/6, k8 3/6) went the wrong way in places. A generation loop that
   assumes "add a clue, get faster" will mis-tune its budgets.
7. **CP-SAT wall times are not reproducible by default.** Set `interleave_search`
   and bound on `max_deterministic_time` before you compare two configurations, or
   you will measure the portfolio race. This is also how ticket 24 got the
   population read down to one run per fixture.
8. **An objective/optimization model is ~200x worse at proving infeasibility.**
   If our uniqueness checker or a minimal-subset hunt leans on "no second
   solution", it must be the pure-satisfaction model, not a softened one.
9. **A ±1 typo in a rank is invisible on a loose opener.** Nine of ten
   leading-digit-preserving ±1 mutations of a six-clue 9x9 opener still had a
   solution (ticket 13) — a *different* valid puzzle. "Still solvable" is not a
   proofreading check. This is an argument for our strategy B (verify against the
   known source grid) over any "does it still solve" loop.
10. **Window ids and ordering must match the oracle exactly.** Ticket 22 calls
    this out for the CP-SAT model: row-major, `R{r}C{c}`, r and c 1-based,
    top-lefts only. A mismatch produces plausible-looking wrong ranks.
11. **Scattered clues are easier to *search* than clustered ones**, the opposite
    of the intuition (and of a stale line in that project's own `bench/README.md`,
    which is true of *encoding* cost only). Do not cluster clues to "make it easier".
12. **`asDigits` in the lifted geometry is Schrödinger scaffolding.** Harmless but
    dead on our board; drop it rather than carry a variable-length-window code path
    into a fixed-4-digit constraint.

---

## 5. What is 9x9-specific and may not hold on 6x6

| finding | on 6x6 |
| --- | --- |
| 64 windows, 63 comparisons per clue, ~56 unclued windows | **25 windows**, 24 comparisons, and a 5-8 clue opener leaves ~17-20 unclued. The unclued-window wall is the same shape but roughly 2.5x smaller |
| Solution space 6.7e21 | **28,200,960** — small enough to enumerate. `grids.js` already knows the exact count. A minimal-subset hunt and a uniqueness check are both far cheaper than anything that project ever measured |
| "5-8 clues is loose, 18+ is tight" | **Untested at 6x6 and does not transfer.** The ratio that matters is clues-to-windows: 5/64 vs 5/25. Five 6x6 clues constrain proportionally ~2.5x more. Expect the usable opener range to sit lower in absolute count |
| ~11s comparator NFA compile, `pack`, the 1000-cell budget, the 114-clue ceiling | ISS encoding artifacts. **Irrelevant** — we build neither the NFA nor an ISS model |
| Leading-digit formula and its soundness guard `rows == cols == numValues` | **Holds on 6x6**, verified this session: 200 grids, 5,000 windows, 0 violations. Stronger in relative terms — 21 of 25 ranks pin the TL cell to exactly one digit |
| Ties are an occasional feature | **Ties are common on 6x6.** In 200 sampled 6x6 solutions, 112 contained at least one tied window pair (758 tied windows of 5,000). Smaller digit alphabet, fewer windows, far more collisions. Tie handling is a main case here, not an edge case — and `duplicateRanks`-style reporting matters more |
| CP-SAT sat-side 58-83%, medians 9-18s | Should improve substantially: 24 comparison bools per clue instead of 63, and a solution space 15 orders of magnitude smaller. **But it is unmeasured** — do not quote 9x9 percentages in our tickets |
| Emergent broke proves in ~130ms, independent of clue count | The mechanism (a refutation only needs the ordinal contradiction) is size-independent; expect it to hold or improve |
| `winval = 1000*TL + 100*TR + 10*BL + BR` | Same shape, range 1111-6666. Ticket 24 flagged the big coefficients as an LP-relaxation smell but never proved a lex alternative better |
| "5-8 clue opener" as the target | Our map's generator hunts a *minimal* subset for **uniqueness**, which is a different and tighter target than the ISS project's non-futility opener. Their looseness findings describe a regime our generator passes through, not one it stops in |

---

## 6. Read against the map's assumptions (#321)

Nothing in the ISS effort invalidates the map. Specifically:

- **6x6 board / 25 windows** — supported. 6x6 is already a tested shape in that
  project (`grids.js` `SIZES`, `quadrank.test.js`, `check.js` sampled sweeps),
  and every scaling argument favours it.
- **Generation strategy B** (sample a grid, compute true ranks with the lifted
  oracle, hunt a minimal clue subset, CP-SAT for uniqueness) — supported, and it
  is the *right* correction to their experience. Their "clues true off a known
  grid = sat by construction" is exactly strategy B's first half. Their reason for
  dropping uniqueness was ISS being too slow to prove it, not the goal being
  wrong; CP-SAT proves infeasibility in tens to hundreds of ms, so the second
  solution search is affordable. **Use the pure-satisfaction model for it**, never
  a softened/objective one.
- **Rank in the group's `value` field** — untouched by their work (a SudokuMaker
  wire-format question), but consistent: ranks run 1..25 on 6x6 and a cell tops out
  at 6.
- **A mandatory pruning `update`** — supported, and §2(a) hands it a concrete,
  sound, cheap deduction. The warning attached is that this is the *only* one they
  found that fires early; the count/comparator family is inert until the grid is
  nearly full, so do not plan an `update` around it.

Two things the map should absorb:

- **Ties become a main case at 6x6**, not an edge case (112 of 200 sampled
  grids). The map's open question "does the component rank every window or only
  the clued ones" should be settled with ties in mind, and any deduction must
  keep `same rank <=> digit-identical windows` sound.
- **Do not import their clue-count numbers.** 5-8 is a 9x9 opener range chosen for
  a non-futility tool, on a board with 2.5x the windows and a solution space 15
  orders of magnitude bigger. Our minimal-uniqueness clue count is an open,
  cheap-to-measure question.
