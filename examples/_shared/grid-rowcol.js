//! A no-ring board's rows and columns: every row and column of the whole grid.
//!
//! A no-ring board is a `"custom"` document. The live editor opens a
//! `"sudoku"` document as 9x9 whatever its width says
//! (docs/research/368-up-to-n-setup-throw.md), and a custom document's region
//! constraint gives BOXES ONLY (docs/gotchas.md #9), so the lines are declared
//! here as components. Unlike frame-rowcol.js nothing is sliced off: with no
//! ring, the edge lines and edge cells are the puzzle.
//!
//! `| 0` turns each id from the geometry helpers into a plain integer, which
//! the solver reads faster (#394). `houseType` lets the solver's row and column
//! logic read the house as a row or a column.

const digitCount = helpers.digits.maxDigit - helpers.digits.minDigit + 1

for (const [kind, houseType, lines] of [
  ['row', 'Row', helpers.geometry.getAllRows()],
  ['column', 'Column', helpers.geometry.getAllColumns()]
]) {
  let i = 0
  for (const line of lines) {
    const name = `${kind} ${++i}`
    const cells = line.map(cell => cell | 0)
    //! A house also says every digit is used, which only holds when the line
    //! is as long as the digit range; a shorter line gets all-different.
    puzzle.addConstraintComponent(cells.length === digitCount
      ? new HouseComponent(name, cells, houseType)
      : new DifferentDigitsComponent(name, cells))
  }
}
