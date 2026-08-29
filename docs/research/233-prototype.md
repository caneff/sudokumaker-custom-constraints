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
