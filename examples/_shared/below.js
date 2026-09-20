/* eslint-disable no-unused-vars -- read by the components that include this file, not from here */
// Arc-consistency for an ordering of two cells, one copy spliced into each
// component by `// #include ../_shared/below.js` (examples/_shared/minify.py).
// Not a module: the app runs the assembled component as a bare script.
// Arc-consistency for "a < b" (strict) or "a <= b" (not strict) using live
// candidates.
function * below (puzzle, a, b, strict) {
  const ca = Array.from(puzzle.getCandidates(a))
  const cb = Array.from(puzzle.getCandidates(b))
  const maxB = Math.max(...cb)
  const minA = Math.min(...ca)
  const rmA = ca.filter(d => (strict ? d >= maxB : d > maxB))
  const rmB = cb.filter(d => (strict ? d <= minA : d < minA))
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), a)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), b)
}
