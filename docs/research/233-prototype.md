# #233 — two hit-counts deductions, ranked (prototype, 2026-08-29)

Part of #222. Question: do the two deductions shortlisted in #226 make the
9x9 hit-counts search close, and by how much?

Board: `examples/hit-counts/gen_9x9.json` / `examples/hit-counts/PUZZLE_LINK.txt`
(27 active clues, 9 blank, 4 interior givens).
Mock: `examples/hit-counts/proto-233.mjs` (Régin all-different floor, MRV DFS,
cap 200,000). The `shipped` row reproduces #224's 39,549 nodes exactly.
App: v2026.08.14-d47fc4b, `app-solve.mjs <link> 3 ShowCandidates --ring-clues`,
non-deterministic solve off, cold unless the row says after-logical. The app
column is the median **sum** (first solve plus uniqueness search) over 3 reps.

## The hit, and the model C is built on

A clue `k` on a line counts hits: reading inward, `line[i]` (0-based) is a hit
when `line[i] === i + 1`, and `k` is how many cells hit. `k` can be 0, and a
line is a permutation, so `k` is never `n - 1`.

Now read one whole side by **position** instead of by line. Position `i` of a
side is the set of cells that sit `i + 1` steps in from each of the side's `n`
clues. Those `n` cells are a house — a column for a left or right side, a row
for a top or bottom side — so the digit `i + 1` sits in exactly one of them.
So **each position is hosted by exactly one line**, and line `L` hosts exactly
`clue(L)` positions. That is a bipartite assignment, positions to lines, with
edge `(i, L)` live while digit `i + 1` is still a candidate in line `L`'s cell
at position `i`, and line `L`'s capacity the range its clue still allows.
`SideSumComponent` is the same regrouping counted rather than assigned: `n`
positions, one host each, so the side's clues sum to `n`.

Filtering the assignment is Régin's: solve the flow once (lower bounds on the
line capacities, so a circulation transform), then an edge is the same in every
valid assignment exactly when its two ends fall in different strongly connected
components of the residual graph. An edge fixed at 0 means the digit is
impossible there; an edge fixed at 1 **forces the hit** — the inference the
per-line rule cannot make, since its forward rule only ever forbids hits.

A is #13's early reject: `validate` returns false as soon as a pinned clue
falls outside `[forced, possible]`, the window the line can still reach.
`update` cannot say this — it skips the reverse rule once the clue is pinned.
The shared DFS calls `validate` only at a leaf, so the mock models A as a
propagator that empties the clue cell on the same contradiction; the state then
fails the engine's own `dead()` test, which is what a `validate` reject does to
a node.

## Results

| variant | what | mock nodes | mock s | app median (cold) |
| --- | --- | --- | --- | --- |
| shipped | per line + pair + side sum (#224 baseline) | 39,549 | 162 | no verdict, app gives up near 60 s |
| A | shipped + #13 early reject | 38,673 | 160 | no verdict |
| C | shipped + side hit matching | 34,595 | 138 | 30.4 s |
| A+C | both | 34,595 | 137 | 34.1 s |
| C, leaner | C without clue-candidate filtering, with a change check | 34,595 | — | 25.5 s |
| A + C leaner | | — | — | 33.2 s |
| C′ | leaner, change check narrowed to the bits the assignment reads | 34,595 | 104 | 20.3 s |
| C′ − pair | C′ with `HitCountsPairComponent` dropped | 36,411 | 111 | **14.8 s** |
| leaner − pair | the same wiring, broad change check | — | — | 21.0 s |

Two-row rule for `C′ − pair`, the recommended variant:

| row | baseline | candidate | ratio |
| --- | --- | --- | --- |
| cold | no verdict (app stops near 60 s) | 14.8 s (14.7 / 15.2 / 14.8) | — |
| after-logical | 65.8 s (68.3 / 65.8 / 64.8) | 15.0 s (14.9 / 15.4 / 15.0) | **0.23x** |

The cold baseline never returns a verdict, so that row has no ratio; the
after-logical row is a real baseline and the candidate clears 0.9x by a wide
margin. Note the cold baseline is the one #224 recorded, and the
after-logical baseline **does** finish — the app's logical pass buys enough
that the search completes in 65.8 s.

## Soundness

`examples/hit-counts/proto-233/soundness-233.mjs`, zero violations:

- Side hit matching, all three component files: 108,000 tests over the three
  `gen_*.json` grids and band/stack shuffles of them, every cell seeded with a
  random candidate superset that keeps its true value. 9,000 states pruned, so
  the rule fires. (Digit relabelling is not a safe shuffle here — a hit compares
  a digit to a position, so relabelling changes the rule, not the grid.)
- Early reject: 40,000 states that a real solution completes, 0 false rejects;
  22,213 states that no solution completes, all rejected. Its `update` is the
  shipped one and re-passes the shipped fuzz (20,000 tests, 0 violations).
- `just check` passes, the shipped soundness harness included.

## Reading

- **A does not pay.** It cuts 2.2 % of mock nodes and costs 4–8 s in the app on
  every wiring that finishes (C 30.4 → 34.1, C leaner 25.5 → 33.2). The app runs
  `validate` often enough that the scan it adds outweighs the branches it saves.
  Drop it. #13's caveat called this exactly.
- **The mock badly understates C.** 12.5 % fewer nodes in the mock; in the app,
  no verdict at all becomes 14.8 s. The mock's Régin all-different floor already
  supplies most of the cross-line reasoning C adds, so C looks redundant there.
  The app's Solutions finder is singles-only and has no such floor, which is
  where C earns its keep. This is the reverse of #124's skyscraper result, where
  the mock and the app agreed — a mock loss is not proof, in either direction.
- **Per-call cost is most of the win.** The three C files hold the *same*
  deduction and the same 34,595 mock nodes, and run 30.4 s, 25.5 s and 20.3 s in
  the app. Dropping the clue-candidate filtering (one flow per open clue
  candidate) and skipping the solve when the assignment's own inputs have not
  moved is worth a third of the time. #224 measured ~3 µs per shipped `update`
  call over 21 M calls; a side component that fires on any of 90 cells has to
  refuse most of those calls cheaply.
- **The pair component is now dead weight.** #224 valued it at 17 % of mock
  nodes. With C in it is worth 5.2 % (34,595 vs 36,411) and costs 5.5 s in the
  app (20.3 → 14.8). Its 7 M `update` calls buy less than they cost.

## Assets

- `examples/hit-counts/proto-233.mjs` — the mock ranking script (throwaway).
- `examples/hit-counts/proto-233/SideHitMatchingComponent.js` — C as first
  written: full filtering including clue candidates, no change check.
- `examples/hit-counts/proto-233/SideHitMatchingComponent.lean.js` — no clue
  filtering, broad change check.
- `examples/hit-counts/proto-233/SideHitMatchingComponent.fast.js` — **C′**, the
  recommended one: change check narrowed to the assignment's own inputs, cell
  state read as bitmasks.
- `examples/hit-counts/proto-233/HitCountsComponent.earlyreject.js` — A.
- `examples/hit-counts/proto-233/main.C.js`, `main.C.nopair.js` — backends that
  register the side component, with and without the pair.
- `examples/hit-counts/proto-233/build_proto_link.py` — builds each variant's
  link off the committed board (`--variant A|C|AC|L|AL|LP|F|FP`).
- `examples/hit-counts/proto-233/soundness-233.mjs` — the fuzz above.

No link is committed; the variant links live in the session's tmp directory.

## Recommendation for /to-spec

Ship **C′ without the pair component**: add one `SideHitMatchingComponent` per
full side (4 instances on the 9x9), registered from `main.js`, and delete the
`HitCountsPairComponent` registration and file. That clears #222's ~20 s bar at
a **14.8 s** cold median and 15.0 s after-logical, against a baseline that
returns no verdict at all cold and 65.8 s after-logical.

Do not ship A.

Points the spec has to settle:

- The component needs the whole side, so it is a backend change and `just time`
  cannot see it (#151). Either fix #151 first or record the variant link build
  (`build_proto_link.py`) as the timing path for this example.
- It registers only on a **full** side of `n` clued lines, the same guard
  `SideSumComponent` already uses. The assignment argument needs every line of
  the side and needs each position's cells to be a house; a partial side breaks
  both.
- Removing the pair component removes a deduction, so it needs its own timing
  row in the build, not just this prototype's.
- The component code adds about 2.5 KB to the link. The 9x9 link goes from
  11,601 to 14,261 characters — well inside the URL limit, but gotcha 7 applies.
- `SideSumComponent` is subsumed in strength (the assignment implies the sum)
  but is nearly free in the app (< 500 calls, #224) and does its work at the
  root. Keep it unless the build measures otherwise.

## Not measured

- A stacked on C′ specifically. A lost on the two C wirings that were timed
  (+3.7 s and +7.7 s), so it was not carried forward.
- 4x4 and 6x6 app times. The mock shows C worth 18 nodes out of 1046 on 6x6 and
  nothing on 4x4; those boards already solve instantly.
- The app's own node count. The app exposes no node counter (#224).

# #246 — D (joint row + pair DP) on C′ (prototype, 2026-08-29)

Part of #222, ticket #246. Question: does D — a joint row + pair DP, the shape
of skyscraper #124's winner — add anything on top of the `C′ − pair` wiring
(14.8 s cold, 36,411 mock nodes), at a per-call cost that still pays under the
two-row rule?

## The model, before any code

One `HitCountsJointComponent` per **line-pair**: a line, the clue at each end,
one component. On the shipped 9x9 that is 18 instances (9 rows, 9 columns), and
each one replaces the two `HitCountsComponent` instances for that line plus the
`HitCountsPairComponent` for it.

**Hits are a matching between digits and positions.** Number the line's
positions `j = 0 … n-1` from clue A. Position `j` is a hit for A when it holds
digit `j + 1`, and a hit for B when it holds digit `n - j`. So digit `d` can hit
in exactly two places: position `d - 1` (for A) and position `n - d` (for B).
Read that as a bipartite graph — positions on one side, digits on the other,
one edge per possible hit. Every node has degree at most 2, so the graph is a
union of paths and cycles.

**The components are tiny.** Follow the edges from position `j`: its A-edge
takes digit `j + 1`, whose B-edge sits at position `n - (j+1) = n-1-j`, whose
A-edge takes digit `n - j`, whose B-edge returns to position `j`. So the graph
splits into `⌊n/2⌋` four-cycles, each joining a position `j` to its **mirror**
`n-1-j`, plus the centre position on its own when `n` is odd. The mirrored pairs
are independent of each other — no digit and no position is shared — so the
reachable `(A, B)` pairs of the whole line are the convolution of one small set
per pair.

**Each mirrored pair allows five outcomes.** Each of its two positions takes one
of three cases: hit for A (`L`), hit for B (`R`), or neither (`M`). A case is
open only while the cell still has that candidate — `M` needs a candidate other
than the position's two targets. Two of the nine combinations are impossible on
a **house**: `(L, R)` and `(R, L)` both put the same digit in both cells. What
survives contributes `(0,0)`, `(1,0)`, `(0,1)`, `(2,0)` or `(0,2)` to `(A, B)`.
The centre contributes `(1,1)` when it holds its own digit and `(0,0)` when it
does not. Note what the exclusion says: **a mirrored pair can never give one A
hit and one B hit.** The pair component's cap cannot see that — it counts
positions, and knows nothing about digits.

The deduction is then the standard forward/backward pass:

- `F[u]` — the `(A, B)` sums reachable from the pairs before `u`.
- `H[u]` — the sums from which the pairs from `u` on can still land inside the
  **clue box**, the `(a, b)` with `a` a candidate of clue A and `b` of clue B.
- A case of one position is **impossible** when no combination containing it
  joins an `F[u]` state to an `H[u+1]` state. Then: `L` impossible drops digit
  `j+1` from the cell, `R` impossible drops digit `n-j`, and `M` impossible pins
  the cell to `{j+1, n-j}`.
- The clues keep only the values that appear in `F[end] ∩ box`.
- An empty intersection means the branch is dead; the component empties clue A,
  the same contradiction signal `C′` already raises.

**Soundness.** Every rule reads off the set of `(A, B)` the line can still
reach. The DP over-approximates that set: it enforces the hit matching and each
cell's own candidates, and it does **not** ask whether the non-hit cells can be
filled in. An over-approximation only ever removes a case no assignment reaches,
so the true solution's case at every position survives. The house exclusion is
gated on `!puzzle.getCellsCanHaveRepeats(line)` (line contract); on a bare line
`(L, R)` and `(R, L)` stay open and the DP is still exact for the relaxation.

**What D does not subsume.** A clue can never equal `n - 1` (fixing `n-1` cells
on target forces the `n`th). That is a permutation fact the hit matching alone
does not see, so D keeps the per-line `initialize` rule for both clues.

**Per-call cost.** `n` cell masks, five units, two DP sweeps over `(n+1)` rows
of bitmasks — a few hundred integer operations, no flow solve. Guarded by the
same narrowed change check `C′` uses: the hash covers only what the DP reads,
which per cell is three bits (can-`L`, can-`R`, can-`M`) plus the two clue
masks.

## Results

Same board, mock and driver as #233: `gen_9x9.json` / `PUZZLE_LINK.txt`, app
v2026.08.14-d47fc4b, `app-solve.mjs <link> 3 ShowCandidates --ring-clues`,
non-deterministic solve off, median **sum** over 3 reps.

| variant | what | mock nodes | mock s | app cold | app after-logical |
| --- | --- | --- | --- | --- | --- |
| C′ − pair | the #233 recommendation (baseline) | 36,411 | 112 | 15.0 s | 14.7 s |
| D | joint DP replacing per-line + pair, no C′ | 15,922 | 61 | 24.5 s | 13.6 s |
| C′ + D | both | **14,708** | 51 | **6.0 s** | **6.1 s** |

The baseline row reproduces #233: 36,411 mock nodes exactly, and 15.0 s against
the 14.8 s recorded there.

Two-row rule for `C′ + D` against `C′ − pair`:

| row | baseline | candidate | ratio |
| --- | --- | --- | --- |
| cold | 15.0 s (15.4 / 15.0 / 14.5) | 6.0 s (6.1 / 6.0 / 6.0) | **0.40x** |
| after-logical | 14.7 s (14.7 / 14.8 / 14.6) | 6.1 s (6.1 / 6.8 / 6.1) | **0.41x** |

**SHIP** — both rows clear 0.9x, so either one would carry it alone.

D on its own, as a control, does not: 1.63x cold, 0.93x after-logical.

## Soundness

`examples/hit-counts/proto-233/soundness-246.mjs`, **zero violations**:

- **House lines**, the shipped shape: 152,000 tests over the three `gen_*.json`
  grids and band/stack shuffles of them, every cell seeded with a random
  candidate superset that keeps its true value, both clues of every line of
  every grid. 12,000 states pruned, so the rule fires.
- **Bare lines**, the gate off: 20,000 random repeating lines of length 4 to 9
  against a mock that answers `getCellsCanHaveRepeats` true. 19,153 states
  pruned, 0 violations — the exclusion really is switched off, and the rest of
  the DP holds without a house.
- `just check` passes, and `soundness-233.mjs` still reports zero violations.

Not covered by this fuzz: `initialize`'s "a clue is never n − 1" rule, which is
the shipped per-line rule copied across and is fuzzed by the shipped harness. It
assumes a permutation line and, like the shipped component, is not gated.

## Reading

- **D and C′ are not the same deduction, and stack almost perfectly.** D alone
  cuts the mock from 36,411 nodes to 15,922 — far more than C′ ever did — and
  the two together reach 14,708. D works **along** a line, using the digit
  conflicts between a position and its mirror; C′ works **across** a side, using
  the house each position forms. Neither sees the other's argument.
- **The mock and the app disagree about D alone, and the app is right about
  why.** D alone cuts 56 % of mock nodes and is *slower* in the app cold, 24.5 s
  against the baseline's 15.0 s. It replaces 36 per-line components and 18 pair
  components with 18 joint ones, and each joint call does real work — two DP
  sweeps — where a per-line call did one scan. Without C′ that work has to
  supply the cross-line reasoning too, and it cannot.
- **Stacked, the per-call cost disappears into the search it removes.** C′ + D
  is 2.5x faster than the baseline on both rows. The narrowed change check is
  doing its share: the DP reads three bits per cell and two clue masks, and
  skips outright when none of them moved.
- **The after-logical row moved.** In #233 the baseline's after-logical row was
  65.8 s, against a shipped wiring; here both rows sit at ~15 s because the
  baseline *is* C′ − pair, whose logical pass and cold search cost nearly the
  same. The app's logic pass buys the candidate almost nothing either — 6.0 vs
  6.1 s — which says the win is search, not propagation at the root.

## Recommendation for /to-spec

**Keep D.** Ship `C′ + D`: one `SideHitMatchingComponent` per full side (4
instances) *and* one `HitCountsJointComponent` per line-pair (18 instances),
with `HitCountsComponent` kept only for a line clued at one end and
`HitCountsPairComponent` deleted. That takes #222's board from the #233
recommendation's 15.0 s to **6.0 s** cold and 6.1 s after-logical, well under
the ~20 s bar.

Points this adds to the ones #233 already listed for the spec:

- Both wirings are backend changes, so `just time` still cannot see them
  (#151); the timing path is `build_proto_link.py --variant CD`.
- **Link size is now the live constraint.** The 9x9 link goes from 11,601
  characters shipped to 18,734 with both components. Still inside the URL
  limit, but gotcha 7 is no longer theoretical — the spec should measure the
  minified size, and the joint component is the one to trim if it must give.
- D subsumes `HitCountsPairComponent` outright (the pair's `A + B <= cap` is
  the mirrored-pair convolution, counted rather than enumerated) and subsumes
  the per-line rule for a line clued at both ends. It does **not** subsume the
  n − 1 rule, which it carries in `initialize`.
- The house exclusion is gated on `getCellsCanHaveRepeats`, per the line
  contract, and cached until it answers house. The mock harnesses have no such
  call and read as a house; the spec's component must keep the gate.

## Not measured

- 4x4 and 6x6 app times. Those boards already solve instantly.
- The app's own node count — the app exposes no counter (#224).
- D against the *shipped* wiring (per-line + pair + side sum) in the app. The
  question was D on top of C′; the D-alone control replaces the same components
  C′ − pair does, so it is the comparison that answers it.
- Whether a cheaper D — the mirrored-pair exclusion as a bound on the pair
  component, without the full DP — would buy most of the win for less code and
  fewer link characters. Worth one row if link size bites.

## Assets (#246)

- `examples/hit-counts/proto-233/HitCountsJointComponent.js` — D.
- `examples/hit-counts/proto-233/main.CD.js`, `main.D.js` — the two backends.
- `examples/hit-counts/proto-233/soundness-246.mjs` — the fuzz above.
- `examples/hit-counts/proto-233.mjs` — variants `D` and `C'+D` added.
- `examples/hit-counts/proto-233/build_proto_link.py` — variants `D` and `CD`.

No link is committed; the variant links live in the session's tmp directory.
