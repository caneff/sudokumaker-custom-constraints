/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Numbered Rooms (escape-the-grid variant). A line reads inward from an
//! outside clue cell. Let O be the clue cell and line[0..m-1] the inside cells,
//! nearest the clue first. The first inside cell line[0] holds a 1-based index
//! k; the clue equals the digit in the k-th inside cell:
//!
//!     line[k - 1] === O,   with k = value(line[0]).
//!
//! The clue is a CELL, not a constant, so the built-in IndexComponent (which
//! needs a fixed value to index) cannot enforce this. This component does it
//! directly: each update pass prunes the indexer line[0], prunes the clue down
//! to the still-feasible targets, and equates the target with the clue once one
//! index remains — all from the first pass, before the clue is solved. See
//! README.md for how this compares to the earlier wrapper (ORIGINAL_*.js).

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// The 1-based indices k that are still possible. k is possible only when it is
// a live candidate of the indexer line[0], points at a real inside cell
// (1..m), and its target cell line[k-1] shares at least one live candidate with
// the clue. k === 1 is the self-reference line[0] === O; the same test holds.
//
// Clue≠index: for k > 1 the target line[k-1] and the indexer line[0] are two
// cells of one row/column, so they hold different digits. line[0] holds k, so
// the target — and the clue — cannot be k. The clue digit d = k is not a match
// for index k unless k = 1. (Assumes the line is one row/column, which is what
// the rule means; main.js trusts the author's group for that.)
function targetMatches (puzzle, line, k, d) {
  return (k === 1 || d !== k) && puzzle.getCandidates(line[k - 1]).has(d)
}

function feasibleIndices (puzzle, clue, line) {
  const m = line.length
  const clueCands = Array.from(puzzle.getCandidates(clue))
  const K = new Set()
  for (const k of puzzle.getCandidates(line[0])) {
    if (k < 1 || k > m) continue
    if (clueCands.some(d => targetMatches(puzzle, line, k, d))) K.add(k)
  }
  return K
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  const K = feasibleIndices(puzzle, clue, line)

  // No index works: a dead branch. Empty the indexer so the solver sees the
  // contradiction now instead of after more propagation.
  if (K.size === 0) {
    yield puzzle.removeCandidatesFromCell(puzzle.getCandidates(line[0]), line[0])
    return
  }

  // Prune the indexer line[0]: drop any index value that cannot be realized.
  const badK = Array.from(puzzle.getCandidates(line[0])).filter(k => !K.has(k))
  if (badK.length > 0) {
    yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(badK), line[0])
  }

  // Prune the clue O: it must equal some feasible target cell, so it can only
  // hold a digit that some line[k-1] (k feasible) still allows.
  const badO = Array.from(puzzle.getCandidates(clue))
    .filter(d => ![...K].some(k => targetMatches(puzzle, line, k, d)))
  if (badO.length > 0) {
    yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(badO), clue)
  }

  // Only one index left: the target cell and the clue are equal. Sound even
  // before line[0] is a singleton, because in any solution the index must be
  // one of the feasible values, and here only one remains. The clue side is
  // already covered: with a single feasible index, the clue prune above kept
  // exactly this target's matching candidates. Only the target still needs
  // narrowing to the clue's candidates.
  if (K.size === 1) {
    const target = line[[...K][0] - 1]
    const clueSet = new Set(puzzle.getCandidates(clue))
    const rmTarget = Array.from(puzzle.getCandidates(target)).filter(d => !clueSet.has(d))
    if (rmTarget.length > 0) {
      yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmTarget), target)
    }
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  const k = puzzle.getValue(line[0])
  if (k < 1 || k > line.length) return false
  return puzzle.getValue(line[k - 1]) === puzzle.getValue(clue)
}
