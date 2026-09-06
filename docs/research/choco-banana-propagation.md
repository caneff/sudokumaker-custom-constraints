# Choco Banana propagation — what is sound and what it costs

**Question (#344, part of the map #342).** Given a partially known infection
grid — each cell infected / uninfected / unknown — what deductions are sound
and cheap for Zombo (every infected group is a rectangle), Brainana (every
uninfected group is not a rectangle), Cluster (a circled digit is the size of
its group), and for the coupling between shading and the sudoku digits?

**Method.** Public solvers read as source over the web, not blog posts:
cspuz_core, noqx, pzprjs, grilops. The rectangle lemma is proved below and
then checked exhaustively by brute force over every connected subset of a
4×4, 4×5 and 5×5 grid. Every claim is tagged `[source]` (I read the code or
the project's own rule text), `[docs]` (project prose), `[proof]` (proved
here, and where noted machine-checked), or `[unsure]` (my inference, not
verified). Isofill's rules are as `examples/isofill/README.md` describes
them; the survey it grew out of is
`docs/research/connectivity-techniques.md`, and the ISS reading protocol is
`docs/agents/iss.md`.

**The one-line answer.** Zombo is a purely *local* constraint — 64 fixed 2×2
windows, no walk, no component tracking — and every public solver encodes it
that way or as a bounding-box area test. Brainana is *not* local: it is one
existential per component ("contains a concave corner"), and that is what
needs a walk. Cluster on an infected circle collapses to enumerating at most
20 rectangle placements. Cluster on an uninfected circle is where isofill's
reach/cut/tour machinery actually transfers.

## 0. What the infection grid even is here

SudokuMaker has no shading. Infection is *derived* from the digits (#342):
a cell whose digit equals its box number is a patient zero and is infected;
an infected cell infects every orthogonally adjacent cell with a smaller
digit, to closure. So a component never observes an infection bit — it
observes digit candidate sets, and has to compute a three-valued infection
grid from them before any rule below can fire. `[source: #342 rules]`

Two sound fixpoints over the 81 cells, both cheap:

- **Possibly-infected `P`** — least fixpoint of: `c ∈ P` if `box#(c) ∈
  cand(c)`, or some neighbour `n ∈ P` has `max(cand(n)) > min(cand(c))`.
  A cell outside `P` is **certainly uninfected**.
- **Certainly-infected `C`** — least fixpoint of: `c ∈ C` if `cand(c) =
  {box#(c)}`, or some neighbour `n ∈ C` has `min(cand(n)) > max(cand(c))`.

`C ⊆ (true infection) ⊆ P` under every completion of the current candidates,
because infection is a monotone closure and each rule uses the extreme of the
candidate interval in the safe direction. The three-valued grid is
`C` = infected, complement of `P` = uninfected, the rest unknown. One
worklist pass each, **O(V+E)** with a small queue. `[proof — mine; the
monotonicity argument is straightforward, but this has not been fuzz-tested
and is the single place an unsoundness would poison every rule below]`

Note the asymmetry: proving a cell **infected** is easy (a forced patient
zero, or a bigger forced neighbour); proving it **uninfected** needs the
whole `P` fixpoint to miss it, which early in a solve it rarely does. Expect
`C` to be small and `P` to be nearly everything at the top of the search, so
the local rules of §1 will do most of their work late. `[unsure]`

Everything below is stated on the three-valued grid and is sound for any
completion consistent with it.

## 1. Zombo — infected groups are rectangles

### 1.1 The lemma

> **Lemma.** Let `S` be a finite, orthogonally connected, non-empty set of
> cells. `S` is a rectangle **iff** no 2×2 window contains exactly three
> cells of `S`.

**(⇒)** A rectangle is `R × C` for row-interval `R` and column-interval `C`.
For a window on rows `{r, r+1}` and columns `{c, c+1}`,
`|W ∩ S| = |{r,r+1} ∩ R| · |{c,c+1} ∩ C|`, a product of two factors each in
`{0,1,2}` — so `|W ∩ S| ∈ {0,1,2,4}`, never 3. `[proof]`

**(⇐)** Two steps.

*Step A (run alignment).* If `(r,c)` and `(r+1,c)` are both in `S`, their
maximal horizontal runs in `S` are the same column-interval. Suppose the run
at row `r` is `[a,b]` and at row `r+1` is `[a',b']`, both containing `c`, and
`b < b'`. Then `(r+1,b)` and `(r+1,b+1)` are in `S`, `(r,b)` is in `S`, and
`(r,b+1)` is not — a 2×2 window with exactly three. Contradiction; symmetric
for `b > b'` and for `a`, `a'`. `[proof]`

*Step B (propagate along connectivity).* Moving horizontally inside a run
preserves the run; moving vertically preserves it by Step A. `S` is
connected, so **every** cell of `S` has the same horizontal run `[a,b]`.
Hence each non-empty row of `S` is exactly `[a,b]` (two disjoint runs in one
row cannot both equal `[a,b]`). The mirror argument gives one common vertical
run `[p,q]`, so the occupied rows are exactly `[p,q]` and
`S = [p,q] × [a,b]`. `[proof]`

**Machine-checked.** Brute force over every connected subset of a 4×4, 4×5
and 5×5 grid — 11,506 / 116,166 / 2,301,877 sets — found **zero** cases where
"is a rectangle" and "no 2×2 window with exactly three" disagree. `[proof —
exhaustive check, script in the scratchpad, not committed]`

**Windows only need to be inside the grid.** A 2×2 window that hangs off the
edge has at most two in-grid cells, so it can never hold three. The 64
interior windows of a 9×9 are the whole rule. `[proof]`

**Zombo is local.** The lemma is stated per component, but the *global*
constraint collapses to the same local test: if a 2×2 window holds three
infected cells, all three are in one component (the corner cell of the L is
adjacent to both others). So

> **every infected component is a rectangle ⇔ no 2×2 window holds exactly
> three infected cells.** `[proof]`

That is the whole of Zombo. No walk, no component tracking, no union-find.

### 1.2 The diagonal-pair case

The lemma's local test permits a 2×2 window holding exactly a *diagonal*
pair — `{(r,c), (r+1,c+1)}` infected, the other two uninfected. This is why
the lemma needs connectivity: `{(0,0), (1,1)}` alone satisfies the window
test and is not a rectangle, because it is two components.

Two consequences, and they pull in opposite directions:

- **Do not forbid the diagonal pattern.** Two 1×1 rectangles touching
  diagonally is a legal Choco Banana position. A component that prunes the
  diagonal is unsound. `[proof]`
- **But a diagonal pair is a separation certificate.** The (⇒) direction
  shows a rectangle never contains a 2×2 window holding only a diagonal pair
  (`|W ∩ S| = 2` forces one factor to be 2 and the other 1, i.e. an
  *adjacent* pair). So in any valid grid, two diagonally-adjacent infected
  cells whose two shared orthogonal neighbours are both uninfected lie in
  **different** rectangles — and therefore no infected path may join them.
  Machine-checked alongside the lemma: zero diagonal-only windows over all
  2.3 million connected rectangles tested. `[proof]`

The separation certificate is real but needs a walk to exploit (§5, rank 8).

### 1.3 Local propagation rules, in firing order

All on the 64 interior windows. Let a window's four cells have counts
`(#infected, #uninfected, #unknown)`.

| # | Precondition | Deduction | Why |
| --- | --- | --- | --- |
| Z1 | 3 infected, 1 unknown | the unknown is **infected** | leaving it uninfected makes exactly 3 |
| Z2 | 2 infected, 1 uninfected, 1 unknown | the unknown is **uninfected** | infecting it makes exactly 3 |
| Z3 | 3 infected, 1 uninfected | **contradiction** | exactly 3 |
| Z4 | 2 infected **and orthogonally adjacent**, 2 unknown | the two unknowns are **equal** | either split makes exactly 3 — this is Step A |
| Z5 | 2 infected on a **diagonal**, 2 unknown | nothing | both `00` and `11` and both splits are legal |

Z1–Z3 are plain arc consistency on a 4-variable table constraint with 12 of
16 tuples allowed; nothing fires below three decided cells except Z4.

**Z4 is the one worth building deliberately.** It removes no candidate, so it
needs somewhere to put an equality — a small union-find over "these two cells
have the same infection state", rebuilt per call. Merging two cells lets a
later Z1/Z2 on a *different* window fire through the link. Isofill has no
analogue of this (its region label is the digit, so co-region means placed);
here the shading is a genuine second colour and equalities are the natural
currency. `[proof for the rule; [unsure] that the union-find pays for itself
— it is the only rule here that adds state]`

**Cheap bounding-box form, for when a component is partly known.** If `K` is a
set of cells known infected and known to be in one component (e.g. joined by
known-infected paths), the final rectangle contains `K`, so it contains
`bbox(K)` — every cell of `bbox(K)` is infected. And every cell orthogonally
adjacent to `bbox(K)` that is already known uninfected pins that side of the
rectangle: the rectangle's extent in that direction stops there. Two
half-rules:

- **Z6 (bbox fill).** `K` co-component and known infected ⇒ all of `bbox(K)`
  infected. `[proof — a rectangle containing K contains bbox(K)]`
- **Z7 (wall).** An infected cell `x` with a known-uninfected neighbour to
  its left ⇒ `x` is on the rectangle's left edge ⇒ every cell of the
  rectangle is in column ≥ `col(x)`. Combined with Z6 this bounds the
  rectangle from both sides and, once the four walls are known, the whole
  rectangle is determined and its border can be sealed uninfected.
  `[proof]`

Z6/Z7 are strictly weaker than Z1–Z4 *for a component with no clue*, because
Z1–Z4 already derive them window by window as knowledge fills in. They earn
their place only under a Cluster clue, where the size is known — see §3.
`[unsure — I have not constructed a state where Z6 fires and Z1–Z4 do not]`

**Early violation detection.** Z3 is the whole of it. A component does not
need to build components or bounding boxes to notice a Zombo violation: one
pass over 64 windows finds every one. This is the cheapest possible failure
detector in the whole design and it should run first in `update`.

### 1.4 What the public solvers do

| Tool | Encoding of "shaded groups are rectangles" | Encoding of "unshaded groups are not" |
| --- | --- | --- |
| [cspuz_core](https://github.com/semiexp/cspuz_core) `cspuz_rs_puzzles/src/puzzles/chocobanana.rs` | the 2×2 window rule, verbatim `[source]` | a corner-marker auxiliary graph `[source]` |
| [noqx](https://github.com/T0nyX1ang/noqx) `solver/cbanana.py` | `all_rect(color="gray")` `[source]` | `no_rect(color="white")` `[source]` |
| [pzprjs](https://github.com/robx/pzprjs) `src/variety/cbanana.js` | `w * h === a` per block `[source]` | `w * h !== a` per block `[source]` |
| [grilops](https://github.com/obijywk/grilops) `grilops/regions.py` | `RegionConstrainer(rectangular=True)`, a pairwise-neighbour closure `[source]` | no primitive; would have to be hand-negated `[source: absence — no chocobanana example in `examples/`]` |

**cspuz_core is the closest to what we should build.** Its entire rectangle
constraint is one line:

```rust
for y in 0..(h - 1) {
    for x in 0..(w - 1) {
        solver.add_expr(is_black.slice((y..(y + 2), x..(x + 2))).count_true().ne(3));
    }
}
```

— our Z1–Z4, exactly, and its independent confirmation of the lemma.
`[source: cspuz_core/cspuz_rs_puzzles/src/puzzles/chocobanana.rs, read at
`main` 2026-09-06]`

**A correction worth recording.** That `ne(3)` is *not* symmetric in the two
colours, though it reads as if it were. `#black ≠ 3` in a four-cell window is
`#white ≠ 1`. It says nothing about `#white = 3` — and it must not, because
`#white = 3` windows are precisely the concave corners Brainana *requires*.
`[proof]`

**pzprjs's answer check is the definitive statement of both rules:**

```javascript
checkShadeRect: function() {
    this.checkAllArea(this.board.sblkmgr,
        function(w, h, a, n) { return w * h === a; }, "csNotRect");
},
checkUnshadeNotRect: function() {
    this.checkAllArea(this.board.ublkmgr,
        function(w, h, a, n) { return w * h !== a; }, "cuRect");
}
```

Bounding-box area equals cell count. This is a *checker*, not a propagator —
it needs the full grid — but it is the cleanest place to read the rule off,
and it is the shape our CP-SAT model and soundness harness should copy
(`CODING_STANDARDS.md`, "The rule has one home"). `[source:
pzprjs/src/variety/cbanana.js, `main`]`

**The official rule text**, from pzprjs's own rules resource
(`src-ui/res/rules.en.yaml`, key `cbanana`) — puzz.link's rules page loads it
client-side, so the static page has nothing in it: "A group of shaded cells
must form a rectangle or square. A group of unshaded cells must not form a
rectangle or square. A number indicates the size of the (shaded or unshaded)
group that overlaps it." `[source]` This matches #342's Zombo/Brainana/Cluster
triple exactly, so we are building stock Choco Banana with infection as the
shading oracle.

**grilops takes a different route** and it is worth knowing about even though
we will not use it — `RegionConstrainer(rectangular=True)` asserts, for every
cell, that any two same-region orthogonal neighbours drag their *other* common
neighbour into the region. Its own docstring: "for each cell in a region,
ensure that pairs of its neighbors that are part of the same region each share
an additional neighbor that's part of the same region when possible."
`[source: grilops/regions.py]` That is the 2×2 rule re-anchored on the centre
cell of the L rather than on the window, and it is region-id-aware where ours
is colour-only. Nothing to steal; it needs region ids we do not have.

## 2. Brainana — uninfected groups are not rectangles

### 2.1 The shape of the constraint

By the lemma's contrapositive: a connected `S` is **not** a rectangle iff some
2×2 window holds exactly three cells of `S`. So

> **every uninfected component is a non-rectangle ⇔ every uninfected
> component contains at least one 2×2 window with exactly three uninfected
> cells** (equivalently, exactly one infected cell). `[proof]`

This is an **existential per component**, and that is the structural
difference from Zombo. Zombo is "no window is bad anywhere" — checkable
cell-locally. Brainana is "each component owns a good window" — you cannot
know a component owns one until you know where the component ends. That is
the walk.

**Both public propagating solvers encode exactly this.** noqx: `no_rect(color)`
"detects any 2×2 L-shape corner pattern (3 of 4 cells same color) and requires
every colored cell to be reachable through a chain of such L-corners"
`[source: noqx/noqx/rule/shape.py, via solver/cbanana.py]`. cspuz_core builds
a doubled graph — one vertex per cell (active iff white) plus one
*corner-marker* vertex per cell, active iff that cell is the corner of a
white L (`!black(y,x) & !black(y±1,x) & !black(y,x±1) & black(y±1,x±1)`) —
wires every corner-marker to a global always-active sink, and asserts
`active_vertices_connected`. Every white cell must therefore reach a live
corner marker through white cells. `[source:
cspuz_core/.../chocobanana.rs, the `aux_graph` block]` Same rule, two
encodings, and a direct confirmation that "must contain a concave corner" is
the right formulation.

### 2.2 What is cheap, locally

| # | Rule | Cost |
| --- | --- | --- |
| B1 | **No isolated uninfected cell.** Every uninfected cell has at least one uninfected orthogonal neighbour (a lone cell is a 1×1 rectangle). Propagates three ways: uninfected cell with 3 infected neighbours and 1 unknown ⇒ the unknown is uninfected; uninfected cell with all in-grid neighbours infected ⇒ contradiction; unknown cell with all in-grid neighbours infected ⇒ **infected** (a 1×1 *infected* rectangle is legal, a 1×1 uninfected pocket is not). | 81 cells × 4 neighbours |
| B2 | **Minimum pocket is 3.** The smallest non-rectangle polyomino is the L-tromino, so every uninfected component has ≥ 3 cells. Feeds every size bound below. | free |
| B3 | **No 1×k strip.** A `1 × k` uninfected component is a rectangle for every `k`. This is *not* local — it needs the component closed. | see B4 |
| B4 | **Rectangle-pocket door forcing.** Let `K` be a maximal set of known-uninfected cells connected through known-uninfected cells. If `K`'s shape is a rectangle (bbox area = `|K|`) and `K` has exactly one unknown neighbour `d`, then `d` is **uninfected** — the component is `K` plus whatever grows through its unknown neighbours, and `K` alone is illegal. Zero unknown neighbours ⇒ contradiction. | the walk |
| B5 | **Rectangle-pocket capacity.** If `K` is a rectangle and the flood fill of `K` through all not-certainly-infected cells is *still* a rectangle, the component can never acquire a concave corner ⇒ contradiction. | one flood fill |

B1 is the highest-value cheap rule in the whole document after Z1–Z3: it is
one neighbour scan, it fires constantly on a grid where infection spreads
from nine patient zeros, and it is the only Brainana rule that needs no walk
at all. `[proof for B1–B3; B4 is the isofill door rule (`examples/isofill/
README.md`, cut) transposed to a colour, and B5 is isofill's capacity
transposed — both proofs are the isofill ones with "reaches its size" replaced
by "acquires a concave corner"]`

**B4 is the Brainana analogue of ISS's door rule** (`connected_values.md`
§7.4, via `docs/research/connectivity-techniques.md` §2.2): read the doors off
a walk you were doing anyway, and force when there is exactly one. The
difference is the trigger — isofill's door fires on a size deficit, ours fires
on a *shape* deficit — but the walk and the bookkeeping are the same, so if
the component ends up carrying an uninfected-component walk for §3 anyway,
B4 is nearly free on top of it. `[unsure — whether the walk exists depends on
whether Cluster clues on the uninfected side ship at all]`

### 2.3 What needs a walk

Everything except B1/B2. The honest cost model: Brainana's existential can
only be *discharged* (proved satisfied) or *refuted* by knowing a component's
extent, and the extent is a flood fill. Two ways to pay:

1. **Refute only.** Run B4/B5 on components of *known-uninfected* cells,
   which are small early and large late. One flood fill over the
   not-certainly-infected cells per call, **O(V+E)**, plus a bbox test per
   component. This finds contradictions and doors and never proves anything
   positive. Cheap and probably enough.
2. **Discharge as well.** Track, per component, whether a concave corner is
   already present; if it is, the component is settled and every remaining
   unknown on it is free of Brainana. This is a *gate*, not a deduction — it
   saves work rather than removing candidates. Isofill's dirty-region
   tracking (#170) is the precedent, and it was parked; expect the same
   verdict. `[unsure]`

## 3. Cluster — a circled digit is its group's size

### 3.1 An infected circle: enumerate the rectangles, do not walk

A circled digit `s` on an infected cell says the component is a rectangle of
area exactly `s`, `1 ≤ s ≤ 9`. The shape count is tiny — the divisor pairs of
`s`:

| `s` | shapes (h × w) | count | max placements through one cell of a 9×9 |
| --- | --- | --- | --- |
| 1 | 1×1 | 1 | 1 |
| 2 | 1×2, 2×1 | 2 | 4 |
| 3 | 1×3, 3×1 | 2 | 6 |
| 4 | 1×4, 2×2, 4×1 | 3 | 12 |
| 5 | 1×5, 5×1 | 2 | 10 |
| 6 | 1×6, 2×3, 3×2, 6×1 | 4 | 20 |
| 7 | 1×7, 7×1 | 2 | 6 |
| 8 | 1×8, 2×4, 4×2, 8×1 | 4 | 20 |
| 9 | 1×9, 3×3, 9×1 | 3 | 11 |

`[proof — divisor enumeration; the placement column is a direct count over
all 81 cells of a 9×9, worst cell shown]`

**Twenty placements, worst case.** So the whole of Cluster-on-infected is:

> Enumerate every rectangle of area `s` containing the circled cell. Discard
> any whose interior contains a certainly-uninfected cell, or whose border
> (the ≤ `2(h+w)` in-grid cells orthogonally adjacent to it) contains a
> certainly-infected cell. Then: zero survivors ⇒ contradiction; a cell
> interior to **every** survivor ⇒ infected; a cell on the border of **every**
> survivor ⇒ uninfected.

Cost: ≤ 20 placements × ≤ 25 cells = a few hundred array reads, no
allocation, no queue, no walk. `[proof — the rule is exactly "the component is
one of these sets", and interior/border membership under every survivor is
plain intersection]`

**This is strictly stronger than any of isofill's walks and about a hundred
times cheaper.** Isofill's reach, cut, tour and capacity all exist because
enumerating the 9,910 fixed 9-ominoes per digit per node is impossible. Here
the rectangle constraint has collapsed the shape space from 9,910 to 3, and
the right answer is to stop being clever: enumerate. Every walk-based rule
(reach, cut, door, tour) is *subsumed* by the intersection of the survivor
set, because that set is the exact set of possible components — no
over-approximation anywhere. `[proof]`

The fixed-polyomino counts, for the record: 1, 2, 6, 19, 63, 216, 760, 2725,
9910 for `n = 1..9`, of which 1, 2, 2, 3, 2, 4, 2, 4, 3 are rectangles
(OEIS A001168; recomputed here). `[proof — enumerated]`

**Where Z6/Z7 come back.** With a known `s`, the bbox rules of §1.3 become
the *cheap pre-filter* for the enumeration rather than a separate rule: given
a set `K` of co-component infected cells, only placements containing
`bbox(K)` survive, and `bbox(K)` with area > `s` is an immediate
contradiction. Fold them into the survivor filter; do not ship them
standalone.

**Multiple circles in one rectangle are consistent, not redundant.** The rule
text ("A group can contain one or more numbers, or none at all" `[source:
pzprjs rules.en.yaml]`) means two circles in one group must carry the *same*
digit — a joint constraint worth checking, since it forces a digit equality
across two cells that sudoku alone would not give. Whether #342's puzzle uses
it is a setting decision. `[unsure]`

### 3.2 An uninfected circle: this is where isofill transfers

A circled digit `s` on an uninfected cell says the component is a connected
non-rectangle of exactly `s` cells, so `s ∈ {3,…,9}` (B2 kills 1 and 2, and
`s = 2` is the 1×2 rectangle). The shape space is 4, 16, 61, 212, 758, 2721,
9907 non-rectangle fixed polyominoes for `s = 3..9` — enumeration is dead, so
the isofill walk rules are the tool, and they transfer one-for-one:

| isofill rule | transposed to an uninfected Cluster group of size `s` |
| --- | --- |
| **seed walk / reach** | 0-1 BFS from the circled cell over not-certainly-infected cells, certainly-uninfected steps free and unknown steps costing 1, budget `s − |known uninfected in the component|`. A cell the walk misses is **infected**. (Use the 0-1 form from the start — `docs/research/connectivity-techniques.md` §2.1 and item 1 of its ranking; it is strictly stronger than multi-source at the same cost, and we already know that.) |
| **cap** | the component at exactly `s` known-uninfected cells seals: every orthogonal neighbour is **infected** |
| **capacity** | fewer than `s` cells reachable ⇒ contradiction |
| **cut** | drop a reachable unknown cell and re-walk; if the reachable count falls below `s` (starve) or a known-uninfected component cell falls out (strand), the cell is **uninfected** |
| **door** | exactly one unknown neighbour and the size not yet met ⇒ that neighbour is uninfected — B4's trigger, plus this size trigger |
| **tour** | the group is connected and holds the circled cell plus every known-uninfected cell of the component, so `s ≥ 1 + ½ ·` (perimeter of the best triple). Same bound, same three-points-not-four verdict |
| **silent** | no analogue. There is no uncircled group we are obliged to find — the "silent digit" problem was isofill's ten-regions-partition structure, and Choco Banana has no partition into named groups |
| **perimeter (non-crossing)** | no analogue. Isofill's rule needs *disjoint named* regions on the border; here the uninfected side is an unbounded number of anonymous pockets |
| **budget / matching prune** | no analogue, same reason |

`[proof for the transposition — each isofill soundness argument is "the region
is connected and contains the seed", which holds verbatim with "region" =
"uninfected component" and "size 10" = "size s"; [unsure] on the two "no
analogue" rows, which are my reading of what the rules need, not measured]`

**Two extra rules the uninfected side gets that isofill does not:**

- **The concave-corner requirement (B4/B5) rides along free.** The walk that
  computes reach already knows the component's known cells; testing
  bbox-area == count is `O(1)` on top.
- **Reach is tighter than isofill's, because Zombo shrinks the frontier.** A
  cell adjacent to an already-known 2×2-window violation, or one Z1/Z2 has
  forced infected, drops out of the allowed set before the walk starts. The
  local rules of §1 are effectively a free preprocessing pass for every walk
  here. `[unsure — the direction is certain, the magnitude is not]`

## 4. The infection layer — where shading meets digits

These are the rules that make this puzzle a *sudoku* variant rather than a
Choco Banana with a grid glued on. All follow from #342's infection rules
plus the fact that two orthogonally adjacent cells are always in the same row
or the same column and therefore **never hold the same digit**.

| # | Rule | Direction | Note |
| --- | --- | --- | --- |
| I1 | `x` infected and `min(cand(x)) > max(cand(y))` for a neighbour `y` ⇒ `y` **infected** | digits → shading | the infection rule itself, read on candidate extremes |
| I2 | `x` infected, `y` uninfected, adjacent ⇒ `digit(y) > digit(x)`: strip candidates `≤ min(cand(x))` from `y`, and candidates `≥ max(cand(y))` from `x` | shading → digits | **strict**, not `≥` as #342 states — orthogonal neighbours are same-row-or-column, so equality is already impossible |
| I3 | the **maximum digit of an infected component is a patient zero** (its digit equals its box number) | shading → digits | see proof below |
| I4 | a rectangle lying inside one 3×3 box has `size ≤ (its patient zero's digit)` | both | the box's cells are distinct and all `≤` the max, which is the patient zero digit `m`, so at most `m` of them |
| I5 | every cell of an infected component has a strictly **increasing** orthogonal path inside the component to the patient zero; so a component cell whose in-component neighbours all hold smaller digits **is** the patient zero | shading → digits | the infection chain, run backwards |
| I6 | an infected cell with digit `d` has **every** in-grid neighbour with digit `< d` infected; so a 9 that is infected is interior to its rectangle in every in-grid direction | both | #342's "box 9's 9 is never a rectangle corner away from the edge" |
| I7 | a 1×1 infected rectangle at digit `d` needs all in-grid neighbours uninfected, hence all `> d` | both | #342's "box 1's 1 is 1×1 unless a bigger infected cell touches it" |

**Proof of I3.** Take the cell of maximum digit in an infected component. If
it were not a patient zero it was infected by an orthogonal neighbour with a
strictly larger digit, which is infected and hence in the same component —
contradicting maximality. `[proof]` The same chain argument gives I5: from any
component cell, walking to whichever neighbour infected it strictly increases
the digit, so it terminates, and only at a patient zero. `[proof]`

**Proof of I4.** Let the rectangle sit inside one box, with max digit `m` — a
patient zero by I3, so `m` is the box number. All cells of the rectangle are
in one box, so their digits are distinct, and all are `≤ m`. Distinct digits
from `{1,…,m}` number at most `m`. `[proof]` The generalisation for a
rectangle spanning several boxes is per-box: its cells inside any one box
number at most `m`.

**Combined shading-and-digit deductions**, the ones neither layer gets alone:

- **C1 (Cluster meets I4).** An infected circle with digit `s` whose surviving
  rectangle placements all lie inside one box forces that box's patient zero
  into the rectangle with digit `≥ s`. Combined with the §3.1 survivor
  intersection, this often pins the patient zero cell outright.
- **C2 (Cluster meets I2).** Once the §3.1 enumeration pins a rectangle's
  border, I2 fires on every border cell at once: each border cell's
  candidates are stripped below the adjacent interior cell's minimum. A
  20-placement enumeration that collapses to one placement hands the digit
  layer up to 20 candidate strips in one go. This is the deduction that makes
  the puzzle solve as a sudoku rather than as two puzzles side by side.
- **C3 (I6 meets Zombo).** A high digit that is possibly a patient zero and
  sits with all four in-grid neighbours available forces, if infected, a
  component containing a plus-pentomino — never a rectangle — so the
  component must extend to at least the 3×3 that contains the plus. On a
  9×9 with `s ≤ 9`, a circled 9 on such a cell is exactly the 3×3.
  `[proof]`
- **C4 (B1 meets I2).** B1 says every uninfected cell has an uninfected
  neighbour; I2 says an uninfected cell adjacent to an infected one exceeds
  it. Together: an uninfected cell whose neighbours are all *smaller* must
  have at least one of them uninfected — and a smaller uninfected neighbour
  is only possible if that neighbour is itself not adjacent to anything
  bigger and infected. `[unsure — this composes two rules into a third; it
  may be entirely subsumed by running B1 and I2 to fixpoint, which is the
  cheap thing to do anyway]`

## 5. Ranked — expected value against cost per `update`

The bar is `CODING_STANDARDS.md`'s: a deduction added must read ≤ 0.9× on one
`just time` row and ≤ 1.1× on the other. Nothing here has been timed; the
ranking is expected value, and the ordering claim is `[unsure]` until the
component exists. What is *not* unsure is the cost column — those are counted
operations.

| rank | deduction | cost per call | why it ranks here |
| --- | --- | --- | --- |
| 1 | **Z1–Z3**, the 2×2 window scan | 64 windows × 4 reads, no allocation | this *is* Zombo, complete and exact. Nothing else in the document is both a full constraint and this cheap. Ship first, alone, and measure everything against it |
| 2 | **B1**, no isolated uninfected cell | 81 × 4 neighbour reads | the cheapest Brainana rule, no walk, fires on any grid where infection spreads from point sources. Ship with rank 1 |
| 3 | **I1 + I2**, the infection/digit coupling to fixpoint | one worklist pass over 180 adjacencies, bitmask ops | this is not an optimisation — without it the component has no infection grid at all (§0). It is the floor, not a deduction |
| 4 | **§3.1 rectangle enumeration** for infected circles | ≤ 20 placements × ≤ 25 cells | strongest deduction per microsecond in the document, and it makes every walk-based rule on the infected side unnecessary. Only fires on circled cells, so its value scales with the circle count |
| 5 | **I3/I4/I5**, patient-zero and box-size rules | one pass per known component | cheap, and they are the rules that let digit knowledge close shading and vice versa. I4 in particular caps rectangle sizes hard inside a box |
| 6 | **B4/B5**, rectangle-pocket door and capacity | one flood fill over not-certainly-infected cells | the first rule that costs a walk. Justified only once the walk exists for rank 7, or if profiling shows Brainana is where the search stalls |
| 7 | **§3.2 isofill transfer** for uninfected circles: 0-1 BFS reach, cap, capacity, then cut, then tour | reach one BFS; cut one or two BFS per frontier cell | the expensive tier. Port in that order and time each addition separately — isofill's own history (`examples/isofill/README.md` § Timing) is that cut is what closes the board and tour is what makes cut affordable, but that verdict does not transfer (`docs/agents/iss.md` rule 4) |
| 8 | **Z4 equality union-find** | 64 windows + a DSU rebuilt per call | sound and genuinely new information, but it removes no candidate directly and it is the only rule needing per-call state. Build only if rank 1 is measurably leaving deductions on the table |
| 9 | **§1.2 diagonal separation certificate** | needs a walk to exploit, on top of rank 7's | narrow: it fires only on a diagonal-pair window with both shared neighbours known uninfected, and its payoff is forbidding an infected path that reach may already forbid. Last |
| — | **not ranked, do not build:** perimeter non-crossing, silent, budget/matching prune | — | isofill rules with no analogue here (§3.2 table). Do not port them by reflex because they are in the isofill component |

**The shape of the recommendation.** Ranks 1–3 are a complete, walk-free
component: Zombo exact, Brainana's cheap half, and the infection layer.
Generate against that first and see whether the puzzle is already unique and
3-star. Rank 4 costs almost nothing and should go in with them if any circle
sits on an infected cell. Everything from rank 6 down is a walk, and the
lesson of `docs/research/connectivity-techniques.md` is that walks are where
the time goes and where the verdicts stop transferring — add them one at a
time, with `just time` between each.

**The one thing to get right before any of it.** §0's three-valued infection
grid is the single point where an unsoundness would corrupt everything
downstream silently, exactly the failure mode `CODING_STANDARDS.md` warns
about. Fuzz that fixpoint against a brute-force infection closure over random
complete grids **before** writing a single deduction on top of it.

## 6. Read record

| Source | Read at | Record |
| --- | --- | --- |
| `cspuz_core/cspuz_rs_puzzles/src/puzzles/chocobanana.rs` | `main`, 2026-09-06 | 2×2 `ne(3)` for shaded; corner-marker aux graph for unshaded; `graph_division` for clue sizes. Both encodings ported as §1.3 and §2.1 |
| `noqx/solver/cbanana.py`, `noqx/noqx/rule/shape.py` | `master`, 2026-09-06 | `all_rect` / `no_rect`; same two rules in clingo. Confirms §2.1's existential |
| `pzprjs/src/variety/cbanana.js`, `src-ui/res/rules.en.yaml` | `main`, 2026-09-06 | bbox-area checker and the official rule text. Copy the checker shape into the CP-SAT model and harness |
| `grilops/grilops/regions.py`, `examples/shikaku.py` | `master`, 2026-09-06 | `rectangular=True` closure rule. Not applicable — needs region ids. No Choco Banana example exists |
| `semiexp/cspuz` (Python) `cspuz/puzzle/` | `main`, 2026-09-06 | **no chocobanana file.** Do not cite a path there |
| `docs/research/connectivity-techniques.md` | this repo | §2.1 (0-1 BFS) adopted as the reach form in §3.2; §2.3 (perimeter) judged not applicable |
| ISS `connected_values.md`, `chaos_construction.md` | not re-read for this ticket | the survey above already covers the sections that matter; §3.2's transposition is off our own isofill README |
