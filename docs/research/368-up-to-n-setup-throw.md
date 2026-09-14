# Up to N in the app: a setup throw, and a no-ring link in the live editor (#368)

**Findings.**

1. **A throw in main code is shown in the editor UI, not only the console.**
   The live app prints a banner under the grid, "Registering custom
   constraint 'Up to N' failed", with the error message below it. The
   constraint is then dropped whole and the board solves without it.
   **[verified live, v2026.08.14-d47fc4b, HAR replay]** The headless bundle
   agrees on the solve: one `console.error`, and 288 solutions on the 4x4
   (a plain 4x4 sudoku) where the shipped board has 1. **[verified headless]**
2. **A `"type": "sudoku"` document opens as 9x9 in the live editor whatever
   its `width` and `height` say.** On the 4x4 Up to N link the editor draws a
   9x9 grid, spreads the 16-entry `regions` array over its first two rows, and
   hands main code `puzzle.spec.size = { width: 9, height: 9 }`. main.js then
   reads the 4x4 group cells on a 9-wide board and refuses the first marker
   ("R2C4 and R1C9"), and the app finds 10,000+ solutions.
   **[verified live]** The headless bundle honours the header's size, which is
   why docs/research/367-no-ring-board-type.md saw a working 4x4. So #367's
   no-ring header is sound at 9x9 only.
3. **A `"type": "custom"` 4x4 with row and column cages opens and solves
   correctly**: a 4x4 grid, and "This is a unique solution." Every cell carries
   a dashed cage outline. **[verified live]** What ships instead declares the
   rows and columns as `HouseComponent`s in a backend,
   `examples/_shared/grid-rowcol.js`, which draws nothing: the rebuilt 4x4 opens
   as a plain 4x4 with no outlines and the app reports "This is a unique
   solution." **[verified live]**
4. **The drawn markers are invisible.** A raw-groups constraint draws nothing,
   so neither the marker cells nor the typed clue values appear on the board
   in either document type. A player opening the link sees no clue. **[verified
   live]**

## How to rerun

```
node docs/research/368-up-to-n-setup-throw/probe.mjs examples/up-to-n/PUZZLE_LINK.txt
node docs/research/368-up-to-n-setup-throw/live-probe.mjs <link_file> [screenshot tag]
```

`probe.mjs` runs the real bundle headless on the shipped link, on a copy with
one three-cell marker, and on a copy with every marker empty:

| Variant | Solutions | console.error |
|---|---|---|
| shipped | 1 | 0 |
| one malformed marker | 288 | 1: "Up to N: the marker at R4C1 and R3C1 and R3C2 must be exactly two cells" |
| every marker empty | 288 | 0 |

`live-probe.mjs` opens a link in the recorded live app, clicks "Find all
solutions", prints the readout and console errors, and writes screenshots to
`.scratch/368-live-*.png`. The diagnostic link for finding 2 replaced main.js
with a throw of `JSON.stringify` over `puzzle.spec.size`, `puzzle.spec.type`,
the first four groups, and `helpers.naming.getCellName` of cells 0, 1, 3, 4,
15. It printed `{"width":9,"height":9}`, `"sudoku"`, the groups unchanged
(`[12, 8]` ...), and names `R1C1, R1C2, R1C4, R1C5, R2C7` -- a 9-wide board.
The finding-3 link is the shipped document with `"type": "custom"` and two
type-301 constraints, "Rows" and "Columns", one cage per line.
