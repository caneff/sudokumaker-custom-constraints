/* eslint-disable no-unused-vars -- the component API SudokuMaker calls by name */
//! The built-in RequiredDigits rule, ported from the bundle body
//! (bundle.claude.js:3234) into this repo's component shape, so the shipped
//! rule and the GAC replacement can be timed and compared through one driver.
//! Not for use in a puzzle -- the app already has this one. `validate` is left
//! out: the built-in's greedy strike-off is the part being replaced, and no
//! comparison here reads it.

function getAffectedCells (values, cells) {
  return cells
}

function setParams (instance, values, cells) {
  instance.values = values
  instance.cells = cells
}

function * update (instance, puzzle) {
  const unsolvedCells = []
  const remainingValues = instance.values.slice()
  for (const cell of instance.cells) {
    const value = puzzle.getValue(cell)
    if (value !== undefined) {
      //! One occurrence per filled cell, as the bundle's removeFirstValue does.
      const at = remainingValues.indexOf(value)
      if (at >= 0) remainingValues.splice(at, 1)
    } else {
      unsolvedCells.push(cell)
    }
  }
  //! The whole of the built-in's pruning: only when the counts match exactly.
  if (unsolvedCells.length !== remainingValues.length) return
  const keptDigits = new Set(remainingValues)
  for (const cell of unsolvedCells) {
    const removed = []
    for (const digit of puzzle.getCandidates(cell)) {
      if (!keptDigits.has(digit)) removed.push(digit)
    }
    if (removed.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(removed), cell)
  }
}
