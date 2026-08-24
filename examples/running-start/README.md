# Running Start — a worked custom constraint

Running Start is a Skyscrapers variant. Each outside clue counts how many digits
keep increasing, starting from the cell next to the clue and reading inward,
until the first digit smaller than its predecessor.

Example line `1 2 4 5 3 9 6 8 7`:
- From the left: `1 < 2 < 4 < 5`, then `3` drops → clue **4**.
- From the right (`7 8 6 …`): `7 < 8`, then `6` drops → clue **2**.

A line's clue is `1 + (length of the strictly increasing run from the clued
end)`. In a sudoku line all digits differ, so "not increasing" always means a
strict drop.

## Files

- `main.js` — the backend segment. One self-contained component per line.
- `RunningStartComponent.js` — the component segment. Both directions of
  propagation plus the final check.
- `soundness-harness.mjs` — Node soundness test (see below).
- `generate.py` — fresh grid, derived clues, uniqueness proof (OR-Tools).

## Paste into SudokuMaker

Build the interactive-outside frame (see `../../docs/patterns.md`), add a custom
local constraint, and paste `main.js` as the main code and
`RunningStartComponent.js` as one component named `RunningStartComponent`. Each
group is one line: cell 0 the outside clue, the rest the line read inward.

## Why one self-contained component

The Skyscraper Lines template uses a wrapper that, once the clue cell has a
value, calls `replaceComponent(instance, new SkyscraperComponent(...))`. That
works only because `SkyscraperComponent` is **built-in**. Swapping in a *custom*
component that way silently does nothing (see `../../docs/gotchas.md`). So
Running Start is a single component that holds the clue cell and the line and
does everything itself.

## What the component deduces

Forward (clue known or partly bounded) and reverse (clue read from the line),
all sound:

- **Reverse, exact** — a filled leading run that then drops fixes the clue; a
  fully increasing line fixes it to the line length.
- **Reverse, bounds** — a filled increasing run of length `i` (next cell empty)
  gives `clue ≥ i`, and `clue ≤ i + (9 − lastValue)`. Also `clue ≤ 10 −
  min-candidate(line[0])`.
- **Forward, guaranteed prefix** — if the clue's smallest remaining candidate is
  `kmin`, the first `kmin` cells must strictly increase; enforce those
  inequalities before the clue is pinned.
- **Forward, pinned** — a known clue `k` gives the prefix its chain bounds
  (`line[i]` in `[1+i, 9−(k−1−i)]`), candidate-aware pairwise `<`, and the
  descent `line[k] < line[k−1]`.
- **validate** — once clue and line are filled, the count must equal the clue.

## Run the tests

Soundness (needs Node and a solution dump):

```
# fresh_sol.json must hold {"val": <121 board values>, "groups": [[clueCell, [lineCells...]], ...]}
node soundness-harness.mjs
# -> "random partial-state tests: 20000  soundness violations: 0"
```

Generation and uniqueness (needs Python with ortools):

```
python generate.py
# -> chosen seed, interior givens, clues kept, "FINAL unique OK"
```

`soundness-harness.mjs` reads its solution from `fresh_sol.json`; produce that
file by decoding a built puzzle link (see `../../docs/patterns.md`) and writing
out the `cells` values and the constraint's `input.groups` in
`[clueCell, lineCells]` form.
