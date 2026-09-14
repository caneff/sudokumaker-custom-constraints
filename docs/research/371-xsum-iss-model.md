# How ISS models X-sums (issue #371)

Read against `~/src/iss-stuff/Interactive-Sudoku-Solver` commit
`ed5688d50b39746cada47b8ef9fce904dfb33bc5`, per the reading process in
`docs/agents/iss.md`.

**Questions this note answers** (from #371): how ISS models X-sums, what
state it propagates, whether it runs a subset DP or bounds, how it handles
the first-cell digit that fixes the length, and what of that transfers to
Up to N.

Most of the build-time decomposition (§1, §4) is already documented in
`docs/research/190-one-sided-clues-ties-non-house-lines.md` §4 — see that
note for the byte-faithful quote of `sudoku_builder.js:566`; §1 here cites
the same lines rather than re-quoting the block. This note's addition over
#190 is the runtime state the generic `Or`/`And` handlers propagate (§2),
which changes the answer to "subset DP or bounds" (§3) and "does it
constrain the real grid" (§4) from what a build-time-only read would
suggest.

## 1. How ISS models X-sums

ISS does not give X-sum its own handler. `SudokuBuilder` expands the `XSum`
constraint into a disjunction of fixed-length cases at **build time**,
before solving starts (`js/solver/sudoku_builder.js:566`, quoted in #190
§4): for `sum === 1` it yields a bare given pinning the control cell (the
line's first cell) to `1`; otherwise it builds one branch per candidate
length `i` from `2` to `cells.length` (stopping once `sum - i < 0`), each
branch an `And` of a `GivenCandidates` handler pinning the control cell to
`i` and a plain `Sum` handler over `cells[1..i-1]` targeting `sum - i` (the
control cell's own value `i` counts toward the sum, so the remaining `i-1`
cells make up the rest). `_yieldOr` (`sudoku_builder.js:1096`) wraps the
branch list in a generic `Or` handler, or short-circuits to a bare
pass-through / `False` when there are 0 or 1 branches.

So "how ISS models X-sums" is: **it doesn't model X-sums** as a domain
concept past construction. It compiles the rule into a generic
disjunction-of-conjunction search structure and hands the arithmetic to the
existing `Sum` handler — which, as §3 below corrects, is not always doing
bounds-only work.

## 2. What state it propagates

Two layers of state, since two different handler types are involved.

**The `Or` handler's own state** (`js/solver/handlers.js:4057`) is a
per-node bitmask tracking which branches are still possibly valid, plus a
fast path once only one is left: `state[0]` holds either a live count of
remaining valid branches, or — once only one remains — a flag
(`_FLAG_FINAL = 1<<15`) OR'd with that branch's index; `state[1..]` packs
one bit per branch, 16 per word, set while the branch has not yet been
proven invalid.

On each `enforceConsistency` call, every still-valid branch is replayed on
a scratch copy of the grid; a branch that returns `false` is marked invalid
via `_markAsInvalid`, which decrements the live count and, on hitting
exactly one survivor, calls `_setFinalHandler` to record which branch
index survived. The result the caller sees is the **bitwise OR of every
surviving branch's candidate sets** (`resultGrid[j] |= scratchGrid[j]`) —
the union of what each remaining length says is possible, not an
intersection. Once collapsed to one final handler, subsequent calls skip
the fan-out (`handlers.js:4197`, `grid[stateOffset] & _FLAG_FINAL`) and
apply that one branch's fixed values directly to the real grid — see §4,
this is where §4 in an earlier draft of this note got it backwards.

**Each branch's `Sum` handler state** is the aggregate from
`handler_docs/sum.md` §2.2–2.3 (`rangeInfo`'s packed `minSum`/`maxSum`/
`fixedSum`/`numUnfixed`), recomputed from the cell candidates on every
call, plus — per §3 below — a `killerCageSums` lookup when the branch
qualifies as a cage.

So the propagated state is: *which lengths are still alive* (the `Or`'s
bitmask) crossed with *what each surviving length's `Sum` handler can
currently prove* about its remainder (bounds, or an exact subset table —
§3).

## 3. Subset DP, or bounds? — corrected

**Both, depending on the branch's shape; not bounds-only.** Each branch's
`Sum` handler self-classifies at `initialize` time
(`sum_handler.js:229–237`):

```js
if (this.onlyUnitCoeffs()
    && this._coeffGroups.length === 1
    && this._coeffGroups[0].exclusionGroups.length === 1) {
  this._flags |= this.constructor._FLAG_CAGE;
}
```

`XSum`'s branches build `new SumHandlerModule.Sum(cells.slice(1, i), sumRem)`
with no coefficients (unit coeffs) over a **contiguous prefix of the same
line**. On a line where those cells mutually exclude (a house, or any run
within one), that is exactly one coefficient group with exactly one
exclusion group, so `_FLAG_CAGE` is set. `enforceConsistency`
(`sum_handler.js:892–898`) then dispatches such branches to
`_restrictCellsSingleExclusionGroup`, which enumerates
`this._sumData.killerCageSums[numUnfixed][sum - fixedSum]`
(`sum_handler.js:764`) — the precomputed table of every distinct-value mask
of a given size summing to a given target. That *is* the subset-sum DP
(computed once per `numValues`, looked up per call), not a bounds check.

The bounds path (`handler_docs/sum.md` §3–4: the `minSum`/`maxSum`
feasibility test, then per-cell range tightening by slack) still runs
first, and still runs alone whenever a branch's cells are **not** one
exclusion group — e.g. an X-sum line that is not a house, where prefix
cells don't all mutually exclude. So the honest answer is: ISS picks
whichever of the two the branch's own cell shape supports, at
`initialize`, per branch — a plain X-sum on a full-house line gets the
exact `killerCageSums` treatment on every branch that stays small enough to
matter; a bare-line X-sum (the common case, since most X-sum lines are not
full houses) gets bounds only, because its branches are not single
exclusion groups.

The build-time **case split over lengths** is still doing separate work
from either of these: it's what turns "unknown length" into "several
fixed-length sub-problems," each of which then gets bounds and/or exact
treatment on its own terms.

## 4. How it handles the first-cell digit that fixes the length — corrected

It forks the search **at construction time**, once, before any solving
happens: every legal value `i` of the control cell becomes its own branch,
carrying a `GivenCandidates` handler pinning the control cell to exactly
`i`. Earlier in this note's drafting, §4 claimed the real grid's control
cell is "never directly constrained" by this handler and only narrows
indirectly through the `Or`'s union. That's wrong: once the `Or` collapses
to a single surviving branch (`_FLAG_FINAL` set), every subsequent
`enforceConsistency` call applies that branch's `GivenCandidates`
initialization **directly to the real grid**
(`handlers.js:4202`, `this._assignInitializations(grid, handlerIndex)` —
note the argument is `grid`, not a scratch copy). So the control cell does
get pinned directly by this handler, but only after enough branches have
died elsewhere that one length is the last one standing; before that point,
narrowing is indeed only indirect, through the unioned result of the
still-competing branches.

This is also why `sum === 1` short-circuits to a bare given: with only one
possible length (`i = 1`, an empty remainder), there is nothing to branch
over.

## 5. What transfers to Up to N

Up to N's length is fixed by the position of the **first occurrence of a
known digit D**, not by the value written in the first cell — so the
control-cell-as-length-selector trick (§4) has no direct analogue: no
single cell's value enumerates the candidate lengths, the *position* of a
value along the line does.

What transfers:

- **The case split, not the branch mechanism.** ISS's real move is
  compiling "the length is unknown but ranges over a small set" into one
  per-length sub-problem, unioned. That idea ports even though
  SudokuMaker has no `Or`/`And` handler to build it out of (#190 already
  notes this absence at the builder level; §2–4 above confirm it again
  from the runtime side).
- **Per-branch treatment can vary by cell shape, not just use bounds.**
  §3's correction matters here: if Up to N's prefix cells for a given
  candidate length happen to form a single exclusion group, an exact
  subset-count table is the ISS-precedented move for that case, not
  bounds-only. Whether that shape actually arises for Up to N's typical
  boards is not established by this note and would need checking against
  real Up to N examples, not assumed from the X-sum case.

What does not transfer: ISS's branches are independent handlers replayed
in full every call, which is affordable there because `Or` is a generic
engine primitive amortizing the replay cost across every constraint type
that uses it. SudokuMaker's `update` runs once per component per call with
no such fan-out scaffold. Porting the *case-split idea* without the `Or`
machinery means a direct port isn't available — some single-pass
alternative is needed instead. The following is a design sketch for that,
**not a verified or measured design** — per `docs/agents/iss.md` #4, a
ported idea gets timed on our fixtures before it's trusted, and this note
does no timing:

### Candidate DP state for Up to N (unverified sketch — a future ticket's design work, not this one's)

One possible shape, keyed by candidate length `i` (the line position where
D could first occur), computed in a single pass down the line:

```
for each i where digit D can still first-occur at position i:
    reachable[i] = true iff no cell before i is forced to D
                   and D remains a candidate at i
                   and minSum(cells[0..i]) ≤ target ≤ maxSum(cells[0..i])
```

`minSum`/`maxSum` over the prefix could be accumulated incrementally as `i`
grows, in the same shape as `handler_docs/sum.md` §2.2's per-group
aggregation extended one cell at a time. Whether this bounds-only table is
sufficient, or whether some candidate lengths need the exact
`killerCageSums`-style treatment §3 found ISS reaching for on house lines,
is an open question for whoever builds this — not settled by this note.

## What was read but judged not applicable

`handler_docs/sum.md` §5 (uniqueness-aware tightening) and §8 (complement
optimization) apply to multi-group weighted sums with attached complement
sets — no X-sum branch has more than one coefficient group or a complement,
so neither path is reachable here; not ported. §9 (implementation notes) is
performance bookkeeping for the `Sum` handler generally, orthogonal to the
X-sum question. §6 (exact small cases, ≤2–3 unfixed cells) and §7 (general
killer-cage filtering beyond the single-exclusion-group case in §3) are
generalizations of the §3 cage path for shapes an X-sum branch's prefix
slice doesn't produce (multiple exclusion groups, non-unit coefficients);
recorded as read, not applicable to this ticket's question.

## Sources

- `js/solver/sudoku_builder.js:566` (`XSum` case), `:1096` (`_yieldOr`),
  `:204` (`_givenHandler`) — build-time branch construction.
- `js/solver/handlers.js:123` (`False`), `:136` (`And`), `:184`
  (`GivenCandidates`), `:4057`–`4245` (`Or`, full runtime state machine,
  including `:4197`–`4205` for the collapsed-to-final-handler path) — the
  generic disjunction engine each branch runs inside.
- `js/solver/sum_handler.js:229`–`237` (`_FLAG_CAGE` self-classification),
  `:764` (`killerCageSums` lookup), `:892`–`898` (dispatch) — the exact-
  subset path §3 found ISS actually uses for house-line X-sum branches.
- `js/solver/handler_docs/sum.md` §2.2–2.3 (packed aggregates), §3
  (feasibility + dispatch), §4 (bounds consistency by slack), §5–§9 read,
  judged not applicable (see above) — what each branch's `Sum` handler
  propagates.
- `docs/agents/iss.md` — reading process followed here.
- `docs/research/190-one-sided-clues-ties-non-house-lines.md` §4 — prior
  read of the same `XSum` build-time decomposition and SudokuMaker's own
  shipped `XSum` gate; not re-derived here.
