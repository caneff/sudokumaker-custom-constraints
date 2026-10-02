/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! DUTCH FLATMATES. Every 5 needs a flatmate: a 1 in the cell directly above
//! it, or a 9 in the cell directly below it. A 5 in the top row can only have
//! the 9 below; a 5 in the bottom row can only have the 1 above.
//!
//! One whole-grid component. `validate` judges the rule on a full grid. `update`
//! prunes per column: a column is a full house, so it holds one 5, one 1 and one
//! 9, and only a (5, 1, 9) row triple the rule allows can be the true one.

function getAffectedCells (cells) {
  return cells
}

// `cells` is row-major over the square grid; `instance.cells` is already set.
// `seen[col]` is the 1/5/9 candidate key `update` last left that column at, so
// a column no one has touched since costs one key read.
function setParams (instance, cells) {
  instance.side = Math.round(Math.sqrt(cells.length))
  instance.seen = new Array(instance.side).fill(-1)
}

const BIT_1 = 1 << 1
const BIT_5 = 1 << 5
const BIT_9 = 1 << 9

// The 1/5/9 candidates of one column as one number: three bits a row.
function columnKey (cells, side, col, puzzle) {
  let key = 0
  for (let row = 0; row < side; row++) {
    const mask = puzzle.getCandidatesBitMask(cells[row * side + col])
    key = key * 8 + ((mask & BIT_1) >> 1) + ((mask & BIT_5) >> 4) + ((mask & BIT_9) >> 7)
  }
  return key
}

// Per column, the rows a 5, a 1 and a 9 can take in some consistent triple:
// three distinct rows, each holding its digit as a candidate, with the 5's
// flatmate present, the 1 directly above it or the 9 directly below it. Sound:
// the true column is such a triple, so none of its positions is dropped.
function supportedRows (m1, m5, m9, side) {
  let s1 = 0
  let s5 = 0
  let s9 = 0
  for (let r5 = 0; r5 < side; r5++) {
    if ((m5 >> r5 & 1) === 0) continue
    for (let r1 = 0; r1 < side; r1++) {
      if (r1 === r5 || (m1 >> r1 & 1) === 0) continue
      for (let r9 = 0; r9 < side; r9++) {
        if (r9 === r5 || r9 === r1 || (m9 >> r9 & 1) === 0) continue
        if (r1 !== r5 - 1 && r9 !== r5 + 1) continue
        s5 |= 1 << r5
        s1 |= 1 << r1
        s9 |= 1 << r9
      }
    }
  }
  return [s1, s5, s9]
}

function * update (instance, puzzle) {
  const { cells, side, seen } = instance
  if (side < 9) return // a board without a 9 cannot hold the triple the prune reasons over
  for (let col = 0; col < side; col++) {
    const key = columnKey(cells, side, col, puzzle)
    if (key === seen[col]) continue
    let m1 = 0
    let m5 = 0
    let m9 = 0
    for (let row = 0; row < side; row++) {
      const mask = puzzle.getCandidatesBitMask(cells[row * side + col])
      m1 |= ((mask & BIT_1) >> 1) << row
      m5 |= ((mask & BIT_5) >> 5) << row
      m9 |= ((mask & BIT_9) >> 9) << row
    }
    const [s1, s5, s9] = supportedRows(m1, m5, m9, side)
    if (s5 === 0) {
      yield puzzle.stop(`no 5 in column ${col + 1} can have a flatmate`)
      return
    }
    let after = 0
    for (let row = 0; row < side; row++) {
      const cell = cells[row * side + col]
      const mask = puzzle.getCandidatesBitMask(cell)
      const drop = (mask & BIT_1 && !(s1 >> row & 1) ? BIT_1 : 0) |
        (mask & BIT_5 && !(s5 >> row & 1) ? BIT_5 : 0) |
        (mask & BIT_9 && !(s9 >> row & 1) ? BIT_9 : 0)
      if (drop !== 0) yield puzzle.removeCandidatesFromCell(drop, cell)
      after = after * 8 + (((mask & ~drop) & BIT_1) >> 1) + (((mask & ~drop) & BIT_5) >> 4) + (((mask & ~drop) & BIT_9) >> 7)
    }
    // A pass over the pruned column removes nothing more: every kept position
    // is in a triple whose three positions all stay.
    seen[col] = after
  }
}

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
