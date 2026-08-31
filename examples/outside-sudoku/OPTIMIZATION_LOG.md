# Outside Sudoku — optimization log

Every speed-up tried on `OutsideSudokuComponent.js`, kept or rejected, with the
numbers that decided it. Read this before trying a new one — a dead end here
does not need a second attempt. Background: `docs/real-app-timing.md` (the
method), issue #259 (the spec), issue #260 (this component).

The first real-app timing row landed with #262: `just time outside-sudoku
--ring-clues` on the shipped board prints BASELINE on both rows — see README,
`## Timing`, for the full rows and why there is no `original/` baseline to
compare against. No deduction has yet been shown to pay for itself against a
real alternative; the table below records what has been considered.

#268 renamed the boards without changing a line of component code. The board
timed at 900ms / 300ms below is now `PUZZLE_LINK_local.txt`, and it still
times 900ms / 300ms; the shipped `PUZZLE_LINK.txt` is the 9x9 global-lane
board, at 500ms / 300ms. Both are BASELINE rows on the same component.

| Variant | Kept / rejected | Real-app numbers | Board + timer caveat | Commit |
|---|---|---|---|---|
| Three deductions in one pass, off `getCandidatesBitMask` (clue pruning, forced placement, dead branch) | Kept — the shipped baseline | 900ms cold, 300ms after-logical (#262, BASELINE only — no candidate diff) | the seed-101 board, `--ring-clues`; shipped then as `PUZZLE_LINK.txt`, now as `PUZZLE_LINK_local.txt` | this log's commit |
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
- **A hand-built `original/` wrapper around `RequiredDigitsComponent`.** No
  catalog author ships an Outside Sudoku "Interactable" template (#262
  checked, README "No `original/` baseline"), but the builtin
  `RequiredDigitsComponent(name, values, cells)` — "each of `values` gets a
  unique cell" — could stand in for the builtin half of the usual wait-then-
  swap wrapper: idle while the clue is blank, then
  `RequiredDigitsComponent(name, [clueValue], line.slice(0, w))` once it is
  filled. Not built: it would be new code this repo authors and maintains,
  not a verbatim baseline, and needs the same window-length geometry
  (`OutsideSudokuComponent.js`'s `windowLength`) duplicated into the wrapper.
  Worth a follow-up ticket if a real capability-gap number (like Numbered
  Rooms' wrapper-vs-ours) is wanted.
