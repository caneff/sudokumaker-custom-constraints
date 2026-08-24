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
- **Corner cells** are often `given: true` with a filler value (e.g. `1`) so the
  solver ignores them; they belong to no line.
- **Conflict checking** for the ring: the puzzle adds hidden row/column cages
  (`type: 301`) and a small JSON post-process constraint that tags them
  `rowcol` and sets `norowcol`, so the app's duplicate checker treats ring
  cells correctly. This needs a userscript at publish time; it is optional and
  cosmetic for solving.

Whether a clue is **shown** is the `given` flag on its ring cell, not its
presence. `given: true` = a visible clue the solver reads; `given: false` = a
blank the solver must deduce. The full solution value is stored either way.

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

## Constraint list — the types we have seen

| `type` | Meaning |
|-|-|
| `0` | Standard sudoku (rows, columns, boxes). |
| `1` | Regions map (`regions`: one region id per cell, `-1` = none). |
| `101` | Cell decoration (circles); `cells` + `style`. Purely cosmetic. |
| `301` | Named cages / houses (used here as hidden `rowcol` helpers). |
| `1000` | **Custom constraint** — `definition` (main code + components), `input.groups`. |
| `2000` | Cosmetic line drawings; `lines` (arrays of `{x, y}` points) + `style`. |

A `type: 1000` constraint carries `definition.backend.code` (the main segment)
and `definition.components[]` (each `{ type: "code", name, code }`), plus
`input.groups` for a local constraint.
