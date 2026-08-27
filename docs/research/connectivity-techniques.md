# Connectivity techniques in other solvers — survey

**Question.** Isofill's `update` already has cap, force, reach, capacity, cut,
tour, silent, and budget. What do other public solvers do for region, path, and
shading connectivity, and is any of it stronger or cheaper than what we run?

**Method.** Read source and handler docs, not blog posts. Every claim below is
tagged `[source]` (I read the code or the project's own algorithm doc),
`[docs]` (project prose or a paper abstract), or `[unsure]` (my inference).
Isofill's rules are as `examples/isofill/README.md` describes them, checked
against `IsofillComponent.js`.

## 1. What the public solvers do

| Tool | Technique | Connectivity encoding |
| --- | --- | --- |
| [Interactive Sudoku Solver](https://github.com/sigh/Interactive-Sudoku-Solver) | propagation + DFS, same shape as SudokuMaker | Dedicated handlers. `ChaosConstruction` and `ConnectedValues` walk the grid every node. `[source]` |
| [cspuz](https://github.com/semiexp/cspuz) | Python front end over a CSP/SAT backend | Two modes. Without the graph primitive: parent-pointer spanning forest with per-vertex **ranks** and one root per region. With it: a native solver operator. `[source]` |
| [cspuz_core](https://github.com/semiexp/cspuz_core) (`enigma_csp`) | Rust CDCL SAT with custom propagators | `GraphDivision` is a lazy propagator over border-edge literals. It keeps a DSU of *decided* regions and of *potential* regions and propagates weight bounds off both, with CDCL explanations. `[source]` |
| [puzz.link](https://puzz.link/) / [cspuz-solver2](https://github.com/semiexp/cspuz-solver2) | the same Rust SAT solver, in WebAssembly | as cspuz_core `[docs]` |
| [Noq](https://github.com/mstang107/noq) | ASP over `clasp`, via `claspy` | Reachability by transitive closure from a chosen source; unreached coloured cells are forbidden. `[source]` |
| [noqx](https://github.com/T0nyX1ang/noqx) | clingo, 180+ solvers | Same shape, written directly as clingo rules. `[source]` |
| [grilops](https://github.com/obijywk/grilops) | Z3 SMT | `RegionConstrainer` builds a spanning **subtree** per region: every cell has a parent direction, a root marker, and a subtree size. `[source]` |
| [nikoli-puzzle-solver](https://github.com/kevinychen/nikoli-puzzle-solver) | Z3, "based on and inspired by grilops" | as grilops `[docs]` |
| [microsoft/nurikabe](https://github.com/microsoft/nurikabe) | hand-written propagation + guessing, C++ | Explicit region objects with liberty sets; named deduction passes. `[source]` |
| [pzprjs](https://github.com/robx/pzpr-puzzlink) | editor and rule checker only | No solver. Answer checking, not propagation. `[docs]` |
| Penpa+ | editor | Ships no solver; links out to puzz.link's. `[unsure]` |

**Reading of the field.** Two families. The declarative ones (cspuz, Noq, noqx,
grilops, Z3 projects) encode connectivity *once*, as reachability closure or as
a spanning tree with parent pointers, and let a SAT/SMT engine do the work.
Nothing there transfers to us: we have no learned clauses and no global model,
so a reachability encoding is just our BFS written slower.

The one family that matches our setting is the hand-written propagators —
Interactive Sudoku Solver and the nurikabe solver. Everything worth stealing
below comes from those two.

## 2. Interactive Sudoku Solver — the closest match

`ChaosConstruction` solves our problem almost exactly: partition a grid into
connected regions of a fixed size `s`, propagate every search node, must be
sound. Its algorithm doc is
[`chaos_construction.md`](https://github.com/sigh/Interactive-Sudoku-Solver/blob/main/js/solver/handler_docs/chaos_construction.md);
the single-region case is
[`connected_values.md`](https://github.com/sigh/Interactive-Sudoku-Solver/blob/main/js/solver/handler_docs/connected_values.md).

### 2.1 The 0-1 BFS — strictly stronger reach, same cost `[source]`

`connected_values.md` §7.2 runs "one bucketed 0-1 BFS **from the seed blob** —
decided steps free, undecided steps costing one — capped at the budget", and
says outright:

> Distance from the seed blob (not the nearest decided cell) is the sound and
> strictly stronger bound: joining means connecting to the whole region, seed
> blob included.

Our reach is the weaker one. `IsofillComponent.js` calls
`reach(instance, placed, size - placed.length, allowed)`: multi-source from
**every** placed cell, every step costing one. That hands each placed cell a
free start even when that cell is nine unplaced steps from the rest of its own
digit. The 0-1 version charges for reaching a far blob first, then travels free
inside it.

Soundness is the same argument we already use: a region cell's path to the seed
blob runs through region cells; the unplaced ones on that path are distinct and
there are at most `10 − placed` of them in the whole region.

The 0-1 BFS also subsumes our split check (line 240 of the component: a second
walk asking whether every placed cell is within `size − 1` of `placed[0]`). A
placed cell the 0-1 BFS misses is a dead branch, and it misses more of them.

### 2.2 Door forcing and the articulation rule we already ship `[source]`

§7.4 of `connected_values.md` and §7.4 of `chaos_construction.md` give the
**door** rule: a blob's undecided neighbours are its doors; with a known region
size, a blob with exactly one door forces that door. This is the cheap special
case of our cut rule, read off a walk already happening.

`chaos_construction.md` §7.4 then reports the general case — ours:

> A natural generalization — force any door `d` when the cells reachable from
> the core *without* `d` fall below `s` (a vertex-cut / "the other doors can't
> supply enough cells" argument, computable in one articulation-point pass) —
> was prototyped and measured. It is sound and fires often, and it cut search
> sharply on some puzzles (x-sums −43% nodes), but it *tripled* the node count
> on the canonical Chaos Construction puzzle.

So ISS measured our best rule and dropped it — for heuristic interference, not
unsoundness. We measured the opposite: cut is what closes the shipped instance
(35 givens, no verdict without it, 0.2 s with it). Two honest measurements on
different boards. Worth knowing the rule is heuristic-fragile, not worth
re-litigating.

Note the phrase "computable in one articulation-point pass" — see §4.3 below.

### 2.3 The border rule — new to us `[source]`

`connected_values.md` §5.3:

> Two disjoint orthogonally-connected regions cannot *interleave* on the grid
> perimeter — there are no four perimeter cells in cyclic order
> `x₁, y₁, x₂, y₂` with `x₁, x₂ ∈ X` and `y₁, y₂ ∈ Y`.

The proof is the Jordan-curve argument, at grid scale: extend each region's
path to the boundary and two interleaved pairs force a crossing, and
axis-aligned centre-to-centre segments cross only at a cell centre.

We tried the **local** form of this — the 2×2 crossing rule, `connected_values.md`
§5.2 — as #148, and removed it: sound, fires, no board faster. ISS reports the
border rule *dominating* the crossing rule where both apply: "from 62 to 1 and
from 6,578 to 454 backtracks on top of §5.2". The border rule sees pairs of
cells arbitrarily far apart, which the 2×2 rule cannot. That #148 failed is
weak evidence against it.

ISS adds it only for two sets, warning that "with more sets, legal nestings
like `X..Y..Z..X` need per-pair analysis". For isofill the ten digits are ten
disjoint connected regions, so the clean statement is: **the partition induced
on the perimeter must be non-crossing.** That is one stack pass over the 36
perimeter cells, not 45 pairwise checks. `[unsure]` — the reduction to a
non-crossing partition is mine, not ISS's; it needs a proof note and the fuzz
harness before it ships.

### 2.4 Shards, dirty regions, canonical labels

- **Shards** (`chaos_construction.md` §2.2, §5): union-find over cells proven
  co-regional, so BFS steps cost a whole shard's size. Does not transfer.
  Isofill's region label *is* the digit, so a cell proven co-regional with a
  placed cell is simply placed. `[source]`
- **Dirty-region tracking** (§8): skip connectivity for a region whose count of
  possibly-member cells is unchanged since the last completed scan, cached in
  branch state. We have no per-digit version of this. `#133` measured a
  whole-component signature skip on skyscraper and did not ship it; per-digit is
  a different, finer question. `[source]`
- **Canonical label ordering** (§4): symmetry-breaking over interchangeable
  region names. Not applicable — our digits are named by the givens. `[source]`
- **Value-aware component pruning** (§7.3): a region is also a distinct-value
  house there. Isofill regions are all one digit. Not applicable. `[source]`

## 3. microsoft/nurikabe — a named technique catalogue `[source]`

The solver's passes, in the order `Grid::solve` runs them
([`nurikabe.cpp`](https://github.com/microsoft/nurikabe/blob/main/nurikabe.cpp)):

| Pass | What it does | Our equivalent |
| --- | --- | --- |
| `analyze_complete_islands` | a region at its full size seals its border | **cap** |
| `analyze_single_liberties` | a partial region with one unknown neighbour takes it | ISS's door rule; subsumed by **cut** |
| `analyze_dual_liberties` | an `n−1` island with exactly two *diagonal* liberties blacks the far corner of the bend | no equivalent — see §4 |
| `analyze_unreachable_cells` | a cell no island can reach is sea | **reach** |
| `analyze_potential_pools` | no 2×2 of sea | Nurikabe-only; isofill has no shading colour |
| `analyze_confinement` | for each unknown cell, forbid it and ask whether *any* region can still reach its size | **cut**, plus a cross-region half we lack |
| `analyze_hypotheticals` | guess and recurse | the app's own DFS |

Two things stand out.

**Confinement is cut, but across regions.** The first loop of
`analyze_confinement` forbids one unknown cell and tests *every* region, not
just the one that owns the cell. Our cut only ever asks about the digit whose
walk the cell sits in — but a cell can be the only route for a digit whose walk
does not contain it, and that case forces the cell to a *different* digit than
the one being tested. `[unsure]` whether isofill's per-digit loop already covers
this in effect: cell `c` is in digit `d`'s walk exactly when `d` is still a
candidate for `c`, so removing `c` from `d`'s walk *is* the test "can `d` live
without `c`". I believe it is covered.

**The second half is a depth-1 lookahead we do not have.** For an incomplete
numbered region and each of its liberties `u`, it forbids `u` **and all of `u`'s
unknown neighbours** and asks whether some *other* numbered region is now
confined; if so `u` is sea. That is a genuine one-ply shave, and it is memoised
in a `cache_map_t`. Expensive; see §4.5.

**Named human techniques, mapped.** Everything in the popular Nurikabe
technique lists — island isolation, complete islands, unreachable cells, wall
connectivity, single liberty, 2×2 pools
([Nurikabe, Wikipedia](https://en.wikipedia.org/wiki/Nurikabe_(puzzle)),
[logicgamesonline tutorial](https://www.logicgamesonline.com/nurikabe/tutorial.html))
— is one of cap, force, reach, capacity, or cut, except the two-colour rules
(2×2 pools, wall connectivity) which need a second colour isofill does not have.

## 4. CP and SAT literature

- **CP(Graph)** (Dooms, Deville, Dupont, CP 2005,
  [paper](https://link.springer.com/chapter/10.1007/11564751_18)) introduces
  graph domain variables with connectivity/path kernel constraints. The design
  assumes a CP store we do not have; the propagators it describes for
  connectivity are BFS-reachability filters — the same idea as our reach, made
  general. Nothing tighter to steal. `[docs]`
- **`tree` global constraint** (Fages & Lorca, "Revisiting the `tree`
  Constraint", CP 2011,
  [paper](https://link.springer.com/chapter/10.1007/978-3-642-23786-7_22)):
  GAC filtering for the tree/forest constraint in **O(|E| + |V|)**, based on
  **dominators**. Shipped in Choco
  ([`IIntConstraintFactory`](https://javadoc.io/static/org.choco-solver/choco-solver/4.0.7/org/chocosolver/solver/constraints/IIntConstraintFactory.html)).
  The load-bearing idea for us is not the tree constraint itself but its
  filtering primitive: **mandatory vertices are the dominators of the reachable
  subgraph, and they are all found in one linear pass.** `[docs]`
- **Régin's SCC pruning** for `alldifferent` — we already ship it in `budget`.
- **ILP connectivity cuts** (Steiner-tree and maximum-weight-connected-subgraph
  branch-and-cut) separate exponentially many vertex-cut inequalities with an
  LP relaxation. No LP here; not applicable.
- **Steiner lower bounds for the tour rule.** Our tour bound is the
  half-perimeter of the best triple of placed cells, i.e. a spanning-tour bound.
  The general statement is that a connected subgraph containing `k` terminals is
  at least the size of a minimum Steiner tree over them, and the standard
  tractable lower bound for that is over the terminal metric closure. Our triple
  bound is a `k = 3` instance of it. The `k = 4` version was measured and lost
  (35.6 s vs 15.3 s on the 32-given fixture). I found no primitive that is both
  tighter than the triple bound and cheaper than the four-point one. `[unsure]`
- **Loop puzzles** (Slitherlink, Masyu, Yajilin): the two techniques are the
  Jordan-curve inside/outside colouring
  ([Olson](https://jonathanolson.net/slitherlink/)) and union-find over partial
  loop segments to reject premature closure. The colouring is the same theorem
  our border rule (§2.3) rests on. Union-find premature-closure is loop-specific
  — isofill has no loop. `[docs]`

## 5. Already covered

| Named technique | Our rule |
| --- | --- |
| complete island / region seal | cap |
| region has exactly `n` possible cells | force |
| unreachable cells | reach |
| region cannot grow to size | capacity |
| single liberty / door forcing | cut (strictly stronger) |
| bottleneck / articulation forcing | cut |
| reachability closure (SAT/ASP encodings) | reach |
| spanning-tree / parent-pointer encodings (grilops, cspuz) | reach + capacity, computed directly |
| potential-region weight upper bound (cspuz_core `GraphDivision`) | capacity |
| decided-region weight lower bound (cspuz_core) | cap |
| dead component with no placed cell | silent |
| Steiner / tour lower bound on region size | tour |
| Régin SCC matching prune | budget |
| 2×2 crossing (yin-yang) | tried, removed (#148) |
| blob gate on door forcing | tried, removed (#150) |

## 6. What to try next

1. **0-1 BFS from one seed blob, replacing the multi-source reach.** Placed
   cells free, open cells cost one, budget `10 − placed`, seeded at one blob.
   Strictly stronger than what we run, at the same cost — one bucketed BFS,
   **O(V+E)**, no extra allocation. It also tightens `near`, which feeds budget,
   and it folds in the separate split walk at line 240. Highest expected value
   of anything here: a free strength upgrade to the rule every other rule reads.
   `[source: ISS connected_values.md §7.2]`
2. **Perimeter non-crossing rule.** Walk the 36 perimeter cells cyclically and
   reject any interleaving of two digits; strip the digit from cells in a gap
   flanked by another. One stack pass, **O(perimeter)** — 36 cells, free next to
   anything else in `update`. New deduction, sees pairs the 2×2 rule cannot.
   Risk: #148 removed the local version for lack of speedup, and the
   ten-set-non-crossing reduction needs a proof before it ships.
   `[source: ISS connected_values.md §5.3, plus my own reduction]`
3. **One Tarjan articulation pass in place of cut's per-cell re-walks.** Cut
   currently walks once or twice per open cell — **O(V·(V+E))** per digit. A
   single lowpoint DFS finds every articulation point and every subtree size in
   **O(V+E)**, which answers the "strands a placed cell" and "leaves fewer than
   ten cells" questions for all cells at once. Honest caveat: this replaces
   *connectivity* cuts exactly but not the *distance* shrink — our re-walk is
   budget-limited, so removing a cell can also shorten nothing yet starve the
   walk by depth. Expect it to be a fast filter that handles most firings, with
   the re-walk kept for the rest, not a clean swap. `[unsure — my analysis;
   ISS calls the same rule "one articulation-point pass"]`
4. **Per-digit dirty tracking.** Skip a digit's walk rules when its count of
   possible cells is unchanged since the last call. **O(1)** test per digit,
   needs the count cached across calls. ISS reports the analogous gate on the
   forcing round removing 62–99.9% of rounds. Weak precedent against: `#133`
   measured a whole-component version on skyscraper and did not ship it.
   `[source: ISS chaos_construction.md §8, §4.4]`
5. **Cross-digit confinement lookahead.** For an open cell `u` and digit `d`,
   deny `u` and `u`'s open neighbours to every other digit and ask whether any
   of them is now confined; if so, `u ≠ d`. **O(V·V·(V+E))** naively — far too
   slow at every node without the memo the nurikabe solver uses. Listed last for
   honesty: it is the only genuinely new *deduction* left in the survey, and it
   is almost certainly too expensive. Measure it only if 1–4 land and the hard
   fixtures still show search. `[source: nurikabe.cpp analyze_confinement,
   second loop]`

One smaller gate, not ranked because #150 already failed near it: ISS skips the
bottleneck pass for regions with `fixedCount + 2 > s`, because a single free
cell is already forced by reach. For us that is "skip cut when `placed = 9`" —
exact and free, but so was the blob gate, which read 0.96×/1.00×/0.98× and was
cut. `[source: ISS connected_values.md §7.4]`
