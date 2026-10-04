// upToN is the rule, stated a third time (CODING_STANDARDS.md, "The rule has
// one home"): it must agree with the component and with build_size.py's
// `up_to_n` and its CP-SAT model.

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
