# A validate-only custom component is not inert

**Result:** a custom component that defines `validate` and no `update` does
run inside the solver. It rejects wrong states and can break a puzzle. What it
never does is remove a candidate, so cells keep their full candidate set until
the search runs. `gotchas.md` §2 said the component was inert; that was wrong
and is now corrected. Probe run 2026-09-13 against the recorded app
(`examples/_shared/sudokumaker.har`, app `v2026.08.14-d47fc4b`).

## Why it was re-tested

Reading the deobfuscated solver (`docs/research/bundle-api-reference.md`,
"When the solver calls what") showed the call path with no dependence on
`update`: the custom-code wrapper installs a `validateDuringSolve` getter
returning `true` whenever the segment defines `validate`, and
`SolverState.validate` calls every such component at start, after every
changed step, inside the solution search, and in the solved check. A doc
marked verified disagreed with the source, so the live app got the last word.

## The probe

A 9×9 with 77 givens and one four-cell swap left empty (r1c2, r1c9, r2c2,
r2c9; the two rows share a band, the two columns do not share a box). One
custom component watches r1c2. Four variants, each a link in
`validate-only-probe/`:

| Link | Component | App verdict |
|---|---|---|
| `PUZZLE_LINK_control.txt` | none | Found 4 solutions |
| `PUZZLE_LINK_validate-only.txt` | `validate` only: r1c2 must be 4 once filled | Found 2 solutions |
| `PUZZLE_LINK_update-and-validate.txt` | same rule with an `update` that prunes r1c2 to 4 | Found 2 solutions |
| `PUZZLE_LINK_always-false.txt` | `validate` returns `false` | "This puzzle is broken: unable to satisfy probe: r1c2 must be 4" |

`validate` alone halves the solution set, and an always-false `validate`
rejects the puzzle outright with the component's own name in the message, so
it is being called. `probe-verdict.mjs` is the Playwright runner that prints
the app's verdict line for one link:

```
node docs/research/validate-only-probe/probe-verdict.mjs docs/research/validate-only-probe/PUZZLE_LINK_validate-only.txt
```

## What stands from the old gotcha

- Cells keep their full candidate set: expected, `validate` cannot prune.
- "Entering a wrong value raises no conflict": not reproduced here and not
  explained by the solver bundle. The UI's conflict check lives in the app's
  main bundle, which has not been read. Do not rely on either reading of that
  symptom.
- The practical advice stands for a different reason: without an `update`,
  the solver learns about your rule only by trying values and failing, so a
  validate-only component makes the search slower and shows the player no
  candidate eliminations.

## Why the control has 4 solutions, not 2

A brute-force count of the emptied grid under full sudoku rules gives 2. The
app gave 4 because the probe document carried `type: "custom"`, and a
custom-type puzzle has no row or column houses at all: only the regions. Three
more controls settle it, all in `validate-only-probe/`:

| Link | Change from the control | App verdict |
|---|---|---|
| `PUZZLE_LINK_control-classic.txt` | header fields dropped (the classic default) | Found 2 solutions |
| `PUZZLE_LINK_control-typesudoku.txt` | `type: "sudoku"` | Found 2 solutions |
| `PUZZLE_LINK_control-colpattern.txt` | `type: "custom"`, the swap pattern transposed (same stack, two bands) | Found 4 solutions |

The mechanism, from the solver bundle (`bundle.claude.js:11453`): the worker
prepends an internal `SudokuRules` constraint (type 2003, one house per row
and per column) only when `spec.type === "sudoku"`. The wire's `{type: 0}` is
`Givens`, not the sudoku ruleset, and `{type: 1}` is `Regions`. So on a
custom-type puzzle rows and columns exist only if the document adds them,
which is gotcha 9. The classic type also selects the standard logic-step
generator over the custom one (`bundle.claude.js:11529`), and lets the X-sum
handler use its impossible-value table (`bundle.claude.js:11414`).

The validate-only verdicts above are unaffected: every variant shared the same
custom-type header, so the counts compare like with like.
