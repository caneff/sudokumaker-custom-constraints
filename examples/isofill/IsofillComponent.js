/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! ISOFILL. Divide the grid into ten regions of ten orthogonally connected
//! cells; every cell in a region holds the same digit; all ten digits appear.
//! So each digit fills exactly ten cells.
//!
//! This component enforces only the count floor, whole grid at once:
//!   Cap:   a digit already in ten cells leaves every other cell.
//!   Force: a digit with exactly ten cells still open takes all of them.
//! Connectivity pruning is deferred: it costs more per call than the search it
//! saves until a real-app timing run says otherwise (decision #51).

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
}

function * update (instance, puzzle) {
  const { cells } = instance
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const size = cells.length / (hi - lo + 1) // cells per digit: 10 on a 10x10
  for (let d = lo; d <= hi; d++) {
    const others = []
    for (let e = lo; e <= hi; e++) if (e !== d) others.push(e)
    let placed = 0
    const open = []
    for (const c of cells) {
      if (puzzle.hasValue(c)) {
        if (puzzle.getValue(c) === d) placed++
      } else if (Array.from(puzzle.getCandidates(c)).includes(d)) {
        open.push(c)
      }
    }
    if (placed === size) {
      for (const c of open) yield puzzle.removeCandidateFromCell(d, c)
    } else if (placed + open.length === size) {
      for (const c of open) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), c)
    }
  }
}
