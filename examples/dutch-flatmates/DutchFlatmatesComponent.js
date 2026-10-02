/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! DUTCH FLATMATES. Every 5 needs a flatmate: a 1 in the cell directly above
//! it, or a 9 in the cell directly below it. A 5 in the top row can only have
//! the 9 below; a 5 in the bottom row can only have the 1 above.
//!
//! One whole-grid component. It judges the rule in `validate`, on a full
//! grid, and its `update` removes nothing: the solver learns the rule only by
//! trying values and failing (docs/component-contract.md).

function getAffectedCells (cells) {
  return cells
}

// `cells` is row-major over the square grid; `instance.cells` is already set.
function setParams (instance, cells) {
  instance.side = Math.round(Math.sqrt(cells.length))
}

// Removes no candidate; the rule is `validate`'s alone.
function * update () {}

function validate (instance, puzzle) {
  const { cells, side } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  for (let i = 0; i < cells.length; i++) {
    if (puzzle.getValue(cells[i]) !== 5) continue
    const flatmateAbove = i >= side && puzzle.getValue(cells[i - side]) === 1
    const flatmateBelow = i + side < cells.length && puzzle.getValue(cells[i + side]) === 9
    if (!flatmateAbove && !flatmateBelow) return false
  }
  return true
}
