/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Outside Sudoku. A line reads inward from an outside clue cell. The clue
//! digit must appear in the line's WINDOW: its first w cells.
//!
//!     O in { value(line[0]), ..., value(line[w - 1]) }
//!
//! w is the extent of the box the line starts in, measured along the line's
//! direction (3 along a row or column of a 9x9, 3 across and 2 down on a 6x6,
//! 2 on a 4x4), capped by the line length. Main code reads it off the board
//! (window-length.js) and passes it as the third constructor argument, so the
//! component never assumes 3. A line that starts at the grid edge — every frame
//! line — therefore has its own first box as its window; one an author draws
//! from mid-box has a window of the same w cells, crossing into the next box.
//! The component is valid only when its own main builds it: a missing `w`
//! empties every clue.
//!
//! The rule holds on a line of any kind — a bare line may repeat the clue digit
//! inside the window and still satisfy it — so the component needs no gate.

function getAffectedCells (clue, line, w) {
  return [clue, ...line.slice(0, w)]
}

function setParams (instance, clue, line, w) {
  instance.clue = clue
  instance.line = line
  instance.w = w
}

function * update (instance, puzzle) {
  const { clue, line, w } = instance
  const clueM = puzzle.getCandidatesBitMask(clue)

  // Pruning the clue to the window's union also kills the dead branch: a
  // solved clue no window cell admits loses its last candidate here.
  let union = 0
  for (let i = 0; i < w; i++) union |= puzzle.getCandidatesBitMask(line[i])
  if (clueM & ~union) {
    yield puzzle.removeCandidatesFromCell(clueM & ~union, clue)
  }

  if (clueM === 0 || (clueM & (clueM - 1))) return
  let holders = 0
  let only = -1
  for (let i = 0; i < w; i++) {
    if (puzzle.getCandidatesBitMask(line[i]) & clueM) { holders++; only = i }
  }
  if (holders === 1) {
    const rm = puzzle.getCandidatesBitMask(line[only]) & ~clueM
    if (rm) yield puzzle.removeCandidatesFromCell(rm, line[only])
  }
}

function validate (instance, puzzle) {
  const { clue, line, w } = instance
  if (!puzzle.getCellsAreFilled(getAffectedCells(clue, line, w))) return true
  const c = puzzle.getValue(clue)
  for (let i = 0; i < w; i++) if (puzzle.getValue(line[i]) === c) return true
  return false
}
