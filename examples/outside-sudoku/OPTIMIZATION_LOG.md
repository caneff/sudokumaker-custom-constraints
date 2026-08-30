# Outside Sudoku — optimization log

Every speed-up tried on `OutsideSudokuComponent.js`, kept or rejected, with the
numbers that decided it. Read this before trying a new one — a dead end here
does not need a second attempt. Background: `docs/real-app-timing.md` (the
method), issue #259 (the spec), issue #260 (this component).

The first real-app timing row lands with #262. Until it does, no row here
carries seconds, and no deduction has been shown to pay for itself in the app.

| Variant | Kept / rejected | Real-app numbers | Board + timer caveat | Commit |
|---|---|---|---|---|
| Three deductions in one pass, off `getCandidatesBitMask` (clue pruning, forced placement, dead branch) | Kept — the shipped baseline | not measured yet (#262) | — | this log's commit |
| Window length cached on the instance after the first `update` | Kept | not measured; the alternative re-reads `getRegionCells` on every pass, which is a per-call cost the app pays on every propagation (`docs/agents/per-call-cost.md`) | — | this log's commit |
| A separate branch for the dead-branch deduction (clue solved, no window cell admits it) | Rejected — dead code | the clue's digit is absent from the window union, so the clue-pruning step already empties the clue. A second branch yields a removal on an empty cell and nothing else. | — | this log's commit |

## Ideas not tried

- **Coupling the clues of one line.** Two clues on one row (both ends) or a row
  clue crossing a column clue are separate components today, with no shared
  deduction. #259 puts the coupling out of scope and asks for it to be logged
  here if pruning proves weak. Nothing yet says it is.
- **A `hasValue` early exit on a filled window.** Numbered Rooms tried the
  equivalent ("early exit on a filled line") and measured no gain. Expect the
  same here: the window is three cells and the pass is already three bitmask
  reads.
- **Union-of-windows across a whole side** (a side component, global only). It
  would need the frame, so it belongs to a global-only component and to a
  timing run, not to the line component.
