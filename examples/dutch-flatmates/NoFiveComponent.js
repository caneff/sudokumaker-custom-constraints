/* eslint-disable no-unused-vars -- the app calls these functions by name */
// No 5 in these cells: 5s live in Dutch Flats, not in circles. This rule is
// added over the circle cells.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
}

// A removed 5 can never come back, so removing it once, before solving starts,
// is enough.
function * initialize (instance, puzzle) {
  for (const cell of instance.cells) yield puzzle.removeCandidateFromCell(5, cell)
}

function validate (instance, puzzle) {
  return !instance.cells.some(cell => puzzle.getValue(cell) === 5)
}
