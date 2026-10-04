/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Numbered Rooms (escape-the-grid). A line reads inward from an outside clue
//! cell — a frame row or column, or any path an author draws. Let O be the clue
//! cell and line[0..m-1] the inside cells, nearest the clue first. The first
//! inside cell line[0] holds a 1-based index k; the clue equals the digit in the
//! k-th inside cell:
//!
//!     line[k - 1] === O,   with k = value(line[0]).
//!
//! An index of 0, or any index past the end of the line, is out of range.
//!
//! The clue is a CELL, not a constant, so the built-in IndexComponent (which
//! needs a fixed value to index) cannot enforce this.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// #include ../_shared/line-kind.js

// Candidate sets are bitmasks: bit d set = digit d possible.
// The clue and index masks are read once, before the pass, so one step's
// removals reach the others only on the next pass.
function * update (instance, puzzle) {
  const { clue, line } = instance
  const m = line.length
  const house = lineKind(instance, puzzle, line).kind >= HOUSE
  const clueM = puzzle.getCandidatesBitMask(clue)
  const idxM = puzzle.getCandidatesBitMask(line[0])
  const drop = (mask, cell) => puzzle.removeCandidatesFromCell(new SudokuDigitSet(mask), cell)

  let K = 0 // indices that still work, as a mask
  let reach = 0 // clue digits that some working index can produce
  for (let k = 1, bit = 2; k <= m; k++, bit <<= 1) {
    if (!(idxM & bit)) continue
    let t = puzzle.getCandidatesBitMask(line[k - 1]) & clueM
    // k = 1: the target IS line[0], which holds k, so the clue must be 1. True
    // on any line. k > 1: target and indexer are two cells of the line, so on a
    // house they differ and the target cannot be k; on a bare line it may be.
    t = k === 1 ? t & bit : house ? t & ~bit : t
    if (t) { K |= bit; reach |= t }
  }

  // Keeping only working indices also drops 0 and every index past the end of
  // the line.
  if (!K) {
    yield puzzle.stop(`no index lets the line reach the clue of ${instance.name}`, [clue, line[0]])
    return
  }
  if (idxM & ~K) yield drop(idxM & ~K, line[0])
  if (clueM & ~reach) yield drop(clueM & ~reach, clue)

  // Clue solved to c: on a house c appears once in the line, at the target, so
  // remove c from every cell at a non-working index. On a bare line c may sit
  // at a dead index too, so this stands down.
  if (house && (clueM & (clueM - 1)) === 0) {
    const dead = []
    for (let k = 1, bit = 2; k <= m; k++, bit <<= 1) {
      if (!(K & bit) && (puzzle.getCandidatesBitMask(line[k - 1]) & clueM)) dead.push(line[k - 1])
    }
    if (dead.length > 0) yield puzzle.removeCandidatesFromCells(clueM, dead)
  }

  // One working index left: its target must equal the clue, and reach is then
  // exactly the digits they share.
  if ((K & (K - 1)) === 0) {
    // 31 - clz32(K) is k; Math.log2 is not exact by spec
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
