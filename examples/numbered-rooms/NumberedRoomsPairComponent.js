/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Two Numbered Rooms clues on opposite ends of one line. Read from the left,
//! the first cell holds index a and the clue O_L equals line[a-1]. Read from the
//! right, the last cell holds index b and the clue O_R equals line[N-b]. Those
//! two target positions are the SAME cell exactly when a + b === N + 1, so:
//!
//!     a + b === N + 1  ==>  O_L === O_R      (always)
//!     O_L === O_R      ==>  a + b === N + 1   (only when the line is distinct)
//!
//! The first direction (and its contrapositive, unequal clues => a + b !== N + 1)
//! needs nothing about the line. The second direction — and every step that
//! reasons from two cells being different to their values differing — holds only
//! when the line has no repeats, so those are guarded by getCellsSeeEachOther.
//! The clues are often the given outside digits, so the "equal clues fix the
//! index sum" prune fires on the first pass.

function getAffectedCells (clueL, clueR, line) {
  return [clueL, clueR, ...line]
}

function setParams (instance, clueL, clueR, line) {
  instance.clueL = clueL
  instance.clueR = clueR
  instance.line = line
  instance.N = line.length
  instance.aCell = line[0]
  instance.bCell = line[line.length - 1]
}

function * prune (puzzle, cell, bad) {
  if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), cell)
}

function * update (instance, puzzle) {
  const { clueL, clueR, line, N, aCell, bCell } = instance
  const candL = Array.from(puzzle.getCandidates(clueL))
  const candR = Array.from(puzzle.getCandidates(clueR))
  const inRange = d => d >= 1 && d <= N
  const aVals = Array.from(puzzle.getCandidates(aCell)).filter(inRange)
  const bVals = Array.from(puzzle.getCandidates(bCell)).filter(inRange)

  const sumPossible = aVals.some(a => bVals.includes(N + 1 - a))
  const sumForced = aVals.length === 1 && bVals.length === 1 && aVals[0] + bVals[0] === N + 1
  const cluesDisjoint = candL.every(v => !candR.includes(v))

  // Unconditional. a + b === N + 1 forces the two clues onto one cell, so equal.
  if (sumForced) {
    yield * prune(puzzle, clueL, candL.filter(v => !candR.includes(v)))
    yield * prune(puzzle, clueR, candR.filter(v => !candL.includes(v)))
  }

  // Unconditional (contrapositive of the above): clues that cannot be equal
  // cannot share a cell, so a + b !== N + 1. Drop an index whose only surviving
  // partner would force the forbidden sum.
  if (cluesDisjoint) {
    yield * prune(puzzle, aCell, aVals.filter(a => bVals.length > 0 && bVals.every(b => b === N + 1 - a)))
    yield * prune(puzzle, bCell, bVals.filter(b => aVals.length > 0 && aVals.every(a => a === N + 1 - b)))
  }

  // Distinct line only. "Equal clues" and "different clues" both reason from
  // cell identity to value (in)equality, which holds only when the line has no
  // repeats. getCellsSeeEachOther is true exactly when the cells must all differ.
  if (puzzle.getCellsSeeEachOther(line)) {
    // Equal clues ==> a + b === N + 1: keep only indices whose complement survives.
    if (candL.length === 1 && candR.length === 1 && candL[0] === candR[0]) {
      yield * prune(puzzle, aCell,
        Array.from(puzzle.getCandidates(aCell)).filter(a => !(inRange(a) && bVals.includes(N + 1 - a))))
      yield * prune(puzzle, bCell,
        Array.from(puzzle.getCandidates(bCell)).filter(b => !(inRange(b) && aVals.includes(N + 1 - b))))
    }
    // a + b === N + 1 impossible ==> the clues sit on different cells, so they
    // differ. When one clue is fixed, that value leaves the other.
    if (!sumPossible) {
      if (candL.length === 1) yield * prune(puzzle, clueR, candR.filter(v => v === candL[0]))
      if (candR.length === 1) yield * prune(puzzle, clueL, candL.filter(v => v === candR[0]))
    }
  }
}

function validate (instance, puzzle) {
  const { clueL, clueR, line, N } = instance
  if (!puzzle.getCellsAreFilled([clueL, clueR, ...line])) return true
  const a = puzzle.getValue(line[0])
  const b = puzzle.getValue(line[N - 1])
  // Only the unconditional half is a safe backstop: a + b === N + 1 forces the
  // clues equal. (The converse holds only for a distinct line.)
  if (a + b === N + 1 && puzzle.getValue(clueL) !== puzzle.getValue(clueR)) return false
  return true
}
