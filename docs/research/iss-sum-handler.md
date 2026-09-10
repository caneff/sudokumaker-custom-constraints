# ISS's `Sum` handler — the whole of `sum.md`, read

**Question.** What makes ISS's killer-cage / weighted-sum propagation fast?

**Method.** Read `js/solver/handler_docs/sum.md` end to end at the local
checkout `~/src/iss-stuff/Interactive-Sudoku-Solver`, commit `ed5688d`
(2026-07-28), spot-checked against `js/solver/sum_handler.js` (997 lines).
Claims below are `[source]` unless tagged otherwise. This supersedes the
partial read recorded in `docs/agents/iss.md` ("§4, exclusion-group gating
only").

## The finding in one line

Nothing here is a novel deduction. The speed comes from **precomputed tables
plus a refusal to run the expensive filter when it cannot pay** — bounds
consistency always, GAC only where the structure makes it affordable.

## The five mechanisms

| § | Mechanism | What it buys |
| --- | --- | --- |
| 2.2 | **`rangeInfo[mask]` packed word** — `(isFixed<<24) \| (fixedValue<<16) \| (minValue<<8) \| maxValue` | Summing the words across a group sums all four statistics independently. Groups are capped at 15 cells (15·16 = 240 < 256) so the 8-bit lanes never carry. The per-call bounds pass is one table lookup and one add per cell, branchless. An empty mask maps to `numValues << 24`, so unsatisfiability shows up as `numUnfixed ≤ 0` after the same addition. |
| 3 | **Layered dispatch** | Aggregate bounds every call; exact filters only for ≤ 2 unfixed cells (3 when `numValues ≤ 9`) or a pure cage. Large cages never pay for GAC. |
| 7 | **`killerCageSums[k][s]`** — every set of `k` distinct values summing to `s`, memoized per `numValues` | Cage GAC becomes an OR/AND loop over a list, not a search. `possibilities` = union of feasible options (prune outside it); `required` = intersection (a required value with one candidate cell is a hidden single, free). |
| 2.3, 6 | **`reverse[mask]` reflection** `v → n+1−v` | Turns "the complement reaching a target" and "a negative coefficient" into the same bitmask shift. Two-cell exact filtering is one lookup plus a shift; a `−1` coefficient is handled by reflecting the mask and raising the target by `n+1`. |
| 5 | **Exclusion-group envelopes** | Bounds use the `t` smallest/largest *distinct* values the group can jointly realise (`seenMin`/`seenMax`, built greedily), not `t × groupMin`. Strictly tighter than plain bounds consistency, still linear in cells. |

## Two structural moves, portable on their own

- **Descending `|coeff|` order with early break** (§4, §9). Once both slacks
  exceed `numValues · |coeff|`, the cell's whole range fits inside the slack
  and nothing can be removed — and the descending order proves the same for
  every later group, so the loop exits.
- **Complement optimization** (§8). A cage that exactly fills the rest of a
  house is filtered jointly with its complement: an option survives only if
  its complement can also be placed in the remaining house cells. Strictly
  more pruning than the cage alone, off the same table.

## Which parts are GAC and which are not

`sum.md` is explicit, and it matters for anyone porting:

- §4 (slack-based range restriction) and §5 (distinct-aware envelope) are
  **bounds consistency**. Cheap, always on.
- §6 (1–3 unfixed cells) is **GAC for the residual equation** — every kept
  value has an explicit completing assignment.
- §7 (pure cage) and §8 (cage + complement) are **GAC**.

That layering is the whole design: the general weighted sum is not cheaply
made GAC, so exactness is bought only where a table already holds the answer.

## Mapping to this repo

We ship no killer-cage component today (`examples/` has fillomino, hit-counts,
isofill, numbered-rooms, outside-sudoku, running-start, skyscraper), so this is
a reference note, not a port plan.

| ISS mechanism | Our status |
| --- | --- |
| Packed-lane aggregate word (§2.2) | New. Applies to any component summing per-cell min/max over a clue — hit-counts and outside-sudoku totals are the shape. `[unsure]` whether the lane packing pays in JS at our cell counts. |
| Layered dispatch (§3) | Same instinct as our per-call-cost work (`docs/agents/per-call-cost.md`). |
| `killerCageSums` enumeration (§7) | New. Only worth it if we build a cage-shaped constraint. |
| `reverse` reflection (§2.3, §6) | New, and cheap. |
| Distinct-aware min/max (§5) | The exclusion-group gating already recorded in `docs/research/190-one-sided-clues-ties-non-house-lines.md` §7 is the same idea, narrower. |
| Complement optimization (§8) | New. Needs a house-filling relationship we do not currently model. |

## Carry-over caveat

`docs/agents/iss.md` rule 4 stands: **ISS's verdicts do not transfer.** Their
numbers say a rule is sound and can fire, nothing more. Anything ported here
gets timed on our fixtures with `just time <example>` per
`docs/real-app-timing.md` before it counts.

## Not read

`nfa.md` is still unread. `count_distinct.md` remains read for §5 only.
