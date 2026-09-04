/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Side sum. The n Hit Counts clues on one side of the grid sum to exactly n.
//! Regroup the side's hits by the perpendicular line each one lands on: a line
//! that holds 1..n once each has its own value at home exactly once, giving one
//! hit per line, n in all. So the rule needs all n clues of the side AND the n
//! perpendicular lines they cross.

function getAffectedCells (cells, target, lines) {
  return cells
}

// `lines` are the n perpendicular lines the main code hands over. The component
// checks them itself rather than trusting the caller (docs/line-contract.md).
function setParams (instance, cells, target, lines) {
  instance.cells = cells
  instance.target = target
  instance.lines = lines
}

// The gate: one perpendicular line per clue, each a full house whose digit set
// is {1..n} -- exactly one hit each, so the side sums to n, which is what the
// target must be. Asked at solve time, because main code runs before the
// built-in row/column houses are registered (gotcha 6) and a hit-counts board
// only loses the 0 off its inner grid once the cage bites during solving. The
// answer is never cached: the app shares one component object across every
// search node, so a gate latched open deep in a branch stays open after the
// backtrack to a parent state whose perpendiculars have regained a 0 (#336).
// The digit-set test is the same one HitCountsComponent's lineKind makes: the
// app pastes each component as its own segment, so the two cannot share code.
function gateOpen (instance, puzzle) {
  const { cells, target, lines } = instance
  if (!lines || lines.length !== cells.length || target !== lines.length) return false
  // The repeats answer is structural -- a house is registered once and a
  // backtrack cannot un-register it -- so it is cached once every line is one.
  if (!instance.noRepeats) {
    for (const line of lines) if (puzzle.getCellsCanHaveRepeats(line)) return false
    instance.noRepeats = true
  }
  for (const line of lines) {
    let mask = 0
    for (const c of line) mask |= puzzle.getCandidatesBitMask(c)
    if (mask !== (1 << (line.length + 1)) - 2) return false // bits 1..n set, bit 0 clear
  }
  return true
}

// Bounds propagation for sum(cells) === target. Each cell sits in
// [target - (sum of other maxima), target - (sum of other minima)].
function * propagate (cells, target, puzzle) {
  const mins = []
  const maxs = []
  let sumMin = 0
  let sumMax = 0
  for (const c of cells) {
    const cand = Array.from(puzzle.getCandidates(c))
    const mn = Math.min(...cand)
    const mx = Math.max(...cand)
    mins.push(mn); maxs.push(mx); sumMin += mn; sumMax += mx
  }
  for (let i = 0; i < cells.length; i++) {
    const lo = target - (sumMax - maxs[i])
    const hi = target - (sumMin - mins[i])
    const bad = Array.from(puzzle.getCandidates(cells[i])).filter(d => d < lo || d > hi)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), cells[i])
  }
}

// Run once at creation: the side's given clues already bound the rest (e.g. if
// the shown clues sum to n, the hidden ones are forced to 0 right away).
function * initialize (instance, puzzle) {
  yield * update(instance, puzzle)
}

function * update (instance, puzzle) {
  if (!gateOpen(instance, puzzle)) return
  yield * propagate(instance.cells, instance.target, puzzle)
}

function validate (instance, puzzle) {
  const { cells, target } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  if (!gateOpen(instance, puzzle)) return true
  let sum = 0
  for (const c of cells) sum += puzzle.getValue(c)
  return sum === target
}
