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
//! needs a fixed value to index) cannot enforce this. This component does it
//! directly: each update pass prunes the indexer line[0], prunes the clue down
//! to the still-feasible targets, equates the target with the clue once one
//! index remains, and once the clue is solved drops its digit from every line
//! cell at a dead index — all from the first pass.
//!
//! Two of those rules need the line's cells to hold distinct digits, which only
//! a house gives. They ask at solve time, so a drawn path that repeats a digit
//! keeps the three rules that hold on any line and nothing more.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// Line kinds, ordered (docs/line-contract.md). Numbered Rooms has no
// full-house rule, so HOUSE is as high as this component looks.
const BARE = 0
const HOUSE = 1

// The line's kind, asked at solve time and re-asked while it is still bare.
// It cannot be asked once in main code: that runs before the built-in
// row/column houses are registered and would read every line as bare (gotcha
// 6). Query the line alone — a clue cell in the list flips
// getCellsCanHaveRepeats to true. A house never repeats again, so the answer
// is cached the moment it comes back HOUSE.
function lineKind (instance, puzzle) {
  if (instance.kind !== HOUSE) {
    instance.kind = puzzle.getCellsCanHaveRepeats(instance.line) ? BARE : HOUSE
  }
  return instance.kind
}

// Candidate sets are bitmasks: bit d set = digit d possible.
// One pass, all reads from the pre-pass masks, so no step depends on another.
function * update (instance, puzzle) {
  const { clue, line } = instance
  const m = line.length
  const house = lineKind(instance, puzzle) === HOUSE
  const clueM = puzzle.getCandidatesBitMask(clue) // what the clue can still be
  const idxM = puzzle.getCandidatesBitMask(line[0]) // what the index k can still be
  const drop = (mask, cell) => puzzle.removeCandidatesFromCell(new SudokuDigitSet(mask), cell)

  // Step 1: try every index k. Keep k if line[k-1] shares a digit with the clue.
  let K = 0 // indices that still work, as a mask
  let reach = 0 // clue digits that some working index can produce
  for (let k = 1, bit = 2; k <= m; k++, bit <<= 1) { // bit = 1 << k
    if (!(idxM & bit)) continue // k is not a candidate of line[0]
    let t = puzzle.getCandidatesBitMask(line[k - 1]) & clueM // digits target and clue share
    // k = 1: the target IS line[0], which holds k, so the clue must be 1. True
    // on any line. k > 1: target and indexer are two cells of the line, so on a
    // house they differ and the target cannot be k; on a bare line it may be.
    t = k === 1 ? t & bit : house ? t & ~bit : t
    if (t) { K |= bit; reach |= t }
  }

  // Step 2: line[0] keeps only working indices (which drops 0 and every index
  // past the end of the line); the clue keeps only reachable digits. No working
  // index -> the branch is dead; stop with the reason.
  if (!K) {
    yield puzzle.stop(`no index lets the line reach the clue of ${instance.name}`, [clue, line[0]])
    return
  }
  if (idxM & ~K) yield drop(idxM & ~K, line[0])
  if (clueM & ~reach) yield drop(clueM & ~reach, clue)

  // Step 3: clue solved to c (mask has one bit). On a house c appears once in
  // the line, at the target, so remove c from every cell at a non-working
  // index. On a bare line c may sit at a dead index too, so this stands down.
  if (house && (clueM & (clueM - 1)) === 0) { // x & (x-1) clears the lowest bit; zero = one bit set
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
