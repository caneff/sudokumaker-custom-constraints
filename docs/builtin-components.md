# Built-in components

These ship with SudokuMaker. You can construct them anywhere the API is in
scope, including inside `update` via `replaceComponent` (unlike custom
components — see gotchas). Reuse a built-in before writing your own logic: an
edge rule that reduces to "these cells strictly increase, then drop" can lean on
`GreaterThanComponent` instead of hand-rolled candidate math.

Signatures reproduced from the [Chris-Tophski docs][src]; `CellId` is a cell id,
`DigitSet` a `SudokuDigitSet`. **[docs]** unless we used it (**[verified]**).

[src]: https://github.com/Chris-Tophski/SudokuMakerConstraints

## Ordering and comparison

| Component | Rule |
|-|-|
| `GreaterThanComponent(name, lesserCell, greaterCell)` | `lesserCell < greaterCell`. Alias `LessThanComponent`. |
| `GreaterThanOrEqualsComponent(name, lesserCell, greaterCell)` | `greaterCell >= lesserCell`. |
| `SequenceComponent(name, cells)` | Digits change by a constant step (or stay equal) along `cells`. |
| `SkyscraperComponent(name, amount, cells)` | Skyscrapers: taller hides shorter; `amount` = count visible from the start of `cells`. **[verified]** (the template our Running Start replaced) |

## Sums and products

| Component | Rule |
|-|-|
| `SumComponent(name, sumOrSums, cells)` | Digits sum to one of `sumOrSums` (a repeated cell counts N times). |
| `WeightedSumComponent(name, sumOrSums, cellWeightMap)` | Weighted sum; positive whole weights only. |
| `SameSumComponent(name, groups)` | Every group sums to the same value; `asNumber` reads a group as a multi-digit number. |
| `ProductComponent(name, productOrProducts, cells)` | Digits multiply to `productOrProducts`. |
| `XSumComponent(name, sum, xCell, cells)` | First X digits of `cells` sum to `sum`, X = value of `xCell`. |
| `SandwichSumComponent(name, sum, [d1, d2], cells)` | Between the two crust digits the values sum to `sum`. |

## Counting and indexing

| Component | Rule |
|-|-|
| `CountDigitComponent(name, digit, counterCell, targetCells)` | `counterCell` = count of `digit` in `targetCells`. |
| `CountDigitsComponent(name, digits, counterCell, targetCells)` | `counterCell` = count of any of `digits`. |
| `ExactDigitCountComponent(name, value, count, cells)` | `value` appears exactly `count` times. |
| `MaxDigitCountComponent(name, value, maxCount, cells)` | `value` appears at most `maxCount` times. |
| `IndexComponent(name, valueToIndex, indexerCell, cells)` | `indexerCell` = a 1-based position where `valueToIndex` sits in `cells`. |
| `NegativeIndexComponent(name, valueToNotIndex, indexerCell, cells)` | The negative of the above. |

## Differences and ratios

| Component | Rule |
|-|-|
| `DifferenceComponent(name, difference, cell1, cell2)` | `|cell1 − cell2|` = `difference` (number or list). |
| `MinimumDifferenceComponent` / `MaximumDifferenceComponent(name, d, c1, c2)` | Difference at least / at most `d`. |
| `NegativeDifferenceComponent(name, differences, c1, c2)` | Difference is none of `differences`. |
| `RatioComponent(name, ratioOrRatios, c1, c2)` | Ratio either way equals `ratioOrRatios`. |
| `NegativeRatioComponent(name, ratios, c1, c2)` | Ratio is none of `ratios`. |

## Sets, groups, membership

| Component | Rule |
|-|-|
| `HouseComponent(name, cells)` | Every digit exactly once (a "house"). |
| `DifferentDigitsComponent(name, cells)` | All different. |
| `SameDigitComponent(name, cells)` | All equal. |
| `ConsecutiveDigitsComponent` / `ConsecutiveDigitsSetComponent(name, cells)` | Form a consecutive set (repeats allowed / not). |
| `PredefinedCandidatesComponent(name, candidates, cells)` | Cells must be within `candidates`. |
| `ForbiddenCandidatesComponent(name, candidates, cells)` | Cells must avoid `candidates`. |
| `RequiredDigitsComponent(name, values, cells)` | Each of `values` gets a unique cell. |
| `RequiredGroupsComponent` / `DiverseGroupsComponent` / `SameGroupComponent` / `DifferentGroupsComponent(name, groups, cells)` | Group-membership rules over digit `groups` (work cleanly only when groups do not overlap). |

## Betweenness and links

| Component | Rule |
|-|-|
| `BetweenComponent(name, [end1, end2], midCells)` | Mids strictly between the ends. |
| `NegativeBetweenComponent(name, [end1, end2], midCells)` | Mids not between the ends. |
| `PairComponent(name, filterOrMapping, cell1, cell2)` | A pair is valid iff `filter(d1,d2)` or `mapping[d1].has(d2)`. Alias `AsymmetricalPairComponent`. |
| `WeakLinkComponent(name, c1, v1, c2, v2)` | If `c1=v1` then `c2≠v2`, and vice versa. |
| `WeakLinksComponent(name, cells1, values1, cells2, values2)` | Set-to-set weak links. |
