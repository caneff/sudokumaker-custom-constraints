/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Side sum. The n Hit Counts clues on one side of the grid sum to exactly n.
//! Regroup the side's hits by the perpendicular line each one lands on: a line
//! that holds 1..n once each has its own value at home exactly once, giving one
//! hit per line, n in all. So the rule needs all n clues of the side AND the n
//! perpendicular lines they cross.

// The clue cells and every cell of the perpendicular lines the gate reads, so
// the change that opens the gate -- a line losing its last 0 -- wakes the
// component instead of waiting for a clue to move. The list does not bear on
// soundness: the gate is re-read in full on every call, so whenever `update`
// runs it judges the lines as they stand then ("side-sum stale wake" in the
// soundness harness). The app retires a component once every listed cell is
// filled and it validates, so this one retires only once its lines are filled
// too. That costs nothing: main-global.js gives every framed line a pair
// component that enforces its own clues.
function getAffectedCells (clueCells, target, lines) {
  return [...clueCells, ...lines.flat()]
}

// The clues live in `instance.clues`: the app has already set `instance.cells`
// to the list above, and the bound reads the clues alone.
function setParams (instance, clueCells, target, lines) {
  instance.clues = clueCells
  instance.target = target
  instance.lines = lines
}

// The gate: one perpendicular line per clue, each a full house of {1..n}. Asked
// at solve time, because main code runs before the built-in row/column houses
// are registered (gotcha 6) and a hit-counts board only loses the 0 off its
// inner grid once the cage bites during solving. The answer is never cached:
// the app shares one component object across every search node, so a gate
// latched open deep in a branch stays open after the backtrack to a parent
// state whose perpendiculars have regained a 0.
// #include ../_shared/line-kind.js

function sumsToN (instance, puzzle) {
  const { clues, target, lines } = instance
  if (!lines || lines.length !== clues.length || target !== lines.length) return false
  for (const line of lines) if (!lineKind(instance, puzzle, line).oneToN) return false
  return true
}

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
    let bad = 0
    for (const d of puzzle.getCandidates(cells[i])) if (d < lo || d > hi) bad |= 1 << d
    if (bad !== 0) yield puzzle.removeCandidatesFromCell(bad, cells[i])
  }
}

function * update (instance, puzzle) {
  if (!sumsToN(instance, puzzle)) return
  yield * propagate(instance.clues, instance.target, puzzle)
}

function validate (instance, puzzle) {
  const { clues, target } = instance
  if (!puzzle.getCellsAreFilled(clues)) return true
  if (!sumsToN(instance, puzzle)) return true
  let sum = 0
  for (const c of clues) sum += puzzle.getValue(c)
  return sum === target
}
