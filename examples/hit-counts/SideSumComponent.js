/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Side sum. The n Hit Counts clues on one side of the grid sum to exactly n.
//! Regroup the side's hits by target column: each column is a permutation, so its
//! own value sits at home exactly once, giving one hit per column, n in all. This
//! couples every clue on a side, so it needs all n lines of that side present.

function getAffectedCells (cells, target) {
  return cells
}

function setParams (instance, cells, target) {
  instance.cells = cells
  instance.target = target
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
  yield * propagate(instance.cells, instance.target, puzzle)
}

function * update (instance, puzzle) {
  yield * propagate(instance.cells, instance.target, puzzle)
}

function validate (instance, puzzle) {
  const { cells, target } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  let sum = 0
  for (const c of cells) sum += puzzle.getValue(c)
  return sum === target
}
