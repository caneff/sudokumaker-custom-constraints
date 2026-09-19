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
  checked, README "No `original/` baseline"). **Built in #534** — not as a
  second baseline for this component (`OutsideSudokuComponent.js` still wins
  in three bitmask reads and needs no detour through RequiredDigits), but to
  give `docs/research/required-digits-gac/RequiredDigitsGacComponent.js` a
  real-app timing row it had none of: no example registered a
  RequiredDigits-shaped component to swap. The wrapper
  (`docs/research/required-digits-gac/RequiredDigitsWrapperComponent.js`)
  idles while its clue is blank, then swaps itself
  (`puzzle.replaceComponent`, docs/gotchas.md #1) for a required-digits rule
  over the clue's window, window-sized with its own copy of
  `OutsideSudokuComponent.js`'s `windowLength`. Two swap targets:
  `RequiredDigitsWrapperComponentBuiltin.js` (the real built-in
  `RequiredDigitsComponent`) and `RequiredDigitsWrapperComponent.js`
  (`customComponents.RequiredDigitsGacComponent`). Lives in
  `docs/research/required-digits-gac/`, not as this example's own board —
  see that directory's `README.md` for the built boards, the reproduce
  commands, and the recorded rows (and why they read `Found 10,000
  solutions`, a probe-method property the unmodified shipped board shares,
  not a soundness regression).
