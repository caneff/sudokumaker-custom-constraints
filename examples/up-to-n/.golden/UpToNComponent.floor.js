/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Up to N. A clue v on a line with target digit N means: read from the
//! marked end, the digits up to and including the first N sum to v. A line
//! that never holds N breaks the rule.
//!
//! The rules here hold on every line kind (docs/line-contract.md). A bare line
//! may repeat digits and may lack N; a house never repeats.

function getAffectedCells (line, target, clue) {
  return line
}

function setParams (instance, line, target, clue) {
  instance.line = line
  instance.target = target
  instance.clue = clue
}

// Is the line a house? Asked in `update`, never at register time, because main
// code runs before the built-in row and column houses exist (gotcha 6). A
// house never becomes bare, so the true answer caches on the instance.
function isHouse (instance, puzzle) {
  if (instance.house) return true
  instance.house = !puzzle.getCellsCanHaveRepeats(instance.line)
  return instance.house
}

// The smallest and largest digit in a candidate mask, or -1 for an empty one.
function lowBit (mask) {
  return mask === 0 ? -1 : 31 - Math.clz32(mask & -mask)
}

function highBit (mask) {
  return mask === 0 ? -1 : 31 - Math.clz32(mask)
}

// Every position the first N can still take. Position p is feasible when the
// cell there allows N, every earlier cell can avoid N, and the clue lies
// between the smallest and largest sum the prefix can make: N plus each earlier
// cell's smallest (largest) digit other than N.
//
// Sound: in the true solution the first N sits at some p*, every cell before
// it holds a digit other than N, and their sum plus N is the clue -- so p* is
// feasible and never dropped.
function feasiblePositions (instance, puzzle) {
  const { line, target, clue } = instance
  const bitN = 1 << target
  const feasible = []
  let lo = target
  let hi = target
  for (let p = 0; p < line.length; p++) {
    const mask = puzzle.getCandidatesBitMask(line[p])
    if ((mask & bitN) !== 0 && lo <= clue && clue <= hi) feasible.push(p)
    const rest = mask & ~bitN
    if (rest === 0) break // this cell must be N, so no later N is the first
    lo += lowBit(rest)
    hi += highBit(rest)
    if (lo > clue) break // every later prefix sums higher still
  }
  return feasible
}

function * update (instance, puzzle) {
  const { line, target } = instance
  const feasible = feasiblePositions(instance, puzzle)
  if (feasible.length === 0) {
    yield puzzle.stop(`${helpers.naming.getCageName('Up to N clue', line)} cannot reach its sum`)
    return
  }

  // Drop N wherever the first N cannot sit. On a house the first N is the only
  // N, so every infeasible position loses it. On a bare line a cell past the
  // first feasible position may hold a second N the sum never reads, so only
  // the cells before it lose N. Both prefix bounds only grow along the line, so
  // no cell that allows N sits infeasible between two feasible positions.
  const end = isHouse(instance, puzzle) ? line.length : feasible[0]
  const bitN = 1 << target
  let next = 0
  for (let p = 0; p < end; p++) {
    if (feasible[next] === p) { next++; continue }
    if ((puzzle.getCandidatesBitMask(line[p]) & bitN) !== 0) {
      yield puzzle.removeCandidateFromCell(target, line[p])
    }
  }
}

function validate (instance, puzzle) {
  const { line, target, clue } = instance
  let sum = 0
  for (const cell of line) {
    if (!puzzle.hasValue(cell)) return true
    const d = puzzle.getValue(cell)
    sum += d
    if (d === target) return sum === clue
  }
  return false
}
