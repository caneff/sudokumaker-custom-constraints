/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Two skyscraper clues on opposite ends of one line couple as L + R <= n + 1.
//! Only the tallest building is visible from both ends; every other building is
//! visible from at most one end. So the two visible counts share exactly the
//! peak, and L + R <= n + 1. When L + R == n + 1 the line is unimodal: it rises
//! strictly to the peak, then falls strictly. That pins the peak (the line
//! maximum) and tightens every cell — deductions no single clue reaches.

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
  instance.n = line.length
}

// Arc-consistency for a strict "a < b" using live candidates.
function * less (puzzle, a, b) {
  const ca = Array.from(puzzle.getCandidates(a))
  const cb = Array.from(puzzle.getCandidates(b))
  const maxB = Math.max(...cb)
  const minA = Math.min(...ca)
  const rmA = ca.filter(d => d >= maxB)
  const rmB = cb.filter(d => d <= minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), a)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), b)
}

// Treat cells as one strictly increasing run of pinned length cells.length:
// cell j needs j cells below it and (k-1-j) above, so it sits in
// [lo+j, hi-(k-1-j)]. Also chain adjacent cells with `less`.
function * incRun (puzzle, cells) {
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const k = cells.length
  for (let j = 0; j < k; j++) {
    if (j >= 1) yield * less(puzzle, cells[j - 1], cells[j])
    const floor = lo + j
    const ceil = hi - (k - 1 - j)
    const bad = []
    for (let d = lo; d <= hi; d++) if (d < floor || d > ceil) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), cells[j])
  }
}

function * update (instance, puzzle) {
  const { clueA, clueB, line, n } = instance
  const cap = n + 1
  const ca = Array.from(puzzle.getCandidates(clueA))
  const cb = Array.from(puzzle.getCandidates(clueB))
  const minA = Math.min(...ca)
  const minB = Math.min(...cb)
  const rmA = ca.filter(d => d > cap - minB)
  const rmB = cb.filter(d => d > cap - minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), clueA)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), clueB)

  // L + R <= cap always, and L >= minA, R >= minB. So minA + minB === cap forces
  // L = minA and R = minB: the unimodal case with the peak at index minA - 1.
  if (minA + minB === cap) {
    const peak = minA - 1
    yield * incRun(puzzle, line.slice(0, peak + 1)) // line[0..peak] strictly up
    yield * incRun(puzzle, line.slice(peak).reverse()) // line[peak..n-1] strictly down
  }
}
