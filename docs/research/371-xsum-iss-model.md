# How ISS models X-sums (issue #371)

Read against `~/src/iss-stuff/Interactive-Sudoku-Solver` commit
`ed5688d50b39746cada47b8ef9fce904dfb33bc5`, per the reading process in
`docs/agents/iss.md`.

Most of the builder-level decomposition here is already documented in
`docs/research/190-one-sided-clues-ties-non-house-lines.md` §4 and its closing
table. This note answers the five questions #371 asks, adds the one thing #190
did not need — the runtime state the generic `Or`/`And` handlers propagate —
and closes with what transfers to Up to N.

## 1. How ISS models X-sums

ISS does not give X-sum its own handler. `SudokuBuilder` expands the `XSum`
constraint into a disjunction of fixed-length cases at **build time**, before
solving starts (`js/solver/sudoku_builder.js:566`, quoted in #190 §4):

```js
case 'XSum': {
  const cells = constraint.getCells(geometry).map(c => geometry.parseCellId(c).cellIndex);
  const sum = constraint.value;
  const controlCell = cells[0];
  if (sum === 1) { yield this._givenHandler(controlCell, 1); break; }
  const branches = [];
  for (let i = 2; i <= cells.length; i++) {
    const sumRem = sum - i;
    if (sumRem < 0) break;
    branches.push([
      this._givenHandler(controlCell, i),
      new SumHandlerModule.Sum(cells.slice(1, i), sumRem),
    ]);
  }
  yield* this._yieldOr(branches);
}
```

One branch per candidate length `i` (2..cells.length, capped once `sum - i <
0`). Each branch is an `And` of two ordinary handlers: `GivenCandidates`
pinning the control cell to `i`, and a plain `Sum` over `cells[1..i-1]`
targeting `sum - i` (the control cell's own value `i` is part of the sum, so
the remaining `i-1` cells must make up the rest). `_yieldOr` (line 1096)
wraps the branch list in a generic `Or` handler, or short-circuits to `And`/
`False`/pass-through when there are 0 or 1 branches. `sum === 1` is a
degenerate one-cell case handled as a bare given, skipping `Or` entirely.

So "how ISS models X-sums" is: **it doesn't model X-sums** as a domain
concept past construction. It compiles the rule into generic disjunction-of-
conjunction search structure and hands the actual arithmetic to the existing
`Sum` handler.

## 2. What state it propagates

Two layers of state, since two different handlers are involved.

**The `Or` handler's own state** (`js/solver/handlers.js:4057`) is a per-node
bitmask tracking which branches are still possibly valid, plus a fast path
once only one is left:

- `state[0]`: either a live count of remaining valid branches, or — once only
  one remains — a flag (`_FLAG_FINAL = 1<<15`) OR'd with that branch's index.
- `state[1..]`: one bit per branch, packed 16 per word, set while the branch
  has not yet been proven invalid.

On each `enforceConsistency` call, every still-valid branch is replayed on a
scratch copy of the grid (`this._scratchGrid`); a branch that returns
`false` is marked invalid via `_markAsInvalid`, which decrements the live
count and, on hitting exactly one survivor, calls `_setFinalHandler` to find
and record which branch index survived. The result grid the caller sees is
the **bitwise OR of every surviving branch's candidate sets**
(`resultGrid[j] |= scratchGrid[j]`), i.e. the union of what each remaining
length says is possible — not an intersection, not a sum. Once collapsed to
one final handler, subsequent calls skip the fan-out and enforce that
handler directly (`grid[stateOffset] & _FLAG_FINAL` check at the top of
`enforceConsistency`).

**Each branch's `Sum` handler state** is the ordinary aggregate from
`handler_docs/sum.md` §2.2–2.3: per-group `minSum`/`maxSum`/`fixedSum`/
`numUnfixed`, recomputed from the cell candidates on every call — no
persisted DP table, no memory of prior calls beyond what is already encoded
in the grid's candidate sets.

So the propagated state is: *which lengths are still alive* (the `Or`'s
bitmask) crossed with *is this length's remainder sum still reachable* (each
branch's live min/max interval, recomputed fresh).

## 3. Subset DP, or bounds?

Bounds, at both layers. The `Or` handler does no subset search of its own —
it just replays each of the `O(n)` branches and unions the results. The
`Sum` handler inside each branch is itself the interval-bounds propagator
from `handler_docs/sum.md` §3–4 (`sum < minSum or maxSum < sum` feasibility
check, then per-cell range tightening by slack), not the exact-subset path
(§6–7, `killerCageSums`), which only activates for very small unfixed-cell
counts or an attached exact-cage constraint — neither applies here since a
plain `Sum` handler is what each branch constructs. There is no DP table
indexed by "sum achievable using the first k cells" anywhere in this path;
the fixed-length **case split** is doing the work a subset DP would do in a
single-handler design, at the cost of replaying every candidate length on
every propagation call.

## 4. How it handles the first-cell digit that fixes the length

It doesn't gate on the first cell's value at solve time at all — it forks
the search **at construction time**, once, before any solving happens. Every
legal value `i` of the control cell becomes its own branch, each carrying a
`GivenCandidates` handler that pins the control cell to exactly `i` inside
that branch's scratch grid (`this._assignInitializations`, called before
each branch's `enforceConsistency`). The real grid's control cell is never
directly constrained to a length by this handler; the `Or`'s union of
surviving branches is what narrows it, indirectly, as branches die.

This is also why `sum === 1` short-circuits to a bare given: with only one
possible length (`i = 1`, an empty remainder), there is nothing to branch
over.

## 5. What transfers to Up to N

Up to N's length is fixed by the position of the **first occurrence of a
known digit D**, not by the value written in the first cell — so the
control-cell-as-length-selector trick (§4 above) has no direct analogue: no
single cell's value enumerates the candidate lengths, the *position* of a
value along the line does.

What still transfers:

- **The case split, not the branch mechanism.** ISS's real move is compiling
  "the length is unknown but ranges over a small set" into one
  bounds-interval check per candidate length, unioned. That idea ports even
  though SudokuMaker has no `Or`/`And` handler to build it out of (#190's
  table already says this: "SudokuMaker has no `Or` handler" — confirmed
  again here from the runtime side, not just the builder side).
- **Bounds over exact subset search.** Nothing here justifies reaching for a
  subset-sum DP; ISS gets useful propagation from min/max sum aggregates
  alone, recomputed per call, for the same shape of problem (sum over a
  prefix of unknown length).

What does not transfer, and is the actual design gap Up to N has to close
that ISS ducked: ISS's branches are independent and re-verified from
scratch every call, which is only affordable because `Or` is a generic
engine primitive amortizing the replay cost across every constraint type.
SudokuMaker's `update` runs once per component per call with no such
scaffold, so a direct port would mean each `update` re-deriving, in one
pass, both (a) which candidate positions can still be the first occurrence
of D, and (b) for each such position, whether the resulting prefix sum
range still admits the target.

### Candidate DP state for Up to N

A single running structure per call, keyed by candidate length `i` (the
line position where D could first occur):

```
for each i where digit D can still first-occur at position i:
    reachable[i] = true iff no cell before i is forced to D
                   and D remains a candidate at i
                   and minSum(cells[0..i]) ≤ target ≤ maxSum(cells[0..i])
```

`minSum`/`maxSum` over the prefix can be accumulated incrementally as `i`
grows (running totals, same shape as `handler_docs/sum.md` §2.2's
per-group aggregation, just extended one cell at a time instead of summed
over a fixed group), so this is one linear pass down the line, not a
branch replay — cheaper than ISS's approach, and the natural translation of
"union over surviving lengths" into a single-pass table because
SudokuMaker's `update` has no fan-out primitive to lean on instead.

## Sources

- `js/solver/sudoku_builder.js:566` (`XSum` case), `:1096` (`_yieldOr`),
  `:204` (`_givenHandler`) — build-time branch construction.
- `js/solver/handlers.js:123` (`False`), `:136` (`And`), `:184`
  (`GivenCandidates`), `:4057` (`Or`, full runtime state machine) — the
  generic disjunction engine each branch runs inside.
- `js/solver/handler_docs/sum.md` §2.2–2.4 (packed aggregates), §3
  (feasibility + dispatch), §4 (bounds consistency by slack) — what each
  branch's `Sum` handler actually propagates.
- `docs/agents/iss.md` — reading process followed here.
- `docs/research/190-one-sided-clues-ties-non-house-lines.md` §4 — prior
  read of the same `XSum` build-time decomposition and SudokuMaker's own
  shipped `XSum` gate; not re-derived here.
