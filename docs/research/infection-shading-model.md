# Modelling derived shading in a SudokuMaker component — survey

**Question (#343, part of #342).** The Zombo Brainanas board ships as a plain
9×9, but infection status is a function of the digits. How should the solver see
it — as a second variable per cell (a 0/1 helper grid the component reads and
writes), or as something recomputed from digit candidates on every `update`?

**Method.** Read the puzzle model and real constraint code, not prose about it.
Every catalog row matching `shad|yin|nurikabe|cave|binary` was resolved through
tinyurl, decompressed per `docs/catalog.md`, and its backend and component code
read in full. The Chris-Tophski community docs were read for the model
(`sudoku_maker/README.md`, `constraints/README.md`, the `functions/` examples).
Local sources: `docs/component-contract.md`, `docs/puzzle-api.md`,
`docs/gotchas.md`, `docs/builtin-components.md`, `docs/advanced-techniques.md`,
`CODING_STANDARDS.md`, `examples/isofill/IsofillComponent.js` and its README,
`examples/_shared/framebuild.py`, and `docs/research/connectivity-techniques.md`.
Claims are tagged `[source]` (I read the code or the project's own docs),
`[docs]` (project prose I did not verify against code), or `[unsure]` (my
inference or proof).

The infection rule as #342 states it, used throughout: a cell is a **patient
zero** iff its digit equals its box number (boxes 1–9 in reading order); each row
and each column holds exactly one patient zero; patient zeros are infected; an
infected cell infects every orthogonally adjacent cell holding a **strictly
smaller** digit; take the closure.

## 1. What the puzzle model actually permits

| Fact | Evidence |
| --- | --- |
| The cell-id space is exactly one rectangular grid, `width × height`, row-major: `id = col + row * width`. | `puzzle.getCellAt(col, row)` is documented as that formula and returns `undefined` off the board (`getIdFromCoordsSafe` in the app bundle). `docs/puzzle-api.md`. `[source]` |
| There is **no** second grid and no addressable cell outside the declared rectangle. The Chris-Tophski docs describe "outside the grid" only as a place to *draw* a clue symbol, never as a cell id. | Community docs, `constraints/README.md`; `helpers.naming.getOuterClueName` and `helpers.geometry.getCellsPointedAtByOuterClue` are both bare `(TODO)` entries with no signature. `[docs]` |
| The digit range is **global**, not per cell: `spec.minDigit`, `spec.maxDigit`, `spec.digitCount` are properties of the puzzle. No per-cell override exists anywhere in the docs or in any example. | Community docs, `sudoku_maker/README.md`; and every decoded link carries `minDigit`/`maxDigit` at the puzzle level. `[source]` |
| So the only way to get helper cells is to **declare a bigger board**. Region id `-1` marks a cell that belongs to no box. | `framebuild.py` already does exactly this in this repo: an `n×n` sudoku ships as a `(n+2)×(n+2)` board whose ring cells carry region `-1`, with `minDigit`/`maxDigit` pinned because "the app otherwise defaults a custom puzzle to 0..9 regardless of grid size". `[source]` |
| `getCellsOrthogonallyAdjacentToCell` does **not** bounds-check the top of the range — "only IDs lower than 0 are not yielded". On a stacked board the bottom row of the upper half is therefore reported as adjacent to the top row of the lower half. | Community docs, `sudoku_maker/README.md`. `[docs]`, but corroborated by every real component filtering its neighbours through an explicit cell set (§2). |

## 2. How the community actually encodes shading

Six catalog rows, all decoded and read. **None** of them keeps a plain 9×9 and
adds hidden solver-side cells, because the model above makes that impossible.

| Row / author | Board it ships | How shading is represented |
| --- | --- | --- |
| **Yin-Yang**, SudokuFan | `type: custom`, **4×4**, `minDigit: 0`, `maxDigit: 1` | The digits **are** the shading. There is no sudoku. The catalog's "uses 0s for unshaded cells and 1s for shaded cells" means the whole puzzle's digit alphabet is `{0,1}`. `[source]` |
| **Snowflake Shading**, Kainapple | plain 9×9 sudoku, digits 1–9 | Shading is never materialised at all. Shade is a *predicate on the digit* (`{1,2,3}` always shaded, `{7,8,9}` never, `{4,5,6}` unknown), and the rule "these two cells share a shade" ships as a built-in `PairComponent` with the JS predicate `(d1,d2) => !(always.includes(d1) && never.includes(d2))`, symmetrised both ways. `[source]` |
| **Stostone**, Chameleon | `type: custom`, 6×6, digits 0–4 | Shading is folded into the digit alphabet: "the largest digit represents an unshaded cell, all other digits represent a shaded cell" and simultaneously encode how far the cell falls. `[source]` |
| **Yajilin**, Chameleon | `type: custom`, **13×13**, digits 0–6 | Two cell *roles* on one enlarged board: "cells that have only 0 and 1 as candidates are lines, cells with 0-6 as candidates are options for the line shape". The role is set by restricting a cell's candidate set inside the global 0–6 range. `[source]` |
| **Chameleon Digits** / **RBC Sudoku**, curlingclips (sample by The Pi Guy / RockyRoer) | `type: custom`, **9 wide × 18 tall** | The helper grid, done properly. See §3 — this is the pattern #343 is asking about. `[source]` |
| **Bishopsgate**, Allagem | plain 9×9 | Shading is pure decoration: a set of `type: 305` cell-colour cosmetics with fixed cell lists. The author paints it; nothing derives it. Not relevant to a derived rule, listed so the row is not mistaken for prior art. `[source]` |

Two idioms worth lifting out of the Yin-Yang code, since it is the closest
*structural* match (whole-grid connectivity over a two-symbol alphabet):

- Its `ConnectedDigitsComponent` filters **every** neighbour through
  `instance.cells_set.has(neighbor)` before using it. That is the guard against
  the unbounded adjacency noted in §1, and it is also how the same component
  serves both "the whole grid" and "just the perimeter". `[source]`
- It runs a recursive Tarjan lowpoint articulation-point pass and then, per
  articulation point, a confirming BFS — the rule
  `docs/research/connectivity-techniques.md` §6 item 3 ranks and #258 measured
  for isofill. So the technique is live in the wild, not just in ISS. `[source]`

## 3. The helper-grid pattern, as Chameleon Digits ships it

This answers #343 questions 1 and 2 directly, from the decoded backend. `[source]`

The board is **9 × 18**, `type: custom`, 162 cells. The region constraint
assigns region ids 0–8 to the standard boxes of the **top** 9×9 and region `-1`
to all 81 cells of the **bottom** 9×9. Rows and columns are then added by hand,
truncated to the top half:

```js
let N = puzzle.spec.size.width;                       // 9
function toHouseComponent (label) {
  return (cells, i) => new HouseComponent(`${label} ${i + 1}`, cells.slice(0, N));
}
let components = [
  ...helpers.geometry.getAllRows().take(N).map(toHouseComponent('row')),
  ...helpers.geometry.getAllColumns().take(N).map(toHouseComponent('column')),
  ...helpers.geometry.getAllPairsWithOffset(0, N).map(toDigitAndValueCellsPair),
];
for (let component of components) puzzle.addConstraintComponent(component);
```

`getAllRows().take(N)` keeps the first nine of eighteen rows; `.slice(0, N)` on
each column keeps its top nine cells. The bottom half gets no house at all, so
its cells are free variables over the same global digit range.

The digit cell and its helper cell are linked by the built-in `PairComponent`:

```js
return new PairComponent(
  helpers.naming.getCellName(digitCell),
  (digit, value) => candidatesFor(digit).includes(value),
  digitCell, valueCell
);
```

Notes on this, all from the decode:

- **`getAllPairsWithOffset(0, N)` takes `(dx, dy)`**, not `(dx, columns)`.
  On a 9-wide/18-tall board with `N = 9` it must pair each cell with the cell
  nine *rows* below. `docs/advanced-techniques.md` §6 currently glosses it as
  "N columns over"; that is wrong for this board and worth fixing. `[source]`
- `PairComponent` is a **built-in** taking an arbitrary JS predicate over two
  digits, or a `DigitSet[]` mapping. It is the sanctioned digit↔helper link, and
  it does full pairwise propagation both directions. `docs/builtin-components.md`
  and the community docs agree on the signature. `[source]`
- The pair link is the *only* coupling. There is no API for a component to read
  one grid and write another beyond this: a component simply lists cells from
  both halves in `getAffectedCells` and yields removals against either. Cell ids
  from the two halves are indistinguishable to the API. So **#343's question 2 is
  yes, unconditionally** — there is only ever one cell-id space. `[source]`

**The catch for #342.** A 9×18 board is a visibly 9×18 board. Nothing hides the
helper half: no `type: custom` puzzle can declare cells the UI does not draw, and
the map's stated constraint is "shipped puzzle is a plain 9×9". A helper grid is
therefore *not* solver-side only — it is a second visible grid the solver's
audience has to look at and, worse, can type into. Chameleon Digits and RBC
accept exactly that: their published boards show both halves. `[source]`

Two consequences if the helper grid is chosen anyway:

- **Do not use digit 0 for "uninfected".** Setting `minDigit: 0` makes
  `digitCount` 10, and `HouseComponent` is documented as "every digit exactly
  once", which nine cells cannot satisfy over ten digits. Keep `minDigit: 1` and
  spend digits `1`/`2` on uninfected/infected in the helper half, pinned by
  `PredefinedCandidatesComponent`. `[unsure]` — the failure mode is inferred from
  the documented semantics of `HouseComponent`, not observed; Yajilin's
  candidate-restriction idiom (§2) is the observed half of it.
- **Guard every neighbour lookup with an explicit cell set**, per §1 and the
  Yin-Yang idiom. On a stacked board, row 8 of the digit grid reports row 9 of
  the helper grid as an orthogonal neighbour.

## 4. No helper grid: what a component can soundly conclude

Without helper cells the only writable variable is the digit, and infection has
to be recomputed from candidates on every call. Write `lo(c)` and `hi(c)` for the
min and max remaining candidate of cell `c`, `box(c)` for its 1-based box number,
and `cand(c)` for its candidate set. A *completion* is any full digit assignment
inside the current candidates. All of §4 is `[unsure]` — it is my analysis, with
the shape borrowed from ISS's `ConnectedValues`, which is the nearest public
precedent for shading as a function of digits
(`docs/research/connectivity-techniques.md` §2).

### 4.1 Definitely infected — `I⁻`, a lower bound

`I⁻` must mean "infected in **every** completion".

*Seeds.* `c ∈ I⁻` if `cand(c) = {box(c)}` — the cell is solved to its box number,
so it is a patient zero in every completion. One more seed comes free from the
row/column rule: in a row where every cell but one has `box(c) ∉ cand(c)`, the
survivor is a patient zero in every completion, which both puts it in `I⁻` **and**
forces its digit to `box(c)` — a hidden-single that yields real removals.

*Propagation.* If `u ∈ I⁻`, `v` is orthogonally adjacent to `u`, and
`hi(v) < lo(u)`, then `v ∈ I⁻`. Sound because `digit(v) ≤ hi(v) < lo(u) ≤ digit(u)`
holds in every completion, and `u` is infected in every completion.

*Fixed point.* Monotone growth over 81 cells: one BFS to closure, `O(V + E)`.

### 4.2 Definitely uninfected — `U⁻`, via a possibly-infected superset

Do not compute `U⁻` directly. Compute `P ⊇ infected(completion)` for every
completion, then `U⁻ = allCells \ P`.

*Seeds.* `c ∈ P` if `box(c) ∈ cand(c)`.

*Propagation.* If `u ∈ P`, `v` adjacent, and `lo(v) < hi(u)`, then `v ∈ P`.

*Soundness.* By induction on the true infection closure of any completion: a
patient zero there has `digit = box`, so `box ∈ cand`; and if `u` is infected and
`digit(v) < digit(u)` then `lo(v) ≤ digit(v) < digit(u) ≤ hi(u)`, so the edge is
admitted. Hence `U⁻` is uninfected in every completion.

*Two useful specialisations of the same rules, worth naming because they fire
often and cost nothing:* the digit 9 is maximal, so **an infected 9 is always a
patient zero and therefore always in box 9** — every 9 outside box 9 is in `U⁻`
the moment it is placed. Symmetrically, a 1 adjacent to any cell of `I⁻` whose
`lo > 1` joins `I⁻`.

### 4.3 The path-consistency refinement of `P`

Plain `P` admits each edge independently, so it accepts a chain that no single
completion realises: infection travels along a **strictly decreasing** digit
sequence, and testing `lo(v) < hi(u)` edge by edge forgets that. Tighten it by
carrying the bound along the walk. Define `b(c)` = the largest digit `c` could
hold and still be infected by some admissible chain:

- seed: `b(c) = box(c)` when `box(c) ∈ cand(c)`, else `−∞`;
- relax: for `u → v` adjacent, `b(v) ← max(b(v), min(hi(v), b(u) − 1))`;
- `c ∈ P` iff `b(c) ≥ lo(c)`.

Values are bounded by 9, so this is a bucketed relaxation over nine levels —
process cells in decreasing `b`, Dial's algorithm, still `O(V + E)`. It is
strictly stronger than §4.2 and sound for the same reason: every completion's
infected cell has *some* real decreasing chain, and that chain satisfies every
relaxation step.

### 4.4 Where these go weak

- **`I⁻` cannot case-split.** A cell infected in every completion but by a
  *different* neighbour in different completions is missed: the rule needs one
  witness `u` that dominates in all completions. This is the dominant gap.
- **`I⁻`'s seeds are almost only solved cells.** Until a cell is pinned to its
  box number, or the row/column rule squeezes a whole line, nothing seeds.
- **`P` ignores the sudoku houses.** Candidates are treated as independent per
  cell; the closure never uses "these two cells are in the same box so cannot
  both be 4". Every declarative solver in `connectivity-techniques.md` gets this
  for free from the SAT/SMT model. We do not.
- **`P` over-admits branching.** §4.3 fixes single chains but two chains reaching
  the same cell are still combined optimistically.
- **`U⁻` is a complement, so it only tightens when `P` shrinks** — which happens
  late, since `P` starts as "almost everything".

### 4.5 The conversion problem — the real cost

Neither set is directly useful. The component can only yield candidate removals,
so every shading conclusion has to be re-expressed as a digit elimination. Under
Zombo (infected groups are rectangles) and Brainana (uninfected groups are not),
the natural deduction is geometric: "three cells of this 2×2 are in `I⁻`, so the
fourth must be infected too, else the group is not a rectangle". But *"must be
infected"* is not a writable fact. Turning it into a removal means, for the cell
`x`: drop every candidate `d ∈ cand(x)` for which no neighbour of `x` can
simultaneously be in `P` and hold a digit `> d`. That is a per-cell,
per-candidate hypothetical — and each hypothetical strictly speaking wants its
own closure re-run to be tight.

Under a helper grid the same deduction is one candidate removal on
`helper(x)`, and it propagates onward through the ordinary components.

## 5. Cost

Anchor from a measured whole-grid component in this repo: isofill's `update`
runs **508 ms over 3000 calls ≈ 0.17 ms per call** on a 100-cell board, of which
cut's per-open-cell re-walks are 36–45%; the remaining ~0.09 ms covers ten
whole-grid digit walks plus every other rule. So **one whole-grid BFS over ~100
cells costs on the order of 0.01 ms** in this engine.
(`examples/isofill/README.md` § Cut profile, #170.) `[source]`

| Approach | Per-`update` work | Estimate |
| --- | --- | --- |
| **No helper grid**, §4.1 + §4.3 only | one global component over all 81 cells; any candidate change anywhere re-runs it; two closure passes, `O(V + E)` with `V = 81`, `E ≈ 144` undirected | ~0.02–0.03 ms per call. Cheap — comparable to two isofill digit walks. `[unsure]` |
| **No helper grid**, plus §4.5 hypotheticals | up to `81 × 9 = 729` per-candidate re-closures | ~7 ms per call, ~250× the base sweep. Not affordable at every search node; this is the same verdict `connectivity-techniques.md` §6 item 5 reached for cross-digit confinement. `[unsure]` |
| **Helper grid** | 81 small components, each over one helper cell + its digit cell + ≤4 neighbour pairs = ≤10 cells; the solver re-runs only components whose `getAffectedCells` changed | `O(1)` per firing, and **incremental** — the scheduler does the closure for us across the propagation loop instead of us re-deriving it whole. `[source]` for the scheduling (`docs/component-contract.md`: "The solver re-runs `update` when any of them changes"); `[unsure]` for the arithmetic. |

The incrementality is the real asymmetry, not the constant factor. A single
global component has one coarse trigger — everything — so it pays the full sweep
for a one-candidate change in a far corner. `docs/research/133-skip-unchanged.md`
and the `instance.sig` memo pattern exist precisely to claw that back, and #133
measured a whole-component signature skip on skyscraper and did **not** ship it.

## 6. One structural fact that makes the helper grid cheap here

Yin-Yang and Nurikabe need a *global* connectivity component because "this cell
is shaded" is supported by an arbitrary connected blob, and blobs admit cycles.
Infection does not. The local biconditional

> `infected(v)` iff `digit(v) = box(v)` **or** some orthogonal neighbour `u` has
> `infected(u)` and `digit(u) > digit(v)`

has a **unique** solution, so no global closure component is needed to pin it
down. Proof: suppose a set of cells were mutually self-supporting in a cycle
`v₁ ← v₂ ← … ← v_k ← v₁`. Each support step requires a strictly larger digit, so
`digit(v₁) < digit(v₁)`. Contradiction. Every `infected` cell therefore has a
well-founded support chain ending at a patient zero, which is exactly the least
fixed point — the intended semantics. `[unsure]` — my proof, but it rests only
on the strictness of "smaller digit" in gdc's rule as #342 quotes it.

That decomposes the whole puzzle into four independent, all-local pieces:

1. **digits** — ordinary sudoku on the upper half (houses truncated per §3);
2. **patient zeros** — exactly one cell per row and per column with
   `digit = box`; a digit-only constraint;
3. **infection** — one component per cell over `{v, helper(v)}` and its ≤4
   neighbours' digit and helper cells, enforcing the biconditional above;
4. **Zombo / Brainana / Cluster** — components over the helper half alone, where
   the rectangle, non-rectangle and group-size rules are ordinary shading rules
   and isofill's reach/cut/cap machinery transfers directly.

Piece 4 is the reason a helper grid is attractive: without one, every rectangle
and cluster deduction has to be laundered through §4.5.

## 7. Recommendation

**Build the closure-recomputation model (§4), not the helper grid — but build it
in two layers, and keep §4.5 out of the hot path.**

Reasons, in order of weight:

1. **The helper grid contradicts the shipped-board requirement.** #342 says the
   shipped puzzle is a plain 9×9. §1 and §3 establish that a helper grid means a
   9×18 board, visibly, with 81 extra cells a solver can type into. That is not a
   solver-side detail; it is a different puzzle. If the requirement is firm, the
   helper grid is out on grounds that have nothing to do with propagation.
2. **The base sweep is genuinely cheap** — two `O(V + E)` passes over 81 cells,
   ~0.02 ms, an order of magnitude under isofill's shipped `update`. Nothing in
   the cost table argues against it.
3. **The strength gap is real but bounded.** §4.1 and §4.3 are strictly weaker
   than helper-cell propagation, chiefly because `I⁻` cannot case-split (§4.4).
   `CODING_STANDARDS.md` is explicit that a weak deduction is acceptable and an
   unsound one is not, and the generator's job is to find puzzles the shipped
   rules close. If the generator cannot hit 3-star, that is the moment to revisit
   — not before.

Concretely, for the first `ZomboBrainanasComponent`:

- One global component over all 81 cells, registered from `main.js` the way
  isofill does. `getAffectedCells` returns every cell.
- Per `update`: compute `I⁻` (§4.1, one BFS) and `P` via the bucketed bound
  (§4.3, one nine-level Dial pass). Guard every neighbour lookup with an explicit
  cell set (§1).
- Yield only the **direct** removals: the row/column patient-zero hidden single
  (§4.1), the 9-outside-box-9 rule and its kin (§4.2), and any digit whose
  placement would put a cell in `I⁻` and `U⁻` at once.
- Put the geometric rules (Zombo rectangle, Brainana non-rectangle, Cluster size)
  in `validate` **first**, as the exact leaf check on `I⁻ ∪ P` once the grid is
  full, then promote them into `update` one at a time, each behind its own
  `just time` row per `CODING_STANDARDS.md`. Do **not** ship the §4.5
  per-candidate hypothetical; it is ~250× the base sweep and it duplicates what
  the app's own DFS does at the next node — the same verdict
  `connectivity-techniques.md` §6 reached for cross-digit confinement.
- Fuzz `I⁻` and `P` against the true solution in the soundness harness: assert
  the solution's real infected set contains `I⁻` and is contained in `P`. That
  is the assertion that catches an off-by-one in the bound relaxation, which is
  where I expect the bug to be.

Fall back to the helper grid only if #342 relaxes the plain-9×9 requirement.
Should it, §6 says the fallback is unusually clean for a shading genre: the
infection biconditional is acyclic, so the helper half needs no global
connectivity component — a fact that does **not** hold for Yin-Yang, Nurikabe or
Cave, and is the one place infection is easier than its neighbours.

## 8. API facts found along the way

Worth folding into `docs/puzzle-api.md` and `docs/advanced-techniques.md`
separately from this research; recorded here so they are not lost.

| Item | Finding | Tag |
| --- | --- | --- |
| `helpers.geometry.getAllPairsWithOffset(dx, dy)` | Arguments are a coordinate offset. `advanced-techniques.md` §6 describes it as "N columns over"; on Chameleon Digits' 9×18 board `(0, 9)` must mean nine rows down. | `[source]` |
| `puzzle.getCellsOrthogonallyAdjacentToCell(cell)` | Yields adjacent ids **without an upper bounds check** — "only IDs lower than 0 are not yielded". Filter through your own cell set. | `[docs]` |
| `puzzle.removeCandidateFromCells(digit, cells)` | Used by Yin-Yang's shipped component; the community README lists only `removeCandidateFromCell` / `removeCandidatesFromCells`. The plural-cells/singular-digit form is real. | `[source]` |
| `puzzle.replaceComponent(instance, components)` | Yin-Yang's `NonEvenByEvenThirdSecret` yields an **array** of replacement components. The community docs show only the single-component form. Built-in targets in both cases, consistent with gotcha #1. | `[source]` |
| `helpers.cellIds.getAllCellIds` / `getIdFromCoords` | Used by shipped catalog constraints (Snowflake, Yin-Yang) and by this repo, but absent from the community docs entirely — the `cellIds` namespace is undocumented there. | `[source]` |
| `puzzle.width` / `puzzle.height` / `puzzle.digitCount` / `puzzle.minDigit` / `puzzle.maxDigit` | Bare top-level shortcuts, used throughout Yin-Yang's backend. Community docs document only the `puzzle.spec.*` nesting. | `[source]` |
| `IterationUtils.getCombinations(arr, k)` | Used by Snowflake Shading's shipped backend. Absent from the community docs. | `[source]` |
| `helpers.geometry.getAllRows()` / `getAllColumns()` | Return an iterator with `.take(n)`, and cover **every** row of the declared board, not just a sudoku's nine. | `[source]` |
