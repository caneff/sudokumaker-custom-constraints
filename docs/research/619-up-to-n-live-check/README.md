# Up to N in the live app after the #589 rule correction (#619)

Date: 2026-09-26. App: sudokumaker.app, footer `v2026.08.14-d47fc4b`, loaded
live (not the recorded HAR in `examples/_shared/sudokumaker.har`). Boards: the
four committed links at `9ed46b5` (main after #617 and #618).

These are the three checks #619 asks for in the shipping surface, which the
bundle end-to-end test (`examples/up-to-n/end-to-end.test.mjs`) cannot reach.

## How to re-run

From the repo root, with `.scratch/619-live/` created for the screenshots:

```
node docs/research/619-up-to-n-live-check/live.mjs     # rules text and labels, four boards
node docs/research/619-up-to-n-live-check/typed0.mjs   # a 0 typed into a marker, 4x4
```

Both drive Playwright's Chromium in the local session; neither prints a link.

## 1. Rules text

Read from the puzzle's rules field (the title button opens it). All four boards
carry the corrected rule, "the digits before the first N sum to the clue; N
itself is not added", and the worked example #589 ruled for their size:

| Board | Worked example shown |
| --- | --- |
| `PUZZLE_LINK_4x4.txt` | a clue of 4 at the left end of row 2 is true of the row 3124, since 3 + 1 = 4. |
| `PUZZLE_LINK_6x6.txt` | a clue of 11 at the left end of row 2 is true of the row 416253, since 4 + 1 + 6 = 11. |
| `PUZZLE_LINK_9x9.txt` | a clue of 12 at the left end of row 5 is true of the row 921564738, since 9 + 2 + 1 = 12. |
| `PUZZLE_LINK.txt` | a clue of 12 at the left end of row 5 is true of the row 921564738, since 9 + 2 + 1 = 12. |

No "failed" or error banner on any board.

## 2. Clue labels

Every SVG text label outside the grid, mapped to its marker by position (right
of row r is `R<r>`, above column c is `T<c>`, 0-based), against the board's gen
JSON `active` clues. All four match exactly:

| Board | Labels drawn = recorded |
| --- | --- |
| 4x4 | R1 4, R2 5, T3 0 |
| 6x6 | B0 16, L1 4, L3 9, L4 12, R5 0, T2 7 |
| minimal 9x9 | B4 0, B7 24, L3 10, L4 29, R0 2, R1 33, R2 33, R5 22, R7 11, T1 32, T3 0, T5 30, T8 19 |
| shipped 9x9 | B1 11, B4 0, B7 24, L3 10, L4 29, L6 17, L7 26, R0 2, R1 33, R2 33, R5 22, R7 11, R8 9, T1 32, T3 0, T5 30, T7 13, T8 19 |

The screenshots of the 4x4 were also read by eye: `0` above column 4, `4` right
of row 2, `5` right of row 3.

## 3. A 0 typed into a marker in the editor

On the 4x4: open the Up to N element, pick a group tab, type `0` in `Value:`,
press Enter, then run the app's solution finder (Tools, "ShowCandidates").

| Marker | True clue | Refusal banner | Solver readout |
| --- | --- | --- | --- |
| tab 1, B0 (bottom of column 1) | 0 | none | "This is a unique solution." |
| tab 2, B1 (bottom of column 2) | 7 | none | "This puzzle is broken: the Up to N clue read from R2C4 cannot reach its sum" |

The typed 0 registers as a clue: accepted with no setup refusal, consistent
with the true grid where the true clue is 0, and a contradiction where it is
not. Before #617, main.js refused a 0 at setup as not a positive integer.

A typed value draws no label outside the grid. That is by design: labels are
type-2002 cosmetic symbols the builder writes (`examples/up-to-n/README.md`
§ Clue labels), so a hand-typed marker has none until the setter adds one.
