# count-digits-gac

Two pruning replacements for built-in rules, and the harness that holds them
sound. Both ship inside shared puzzle links, so they live here, where the
linter and `just soundness` look, and not under `docs/research/`.

This example has no board of its own (`boardless = true` in `example.toml`,
`docs/example-layout.md`): the links that ship the components are built by
`examples/outside-sudoku/build_*count_digits*.py` and
`build_*required_digits*.py`, and the boards and measurements sit in
`docs/research/count-digits-gac/` and `docs/research/required-digits-gac/`.

## Files

| File | What it is |
|---|---|
| `CountDigitsGacComponent.js` | `CountDigitsComponent(name, digits, counterCell, targetCells)` with the pruning the built-in lacks. The header holds the rule and the soundness argument. |
| `RequiredDigitsGacComponent.js` | `RequiredDigitsComponent(name, values, cells)` at full strength (Hall's condition on the digit side). |
| `BuiltinCountDigitsComponent.js` | The built-in CountDigits rule, ported from the bundle body, for the strength comparison. Not for use in a puzzle. |
| `count-digits.test.mjs` | One hand-worked case per CountDigits deduction, both stop paths and `validate`. |
| `soundness-harness.mjs` | The entry `just soundness` runs: both components below, one verdict. |
| `count-digits-soundness.mjs` | CountDigits: soundness, the built-in's `validate` against the pruning, and completeness against a brute-force oracle. |
| `required-digits-soundness.mjs` | RequiredDigits: soundness, strength against the built-in's `update`, and no more than a brute-force oracle removes. |

`RequiredDigitsGacComponent.js` takes its single-bit helpers from
`examples/_shared/bit-helpers.js` by `// #include`, the file
`HouseGacComponent.js` shares with it.

## Run

```
node examples/count-digits-gac/soundness-harness.mjs
node examples/count-digits-gac/count-digits.test.mjs
```

Every check in the soundness harness fails the run: a removed true value, a
`validate` that rejects the true solution, a RequiredDigits candidate the
built-in removes and the component keeps, a RequiredDigits removal the oracle
does not make, a CountDigits removal the oracle does not make, and a
CountDigits candidate the oracle removes that an `exact` shape keeps.

## Timing

`just time` needs a shipped board and this example has none; the timing rows
for both components are in `docs/research/count-digits-gac/README.md` and
`docs/research/required-digits-gac/README.md`.
