# Advanced techniques for stronger constraints

The `component-contract.md` and `puzzle-api.md` docs cover the baseline: a
component defines `setParams`/`update`/`validate`, and `update` yields candidate
removals. This doc collects the techniques that go past that baseline — the ways
a custom constraint can prune more, deduce more, or model a harder rule.

Every technique here is read from shipped constraint code by **curlingclips**,
decoded from the catalog links (see `catalog.md`; resolved links cached in
`curlingclips-links.json`). The API names are exactly as they appear in that
code. Much of it is **undocumented and version-dependent** — the deepest tricks
reach into private solver state and match built-in components by name, so an
engine update can break them without warning. Each risky technique is flagged.
Tag: **[decoded]** — observed in working shipped code, not run by us.

One contract note up front: none of these constraints define `validate`. They
detect a contradiction inside `update` by yielding `puzzle.stop(message)`. Treat
`puzzle.stop` as the in-`update` validity gate. **[decoded]**

## 1. Hijack a built-in component, then re-skin it

The most-reused trick. Read the live list of built-in components the author
already placed, filter by type and name, remove them, and add a stronger custom
component built from their data. The author draws a normal killer cage or Kropki
dot in the UI; your code silently upgrades what it means.

```js
// Semi-Killer Cages: pull the built-in SumComponents, read their data, swap
let sums = [...puzzle.state.constraintComponents]
  .filter(c => c instanceof SumComponent && c.name.startsWith("the killer cage at"));
for (let s of sums) {
  let { cellIds: cells, minSum, sums } = s.getComponents(puzzle);   // read built-in internals
  puzzle.state.removeConstraintComponent(s);
  puzzle.addConstraintComponent(new SemiKillerCageComponent(name, cells, { sum: minSum ?? sums[0] }));
}
```

Used by Ambiguous/Anti-Quadruples, Semi-Killer, Rellik, Hidden Sum Killer Cages,
First Seen Odd/Even, RBC, repeat-allowed killers, Kropki/XV regional negative,
Counting Circles 2.0. Related reach-ins: `puzzle.state.houseConstraintComponents`,
`puzzle.state.getConstraintComponentsAt(cell)`, and — the deepest — scrubbing
`puzzle.state.candidateSetMap.map.values()` to drop a built-in's cached
candidate sets.

**Fragile.** Everything here is private state: `puzzle.state.constraintComponents`,
`.candidateSetMap.map`, `removeConstraintComponent`, `getComponents`, and the
string match on `.name` (`"the killer cage at"`, `"quadruple at"`,
`"numbered room"`). A rename of any built-in breaks it silently.

## 2. `replaceComponent` as a state machine

A component can replace itself with a fresh copy that carries accumulated state,
and at the same time emit built-in components for facts it has proven. The custom
constraint becomes an incremental deducer, and each fact it learns becomes a
first-class constraint the rest of the engine propagates.

```js
// Quad Sums: replace self with a tighter self, plus a RequiredDigitsComponent for the new fact
function transitionTo (instance, puzzle, requiredDigits) {
  let added = new DigitSet(requiredDigits).subtract(instance.requiredDigits);
  return puzzle.replaceComponent(instance, [
    new customComponents.QuadSumComponent(instance.name, instance.cells, instance.isNegative, requiredDigits),
    new RequiredDigitsComponent(`${instance.name} [${[...requiredDigits]}]`, [...added], instance.cells),
  ]);
}
```

The simpler form is a **one-way collapse**: once a value or an ordering settles
the rule, replace the fuzzy custom component with a cheaper built-in and stop
re-scanning. Clock Faces collapses to `GreaterThanComponent`s, Ziffer to
`DifferenceComponent`, Rossini to `GreaterThanComponent`, X-Sum Arrows to
`SameSumComponent`. Reach for `transitionTo` when re-scanning is expensive and
you want to bank partial deductions; reach for one-way collapse when the rule
reduces to a primitive.

Note the Running Start gotcha still holds: `replaceComponent` with a *custom*
target that is not built-in does nothing (see `gotchas.md`). These collapses work
because they target built-ins, or re-register through `addConstraintComponent`.

## 3. Enumerate every legal filling (generalized arc consistency)

Instead of pairwise pruning, generate every legal tuple over the constraint's
cells, keep the valid ones, and project the surviving values back per cell. This
is full arc consistency on the sub-grid — much stronger than removing one
candidate at a time. It is cheap only on small cell sets (quads, triplets).

```js
// Quad Sums: recursive generation with per-position repeat legality, then union per cell
function* allFillings (values = []) {
  let cell = cells[values.length];
  if (cell === undefined) { yield [...values]; return; }
  for (let d of puzzle.getCandidates(cell)) {
    if (values.every((v, i) => v !== d || getCellsCanHaveRepeats([cell, cells[i]]))) {
      values.push(d); yield* allFillings(values); values.pop();
    }
  }
}
let unions = cells.map(() => new DigitSet());
for (let vals of [...allFillings()].filter(isLegalQuad)) vals.forEach((v, i) => unions[i].add(v));
yield* unions.map((u, i) => puzzle.filterCandidatesInCell(u, cells[i]));   // GAC projection
```

The same loop gives two more facts for free: the **intersection** across all
valid tuples is the set of forced digits, and sorting cells by candidate count
before enumerating prunes early. Used by Quad Sums, XY-Difference Pairs,
Ambiguous Quadruples, X-Sum Arrows.

## 4. Negative constraints by enumerating every placement

"Supports negative constraint" needs no special engine support. Enumerate every
geometric position the clue could occupy, subtract the given (positive) ones, and
add a negative component to each empty spot.

```js
// "all quads except the marked ones"
function negativeQuads () {
  return ArrayUtils.withoutAll(
    helpers.geometry.getAllQuadruples().map(q => q[0]),
    input.groups.flatMap(g => g.cells));
}
```

The strongest case is Negative Killer Cages: it grows **all polyominoes** of the
relevant sizes by orthogonal adjacency (dedup by sorted key), skips the exclusion
zone, and wraps each in `RepeatDigitOrElseComponent(new NegativeSumComponent(...))`
— a negative sum that only bites when the digits do not repeat. Kropki/XV
regional negative does the same over `helpers.geometry.getAllDominoes()`. Reach
for this whenever the rule is "all X are given."

## 5. Cross-constraint interaction deductions

Deduce from the overlap of two constraints, not from either alone. Ambiguous
Quadruples reasons over pairs of quads that share cells and applies a pigeonhole
count on the shared cells and digits.

```js
for (let pair of IterationUtils.getCombinations(quads, 2)) {
  let [cells1, cells2] = pair.map(q => new Set(q.cells));
  let shared = cells1.intersection(cells2);
  if (shared.size === 0) continue;
  let union = cells1.union(cells2);
  let sharedDigits   = new DigitSet(digits1).intersect(digits2);
  let unsharedDigits = new DigitSet(digits1).union(digits2).subtract(sharedDigits);
  let cantFit = sharedDigits.size > shared.size                       // too many digits for shared cells
             || unsharedDigits.size > union.size - shared.size;
  if (cantFit) yield new ForbiddenCandidatesComponent(/* … */, sharedDigits, [...shared]);
}
```

Reach for this when many similar constraints coexist and their overlaps carry
information — quads, cages, arrows. It is hand-rolled two-constraint consistency.

## 6. Dual "digit vs value" cells (modifiers / Schrödinger)

Chameleon Digits and RBC model a second variable per cell — the cell's *value*,
separate from its *digit* — by treating a shifted copy of the grid as the value
grid and linking each digit cell to its value cell with a `PairComponent`.
Per-cell context variables `{R, C, B, i}` (row, column, box, index-in-box,
1-based) drive the mapping.

```js
function toVars (cell) {
  return { R: 1 + puzzle.getRow(cell), C: 1 + puzzle.getColumn(cell),
           B: 1 + puzzle.getRegion(cell),
           i: 1 + puzzle.getRegions()[puzzle.getRegion(cell)].indexOf(cell) };
}
function pairFor ([digitCell, valueCell]) {
  let vars = toVars(digitCell);
  let valuesFor = d => Array.from(chameleons[d] ?? [d]).map(s => vars[s] ?? +s);
  return new PairComponent(name, (digit, value) => valuesFor(digit).includes(value), digitCell, valueCell);
}
// pair each cell with its value cell N columns over:
...helpers.geometry.getAllPairsWithOffset(0, N).map(pairFor)
```

Reach for the dual-cell trick to model "each digit carries an associated
value/modifier." A component that threads a shrinking possibility set through
`transitionTo` is the general Schrödinger mechanism.

## 7. `initialize` for one-time work

`initialize` runs once, before any `update` cycle. Use it for anything geometric
or combinatorial that does not change as candidates shrink: precompute
reachability sets (Treasure Line caches Manhattan neighbors by distance),
compute feasible clue values from extreme-sum bounds once (X-Sum Arrows), or
promote immediately when the geometry already decides the rule (Negative Killer
Cages: `if (puzzle.getCellsSeeEachOther(cells)) replaceComponent(...)`).

## 8. House-complement reasoning ("outies force digits")

A digit is required inside a set when the rest of its house cannot hold it.
Compute the house-minus-my-cells complement and read forced digits from it.

```js
// digits the region cannot place outside the quad are required inside it
function requiredFromRegion () {
  return helpers.digits.createFullDigitSet().subtract(
    instance.regionCellsMinusQuad.map(c => puzzle.getCandidates(c)).reduce((a, b) => a.union(b)));
}
```

Counting Circles 2.0 pushes this to **house-capacity counting**: for each digit
it counts how many houses could host a circled copy; if the capacity is below the
digit, the digit is forbidden; if exactly the digit-many houses remain, they are
forced. Used by Quad Sums, Ambiguous Quadruples, Rellik, Counting Circles.

## 9. Bounds propagation, then collapse to an inequality

For ordering rules, compare the extreme candidates of two cells to decide a fixed
inequality, then replace the fuzzy component with a concrete built-in.

```js
// Rossini / Triplet: if one cell's max <= another's min, the order is forced
for (let [a, b] of [[1,0],[1,2],[0,1],[2,1]])
  if (candidates[a].getLargestDigit() <= candidates[b].getSmallestDigit())
    yield puzzle.replaceComponent(instance, GreaterThanComponent.of(cells[2 - a], cells[2 - b]));
```

X-Sum Arrows bounds achievable sums with
`helpers.sums.getExtremeSumsWith/WithoutRepeat(candidates)` (`{minSum, maxSum}`)
and clamps against the pill's range. This is the same family as the Running Start
example's own min/max run bounds — the general move is: compute a bound from the
candidate extremes, then prune or collapse.

## 10. Counting and quota pruning ("exactly N of …")

Model "exactly K distinct digits among N cells" with two cooperating components:
a per-cell `DeferredExactDigitCountComponent` that defers to
`ExactDigitCountComponent` once its cell has a value, plus one grid-wide quota
component.

```js
// once the digit budget is exactly spent, lock the grid to those digits
if (usedDigits.size > quota) { yield puzzle.stop(`${name} exceeds digit quota`); return; }
else if (usedDigits.size === quota) {
  yield puzzle.filterCandidatesInCells(usedDigits, cells);
  yield puzzle.removeComponent(instance);
}
```

Used by the Octoquadri / Mean Mini family and Equality Cages (a quota per label
group — lows/highs, odds/evens).

## 11. The utility layer these rest on

The tricks above are tractable because of a fluent set-algebra and geometry API.
Reach for these instead of hand-rolling:

- **DigitSet**: `union`, `intersect`, `subtract`, `isSubsetOf`, `isDisjointFrom`,
  `equals`, `has`, `size`, `getLargestDigit()`, `getSmallestDigit()`; factories
  `helpers.digits.createFullDigitSet()`, `createFilteredDigitSet(pred)`,
  `createOddsDigitSet()`, `createEvensDigitSet()`, `DigitSet.from(array)`.
- **Native `Set`**: `intersection`, `union`, `difference`, `isSubsetOf`.
- **IterationUtils**: `getCombinations(arr, k)`, `getRangeInclusive(a, b)`, `getOne(set)`.
- **helpers.geometry**: `getAllQuadruples`, `getAllDominoes`,
  `getAllDiagonallyAdjacentPairs`, `getOrthogonallyAdjacentCells`,
  `getCellsInDiagonal`, `getManhattanDistanceBetweenCells`,
  `getAllPairsWithOffset(dx, dy)`, `getCellsPointedAtByOuterClue`,
  `getCellsTouchingEdge`.
- **helpers.sums**: `getCombinationsForSumWithoutRepeat`,
  `getCombinationsForSumsWithoutRepeat`, `getExtremeSumsWith/WithoutRepeat`.
- **helpers.lines**: `getAllPairsAlongLines`, `getCellGroupsFromLines`.
- **ArrayUtils**: `withoutAll`, `withoutDuplicates`, `includesSome`.

`filterCandidatesInCell(set, cell)` / `filterCandidatesInCells(set, cells)` keep
only the listed candidates — the inverse of `removeCandidatesFromCell`, and the
natural output of an enumeration.

## 12. Multi-digit numbers via `SameSumComponent` weights

`SameSumComponent` accepts weighted parts and an `asNumber` flag, so you can
equate a multi-digit number with a sum — the mechanism behind pills and hidden
two-digit clues.

```js
// Hidden Sum: the two pill cells (weights 10, 1) form a number equal to the cage sum
{ name: `pill`, cells: pills, weights: weightsByIndex(pills, [10, 1]) },
{ name: `cage`, cells: cages.flat(1) }        // both parts equal => hidden sum
```

Used by Hidden Sum Killer Cages, Arrows+, X-Sum Arrows.

## Export hooks (authoring, not solving)

Two hooks recur and are worth knowing:

- **`postprocessJSON(json, input, helpers, puzzle)`** with `Api.updatePuzzle`
  auto-generates cosmetics and input groups by reading other constraints on the
  board — e.g. Candy Dots reads a disabled Difference constraint to build its
  colored dots. First Seen's version even pads the whole grid (offsetting cells,
  cages, lines, fog, and the solution).
- **`issExport(input, api, puzzle)`** emits the constraint to the sudokucolors
  ISS format through `And`/`Or` builders. Bounce Lines is notable: it expresses
  the rule as a **state machine** (`api.addStateMachine` with
  `startState`/`transition`/`accept`/`maxDepth`) — a more expressive primitive
  than pairwise components.

## Fragility ledger

Techniques 1 and 2 depend on internals that an engine update can break:

- Private state: `puzzle.state.constraintComponents`,
  `puzzle.state.candidateSetMap.map`, `removeConstraintComponent`,
  `houseConstraintComponents`, `getConstraintComponentsAt`,
  `component.getComponents(puzzle)`, and fields like
  `component.cellIds` / `values` / `minSum`.
- Name coupling to built-ins: `"quadruple at"`, `"the killer cage at"`,
  `"the cage at"`, `"numbered room"`.
- `instanceof` on built-in globals: `RequiredDigitsComponent`, `SumComponent`,
  `DifferenceComponent`, `IndexComponent`, `HouseComponent`, `RatioComponent`,
  `NegativeSumComponent`.

Prefer the public `puzzle`/`helpers` API when a technique does not truly need the
internals. When it does, isolate the reach-in behind one named helper so a future
break has one home to fix — see `CODING_STANDARDS.md`.
