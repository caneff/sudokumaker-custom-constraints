/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Outside Sudoku. A line reads inward from an outside clue cell. The clue
//! digit must appear in the line's WINDOW: the cells of the line that lie in
//! the box the line starts in.
//!
//!     O in { value(line[0]), ..., value(line[w - 1]) }
//!
//! w is the box's extent in the line's direction (3 along a row or column of a
//! 9x9, 3 across and 2 down on a 6x6, 2 on a 4x4), capped by the line length.
//! The component reads it off the board, never assuming 3.
//!
//! The rule is a pure membership test: no index, no order, no DP. It holds on
//! a line of any kind — a bare line may repeat the clue digit inside the
//! window and the rule is still satisfied — so the component needs no gate.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// The window length: how many cells of line[0]'s box lie along the line. Read
// once per component and cached — board geometry cannot change under a live
// component, and the app rebuilds every component when the author edits.
// A line whose first cell has no region (region -1, e.g. a ring cell) gets the
// whole line as its window: weaker, never unsound.
function windowLength (instance, puzzle) {
  if (instance.w !== undefined) return instance.w
  const { line } = instance
  const head = line[0]
  const region = puzzle.getRegion(head)
  let w = line.length
  if (region >= 0) {
    const alongRow = line.length === 1 || puzzle.getRow(line[1]) === puzzle.getRow(head)
    const same = alongRow
      ? c => puzzle.getRow(c) === puzzle.getRow(head)
      : c => puzzle.getColumn(c) === puzzle.getColumn(head)
    let extent = 0
    for (const c of puzzle.getRegionCells(region)) if (same(c)) extent++
    w = Math.min(extent, line.length)
  }
  instance.w = w
  return w
}

// Candidate sets are bitmasks: bit d set = digit d possible (bit 0 unused).
// One pass, all reads from the pre-pass masks, so no step depends on another.
function * update (instance, puzzle) {
  const { clue, line } = instance
  const w = windowLength(instance, puzzle)
  const clueM = puzzle.getCandidatesBitMask(clue)

  // Deduction 1: the clue keeps only digits some window cell can still hold.
  // This also covers the dead branch — a clue solved to a digit no window cell
  // admits is not in the union, so its last candidate goes and the solver sees
  // an empty cell.
  let union = 0
  for (let i = 0; i < w; i++) union |= puzzle.getCandidatesBitMask(line[i])
  if (clueM & ~union) {
    yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(clueM & ~union), clue)
  }

  // Deduction 2: the clue is solved to d (one bit) and exactly one window cell
  // still admits d, so that cell is d. Sound on every line kind: the rule needs
  // d somewhere in the window, and only one cell is left to hold it.
  if (clueM === 0 || (clueM & (clueM - 1))) return // x & (x-1) clears the lowest bit
  let holders = 0
  let only = -1
  for (let i = 0; i < w; i++) {
    if (puzzle.getCandidatesBitMask(line[i]) & clueM) { holders++; only = i }
  }
  if (holders === 1) {
    const rm = puzzle.getCandidatesBitMask(line[only]) & ~clueM
    if (rm) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(rm), line[only])
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  const w = windowLength(instance, puzzle)
  const c = puzzle.getValue(clue)
  for (let i = 0; i < w; i++) if (puzzle.getValue(line[i]) === c) return true
  return false
}
