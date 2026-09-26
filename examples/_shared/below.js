/* eslint-disable no-unused-vars -- read by the components that include this file, not from here */
// Arc-consistency for an ordering of two cells, one copy spliced into each
// component by `// #include ../_shared/below.js` (examples/_shared/minify.py).
// Not a module: the app runs the assembled component as a bare script.
// Arc-consistency for "a < b" (strict) or "a <= b" (not strict) using live
// candidates.
function * below (puzzle, a, b, strict) {
  const ma = puzzle.getCandidatesBitMask(a)
  const mb = puzzle.getCandidatesBitMask(b)
  if (!ma || !mb) return // an emptied cell: the branch is already dead
  // Bit d set = digit d possible. 31 - clz32 reads the highest set bit, and
  // m & -m isolates the lowest.
  const maxB = 31 - Math.clz32(mb)
  const minA = 31 - Math.clz32(ma & -ma)
  // -(1 << d) masks every digit >= d; (1 << d) - 1 every digit < d.
  const rmA = ma & -(1 << (strict ? maxB : maxB + 1))
  const rmB = mb & ((1 << (strict ? minA + 1 : minA)) - 1)
  if (rmA) yield puzzle.removeCandidatesFromCell(rmA, a)
  if (rmB) yield puzzle.removeCandidatesFromCell(rmB, b)
}
