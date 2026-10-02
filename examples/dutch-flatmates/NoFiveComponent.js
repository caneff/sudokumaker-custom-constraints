/* eslint-disable no-unused-vars -- the app calls these functions by name */
// No 5 in these cells: 5s live in Dutch Flats, not in circles. This rule is
// added over the circle cells.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
}

// Remove 5 from every one of these cells before solving starts. A 5 can never
// come back, so there is nothing more to check later.
function * initialize (instance, puzzle) {
  for (const cell of instance.cells) yield puzzle.removeCandidateFromCell(5, cell)
}

// A full or partial grid is fine as long as none of these cells holds a 5.
function validate (instance, puzzle) {
  return !instance.cells.some(cell => puzzle.getValue(cell) === 5)
}
