// Cross-constraint deduction for two Running Start clues on opposite ends of one
// line. The left clue A counts a strictly increasing run inward from the left;
// the right clue B counts one inward from the right. On the same line those are
// a strictly increasing prefix (cells 0..A-1) and a strictly increasing-inward
// suffix (cells n-1..n-B). Read in array order the suffix is strictly
// decreasing, so the two runs can share at most one cell — the peak. Hence
//     A + B <= n + 1.
// This couples the two clues: neither can exceed n + 1 minus the other's
// smallest remaining value. It fires whenever either clue's candidates shrink.

function getAffectedCells (clueA, clueB, n) {
  return [clueA, clueB]
}

function setParams (instance, clueA, clueB, n) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.n = n
}

function* update (instance, puzzle) {
  const { clueA, clueB, n } = instance
  const cap = n + 1
  const ca = Array.from(puzzle.getCandidates(clueA))
  const cb = Array.from(puzzle.getCandidates(clueB))
  const minA = Math.min(...ca)
  const minB = Math.min(...cb)
  const rmA = ca.filter(d => d > cap - minB)
  const rmB = cb.filter(d => d > cap - minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), clueA)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), clueB)
}
