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
//! to the still-feasible targets, equates the target with the clue once one
//! index remains, and once the clue is solved drops its digit from every line
//! cell at a dead index — all from the first pass.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// One pass over bitmasks (bit d = digit d), the shape ISS's ValueIndexing uses.
// A 1-based index k is feasible when it is a live candidate of the indexer
// line[0], points at a real inside cell (1..m), and its target line[k-1] has a
// digit the clue can match. "Match" carries the one sudoku fact the line gives:
//   k = 1  — the target IS the indexer, which holds k, so the clue must be 1;
//   k > 1  — the target and the indexer are two cells of one row/column, so
//            the target (and the clue) cannot be k.
// Assumes the line is one row/column, which is what the rule means; the main
// code trusts the author's group for that. Every read is of the pre-pass
// masks, so the k = 1 case needs no second pass: the indexer's own mask is
// read before this pass prunes it.
function * update (instance, puzzle) {
  const { clue, line } = instance
  const m = line.length
  const clueM = puzzle.getCandidatesBitMask(clue)
  const idxM = puzzle.getCandidatesBitMask(line[0])
  const drop = (mask, cell) => puzzle.removeCandidatesFromCell(new SudokuDigitSet(mask), cell)

  let K = 0 // feasible indices, as a digit mask
  let reach = 0 // clue digits some feasible index can realize
  for (let k = 1, bit = 2; k <= m; k++, bit <<= 1) {
    if (!(idxM & bit)) continue
    let t = puzzle.getCandidatesBitMask(line[k - 1]) & clueM
    t = k === 1 ? t & bit : t & ~bit
    if (t) { K |= bit; reach |= t }
  }

  // Prune the indexer to the feasible indices (this also drops out-of-range
  // values) and the clue to the digits a feasible target can realize. With no
  // feasible index both empty, and the solver sees the contradiction now.
  if (idxM & ~K) yield drop(idxM & ~K, line[0])
  if (clueM & ~reach) yield drop(clueM & ~reach, clue)
  if (!K) return

  // Clue solved to c: c sits in exactly one cell of the line (one house), and
  // that cell is the target, so c can only live at a feasible index. Drop c
  // from every cell at a dead index — the converse of the loop above.
  if ((clueM & (clueM - 1)) === 0) {
    for (let k = 1, bit = 2; k <= m; k++, bit <<= 1) {
      if (!(K & bit) && (puzzle.getCandidatesBitMask(line[k - 1]) & clueM)) yield drop(clueM, line[k - 1])
    }
  }

  // Only one index left: in every solution the index is that k, so the target
  // equals the clue. `reach` is then exactly the target digits the clue can
  // match, so narrow the target to it. (The clue side is done above.)
  if ((K & (K - 1)) === 0) {
    const target = line[31 - Math.clz32(K) - 1] // clz32 is exact; Math.log2 is not by spec
    const rm = puzzle.getCandidatesBitMask(target) & ~reach
    if (rm) yield drop(rm, target)
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  const k = puzzle.getValue(line[0])
  if (k < 1 || k > line.length) return false
  return puzzle.getValue(line[k - 1]) === puzzle.getValue(clue)
}
