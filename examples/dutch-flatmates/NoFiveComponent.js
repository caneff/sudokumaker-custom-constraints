/* eslint-disable no-unused-vars -- setParams/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! NO FIVE. No 5 in any of these cells: the Counting Circles board's "5s live
//! in Dutch Flats, they don't live in Circles". The backend registers it over
//! the circle cells.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
}

// A 5 is never a candidate in these cells, so nothing is left to prune later.
function * initialize (instance, puzzle) {
  for (const cell of instance.cells) yield puzzle.removeCandidateFromCell(5, cell)
}

function validate (instance, puzzle) {
  return !instance.cells.some(cell => puzzle.getValue(cell) === 5)
}
