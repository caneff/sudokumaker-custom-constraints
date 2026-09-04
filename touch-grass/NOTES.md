# Touch grass — session record (2026-09-04)

"Touch grass" is a 20x20 SudokuMaker board holding four overlapping 6x6
sudokus (Red top, Blue right, Green bottom, Purple left; 3-wide x 2-tall
boxes) with an interactive outside-clue ring around each: every ring cell is
an unfilled cell whose value acts as a clue the solver must deduce. Grass
(given 1s) fills the rest. Rules per grid: **Skyscrapers (Red), Numbered
Rooms (Blue), Running Start (Purple, strict), Outside Sudoku (Green, window =
first 3 cells for rows AND columns — deliberately not box-shaped)**.

## Files here

- `rebuild.js` + `patch.js` + `link_in.txt` — regenerate `board_out.json` and
  `PUZZLE_LINK_touch_grass.txt` (the 1x1 board) from the original link.
  **`link_in.txt` is currently an incomplete transcription (blob 8052 chars,
  needs 8886) — replace it with a good copy of the original link before
  running.** The original link arrived chat-mangled; `rebuild.js` contains the
  one-pattern repair (`9.5,"y""y":` → `.5},{"x":0.5,"y":`).
- Components are lifted verbatim from this repo's examples (`numbered-rooms`,
  `skyscraper`, `running-start`, `outside-sudoku` — each's local-lane
  PUZZLE_LINK), so their soundness harnesses cover the embedded code.

## Edits the 1x1 board carries (all in `rebuild.js`)

1. Regions/Columns/Rows house components cloned from Red to Blue/Purple/Green.
2. All 12 house backends name their houses ("Red row 4") — fixes
   "nameless constraint" messages.
3. Four clue families added, one per grid (24 lines each, clue cell first,
   line reading inward; Outside ships only its 3-cell window as the line).
   Each line is named "<Rule>, clue RxCy reading <dir>".
4. "Named messages (patch)" constraint (`patch.js`): wraps
   `helpers.naming.getCellsDescription` to append the containing house to
   app-built messages ("R7C8 and R8C9 (Red box 5) must both be 1").
   Unverified against the live app: if the suffix never shows, the app used a
   different naming instance and the patch is a silent no-op.
5. Central 2x2 (r9-10 x c9-10, 0-based) filled with given 1s.
6. r13c1 (0-based) fixed: was a genuinely free cell (no constraint, not
   given → 6+ solutions) with a malformed white-mask symbol `[1.5,13.5]`;
   now given 1 with the mask entry completed.

## CP-SAT findings (exact semantics from the examples' generators)

Feasibility of the whole system — houses + all four clue families, clue
cells as variables:

- **1x1 overlaps (the kept design): feasible.** 16 of 24 rule→grid
  assignments work; the 8 failures are exactly the ones with **Skyscrapers
  and Running Start on opposite grids**. Box shape (3x2 vs 2x3) changes
  nothing at 1x1.
- **Any deeper overlap with full rings is impossible.** 2x1, 1x2, single-2x2
  corner hybrids, full 2x2: 0 of 24 assignments each, under every box-shape
  mix (16 combos tested at full 2x2; both uniform shapes for hybrids).
- **Why NR dies on a side grid at 2x2** (the sharpest core): the four left
  clues on overlap rows each have clue + first two line cells inside a
  neighbor row → indexer k ∈ {3..6}; the four indexers share blue col 1 →
  exactly {3,4,5,6}; the overlap rows are full neighbor-box rows (boxes
  3-wide) → six-distinct squeeze; all 24 index assignments then close.
  Rotated grids escape because 2-tall boxes split the vertical triple.
- **Path idea (2x2 with clues gated by a drawn path): viable.** With clues
  only on true outside cells, all 24 assignments are feasible. Reactivating
  in-grid ring cells is fine in most combinations but the minimal infeasible
  cores are dense (73+ found, most mixing NR/RS/Out lines; Skyscrapers nearly
  never implicated; smallest core = NR's left quartet, then 6-cell NR+RS
  mixes). No human-memorable rule — check each intended path's activation
  set with one CP-SAT solve. Both assignments tried (RS purple vs RS green)
  are equally open (19-21 of 32 in-grid lines simultaneously activatable).
- **1x1 board solution space**: 23 of 212 unknown cells are forced (same
  digit in every solution), clustered near the cross-center; candidate-count
  histogram {1:23, 2:28, 3:35, 4:40, 5:56, 6:30}; ≥1,000,000 solutions even
  ignoring outside-sudoku clue multiplicity (16 pure Out clues pinned).
  Uniqueness needs carving.

## Lost artifacts (rebuildable)

The session scratchpad was wiped before anything was committed. Gone:
`board_out.json`, `board_2x2*.json`, all `PUZZLE_LINK_*.txt`, the candidate
probe data, and the CP-SAT scripts (feasibility, core extraction, forced-digit
probe, solution count). `rebuild.js` regenerates the main board once
`link_in.txt` is restored; the 2x2 variants and analyses re-derive from
`board_out.json` per the descriptions above.
