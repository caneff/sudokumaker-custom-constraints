# Patterns

## Local groups

A local constraint's main code reads `input.groups`. Each group is
`{ value: string, cells: CellId[] }`:

- `value` — the text the author typed in the group's value field. Often empty
  when the clue lives in a cell instead.
- `cells` — the cells in the order the author drew them.

A common convention (used by the built-in "Skyscraper Lines" template and by
our Running Start): **cell 0 is a clue/target cell, the rest is the payload
line read in order.** Split with `group.cells[0]` and `group.cells.slice(1)`.

## The interactive-outside frame

"Enterable outside clues" is not a special feature — it is a construction. The
author builds a grid one ring larger than the puzzle (an 11×11 board around a
9×9 sudoku) and puts the clues in the outer ring's cells. Anatomy:

- **Board size** is `width/height = 11`. Interior cell `(r, c)` for `r, c` in
  `1..9` sits at index `r*11 + c` (row-major over 121 cells).
- **Outer ring** (40 cells) holds the clues: 9 per side plus 4 corners.
  - left of row `r`: index `(r+1)*11 + 0`
  - right of row `r`: index `(r+1)*11 + 10`
  - top of column `c`: index `0*11 + (c+1)`
  - bottom of column `c`: index `10*11 + (c+1)`
- **Reading direction** is baked into each group's cell order: the line lists
  the cell next to the clue first, then inward.
- **A region constraint** (`type: 1`) marks the interior 9×9 as the real sudoku
  and the ring as `-1` (no region).
- **Cosmetic layers** (`type: 2000` line drawings) hide the ring's cell borders
  so it reads as a margin, not extra cells: "White Lines", "Outside Cell
  Outlines", "Grid Outer Border".
- **Corner cells** belong to no line, no region and no cage, so nothing
  reaches them: left free, the board is **not unique**. They are held down by
  a component that pins them to one digit
  (`examples/_shared/frame-corners.js`), not by a filler given -- a given
  there is a digit the recipient reads off the board, which is what every
  shipped link used to show in all four corners (#394).
- **The interior's rows and columns have to be declared, and they enforce the
  puzzle.** Not decoration, not optional: a region constraint gives BOXES
  ONLY, so undeclared rows and columns are not houses at all, and the app
  answers **not unique in 400 ms** where it answered unique in seconds (#394;
  the same fact cost three tickets of quad-rank work, docs/gotchas.md #9).
  `framebuild.py` declares them in `examples/_shared/frame-rowcol.js` as named
  `HouseComponent`s -- `row 4`, `column 7` -- rather than as the transparent
  `type: 301` cages it used to ship. Two reasons: a cage **cannot be named**
  (the app hard-codes `the cage at <cell>`, the identical string for row 1 and
  column 1), and the named houses cost nothing once their cell ids are coerced
  with `| 0` (see `docs/puzzle-api.md`, `helpers.geometry`). A line shorter
  than the digit range gets a `DifferentDigitsComponent` instead: Hit Counts
  runs `minDigit: 0`, so "every digit exactly once" is false there.
  `check_layout.check_houses` sweeps every committed link and accepts either
  form.
- **Conflict checking for the ring**, at publish time: the same file's
  `postprocessJSON` sets `norowcol` -- a ring clue shares a physical row with
  the interior, so SudokuPad's duplicate checker would read it as a repeat --
  and pushes the same lines back as hidden `rowcol` cages, since the export
  otherwise carries no line rule at all. **This is a Tampermonkey userscript
  hook, not an app one**: the app has no `postprocessJSON` and never calls it,
  which is why the name appears in none of its bundles.

**A cell holds a value only when it is a given.** A shown clue is a ring cell
with `given: true` and its value; a hidden (interactive) clue is an **empty**
ring cell, `{}`; an interior cell that is not a given is `{}` too. Never store
the solution or a hidden clue's value: a non-given value is an *entered* digit,
so the shared link opens with the grid and clues already typed in.
`framebuild.py` enforces this; the "n entered values on the board" refusal in
`app-solve.mjs` is the symptom when a link gets it wrong.

## Encoding a puzzle

The `?puzzle=` payload is lz-string over the JSON document:

```python
import json, urllib.parse
from lzstring import LZString                     # pip install lzstring

def link_to_doc(link):
    payload = link.split("puzzle=")[-1]
    raw = LZString.decompressFromEncodedURIComponent(urllib.parse.unquote(payload))
    return json.loads(raw)

def doc_to_link(doc):
    payload = LZString.compressToEncodedURIComponent(json.dumps(doc))
    return "https://sudokumaker.app/?puzzle=" + payload
```

Document shape (top level): `formatVersion`, `puzzle`. Inside `puzzle`:
`name`, `author`, `comment`, `type`, `width`, `height`, `cells` (one
`{ value?, given? }` per board cell, row-major), and `constraints` (a list).

`minDigit` and `maxDigit` appear on most boards but neither is guaranteed —
isofill's links carry `minDigit` and no `maxDigit`. Read both with a default;
a bare `puzzle["maxDigit"]` raises on a link that is otherwise fine.

## Constraint list — the types we have seen

| `type` | Meaning |
|-|-|
| `0` | Standard sudoku (rows, columns, boxes). |
| `1` | Regions map (`regions`: one region id per cell, `-1` = none). |
| `101` | Cell decoration (circles); `cells` + `style`. Purely cosmetic. |
| `301` | Named cages / houses. Frame boards no longer use these: a cage cannot be named, so their interior lines are `HouseComponent`s (#394). |
| `304` | Named cage rule; `name` + `cages`. Hit Counts ships one as "Disallow 0 in the main grid". |
| `1000` | **Custom constraint** — `definition` (main code + components), `input.groups`. |
| `2000` | Cosmetic line drawings; `lines` (arrays of `{x, y}` points) + `style`. |

A `type: 1000` constraint carries `definition.backend.code` (the main segment)
and `definition.components[]` (each `{ type: "code", name, code }`), plus
`input.groups` for a local constraint.

## Coupling opposite-end clues

Two clues that read the same line from opposite ends couple into one bound that
neither clue reaches alone. Both the Hit Counts and Running Start examples do
this in a separate pair component (`*PairComponent.js`), which `main.js` adds
whenever two groups hold the same line reversed.

The bound has the same shape in both:

- **Hit Counts:** a left hit at cell `j` is value `j+1`, a right hit is `n-j`;
  they coincide only at the center, so the hit sets are disjoint and
  `A + B <= n` (`n+1` when `n` is odd and the center hits both ways).
- **Running Start:** the left run is an increasing prefix, the right run an
  increasing-inward suffix; the two share at most the peak, so `A + B <= n + 1`.

From the bound, cap each clue by the other's smallest remaining value: remove
from `A` every candidate above `cap - min(B)`, and the reverse for `B`. It fires
whenever either clue's candidates shrink.

**Saturation pins the line.** When `min(A) + min(B) === cap`, both clues are
pinned and every cell is committed. Hit Counts restricts each still-hittable
cell to `{j+1, n-j}`; Running Start propagates the two monotone runs from the
forced peak. These are per-cell cuts from the clues alone, before any interior
digit is known.

**Tighten the cap as cells fill.** The static cap is loose once interior cells
lose the power to hit. Hit Counts recomputes `cap` each pass by summing, per
cell, whether it can still hit either way; a lower cap is a stronger clue bound.
Any end-pair bound whose terms decay as cells fill can do the same.

## Cheap passes

A component's `update` runs to a fixpoint and reruns on every change. Keep each
pass cheap:

- **Never yield an empty removal.** Guard every `yield` with
  `if (removed.length > 0)`. A no-op Change wakes the solver for nothing and can
  stall the fixpoint. Both examples guard every yield.
- **Skip work the solved state makes pointless.** Guard the reverse pass (deduce
  the clue from the line) behind `if (!puzzle.hasValue(clue))`; once the clue is
  known there is nothing to deduce about it.
- **Deduce both directions in one component.** Each line component runs the
  clue-from-line and line-from-clue deductions in the same `update`, so one pass
  prunes both ends.

## Generalizable single-clue moves

Two moves appear in one example each but transfer to any outside-clue
constraint.

**Aggregate coupling: bound a whole side's clues at once.** Hit Counts'
`SideSumComponent` uses that the `n` clues on one side sum to exactly `n` — each
column is a permutation, so it gives one hit, `n` per side. The component
enforces `sum === n` with bounds propagation over all `n` clue cells: each cell
sits in `[target - sum(other maxima), target - sum(other minima)]`. This couples
clues that share no cell, the strongest kind of cut. Any side of clues with a
provable total or bound can do the same — visible-count sums, X-sums, sandwich.
It needs the whole side present, so fire it only on a full side of `n` clues; a
partial side gives an unsound bound.

**Exact feasible-clue set from one walk.** Running Start's `feasibleClues` does
not bound the clue to a min/max interval. It walks the line once, tracking the
smallest and largest value a length-`k` increasing prefix can end on, and keeps
a clue value `k` only when a real descent after it is still possible. This drops
interior values a plain range would keep. Any clue that encodes a line pattern —
run length, visible count, first-seen digit — can compute its exact feasible set
this way in one pass over candidates: stronger than an interval, still cheap.
