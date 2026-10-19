# Which fortress deductions are sound (#852)

**Question.** Which deductions does the **fortress rule** support in a
SudokuMaker component, and which of them are sound? Plus #278's open point
(`fillomino-isofill-transfer.md` §5, "When it could revive"): do the ordering
chains pin distant islands to one region and so revive the tour bound?

**Rule, as ruled (Chris, 2026-10-19; `GLOSSARY.md`).** Plain fillomino on a bare
board, givens only, plus: every region is strictly larger than all its
orthogonal neighbours (a **peak**) or strictly smaller than all of them (a
**pit**).

**Method.** I read the shipped machinery (`examples/fillomino/FillominoComponent.js`,
its README § "What the component deduces", `GLOSSARY.md` § Region-building
terms, `fillomino-isofill-transfer.md`) and argued each candidate from the
rules. Then I checked every candidate with a **scratch** exhaustive enumerator,
`fortress-fillomino-deductions/scratch_check.py` (details under *Evidence*). It
is not the repo's model, and nothing runs it. No component code was written,
and nothing was timed.

Tags: `[proof]` is argued here from the rules. `[fuzz]` means the scratch
check found no violation, or found the counterexample cited. `[unsure]` is my
inference and needs a measurement.

---

## 0. What the fortress rule is, cell by cell

**Lemma F (the rule is local to a cell).** A region `R` of size `k` is a peak
exactly when every cell of `R` has all its neighbours `<= k`, and a pit exactly
when every cell has all its neighbours `>= k`. `[proof]` A neighbour inside `R`
holds `k`. A neighbour outside `R` holds a different digit, because equal sizes
may not touch, so `<= k` there means `< k`. So the fortress rule says: **no
region has both a strictly smaller and a strictly larger neighbour**. Every rule
below leans on this form.

**The two-colouring is a consequence, not a separate rule.** `[proof]` Suppose
no region has a smaller and a larger neighbour. Then along any cycle of
regions, each region is a local maximum or a local minimum of its two cycle
neighbours. The two kinds alternate, so the cycle has even length. The region
adjacency graph is therefore bipartite, with peaks on one side and pits on the
other. The converse direction is the map's own fact (two touching peaks would
each be larger than the other). So checking for odd cycles or triangles adds
nothing to checking for sandwiches. A triangle of three islands with pairwise
distinct digits always has a middle digit, and that island is sandwiched.

**Certainty, read from candidates.** Every rule below reads one cell-level fact:
neighbour `y` of a `k`-cell is **certainly below** `k` when `max cand(y) < k`,
and **certainly above** `k` when `min cand(y) > k`. Either way `y` cannot hold
`k`, so it lies in a different region from that cell. The fact is monotone
within a branch: candidates only shrink, so a certainty never lapses mid-pass.
That makes it safe against `update`'s yield-as-you-go. It is **not** safe to
carry between calls, because backtracking restores candidates (README § "The
bound made cheap": a snapshot, never a flag).

**Per call**, two arrays over the board serve every rule: `lo[x] = min over
neighbours y of max cand(y)` and `hi[x] = max over neighbours y of min cand(y)`.
A `k`-cell `x` has a certainly-below neighbour iff `lo[x] < k`, and a
certainly-above one iff `hi[x] > k`. Each entry costs one read of the highest
and lowest set bit of four masks, so the table is `O(G)` per call.

---

## 1. Candidate deductions

### F1. Island orientation (survives)

*Island `I` of digit `k`. Over the neighbours of `I`: if one is certainly below
`k` and another certainly above, the branch is dead. If one is certainly below,
`I`'s region is a peak, and every open neighbour of `I` loses every digit above
`k`. If one is certainly above, the region is a pit, and every open neighbour of
`I` loses every digit below `k`.* `[proof]` By Lemma A, `I` sits in one region
`R`, and a neighbour of `I` is either in `R` (it holds `k`) or a neighbour of
`R`. The certain cell is a neighbour region on that side, which fixes `R`'s
colour, and every non-`k` neighbour must then fall on the same side. `[fuzz]`
0 violations.

The prune lands only on cells adjacent to the **island**. Those cells are
adjacent to the region, or inside it. A wider ring is unsound (see U2).

- **Scan:** island-indexed. It rides the neighbour lap that seal and the doors
  already make. The dead verdict uses the repo's idiom: remove the digit from a
  placed cell.
- **Cost:** `O(perimeter)` per island, with a `removeCandidatesFromCell` mask of
  the out-of-range digits per open neighbour. Negligible.
- **Digits 1 and D:** a 1 is always a pit and a `D` is always a peak, but on
  their own those labels prune nothing. A 1's neighbours lose digits below 1,
  and a `D`'s lose digits above `D`. Their effect reaches the board through the
  neighbours' own F1 and F2, which see the 1 or the `D` as a certain neighbour.
  Special-casing them gives nothing.

### F2. Sandwich (survives)

*Open cell `x` loses every digit `d` with `lo[x] < d < hi[x]`.* `[proof]` If `x`
held `d`, its region would have one neighbour certainly below `d` and one
certainly above. `[fuzz]` 0 violations.

This is F1 indexed per **(open cell, digit)**, the indexing #278 §6 said
fillomino needs for silent regions. Here it costs no walk: the doomed digits
form one contiguous range, so the prune is a single mask per cell.

- **Scan:** per open cell, from the `lo`/`hi` table.
- **Cost:** `O(G)` per call. On a 9x9 board that is about 324 neighbour mask
  reads plus 81 range masks. The cheapest rule here.

### F2b. Cell bounds (survives)

*If every candidate of open cell `x` has a certainly-below neighbour
(`lo[x] < min cand(x)`), then `x` is a peak whatever it holds, and every
neighbour of `x` loses the digits above `max cand(x)`. Mirror case: if
`hi[x] > max cand(x)`, every neighbour loses the digits below `min cand(x)`.*
`[proof]` By Lemma F, a peak cell's neighbours are all `<= val(x) <= max
cand(x)`. `[fuzz]` 0 violations.

F2 does not cover this. F2 at the neighbour would also need a second,
certainly-above witness. F2b is bounds propagation one step out from an open
cell whose colour is certain.

- **Scan:** per cell, from the same table. **Cost:** `O(G)`.

### F3. Merge orientation at a door (survives)

*At door `x` for digit `k`, let `M` be `x` plus every adjacent island of `k`, as
the shipped merge rules build it. If the neighbours of `M` include one cell
certainly below `k` and one certainly above, `x` loses `k`.* `[proof]` By Lemma
A, if `x` held `k` all of `M` would be one region, and that region would be
sandwiched. `[fuzz]` 0 violations.

F3 is stronger than F2 at a door, because it pools the witnesses of every island
`x` would join. It also covers the **colour clash**: when `x` touches a
known-peak island of `k` and a known-pit island of `k`, `x` loses `k`.

- **Scan:** per door. It rides `placedFlood` in `doorRules`, which already
  builds `M`. **Cost:** one lap of `M`'s rim per door, at most about `4k` reads.

### F4. Colour-filtered walk (survives)

*A cell can sit in a peak of `k` only if no neighbour is certainly above `k`
(`hi <= k`), and in a pit of `k` only if no neighbour is certainly below `k`
(`lo >= k`). Run the island's 0-1 walk over peak-admissible cells and again over
pit-admissible cells, placed cells included. If both walks are under `k` cells,
the branch is dead. If only one reaches `k`, the island takes that colour, and
starve, force and cut starve read that walk instead of the plain one.*
`[proof]` `R` is a peak or a pit, every cell of `R` is admissible for its own
colour (Lemma F), so `R` lies inside the walk of its colour. The shipped
argument (walk is a superset of the region) then carries over word for word.
`[fuzz]` 0 violations, force included.

This is where fortress is most likely to bite, because it shrinks the walk that
every island rule reads. It is also the most expensive per-island addition.

- **Scan:** island-indexed. It needs the `lo`/`hi` table. When F1 has fixed the
  colour, one walk is enough. Otherwise it takes two.
- **Cost:** at most twice the shipped walk, `O(k^2)` cells per island. Cut
  starve's re-walks and its dominator filter run on the filtered set. They read
  only reachability, so they carry over as they are. `[unsure]` whether the
  narrower walk saves more re-walks than the second walk costs. `just time`
  decides.

### F5. Colour-split component bound (survives)

*Split `A(k)` into `A_peak(k)` (cells allowing `k` with `hi <= k`) and
`A_pit(k)` (cells allowing `k` with `lo >= k`). A cell keeps `k` only if its
component in one of the two has at least `k` cells.* `[proof]` A `k`-region is
connected and lies wholly inside the set for its colour. `[fuzz]` 0 violations.
This is the fortress form of the one rule that reaches a silent region.

- **Scan:** per digit, over the board.
- **Cost:** two floods per dirty component instead of one. There is a catch for
  the shipped dirty-component diff (`componentBound`): a cell's membership in
  `A_peak` or `A_pit` depends on its **neighbours'** candidates. So a changed
  cell must re-seed its distance-2 neighbourhood, not distance 1, or a stale
  component verdict survives. Diffing `lo`/`hi` alongside `code` would do it.
  `[unsure]` whether that holds the #312 savings. Once F2 has run, `A(k)` is
  exactly `A_peak ∪ A_pit`, so the split only helps where peak-only and pit-only
  cells mix inside one plain component.

### F6. Same-digit colour separation (survives, folded into F3)

*Two islands of `k`, one known peak and one known pit, lie in different
regions.* `[proof]` A region has one colour. This is the reverse of a pin. It
fires as F3's colour clash at a shared door. It is also a second
"certainly-different-regions" witness for #278 §8's merge-isolation guard,
alongside `|I| + |J| > k`. Free once F1 has labelled the islands.

### F7. Odd-cycle or triangle rule (dies, redundant)

By §0, bipartiteness follows from "no sandwich", so an odd-cycle test fires
only where F1 or F3 already does. Not unsound, just never first.

### U1. Ordering chains and transitivity (dies)

*"Peak `P` > pit `Q` < peak `P'`, so `P` and `P'` are ordered."* `[proof]` The
inequalities alternate in direction along every chain, because the adjacency
graph is two-coloured and every edge runs peak > pit. Two inequalities never
compose, so every chain has length one. The two peaks beside one pit may hold
any digits, equal ones included, as long as they do not touch. The fortress
rule orders neighbours and nothing beyond them.

### U2. Ring wider than the island (dies)

*"A known-peak island's walk rim loses the digits above `k`."* `[fuzz]`
counterexample: 63 to 416 violations per board. The walk is a superset of the
region, so a cell next to the walk need not be next to the region. F1's ring
must stay the island's own neighbours.

### U3. One colour per digit (dies)

*"An island of `k` is a peak, so every island of `k` is a peak."* `[fuzz]`
counterexample, and a 4x4 fortress solution (digits 1-5, scratch board, not a
published puzzle) with digit 3 both ways:

```
2 2 3 3
5 5 1 3
3 5 5 2
3 3 5 2
```

The top-right 3 touches 2, 1 and 2, so it is a peak. The bottom-left 3 touches
only 5s, so it is a pit. This is Lemma B again: colour belongs to a region, not
to a digit. It is the fortress twin of the trap #278 traced every unsound rule
to.

---

## 2. Verdict list

| # | Candidate | Verdict | Scan | Cost guess |
| --- | --- | --- | --- | --- |
| F1 | island orientation: dead on sandwich; peak or pit prunes the island's open ring | **survives** | island | `O(perimeter)`, rides seal/door lap |
| F2 | sandwich: `x` loses `lo < d < hi` | **survives** | (open cell, digit) as one range mask | `O(G)` |
| F2b | cell bounds from a certain-colour open cell | **survives** | per cell | `O(G)` |
| F3 | merge orientation at a door (with colour clash) | **survives** | per door | `O(k)` per door, rides `placedFlood` |
| F4 | colour-filtered walk: starve, force, cut starve per colour | **survives** | island + `lo`/`hi` | at most 2x shipped walk; `[unsure]` net |
| F5 | colour-split component bound | **survives** | per digit | 2x floods, dirty radius 2; `[unsure]` net |
| F6 | peak island and pit island of `k` are different regions | **survives** (inside F3) | island | free |
| F7 | odd-cycle or triangle test | **dies** (redundant with F1/F3) | — | — |
| U1 | ordering chains or transitivity | **dies** (chains have length one) | — | — |
| U2 | prune the walk's rim by colour | **dies** (counterexample) | — | — |
| U3 | one colour per digit | **dies** (counterexample) | — | — |
| P | pin walk, and the pinned door starve (§3) | **survives**, but plain-fillomino and unmeasured | island pair | `O(islands of k squared x k^2)` `[unsure]` |

No candidate is left **unsure** on soundness. Every `[unsure]` above is about
cost, which `just time` settles per the solve-time invariant.

Suggested build order, cheapest and most local first: F2 + F2b (one table, one
pass) → F1 → F3 → F4 → F5.

---

## 3. The revive question: do ordering chains pin distant islands?

**No.** The ordering cannot pin anything: by U1, every chain has length one, and
the colour gives anti-pins (F6), the opposite of what the tour bound needs.
None of F1-F5 ever concludes that two islands share a region.

Three facts sharpen that answer.

1. **The fortress rule does make some pins true; it just doesn't derive them
   by ordering.** I took placed-cell subsets of random fortress solutions and
   enumerated every solution consistent with them. I then counted
   non-adjacent same-digit island pairs with `|I| + |J| <= k` that share a
   region in **every** consistent solution. Some are pinned under fortress but
   not under plain fillomino: 14 of 565 pairs (4x4, digits 1-5), 7 of 394 (3x5,
   1-6), 9 of 510 (4x4, 1-7), 0 of 305 (3x4, 1-6). These come from the whole
   solution space, not from any local rule above, and the sample is 300 random
   givens subsets per board. `[fuzz]`
2. **A pin-deriving rule exists, and it is plain fillomino.** #278 missed it.
   This is the **pin walk**, cut strand restated for one pair of islands. For
   islands `I` and `J` of `k`, if `I`'s region left `J` out, it would be a
   different `k`-region from `J`'s, so it could neither contain nor touch `J`.
   Walk out from `I` with `J` and every neighbour of `J` blocked. *If that walk
   covers fewer than `k` cells, `I`'s region contains `J`.* `[proof]` `[fuzz]`
   about 22,500 pins derived, 0 wrong. F4's filtered walk would narrow the
   blocked walk and so fire it more often under fortress. `[unsure]` how often.
3. **Even with a pin, the three-point tour mostly collapses to a two-point
   distance.** A tour bound prunes `x` only when `x` must belong to `I`'s
   region, which (Lemma B) means `x` is a door of `I` or `J`. Then `x` merges
   into one terminal, and the "tour" through `M = x ∪ I` and `J` reduces to a
   pairwise check. **Pinned door starve:** the door loses `k` when `M` cannot
   reach `J` within the `k - |M| - |J|` open cells left. If `I` cannot reach
   `J` at all, the branch is dead. `[fuzz]` 0 violations, 280-337 removals per
   4000 states. Those removals are **not** measured against the shipped rules,
   so how many are new is unknown. A true three-point tour would need three
   mutually pinned islands. I did not look for that case.

**Answer for #278 §5:** the ordering chains do not revive the tour bound. If any
tour-like rule is ever built, it is the pin walk plus pinned door starve, a
plain-fillomino rule that fortress only feeds through F4. It belongs to its own
ticket and its own `just time` gate, with a firing instance on a real board
first. `[unsure]` whether it is worth it.

---

## Evidence: the scratch check

`fortress-fillomino-deductions/scratch_check.py` (**scratch**: a throwaway
model, not the repo's CP-SAT `model()`, which has no fortress variant yet). Run
with `uv run docs/research/fortress-fillomino-deductions/scratch_check.py`, seed
852, one core, 39 s on this box.

- **Enumeration, exhaustive** over four boards. Each fillomino partition is
  listed once, then filtered by the fortress rule:

  | Board | Digits | Fillomino solutions | Fortress solutions |
  | --- | --- | --- | --- |
  | 3x4 | 1-6 | 4,683 | 215 |
  | 4x4 | 1-5 | 59,951 | 224 |
  | 3x5 | 1-6 | 51,363 | 613 |
  | 4x4 | 1-7 | 179,501 | 1,150 |

  The plain enumerator agrees grid for grid with the repo's own `brute()`
  (`examples/fillomino/generate.py`) on 3x3 at caps 3, 5 and 9 (38, 323 and 445
  grids). The **fortress filter** (`region_colours`) is checked against nothing
  but this note's reading of the rule. That is the one piece no repo model
  backs.
- **Soundness fuzz, sampled, not exhaustive.** 4,000 states per board, drawn
  the way the repo's soundness harness draws them. Pick a random fortress
  solution, place a random 20-60% of its cells, and give every other cell a
  random superset of its true digit. A rule fails when it removes the true digit
  or calls the state dead. F1, F2, F2b, F3, F4, F5, the pin walk and pinned door
  starve: **0 violations** on all four boards. U2: 63 / 359 / 416 / 383
  violations. U3: 0 / 21 / 31 / 15 (3x4 had no digit both ways).
- **Pin semantics, sampled.** 300 random placed-cell subsets per board, every
  consistent solution enumerated. Counts in §3.

## Not verified

- **Cost.** Every cost line is arithmetic, not a measurement. There is no
  component and no `just time` row.
- **The fortress filter** is my reading of the rule. No CP-SAT fortress model
  exists to cross-check it.
- **Boards beyond 4x4 and 3x5.** I did not fuzz any rule on a 9x9 board. The
  proofs carry the claim there.
- **Value.** I did not measure how many of F1-F5's removals the shipped rules
  already make, or which of them fire on a generated fortress puzzle.
