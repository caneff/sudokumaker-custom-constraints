# A no-ring board's rows and columns come from a `"sudoku"` header (#367)

> **Superseded for shipping (#368).** The live editor opens a `"sudoku"`
> document as 9x9 whatever its width says, so this header is wrong at every
> size but 9 (`368-up-to-n-setup-throw.md`). A no-ring board now ships
> `"custom"` with `examples/_shared/grid-rowcol.js`. The headless result below
> still stands.

**Finding.** A bare n x n document with `"type": "sudoku"` gets the solver's
own row and column houses, and a custom constraint (type 1000) on it still
registers and prunes. That is the header `framebuild.no_ring_doc` writes.
**[verified headless, 4x4]**

## Why the question came up

A frame board is `"type": "custom"` and declares its interior rows and columns
in `frame-rowcol.js` (docs/gotchas.md #9). That backend drops the first and
last line and the first and last cell of every line, because those are ring.
On a board with no ring it would drop real cells, and `frame-corners.js` would
pin four real cells to the lowest digit. Neither can ship on a no-ring board,
and editing either would change the code embedded in every sibling's link.

The bundle prepends a `SudokuRules` constraint only when
`spec.type === "sudoku"` (`bundle.claude.js:11446`, `buildSolverStateFromPuzzle`), so
the header alone is enough on a board with no ring to hide.

## The check

`367-no-ring-board-type/build_docs.py` writes four empty 4x4 documents (2x2
boxes, `minDigit` 1, `maxDigit` 4). Two carry a type-1000 constraint whose
backend reads `input.groups` and pins cell 0 to the group's value `"1"` with a
`PredefinedCandidatesComponent`. `count.mjs` counts every solution through the
real bundle (`examples/_shared/bundle-solve-lib.mjs`).

```
uv run docs/research/367-no-ring-board-type/build_docs.py > .scratch/367-docs.json
node docs/research/367-no-ring-board-type/count.mjs .scratch/367-docs.json
```

| Document | Solutions | Reading |
|---|---|---|
| `sudoku` | 288 | the true 4x4 sudoku count: rows and columns enforced |
| `sudoku+pin` | 72 | 288 / 4: the custom constraint ran on a sudoku header |
| `custom` | 331776 | boxes only, (4!)^4: no rows or columns |
| `custom+pin` | 82944 | 331776 / 4 |

## What this does not show

- That the editor UI opens a `"sudoku"`-type link with a custom constraint the
  same way it opens a custom one. The first up-to-n link settles that in the
  live app (`just time`).
- Solve time. A `"sudoku"` header also switches the logic steps from
  `CustomLogicStepsGenerator` to `StandardLogicStepsGenerator`
  (`bundle.claude.js:11529`), which adds fish, X-wing, Y-wing and the rest.
  They are sound on a real sudoku; whether they pay is a timing question.
- `check_layout.check_houses` reads houses off the document and does not know
  the header supplies them. An example that ships a no-ring link needs that
  check taught, or an exemption.
