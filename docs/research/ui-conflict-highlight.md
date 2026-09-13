# How the editor decides which cells to paint red

Static read of the app's UI bundles (`main-D44ZZMA9.js`, `puzzleQueries-DKblPzGJ.js`
from `examples/_shared/sudokumaker.har`), 2026-09-13, **confirmed live the
same day** by `validate-only-probe/probe-highlight.mjs` (results at the end).

## The path

1. `SudokuEditor` watches the solver input and the `highlightConflicts`
   setting (`main.js` byte 938201). Any cell edit re-runs a queued
   `validateGrid` call to the puzzle-queries worker.
2. The worker's `validateGrid` (`al` in `puzzleQueries.js`, near the end of
   the file) builds a state from the entered values, then collects
   `invalidCells`:
   - peer duplicates from `getCellsSeenByCell`, which covers the plain
     row/column/box rules;
   - for every other component (the `Different` and `House` classes are
     skipped because the peer loop already covers them), it runs
     `initializeComponent` and, on any change of `type === "failed"`, adds
     the component's whole `cellIds`;
   - then calls `component.validate(state)` and, when `.valid` is false, adds
     the component's whole `cellIds`.
3. The editor marks a cell invalid when its id is in that set.

Custom (type 1000) components go through both loops like a killer cage. The
highlighted cells are always the component's own `cellIds`, which for a custom
component is what `getAffectedCells` returned; no `cells` field on a validate
result is ever read, for built-ins either.

## Why a custom `validate` can never highlight

The custom-component wrapper coerces the author's return by truthiness:

```js
return validateWrapper() ? __VALID : { valid: false, message: `unable to satisfy ${this.name}` }
```

An object is truthy, so a `validate` that returns `{ valid: false, message }`
in the built-in style is reported as satisfied every time. Only a bare `false`
reaches the editor. This is the most likely cause of the "typing a wrong digit
raises no conflict" report that the old gotchas §2 recorded, if the component
in question returned an object. A component that returns a bare boolean and a
non-empty `getAffectedCells` should highlight.

## What `update` does here

The highlight path never calls `update` directly, but `initializeComponent`
runs the base `initialize`, which ends in `update`. So an `update` whose yield
produces a failed change (for example emptying a cell's candidates) does
highlight through loop 2. Whether the solver state turns "remove the only
candidate of an entered cell" into a `failed` change is what the live probe
has to establish.

## Live probe

`probe-highlight.mjs` loads each board from the recorded app, selects r1c2
(the probe component's cell, which the component says must be 4), types a
digit, and reads the cell text's fill; the app paints an invalid cell `#f00`.
Digit 5 is legal for every house, so only the custom component can flag it.
Digit 2 duplicates r1c1 and checks the detector.

| Board | typed 5 | typed 4 | typed 2 |
|-|-|-|-|
| control (no custom component) | black | black | red |
| validate-only, returns bare boolean | **red** | black | red |
| validate-only, returns `{ valid, message }` | black | black | red |
| update + validate, bare boolean | **red** | black | red |

So the editor does consult a custom `validate`, and a bare `false` highlights
the component's cells. Returning the built-in-style object silences it
completely. The old "no conflict" report is explained.

Run: `node docs/research/validate-only-probe/probe-highlight.mjs <link.txt>`
with any `PUZZLE_LINK_*.txt` in that directory; `validate-object.json` is the
object-returning variant.

## Open

- Whether disabled constraints are filtered before `getConstraintComponents`.
- Whether an `update` alone (no `validate`) can highlight through the
  `initialize` loop; the probe boards all carry a `validate`.
