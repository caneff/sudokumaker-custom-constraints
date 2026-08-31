# Which ISOFILL deductions survive variable region size? (#278)

**Question.** ISOFILL indexes every rule per digit, because there each digit is
exactly one region of `size` cells. Fillomino breaks that: digit `k` may be
several separate `k`-regions anywhere on the board, and the region count is
unknown. Which of ISOFILL's deductions survive, what is the sound restatement of
each, and what does each cost per `update` call under fillomino's indexing?

**Method.** Read in this repo, not from memory: `examples/isofill/README.md`
section "What the component deduces", `examples/isofill/IsofillComponent.js`
(595 lines, line numbers cited below), `examples/isofill/soundness-harness.mjs`,
`docs/component-contract.md`, `docs/gotchas.md`, `CODING_STANDARDS.md`. The
fillomino rules are as stated in map #277. No component was written; this is the
deduction menu the component design ticket chooses from.

Tags: `[source]` = read off the code or the rules; `[proof]` = argued here, from
the rules; `[unsure]` = my inference, needs a measurement or a check.

---

## 0. The two lemmas everything below rests on

Fillomino, bare board, no houses: partition the grid into orthogonally connected
regions; every cell of a region of size `k` holds the digit `k`; two distinct
regions of the same size may not touch orthogonally. Digits run `1..D` from the
puzzle spec, so no region is larger than `D`.

**Lemma A (island coherence).** Two orthogonally adjacent cells that both hold
digit `k` are in the same region. `[proof]` Each lies in a region of size `k`.
If the two regions were distinct, they would be two distinct regions of equal
size touching orthogonally, which the rules forbid. By induction along a
connected path, a maximal orthogonally connected set of placed cells all holding
`k` lies wholly inside one region.

Call that set an **island**. An island of digit `k` with `p` cells satisfies
`p <= k`, and its region needs exactly `k - p` more cells.

**Lemma B (islands do not have to join).** Two islands of the same digit `k` that
are not adjacent may lie in the same region or in two different regions.
`[proof]` Both are consistent with the rules: they may be joined by a path of
`k`-cells, or be two separate `k`-regions that never touch.

Lemma A is what makes a per-island restatement possible at all. Lemma B is what
kills half of ISOFILL's rules: ISOFILL's "every placed cell of digit `d` is in
the one `d`-region" has no fillomino analogue.

**The right index.** ISOFILL indexes per digit. Fillomino indexes two ways, and
both are needed:

- **per island** — for a region that already has a known member;
- **per (open cell, candidate digit)** — for a region that does not exist yet.

Nothing in ISOFILL is indexed the second way. That is the gap the ticket
suspected, and it is real (section 6).

**The seed-walk lemma, restated for an island.** Let `I` be an island of digit
`k` with `p` cells and `R` its region. Then every cell of `R` lies within 0-1
distance `k - p` of `I`, where a cell already holding `k` costs 0 to enter, an
open cell that still allows `k` costs 1, and a cell holding any other digit is
impassable. `[proof]` `R` is connected and contains `I`; take a path inside `R`
from a cell of `I` to any `y` in `R`. Every cell on it is in `R`, so it holds `k`
(cost 0) or is open and allows `k` (cost 1). The cost-1 cells on the path are
open cells of `R`, and `R` has at most `k - p` of those. The budget `k - p` is an
over-estimate whenever `R` also swallows another island of `k`: that only widens
the walk, which is the direction soundness needs. Call this walk `walk(I)`; it is
a superset of `R`.

Cost symbols below: `G` cells, `D` digits, `P` placed cells, `O` open cells,
`k <= D` the digit under test.

---

## 1. Cap — dies globally, survives restated per island

**ISOFILL** (`IsofillComponent.js:338`): once digit `d` occupies `size` cells,
remove `d` from every other cell. `[source]`

**Verdict: dies as stated.** It needs a fixed global per-digit cell count.
Fillomino has none — digit 5 may fill 5 cells, or 25, or none.

**Survives restated (seal).** *An island `I` of digit `k` with exactly `k` cells
is a finished region. Every open cell orthogonally adjacent to `I` loses the
candidate `k`.* `[proof]` If such a cell held `k`, Lemma A puts it in `I`'s
region, making that region `k + 1` cells, which contradicts every cell of a
`k`-region holding `k`. (The alternative reading — a second, distinct `k`-region
touching `I` — is forbidden outright.)

**Also survives, as its mirror (overflow).** *An island of digit `k` with more
than `k` cells is a dead branch.* `[proof]` Lemma A puts all of them in one
region, of size `k`. ISOFILL states this through the walk instead; here it is one
subtraction. This is the check the catalog baseline calls "stops on overflow"
(#277).

**Cost.** One island scan per call (flood or DSU over placed cells), `O(G)`, then
one lap of each finished island's perimeter, `O(P)` in total.

---

## 2. Force — dies globally, survives restated per island

**ISOFILL** (`IsofillComponent.js:340`): when exactly `size` cells can still hold
`d`, place `d` in all of them. `[source]`

**Verdict: dies as stated.** Same missing premise as cap: a fixed per-digit cell
count.

**Survives restated.** *If `walk(I)` holds exactly `k` cells, then `R = walk(I)`,
so every open cell of `walk(I)` holds `k`.* `[proof]` `R` is a subset of
`walk(I)` with `|R| = k = |walk(I)|`, so the two sets are equal.

This is the same statement ISOFILL makes, with "the cells that allow `d`"
replaced by "the walk from this island". It is the tighter of the two even in
ISOFILL's own setting.

**Cost.** Free — one comparison on a walk section 3 already runs.

---

## 3. Seed walk — the walk survives restated; of its three readings, one survives

**ISOFILL** (`IsofillComponent.js:148`, `:330`): a 0-1 BFS from the digit's
lowest placed cell, budget `size - placed`, with three readings — cells outside
the walk lose the digit (`:375`); a walk under `size` cells is a dead branch
(`:334`); a placed cell the walk never meets is a dead branch (`:335`).
`[source]`

**The walk survives restated**, per island, as the seed-walk lemma in section 0.
The restatement changes two things: the seed is an island rather than one cell
(start the BFS from every cell of `I` at cost 0 — the free-closure loop at
`IsofillComponent.js:157` already does exactly this), and the budget is `k - p`,
read off the island's own digit rather than a board constant.

Now the three readings.

**(a) "Cells outside the walk lose the digit" — dies.** `[proof]` It needs the
digit to name one region (Lemma B). A cell far from every island of `k` may
perfectly well hold `k`, as a member of a `k`-region that has no placed cell yet.
This is ISOFILL's cheapest and strongest prune, and fillomino loses it outright.
Sections 3 (frontier prune) and 6 are the replacements, and they cost more.

**(b) "A walk under `k` cells is a dead branch" — survives as is.** `[proof]`
`R` is a subset of `walk(I)` and `|R| = k`, so `|walk(I)| >= k`. This is the
baseline's "checks reachable space" (#277).

**(c) "A placed cell the walk never meets is a dead branch" — dies.** `[proof]`
Lemma B: an island of `k` outside `walk(I)` is simply a different region. In
ISOFILL this was a contradiction; here it is the ordinary case.

**What replaces (a): the frontier prune.** The one place membership *is* forced
is adjacency. *Let `x` be an open cell and `k` a candidate of `x`. Let `M(x, k)`
be `{x}` together with every island of digit `k` orthogonally adjacent to `x`. If
`x` holds `k`, then all of `M(x, k)` lies in one region of size `k`.* `[proof]`
Lemma A, applied to `x` and each adjacent island in turn. Three consequences:

1. **Merge overflow.** If `|M(x, k)| > k`, then `x` does not hold `k`.
2. **Merge starve.** If the 0-1 walk from `M(x, k)` with budget `k - |M(x, k)|`
   covers fewer than `k` cells, then `x` does not hold `k`.
3. **Merge force.** If that walk covers exactly `k` cells, every open cell in it
   holds `k`.

This is cap, force and the seed walk fused into one test, indexed the fillomino
way. It generalises what the catalog baseline does when it "forces growth when
one frontier cell remains" (#277).

**Cost.** One walk per island, bounded by the `k - p` budget, so it touches at
most the cells within `k` steps and may stop early at `k` cells: `O(k^2)` cells
per island, `O(P * k^2)` worst case, `O(G)` in practice. The frontier prune runs
one bounded BFS per (frontier cell, candidate digit) pair, each stopping at `k`
cells: `O(k)` per pair with the early stop, so `O(F * D * k)`, where `F` is the
number of open cells adjacent to an island.

**This is the structural good news.** ISOFILL's walks are expensive because a
region there is as wide as the board — the walk covers the grid on every search
node, which is why `update`'s own cost was most of the solve time (`README.md`,
"What the component deduces"). In fillomino no region exceeds `D` cells, so
**every walk stops at `k <= D` cells**. The rules that survive cost far less per
firing than their ISOFILL originals. `[unsure]` — argued from the bound, not
measured; `just time` decides.

---

## 4. Cut — starve survives restated, strand dies

**ISOFILL** (`IsofillComponent.js:376`, filter at `:261`): for each open cell in
the digit's walk, drop it and walk again. If the walk now holds fewer than `size`
cells (**starve**), or a placed cell falls out of it (**strand**), that cell must
hold the digit. `[source]`

**Starve — survives restated.** *Let `y` be an open cell in `walk(I)`. If the
walk from `I` with `y` removed covers fewer than `k` cells, then `y` is in `R`,
so `y` holds `k`.* `[proof]` If `y` were not in `R`, then `R` would be a subset
of the walk computed without `y`, which has fewer than `k` cells — but
`|R| = k`. So `y` is in `R`, and every cell of `R` holds `k`. The yield is the
strong one: remove every digit but `k` from `y`.

**Strand — dies.** `[proof]` It needs every placed cell of the digit to belong to
one region (Lemma B again). An island of `k` that falls out of the walk is a
different region, not a contradiction. Within a single island the test is vacuous
by construction: an island is connected, so it never strands itself.

**Partial replacement, in the opposite direction.** Strand proved distant
same-digit cells *must* connect. Fillomino gets the reverse: *two islands `I` and
`J` of digit `k` with `|I| + |J| > k` are certainly in different regions.*
`[proof]` Lemma A would otherwise force one region of more than `k` cells. Merge
overflow (section 3) is the cheap local form; section 7 uses the global form.

**`cutFilter` transfers unchanged.** The dominator-tree filter
(`IsofillComponent.js:202`, `:261`) is a statement about reachability alone —
"a cell `y` keeps a path of its own length from some start when the removed cell
does not dominate `y`" — and never reads a digit or a region count. Its starve
half applies verbatim to the restated starve test. Its strand half has nothing
left to filter. `[source]`

**Cost.** Per island: one `domTree` plus `subtreeSums` over the walk, then one
re-walk per open cell the filter did not clear, each stopping at `k` cells:
`O(k^2)` filter plus `O(k^2)` per surviving cell, so `O(k^3)` per island worst
case with `k <= D`. On a 9x9 with `D = 9` that is a few hundred steps per island,
against ISOFILL's grid-wide re-walks.

---

## 5. Tour — dies, vacuous

**ISOFILL** (`IsofillComponent.js:346`): the region is a connected set holding
every placed cell of the digit and the candidate cell, so a walk round its
spanning tree is a closed tour through all of them, and the region holds at least
`1 + ceil(perimeter / 2)` cells for any three of those points, by BFS distance.
The README is explicit about where the strength comes from: "tighter than the
depth bound **when the placed cells are spread**: two placed cells nine apart
leave only the cells between them". `[source]`

**Verdict: dies — the bound is vacuous under fillomino indexing.** `[proof]` The
known members of a fillomino region are one island, and an island is connected.
Take two points `i, j` in `I` and the candidate `x`. The tour bound reads
`1 + ceil((d(i,j) + d(i,x) + d(j,x)) / 2)`. The plain bound already available
from the island is `|R| >= p + dist(I, x)`, since `R` contains all `p` island
cells and a path from the island to `x`. Because `i` and `j` are both in the
connected island, `d(i,j) <= p - 1` and `d(i,x), d(j,x) <= (p - 1) + dist(I, x)`;
feeding those in, the tour bound never exceeds `p + dist(I, x)`. It is dominated
by a bound that costs one walk instead of one BFS per placed cell.

**Assumption it needed:** several known members of one region that are far apart
from each other. Fillomino's known members of a region are, by Lemma A, always
one connected clump.

**When it could revive.** `[unsure]` If some later rule pins two distant islands
of `k` to the *same* region — nothing in this menu does — the tour bound becomes
non-vacuous on that pair. Fortress fillomino (#277 stage two) may create such
pins through its ordering chains. Do not build it now.

---

## 6. Silent — survives, generalises, and is the biggest single win

**ISOFILL** (`IsofillComponent.js:401`): a digit with no placed cell gets no
walk, because every walk starts from a placed cell. Its region still lies inside
one connected component of the cells that allow it, so a component under `size`
cells loses the digit, and if no component reaches `size` the branch is dead.
`[source]`

**Verdict: survives restated, and it stops being a special case.** In ISOFILL
"silent" means one digit out of ten, on rare boards — the README says the two
silent-digit fixtures were built to expose it. In fillomino **every open cell is
silent**: any open cell may belong to a region that has no placed cell at all,
and the rules of sections 1-4 say nothing whatever about such a region. The
ticket called this the biggest gap in the baseline and that is right — the
baseline "reasons only from placed cells" (#277).

Two restatements, cheap and less cheap.

**(i) Component bound — the direct transfer.** *Let `A(k)` be the cells that
allow `k`: open cells with `k` among their candidates, plus cells already holding
`k`. Every `k`-region is connected and lies inside `A(k)`, so it lies inside a
single orthogonally connected component of `A(k)`. Every open cell in a component
of `A(k)` smaller than `k` cells loses the candidate `k`.* `[proof]` The region
is connected and a subset of `A(k)`, so it is inside one component; a component
of fewer than `k` cells cannot contain it. A component smaller than `k` that
*contains a placed `k`* is a dead branch instead (that island cannot reach `k`) —
never empty a placed cell without meaning it; `IsofillComponent.js:334` shows the
repo's idiom, which is to yield the removal on a placed cell so the solver drops
the branch.

Note what changed: ISOFILL runs this only for a digit with no placed cell. In
fillomino it runs for **every** digit, because a component far from every island
may still host a fresh region.

**(ii) Local growth test — the sharper form.** *For an open cell `x` and
candidate `k`, if the cells reachable from `x` through `A(k)` within `k - 1`
steps number fewer than `k`, then `x` does not hold `k`.* `[proof]` `x`'s region
is connected, has `k` cells, contains `x` and lies inside `A(k)`; every one of
its cells is within `k - 1` steps of `x` inside it. Strictly stronger than (i) —
it is (i) localised — and it subsumes merge starve from section 3 when the walk
starts from `M(x, k)` instead of `{x}`.

The final shape is one uniform test, replacing cap, force, seed walk and silent
at once:

> **Growth test.** For each open cell `x` and each candidate `k` of `x`: let
> `M` be `{x}` plus every island of digit `k` adjacent to `x`. If `|M| > k`,
> drop `k` from `x`. Otherwise run the 0-1 walk from `M` with budget `k - |M|`,
> stopping at `k` cells. If it covers fewer than `k` cells, drop `k` from `x`.
> If it covers exactly `k` and stopped there naturally, every open cell it
> covers holds `k`.

**Cost.** (i) is one flood fill per digit over the cells that allow it,
`O(D * G)` per call — the shape ISOFILL pays per silent digit, times `D`. (ii) is
one bounded BFS per (open cell, candidate) pair, each stopping at `k <= D` cells:
`O(O * D * k)`, roughly `O * D * D * 4` neighbour reads. On a 9x9 with `D = 9`
that is about 26,000 neighbour reads per `update` call — cheap in absolute terms
but paid on every search node, so it is exactly the kind of rule
`CODING_STANDARDS.md` requires `just time` to judge. `[unsure]` — the arithmetic
is mine; the clock decides.

---

## 7. Perimeter — the topology survives as is, the digit-indexed rule dies, an island-indexed rule survives

**ISOFILL** (`IsofillComponent.js:446`): two disjoint orthogonally connected
regions cannot interleave round the border, so no four border cells read
`a, b, a, b` in cyclic order. *Split arc*: a digit whose placed border cells fall
into two arcs with one other digit placed in each is a dead branch. *Flank*: an
open border cell whose nearest placed border cells both ways hold digit `a` loses
every digit `b` placed elsewhere on the border. `[source]`

**The topological fact survives untouched.** The non-crossing argument — extend
each path's ends to the grid edge inside its own cells, the two curves have
interleaved ends on the rectangle's boundary so they cross, and two axis-aligned
centre-to-centre paths cross only at a shared cell centre — reads "two disjoint
connected regions" throughout. It never mentions a digit, a region size, or a
region count. It holds for fillomino verbatim. `[proof]`

**Both deductions as coded die.** `[proof]` Both substitute "digit `a`" for
"region `a`". Under Lemma B, two border cells holding `a` may be in different
`a`-regions, so `a, b, a, b` in digits is not `a, b, a, b` in regions. Neither
rule's witness holds.

**Survives restated, island-indexed.** *Four border cells in cyclic order whose
owners are island `I`, island `J`, island `I`, island `J` (the same island for
each pair) is a dead branch.* `[proof]` The two islands lie in two regions, which
are either equal or disjoint. If equal, the four cells are one region and the
reading is not an interleave of two. If disjoint, the topological fact applies
directly.

**A second, fillomino-native version.** *Two islands `I`, `J` of the same digit
`k` with `|I| + |J| > k` are certainly in different regions (section 4). If their
border cells interleave, the branch is dead.* `[proof]` The certainty comes from
Lemma A; the contradiction from the topological fact. ISOFILL has no analogue,
because there two placed cells of the same digit are never in different regions.

**Flank essentially dies.** `[proof]` Flank's prune needs "digit `b` placed
anywhere else on the border" to mean "region `b` is elsewhere on the border".
Under Lemma B it does not. The surviving restatement — `x` loses `b` only when
`x` would join a specific island of `b` sitting outside the arc — requires that
island to be adjacent to `x`, and the arc separates them, so the case is close to
empty. `[unsure]` I could not construct a firing instance; treat flank as not
worth its lap of the border until one is found.

**Cost.** One lap of the border, plus the island id per border cell, which the
island scan already produced: `O(border)` for the ownership pass and `O(islands
touching the border, squared)` for the interleave check, against ISOFILL's one
lap per digit. Cheaper than ISOFILL's version, and it fires far less often — a
fillomino region has at most `D` cells, so a region touching the border in two
separated arcs must be a long snake. `[unsure]` measure before shipping.

---

## 8. Budget — the covering half dies, the demand half survives heavily restated

**ISOFILL** (`IsofillComponent.js:424`, `:498`): the one rule that looks across
digits. Every open cell needs a digit; digit `d` takes at most `size - placed`
more cells, only inside its walk. Max flow short of covering every open cell is a
dead branch. Then Régin's prune on the perfect matching: a (cell, digit) pair no
perfect matching uses loses that candidate. `[source]`

**The covering half dies.** *"Every open cell needs a digit, and the digits'
remaining capacities must cover them"* has no fillomino form. `[proof]` Two
premises fail at once. First, digit `k` has no fixed remaining capacity — it may
fill any number of further regions. Second, and this is the ticket's suspicion
confirmed, an open cell may belong to a region **that does not exist yet**, so it
needs no capacity from any existing island. A fresh region contains no placed
cell of any digit, so it draws entirely on open cells and appears in no island's
budget. The counting argument that made ISOFILL's flow bite — open cells and
slots count the same, so a full matching is perfect
(`IsofillComponent.js:532`) — has no counterpart: fillomino's slots do not
exhaust its open cells.

**The demand half survives, restated, and needs a guard.** *Island `I` of digit
`k` needs exactly `k - |I|` open cells, and they must come from `walk(I)`.
Regions are disjoint, so two islands in different regions cannot use the same
open cell.* Model it as a bipartite b-matching: island `I` demands `k - |I|`
units, one per open cell, from `walk(I)`. If no feasible assignment saturates
every demand, the branch is dead. `[proof]` A solution supplies one — each
island's region supplies its own fill, and distinct regions are disjoint.

**The guard is load-bearing.** The model is unsound as written whenever two
islands of the same digit `k` can merge into one region: that region needs
`k - |I| - |J|` open cells in total, and demanding `k - |I|` and `k - |J|`
separately over-counts, which can make a feasible state look dead — an unsound
removal, the one failure mode `CODING_STANDARDS.md` calls out. Restrict the flow
to **merge-isolated** islands: those with no other same-digit island inside their
walk, or where any such pair overflows (`|I| + |J| > k`, section 4). Those
islands' regions are pairwise disjoint and their demands are exact. `[proof]`

**The Régin prune survives only on frontier cells.** A dropped (cell, island) arc
means "this cell is not the fill of that island", which by itself removes no
digit — the cell may hold `k` inside a different `k`-region. It removes a
candidate exactly when island membership is forced, that is, when the cell is
adjacent to the island: *if open cell `x` is adjacent to island `I` of digit `k`
and no feasible flow assigns `x` to `I`, then `x` does not hold `k`.* `[proof]`
Lemma A forces `x` into `I`'s region if `x` holds `k`. The residual-graph
argument must run on a flow that saturates the island side; ISOFILL's version
(`:532`) guards on a perfect matching and refuses to prune otherwise, and the
fillomino version needs the analogous guard. `[unsure]` I have not worked the
residual construction through for a b-matching with slack on the cell side; a
design ticket should, before shipping it.

**Cost.** Islands number up to `P`, far more than ISOFILL's ten digits, and each
demands up to `D` units: Kuhn's augmenting path per demand unit over
island-to-cell edges gives `O(sum of demands * edges)`, worst case
`O(P * D * E)`. This is the most expensive rule on the menu by a wide margin, and
the one whose ISOFILL justification (it "catches what the per-digit rules
cannot") transferred least. Rank it last and make it earn its place against
`just time`. `[unsure]`

---

## 9. `validate` — simpler in fillomino than in ISOFILL

ISOFILL's leaf check (`IsofillComponent.js:576`) walks each digit's blob and
checks size and connectedness. Fillomino's is one pass and needs no separate
adjacency check: *on a full grid, flood every maximal orthogonally connected
same-digit component; the rule holds exactly when each component's size equals
its digit.* `[proof]` Size-equals-digit is the first rule directly. The second
rule follows for free: two distinct regions of size `k` touching orthogonally
would be one connected same-digit component of at least `2k` cells, whose size is
not `k`, so the check already rejects it. One flood over the grid, `O(G)`. Note
gotcha 2 — the solver may not call `validate` at all, so it states the rule and
the deductions do the work.

---

## 10. Summary

| ISOFILL rule | Verdict | Fillomino form | Cost per `update` |
| --- | --- | --- | --- |
| Cap | dies globally, survives restated | seal a finished island's border; overflow on an island over `k` | `O(G)` scan + `O(P)` |
| Force | dies globally, survives restated | `walk(I)` of exactly `k` cells is the region | free, rides the walk |
| Seed walk (the walk) | survives restated | 0-1 walk from an island, budget `k - p` | `O(k^2)` per island |
| — reading (a): outside the walk loses the digit | **dies** | needs one region per digit | — |
| — reading (b): walk under `k` is dead | survives as is | same statement, `k` for `size` | free |
| — reading (c): a missed placed cell is dead | **dies** | needs one region per digit | — |
| (new) frontier / growth test | replaces (a) | merge overflow, merge starve, merge force | `O(O * D * k)` |
| Cut — starve | survives restated | drop `y`, re-walk; under `k` means `y` holds `k` | `O(k^3)` per island |
| Cut — strand | **dies** | needs every placed cell of the digit in one region | — |
| `cutFilter` (dominators) | survives as is | pure reachability, reads no digit | `O(k^2)` per island |
| Tour | **dies (vacuous)** | needs spread-out known members; an island is connected | — |
| Silent | survives, generalises to every digit | component bound + local growth test | `O(D * G)` / `O(O * D * k)` |
| Perimeter — topology | survives as is | holds for any two disjoint connected regions | — |
| Perimeter — split arc | dies as coded, survives island-indexed | `I, J, I, J` round the border is dead | `O(border)` |
| Perimeter — flank | **dies** | needs digit `b` to name one region | — |
| Budget — covering | **dies** | an open cell may join a region that does not exist yet | — |
| Budget — demand | survives restated, with a guard | b-matching over merge-isolated islands | `O(P * D * E)` |
| `validate` | survives, simpler | one flood: component size equals its digit | `O(G)` |

**The three headlines.**

1. **What dies, dies for one reason.** Every death traces to Lemma B: ISOFILL
   knows that all placed cells of digit `d` are one region, and fillomino does
   not. Cap, force, reading (a), strand, tour, flank and budget's covering half
   all lean on it.
2. **What survives gets cheaper, not dearer.** Fillomino caps a region at `D`
   cells, so every surviving walk stops at `k <= D` cells, where ISOFILL's walks
   spanned the grid on every search node. The per-island and per-cell indexing
   multiplies the *number* of walks, but each one is small.
3. **The new work is the fresh region.** ISOFILL has no rule indexed per (open
   cell, candidate digit), because there a region always had a placed member.
   Fillomino's growth test (section 6) is the rule with no ISOFILL ancestor, and
   the one the catalog baseline is missing entirely.

**Recommended ordering for the design ticket** — cheapest and most certain
first, each gated by `just time`: island scan with seal and overflow (1) → walk
with reading (b) and force (2, 3) → growth test (6) → cut starve with the
dominator filter (4) → component bound (6i) → island perimeter (7) →
island-demand matching (8). Section 5 (tour) and the dead halves of 4, 7 and 8
should not be built.

## Open questions for the design ticket

- Does the growth test pay for itself run over every (open cell, candidate) pair,
  or must it be restricted to frontier cells? `[unsure]` — needs `just time` on a
  fixture that does not exist yet (#277 notes the ranking fixtures are not
  built).
- The residual-graph prune for the island-demand b-matching with slack on the
  cell side (section 8) is unworked. It must not prune without the saturation
  guard.
- Does the island-perimeter rule ever fire on a board with `D <= 9`? A region
  touching the border in two separated arcs needs a long snake. `[unsure]`
- Should the island scan be a DSU maintained across `update` calls, or a fresh
  flood each call? ISOFILL rebuilds all state from one grid scan per call
  (`IsofillComponent.js:292`), and the README records that the one-pass scan
  halved the app's verdict; the same shape probably applies. `[unsure]`
