// What the up-to-n tests and harness share: one definition each (#671).
//
// upToN is the rule, stated a third time (CODING_STANDARDS.md, "The rule has
// one home"): the sum of the digits strictly before the first `target`, or
// null when the line never holds it. It must agree with the component and with
// build_size.py's `up_to_n` and its CP-SAT model.
//
// entered puts a board's recorded grid into a document in full, so a case can
// check its clues against the solution without a search.

export function upToN (digits, target) {
  let sum = 0
  for (const d of digits) {
    if (d === target) return sum
    sum += d
  }
  return null
}

export const entered = (d, board) => {
  d.puzzle.cells = board.grid.flat().map(value => ({ value }))
  return d
}
