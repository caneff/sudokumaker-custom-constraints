/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Up to N. A clue v on a line with target digit N means: read from the
//! marked end, the digits strictly before the first N sum to v; N itself is
//! never added, so a first cell holding N gives 0. A line that never holds N
//! breaks the rule.
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

// The line's kind: lineKind(instance, puzzle, cells).
// #include ../_shared/line-kind.js

// The smallest and largest digit in a candidate mask, or -1 for an empty one.
function lowBit (mask) {
  return mask === 0 ? -1 : 31 - Math.clz32(mask & -mask)
}

function highBit (mask) {
  return mask === 0 ? -1 : 31 - Math.clz32(mask)
}

// Every position the first N can still take, with the prefix sum bounds at
// each: `at[k]` is the position, `lo[k]` and `hi[k]` its bounds. Position p is
// feasible when the cell there allows N, every earlier cell can avoid N, and
// the clue lies between the smallest and largest sum the prefix can make: the
// sum of each earlier cell's smallest (largest) digit other than N.
//
// Sound: in the true solution the first N sits at some p*, every cell before
// it holds a digit other than N, and their sum is the clue -- so p* is
// feasible and never dropped.
function feasiblePositions (instance, puzzle) {
  const { line, target, clue } = instance
  const bitN = 1 << target
  const feasible = { at: [], lo: [], hi: [] }
  let lo = 0
  let hi = 0
  for (let p = 0; p < line.length; p++) {
    const mask = puzzle.getCandidatesBitMask(line[p])
    if ((mask & bitN) !== 0 && lo <= clue && clue <= hi) {
      feasible.at.push(p)
      feasible.lo.push(lo)
      feasible.hi.push(hi)
    }
    const rest = mask & ~bitN
    if (rest === 0) break // this cell must be N, so no later N is the first
    lo += lowBit(rest)
    hi += highBit(rest)
    if (lo > clue) break // every later prefix sums higher still
  }
  return feasible
}

function * update (instance, puzzle) {
  const { line, target, clue } = instance
  const { at, lo, hi } = feasiblePositions(instance, puzzle)
  if (at.length === 0) {
    // Named by the border cell the clue reads from; getCageName would name the
    // line's lowest cell id, the far end for a bottom or right marker.
    yield puzzle.stop(`the Up to N clue read from ${helpers.naming.getCellName(line[0])} cannot reach its sum`)
    return
  }

  // Drop N wherever the first N cannot sit. On a house the first N is the only
  // N, so every infeasible position loses it. On a bare line a cell past the
  // first feasible position may hold a second N the sum never reads, so only
  // the cells before it lose N. Both prefix bounds only grow along the line, so
  // no cell that allows N sits infeasible between two feasible positions.
  const end = lineKind(instance, puzzle, line).kind >= HOUSE ? line.length : at[0]
  const bitN = 1 << target
  let next = 0
  for (let p = 0; p < end; p++) {
    if (at[next] === p) { next++; continue }
    if ((puzzle.getCandidatesBitMask(line[p]) & bitN) !== 0) {
      yield puzzle.removeCandidateFromCell(target, line[p])
    }
  }

  // A cell before every feasible position holds a digit d other than N, and
  // at a position with bounds lo..hi the other cells sum to between
  // lo - (its smallest) and hi - (its largest). So d must satisfy
  // lo - min + d <= clue <= hi - max + d at some feasible position; the rest
  // go. Sound: the true first N sits at a feasible position, and there the
  // cell's true digit meets both bounds.
  for (let i = 0; i < at[0]; i++) {
    const rest = puzzle.getCandidatesBitMask(line[i]) & ~bitN
    const min = lowBit(rest)
    const max = highBit(rest)
    let keep = 0
    for (let k = 0; k < at.length; k++) {
      const from = Math.max(clue - (hi[k] - max), min)
      const to = Math.min(clue - (lo[k] - min), max)
      for (let d = from; d <= to; d++) keep |= 1 << d
    }
    const drop = []
    for (let d = min; d <= max; d++) if ((rest & (1 << d)) !== 0 && (keep & (1 << d)) === 0) drop.push(d)
    if (drop.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(drop), line[i])
  }
}

function validate (instance, puzzle) {
  const { line, target, clue } = instance
  let sum = 0
  for (const cell of line) {
    if (!puzzle.hasValue(cell)) return true
    const d = puzzle.getValue(cell)
    if (d === target) return sum === clue
    sum += d
  }
  return false
}
