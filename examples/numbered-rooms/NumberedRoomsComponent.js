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

// Candidate sets are bitmasks: bit d set = digit d possible (bit 0 unused).
// One pass, all reads from the pre-pass masks, so no step depends on another.
function * update (instance, puzzle) {
  const { clue, line } = instance
  const m = line.length
  const clueM = puzzle.getCandidatesBitMask(clue) // what the clue can still be
  const idxM = puzzle.getCandidatesBitMask(line[0]) // what the index k can still be
  const drop = (mask, cell) => puzzle.removeCandidatesFromCell(new SudokuDigitSet(mask), cell)

  // Step 1: try every index k. Keep k if line[k-1] shares a digit with the clue.
  let K = 0 // indices that still work, as a mask
  let reach = 0 // clue digits that some working index can produce
  for (let k = 1, bit = 2; k <= m; k++, bit <<= 1) { // bit = 1 << k
    if (!(idxM & bit)) continue // k is not a candidate of line[0]
    let t = puzzle.getCandidatesBitMask(line[k - 1]) & clueM // digits target and clue share
    // Line is one house. k = 1: target IS line[0], which holds k, so clue = k.
    // k > 1: target sits in the same house as line[0] = k, so target != k.
    t = k === 1 ? t & bit : t & ~bit
    if (t) { K |= bit; reach |= t }
  }

  // Step 2: line[0] keeps only working indices; clue keeps only reachable digits.
  // No working index -> both go empty and the solver sees the contradiction.
  if (idxM & ~K) yield drop(idxM & ~K, line[0])
  if (clueM & ~reach) yield drop(clueM & ~reach, clue)
  if (!K) return

  // Step 3: clue solved to c (mask has one bit). c appears once in the line,
  // at the target, so remove c from every cell at a non-working index.
  if ((clueM & (clueM - 1)) === 0) { // x & (x-1) clears the lowest bit; zero = one bit set
    for (let k = 1, bit = 2; k <= m; k++, bit <<= 1) {
      if (!(K & bit) && (puzzle.getCandidatesBitMask(line[k - 1]) & clueM)) yield drop(clueM, line[k - 1])
    }
  }

  // Step 4: one index k left, so the target is known: it must equal the clue.
  // reach is then exactly the digits the target and clue share; keep only those.
  if ((K & (K - 1)) === 0) {
    // 31 - clz32(K) is the set bit's position, i.e. k (clz32 is exact; Math.log2 is not by spec)
    const target = line[31 - Math.clz32(K) - 1]
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
