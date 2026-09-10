# SudokuMaker's built-in sum logic vs ISS's `Sum` handler

**Question.** ISS's killer-cage propagation is documented and fast
(`iss-sum-handler.md`). What does SudokuMaker's own built-in do, and where do
the two differ in strength and in cost?

**Method.** Read the app bundle: `https://sudokumaker.app/assets/main-D44ZZMA9.js`,
version string `v2026.08.14-d47fc4b` (the same build as
`skyscraper-builtin-constraint-baseline.md`). Class names are minified; the
sum engine is `class T0`, reached from the `SumComponent` class (`Z7`) via
`*update(e){ yield* new T0(...).updateCandidates(this.repeat) }`. Weighted sums
use a second class (`Bx`). Combination tables are in `P_`. Everything below is
`[source]` — read in the bundle — unless tagged `[unsure]`.

## The finding in one line

For a **single-target killer cage** the two are the same idea and the same
strength: enumerate the distinct-value combinations that hit the target, keep
their union. Everywhere else — multi-sum cages, repeats, weights, cages inside
a house — ISS is stronger, and it is cheaper per call in all cases.

## What SudokuMaker actually runs

`T0.updateCandidates(repeat)` branches once:

**No-repeat path** (the killer cage). Subtract the fixed cells from the target
window, collect the union `u` of the unfixed cells' candidates, then for every
target `d` in the remaining `[min, max]` window:

```js
Ge.sums.getCombinationsForSumWithoutRepeat(d, a.size)   // memoized, digit arrays
  .map(h => qs(h))                                      // digits → bitmask, every call
  .filter(h => (h & u) === h)                           // option ⊆ available values
```

The union of the survivors is written to every unfixed cell; if exactly one
combination survives, a flag is set to say the cage is determined. That is
ISS §7's `possibilities` pruning, arrived at by the same argument.

`getCombinationsForSumWithoutRepeat(sum, k)` enumerates **all** `C(9, k)` digit
subsets and filters by sum, memoized on `sum_k`. So the enumeration is paid
once per (sum, size) per session, but the digits→mask conversion is redone on
every propagation call.

**Repeat path and weighted sums.** Pure bounds consistency: for each unfixed
cell, drop the candidates that cannot fit between the other cells' minimum and
maximum. `getMinSum`/`getMaxSum` rescan **all other cells** for each cell, so
the pass is O(n²) in cage size.

## Where they differ

| Case | SudokuMaker | ISS | Verdict |
| --- | --- | --- | --- |
| Single-target cage, distinct cells | union of feasible combinations — GAC | §7, same union | **tie in strength** |
| Required values inside a cage | not computed | §7 keeps `required` = intersection of feasible options, places hidden singles and drives exclusions | **ISS stronger** |
| Cage filling the rest of a house | no complement reasoning | §8 filters cage and complement jointly; an option survives only if its complement can be placed | **ISS stronger** |
| Multi-sum cage (`sums: [10, 20]`) | relaxes to the interval — the loop runs every `d` in `[min, max]`, so 15 is admitted | filters against the actual target | **ISS stronger, SM also slower** as the interval widens |
| Repeats allowed / weighted sums | bounds consistency, no distinctness anywhere | §4 bounds **plus** §5 exclusion-group envelopes derived from the grid's own mutual exclusion | **ISS stronger** |
| Per-call cost, bounds pass | O(n²) rescans, `Set` allocation per call | one packed `rangeInfo` lookup and one add per cell, no allocation | **ISS cheaper** |
| Cage tables | lazy, memoized per `(sum, k)`, stored as digit arrays and re-masked each call | `killerCageSums[k][s]` precomputed as masks, memoized per `numValues`, shared by every handler | **ISS cheaper** |
| Negative coefficients | `WeightedSumComponent` takes positive whole weights only | §6 reflection handles `−1` uniformly | not comparable |

## One quirk worth knowing

In the no-repeat path the available-value mask is built in a single pass:

```js
f !== undefined ? (… u &= ~(1 << f)) : u |= cells[d].candidates
```

A fixed cell clears its digit from `u`, but an unfixed cell processed **later**
ORs its candidates back in. So whether a cage's already-placed digit is
excluded from the remaining combinations depends on the order of `cellIds`.
This is sound either way — a larger `u` only filters fewer combinations — but
it means the built-in's cage strength is cell-order dependent. `[source]`, not
probed live.

## What this means for us

- Building a cage-shaped custom component to beat the built-in is only worth it
  for the cases in the table where ISS is stronger: required values, the house
  complement, multi-sum targets, and any sum where grid distinctness could
  tighten the bounds but the constraint allows repeats.
- The plain single-target killer cage is already GAC in the app. A custom
  reimplementation of it buys nothing and costs per-call overhead.
- Any such component still gets timed on our fixtures (`just time <example>`,
  `docs/real-app-timing.md`) before it counts — ISS's numbers do not transfer
  (`docs/agents/iss.md` rule 4).

## Not checked

Live behaviour was not probed — no board was built to confirm the multi-sum
relaxation or the cell-order quirk in the running app. Both are read off the
bundle only. `[unsure]` on how often either bites in practice.
