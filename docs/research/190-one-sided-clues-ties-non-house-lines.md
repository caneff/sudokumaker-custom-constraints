# #190: one-sided clues, ties, and non-house lines in ISS and SudokuMaker

**Question** (issue #190, part of #187). For skyscraper, X-sums/numbered-rooms
style, and running-start style clues: which deductions rest on **all-different**
(a house), which rest on **every digit present** (a full house), how does each
solver gate them, what does it do when the far clue is unknown (one-sided), and
how are ties (equal digits) treated?

**Sources read.**

- ISS: `~/src/iss-stuff/Interactive-Sudoku-Solver` at commit `ed5688d5`
  ("Improve overly methods to include rows and co...", 2026-07-28).
  `js/solver/handlers.js`, `js/solver/sudoku_builder.js`,
  `js/sudoku_constraint.js`, `js/solver/engine.js`,
  `js/solver/handler_docs/count_distinct.md`.
- SudokuMaker: `examples/_shared/sudokumaker.har`. Two bundles carry the
  components — `main-D44ZZMA9.js` and `solver-Bv75x3BJ.js`. Both are minified,
  so every quote below carries the minified identifiers. Extract the response
  bodies from the HAR before re-checking a quote.

Nothing here is measured. Every claim is "what the source does", not "what pays
for itself".

---

## Headline

1. **Neither solver has an interactive outside clue.** In both, the clue value
   is a constructor argument — a number fixed before the solve. "One-sided" is
   therefore not a case either solver handles; it is a case neither solver has.
2. **ISS never meets a bare line for an outside clue.** Its outside clues are
   built from `fullLineCellMap`, so the line is always a whole row or column,
   and so always a full house. It gates nothing because it never has to.
3. **SudokuMaker does meet bare lines, and gates exactly three components** —
   `GreaterThanOrEquals`, `Index`, `XSum`. `Skyscraper` and `SandwichSum` assume
   a house and never check.

---

## 1. What "house" means to each solver

**SudokuMaker — `getCellsCanHaveRepeats` is a pairwise-exclusion test, not a
length test.** From `solver-Bv75x3BJ.js`:

```js
getCellsCanHaveRepeats(e){const t=Array.isArray(e)?e:[...e];return Ue(t)||!this.getCellsSeeEachOther(e)}
```

`Ue` is a duplicate check on the list itself:

```js
function Ue(s,e){ ... const t=new Set;for(let i=0;i<s.length;i++){if(t.has(s[i]))return!0;t.add(s[i])}return!1}
```

and `getCellsSeeEachOther` asks whether every cell excludes every other through
some registered constraint component:

```js
getCellsSeeEachOther(e){const t=Array.isArray(e)?e:[...e];return t.every(i=>{const n=this.getCellsSeenByCell(i);return t.every(o=>o===i||n.has(o))})}
```

So `!getCellsCanHaveRepeats(line)` means **house** in our vocabulary, and
nothing more. It never establishes a **full house** — a component that wants one
must add its own length test. `XSum` does exactly that (section 4).

**ISS — `cellExclusions.areMutuallyExclusive(cells)`** is the same idea, built
once in `engine.js:1340` from each handler's `exclusionCells()`
(`engine.js:1301`). Handlers use it three ways: reject the constraint
(`Rellik`, `handlers.js:3786`, throws `InvalidConstraintError`), branch to a
weaker algorithm (`SameValues`, `handlers.js:1829`), or raise a static bound
(`handler_docs/count_distinct.md` section 5). A fourth way — ignore it — is what
the skyscraper handler does.

---

## 2. Skyscraper

### 2.1 ISS `Skyscraper` (`handlers.js:1241`) — two ungated all-different steps

The handler takes `cellExclusions` in `initialize` and never reads it. Two of
its steps are unsound on a line that can repeat.

**(a) The terminal bound.** `handlers.js:1263`:

```js
    // Terminal max height must be >= numCells (the minimum possible max
    // with numCells distinct values). For full rows this equals maxValue.
    const numCells = this.cells.length;
    this._terminalMask = (1 << this._numValues) - (1 << (numCells - 1));
```

The comment states the assumption in so many words: `numCells` **distinct**
values force a maximum of at least `numCells`. On a line that repeats, the
maximum can be anything at or above the number of visible buildings, and this
mask discards true states.

**(b) One peak.** `handlers.js:1359`:

```js
    // Anything after the first maxValue can't also be a maxValue.
    for (let i = lastMaxHeightIndex + 1; i < numCells; i++) {
      if (!(grid[cells[i]] &= ~maxValue)) return false;
    }
```

Sound only because a house holds `maxValue` once. With repeats, a second copy of
the maximum digit may sit later on the line, hidden behind the first.

The rest of the pass — the forward and backward visibility DP — needs no
distinctness. It is driven by `higherThanMinV` (`handlers.js:1323`):

```js
      const higherThanMinV = -(v & -v) << 1;
```

`v & -v` is the lowest candidate bit; negating and shifting left by one gives
the bits **strictly above** it. **Ties are not visible**, and the strictness
lives in the bit arithmetic, not in a flag.

### 2.2 ISS `HiddenSkyscraper` (`handlers.js:1439`) — no distinctness at all

The clue is the first digit hidden behind a taller one. Every comparison is
strict: `const moreThanTarget = -targetV << 1;` (`handlers.js:1458`), and the
backward pass caps earlier cells with `(1 << (maxValue(newV) - 1)) - 1`, values
strictly below. The one structural step is
`// If the hidden value is first it will always be visible.`
(`handlers.js:1449`), which removes the target from cell 0. That is sound on any
line. **`HiddenSkyscraper` is the one outside-clue handler in ISS with no house
assumption anywhere** — worth reading before we design a bare-line skyscraper
rule.

### 2.3 SudokuMaker `Skyscraper` — no repeats check, one deduction, tie-tolerant

From `solver-Bv75x3BJ.js` (class `Yt`), the whole component:

```js
let Yt=class extends S{amount;constructor(s,e,t){super(s,t),this.amount=e}get validateDuringSolve(){return!0}
*initialize(s){if(this.amount===1&&h.minDigit===1){yield H(this.cellIds.slice(1).map(e=>new tt(this.name,e,this.cellIds[0])));return}yield*super.initialize(s)}
*update(s){let e=0,t=h.maxDigit-this.amount+1;for(let i=0;i<this.cellIds.length;i++){const n=this.cellIds[i];let o=0;for(let a=h.minDigit;a<=t;a++)o|=1<<a;yield O(o,n);const r=_(s.cells[n].candidates);r>e&&(e=r);const l=P(s.cells[n].candidates);l>0&&l>=e&&t++}}
validate({cells:s}){let e=0,t=0,i=!1;for(const n of this.cellIds){if(P(s[n].candidates)<=e)continue;const r=s[n].value;if(r===void 0){i=!0;break}else r>e&&(e=r,t++)}return i?t>this.amount?{valid:!1,...}:C:t!==this.amount?{valid:!1,...}:C}};
```

Helper names, resolved in the same bundle: `_` is `os` (lowest set bit, so the
**minimum** candidate), `P` is `rs` (highest set bit, the **maximum**
candidate), `O(mask, cell)` is a keep-only change on one cell, `H(list)` is
`replaceComponent`.

- **The whole propagation is one cap.** `t` starts at `maxDigit - amount + 1`
  and each cell keeps only `[minDigit, t]`. `t` rises by one for each earlier
  cell that could be visible (`l >= e`: the cell's maximum candidate at or above
  a lower bound on the running maximum). The argument is "the visible heights
  strictly increase, so `k` of them still to come cap this cell at
  `maxDigit - k + 1`" — **it needs no distinctness and no full house**, only
  that `maxDigit` bounds every digit. As written it is sound on a bare line.
- **The component never calls `getCellsCanHaveRepeats`.** There is no
  house-gated deduction to gate.
- **`amount === 1` is special-cased to `GreaterThanOrEquals`, not
  `GreaterThan`** — every later cell must be at or below the first. Equal digits
  do not count as visible. The `h.minDigit === 1` guard is there because a `0`
  is not a building.
- **`validate` skips a cell whose maximum candidate is at or below the running
  maximum** (`if (P(...) <= e) continue`) and counts only `r > e`. Ties are not
  visible in the leaf check either.

**Both solvers treat a tie as hidden, and both hard-code it.** Neither has the
flag #187 wants; the strict-or-loose choice would be ours alone.

### 2.4 One-sided

ISS's `Skyscraper` is `CLUE_TYPE_DOUBLE_LINE` (`js/sudoku_constraint.js:2374`),
and `fullLineCellMap` (`js/sudoku_constraint.js:299`) stores each row twice —
`R1,1` forward and `R1,-1` reversed. Two opposite clues therefore become **two
independent handlers over the same cells in opposite orders**. ISS never couples
the two ends: there is no `L + R <= n + 1` and no joint DP. Our
`SkyscraperLineComponent`, which reads both clues at once, has no counterpart in
either solver.

---

## 3. Numbered rooms — SudokuMaker `Index`, ISS `Indexing`

### 3.1 SudokuMaker `Index` (`main-D44ZZMA9.js`, class `hO`) — one house-gated rule

```js
let hO=class extends rt{constructor(n,e,t,s){super(n,[t,...s]),this.valueToIndex=e,this.indexerCellId=t,this.indexingCellIds=s}allowRepeats=!0;
*initialize(n){if(this.allowRepeats=n.getCellsCanHaveRepeats(this.indexingCellIds),!this.allowRepeats){const e=this.indexingCellIds.indexOf(this.indexerCellId);e!==-1&&this.valueToIndex!==e+1&&(yield Ul(this.valueToIndex,this.indexerCellId))}yield*super.initialize(n)}
*update(n){yield*this.updateIndexerCandidates(n),yield*this.updateFromIndexer(n),n.cells[this.indexerCellId].value&&(yield ps())}
*updateIndexerCandidates(n){let e=0;for(let t=0;t<this.indexingCellIds.length;t++){const s=t+1,i=this.indexingCellIds[t];n.cells[i].candidates&1<<this.valueToIndex&&(e|=1<<s)}yield ln(e,this.indexerCellId)}
*updateFromIndexer(n){if(n.cells[this.indexerCellId].value){const e=n.cells[this.indexerCellId].value-1;if(e>=this.indexingCellIds.length){yield Nt(`impossible to satisfy ${this.name}`);return}yield ln(1<<this.valueToIndex,this.indexingCellIds[e])}}};
```

Three rules, and only one is gated:

| rule | needs | gate |
| --- | --- | --- |
| indexer keeps only positions whose cell still allows the clue digit (`updateIndexerCandidates`) | nothing | none — sound on a bare line |
| an index past the end of the line is a contradiction (`updateFromIndexer`, `e >= length`) | nothing; reads line length only | none |
| the indexer, when it sits on its own line at position `e+1`, cannot hold the clue digit unless `valueToIndex === e+1` | **house** | `!getCellsCanHaveRepeats(indexingCellIds)` |

The gated rule is the self-reference rule: if the indexer held the clue digit,
that digit's position would be the indexer's own, so its value would have to
equal its own index. With repeats the digit could appear twice, and the argument
fails. Note the gate is a house test, **not** a full-house test. This confirms
#187's note that the "escape the grid" rule reads only the line length and needs
no gate.

`updateFromIndexer` fires only once the indexer has a **value**. While the clue
index is merely narrowed, the component pushes information one way only, from
the line to the indexer.

### 3.2 ISS `Indexing` (`handlers.js:2679`) — the same two ungated rules, no third

```js
    // Clamp control cell to the line length so that N is always a valid index.
    const lineLength = this._indexedCells.length;
    ...
    if (!(initialGridCells[this._controlCell] &= allowedMask)) return false;
```

and in `enforceConsistency`, the same two-way link between "cell `i` allows the
indexed value" and "the control cell allows index `i`". No exclusion check, and
no self-reference rule — ISS's control cell is the first cell of the line by
construction, so the case does not arise the way it does for a drawn group.

---

## 4. X-sums — SudokuMaker's four-part gate

This is the most directly useful precedent in either codebase. From
`main-D44ZZMA9.js`:

```js
let IO=class extends oi{constructor(n,e,t,s){super(n,[t,...s],i=>Ae.minDigit===1&&t===s[0]&&s.length===Ae.digitCount&&!i.getCellsCanHaveRepeats(s)?new fM(n,e,s):new hM(n,e,t,s))}};
IO=gM([qe("XSum","The first X digits along {cells} must sum to {sum}, where X is the value of {xCell}.",...)],IO);
```

The strong component `fM` is chosen only when **all four** hold:

1. `Ae.minDigit === 1` — digits start at 1;
2. `t === s[0]` — the x-cell **is** the first cell of the line;
3. `s.length === Ae.digitCount` — the line is as long as the digit set;
4. `!getCellsCanHaveRepeats(s)` — the line is a house.

(3) and (4) together are our **full house**. This is the pattern #187 wants: the
app builds the full-house test from a live house check plus an explicit length
check, once at construction time, and picks a whole component accordingly.

**Weak path `hM` (bare line).** Its entire behaviour:

```js
*initialize(e){if(this.sum===0)yield Mg(0,this.xCellId),yield ps();else{const t=qs(Pt(1,this.cellsToSum.length));yield ln(t,this.xCellId),yield*super.initialize(e)}}
*update({cells:e}){if(P0(e[this.xCellId].candidates)===1){const t=Gt(e[this.xCellId].candidates);yield cs(new ql(this.name,this.sum,this.cellsToSum.slice(0,t)))}}
validate({cells:e}){const t=Gt(e[this.xCellId].candidates),s=this.cellsToSum.slice(0,t),{minSum:i}=Ge.sums.getExtremeSumsWithRepeat(s.map(r=>e[r].candidates));return i>this.sum?{valid:!1,...}:Ye}
```

- clamp the x-cell to `1..lineLength` (the "escape the grid" rule again, ungated);
- **do nothing at all until the x-cell is down to one candidate**, then replace
  itself with a plain `Sum` over the prefix;
- back the whole thing with a min-sum leaf check that explicitly allows repeats
  (`getExtremeSumsWithRepeat`).

**Strong path `fM` (full house).** It precomputes
`helpers.xSums.getXSumPossibilities(sum)` — `{x, combinations}` pairs whose
combinations are sets of **distinct** digits — and then:

```js
*initialize(e){const t=qs(this.possibilities.map(s=>s.x));yield ln(t,this.cellIds[0]),yield*this.update(e)}
*update({cells:e}){const t=hn(e[this.cellIds[0]].candidates);t.length===1&&(this.sum>t[0]?yield cs(new ql(this.name,this.sum,this.cellIds.slice(0,t[0]))):yield ps());const s=this.possibilities.filter(a=>t.includes(a.x)),i=s.map(a=>a.combinations).flat().reduce((a,u)=>a|u,0),r=s.reduce((a,{x:u,combinations:c})=>{for(const d of c)a&=1<<u|d;return a},pl),o=t[0],l=t.at(-1);yield Kn(i,this.cellIds.slice(1,o)),yield Hl(r,this.cellIds.slice(l))}
```

The step the weak path cannot make is the first one: **prune the clue cell from
the sum alone, before anything on the line is known.** That is precisely the
"deduce a blank clue" power our interactive examples are built around, and
SudokuMaker gives it up entirely on a bare line.

### ISS's X-sum is a search branch, not a handler

`sudoku_builder.js:566` decomposes `XSum` into an `Or` over every possible X:

```js
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
```

Note `sumRem = sum - i`: the control cell is itself part of the sum. The
decomposition assumes no distinctness; whatever distinctness the `Sum` handler
exploits it derives from `cellExclusions` on its own (`handler_docs/sum.md`
section 4, exclusion groups).

---

## 5. Sandwich — the counter-example: precondition in prose, not in code

SudokuMaker's `SandwichSum` (`main-D44ZZMA9.js`, class `$O`) registers **two**
components: a required-digits component (`el`) forcing both crust digits onto
the line, and the sum component `K7`, whose combinations are enumerated from the
**full digit set minus the crusts**:

```js
const r=Ge.digits.createFullDigitSet();for(const o of s)r.delete(o);this.combinations=[...Fx([...r],this.sum)],...
```

Both steps need a full house. Neither is gated. The constraint's own description
says so instead:

```
Along {cells} there must be a sequence of values starting with one of {sandwichDigits},
then some values summing to {sum}, then another digit from {sandwichDigits}.
**Note:** currently requires all cells to be different.
```

ISS's equivalent, `Lunchbox` (`handlers.js:1527`), is the one ISS handler that
**does** branch on the shape of the line:

```js
    this._isHouse = this.cells.length === effectiveNumValues;
```

with `effectiveNumValues` read from the candidates present, not from an
exclusion check. `enforceConsistency` then takes a cheaper sentinel-pairing path
when `_isHouse` and a general range path otherwise. Even so, the general path
closes with
`// Given that the values must form a house, this is sufficient to ensure`
`// that the constraint is fully satisfied.` (`handlers.js:1699`) — the handler
still assumes distinctness for completeness; `_isHouse` only chooses how hard it
works.

Read `_isHouse` as a **full-house-by-length** test, and note it is exactly the
test SudokuMaker's `XSum` gate pairs with a real exclusion check. Length alone is
not enough for us.

---

## 6. Running start

**No built-in exists in either solver** (`docs/catalog.md` says the same for
SudokuMaker; ISS has no such constraint class). The nearest primary sources are
ISS's `HiddenSkyscraper` (section 2.2) — a prefix rule with strict comparisons
and no distinctness assumption anywhere — and SudokuMaker's `Skyscraper` cap
(section 2.3).

Worth stating plainly, because our own README asserts the opposite for our
component: `examples/running-start/README.md` says "In a sudoku line all digits
differ, so 'not ascending' always means a strict drop." On a bare line that
sentence is false, and the run can either continue through a tie or stop at one,
depending on which reading we pick. Nothing in either solver decides it for us.

---

## What this implies for our gates

1. **`getCellsCanHaveRepeats` buys "house" and nothing else.** Its own source is
   a pairwise "do these cells see each other" test. Any full-house rule needs
   `line.length === digitCount` alongside it. SudokuMaker's `XSum` gate is the
   citable precedent, and it also adds `minDigit === 1` and "the clue cell is the
   first line cell". Copy the shape of that four-part test.
2. **Gate at construction, not inside `update`.** `XSum` picks a component in
   the constructor callback; `Index` reads the check once in `initialize` into
   `this.allowRepeats`. Nothing re-checks per pass. `initialize` is where our
   gates belong too.
3. **Classify each of our rules by which property it needs.** The sources give a
   three-way split we can reuse as a checklist: *no assumption* (visibility
   caps, index-in-range, the indexer/line two-way link, min-sum with repeats),
   *house* (the numbered-rooms self-reference rule; ISS's "only one maximum
   digit"), *full house* (ISS's `numCells` terminal bound; every sandwich rule;
   the X-sum combination tables).
4. **A bare line costs the clue-side deduction, not the line-side one.**
   SudokuMaker's weak `XSum` still prunes the clue cell to `1..n` and still
   pushes line-to-clue information; what it loses is pruning the clue from the
   *sum*. Expect the same trade in our variants, and expect a bare-line board to
   need more givens.
5. **Ties: both solvers hard-code "a tie is hidden", in the bit arithmetic.**
   #187's "strict by default behind a code flag" has no precedent to copy. It is
   a new decision, and the flag is ours to define and test rather than to port.
6. **One-sided is genuinely unexplored ground.** Neither solver has an
   interactive clue, and ISS models a two-ended line as two independent
   one-ended handlers. Our joint two-clue DP
   (`docs/research/137-exact-line-dp.md`) is already past anything in either
   source, so a one-sided DP has to be designed and measured, not looked up.

## What was passed on

| Source | Verdict |
| --- | --- |
| ISS `Skyscraper` `enforceConsistency` DP | read in full; two all-different steps identified (2.1). Not ported — our subset DP (#137) is stronger on a full house. |
| ISS `HiddenSkyscraper` | read in full; **candidate** for a bare-line skyscraper rule (no distinctness anywhere). Not ticketed here. |
| ISS `Lunchbox` | read in full; `_isHouse` is length-only, weaker than our intended gate. Pattern noted, code not ported. |
| ISS `Indexing` | read in full; both its rules already exist in SudokuMaker's `Index`. |
| ISS `XSum` builder decomposition (`Or` over X) | read; a search-space decomposition, not a propagator. Not applicable — SudokuMaker has no `Or` handler. |
| ISS `handler_docs/sum.md`, `count_distinct.md` | skimmed for distinctness gating only (`sum.md` section 4 exclusion groups, `count_distinct.md` section 5 static bound). Full read still outstanding; `docs/agents/iss.md` still lists them unread. |
| ISS `Rellik`, `SameValues`, `FullRank` | not read beyond their exclusion checks (section 1). |
