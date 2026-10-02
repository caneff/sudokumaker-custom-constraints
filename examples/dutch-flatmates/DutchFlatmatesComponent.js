/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! DUTCH FLATMATES. Every 5 needs a flatmate: a 1 in the cell directly above
//! it, or a 9 in the cell directly below it. A 5 in the top row can only have
//! the 9 below; a 5 in the bottom row can only have the 1 above.
//!
//! One whole-grid component. `validate` judges the rule on a full grid. `update`
//! prunes per column, and how far depends on what the app says about it:
//!   - a column that cannot repeat is a house, so it holds exactly one 5, one 1
//!     and one 9, and only the rows of a (5, 1, 9) arrangement the rule allows
//!     can be the true ones;
//!   - a column that can repeat gets only the per-cell rule: a 5 with no 1
//!     above it and no 9 below it can go.

// #include ../_shared/line-kind.js

// Every cell takes part in the rule, so a change to any cell wakes `update`.
function getAffectedCells (cells) {
  return cells
}

// `cells` is row-major over the square grid; `instance.cells` is already set.
// `instance.columns[col]` is that column's cell ids, top row first.
// `instance.seen[col]` is the `[ones, fives, nines]` row sets `update` last
// left that column at (null until it has), so a column no one has touched since
// costs one read.
function setParams (instance, cells) {
  const side = Math.round(Math.sqrt(cells.length))
  instance.side = side
  instance.columns = Array.from({ length: side }, (_, col) =>
    Array.from({ length: side }, (_, row) => cells[row * side + col]))
  instance.seen = new Array(side).fill(null)
}

// Candidate bit masks put digit d at bit d. Row sets below are different: there
// bit `row` is the row (0 = top), so `1 << 3` is "row 3".
const BIT_1 = 1 << 1
const BIT_5 = 1 << 5
const BIT_9 = 1 << 9

// The rows of a column where a 1, a 5 and a 9 can still go, as three bit sets
// (bit `row` is set when that row's cell holds the digit as a candidate).
function readRows (puzzle, column) {
  let ones = 0
  let fives = 0
  let nines = 0
  for (let row = 0; row < column.length; row++) {
    const mask = puzzle.getCandidatesBitMask(column[row])
    if (mask & BIT_1) ones |= 1 << row
    if (mask & BIT_5) fives |= 1 << row
    if (mask & BIT_9) nines |= 1 << row
  }
  return [ones, fives, nines]
}

// Has the column not changed since `update` last left it at `b`?
function sameRows (a, b) {
  return b !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

// House column: the rows a 1, a 5 and a 9 can take in some arrangement of one
// of each that the rule allows. A 5 at `row` is supported two ways:
//   1 above: a 1 at row - 1, and a 9 at any other row it can go;
//   9 below: a 9 at row + 1, and a 1 at any other row it can go.
// A row is kept for a digit when some supported 5 uses it, as its partner or as
// the column's other digit. Sound: the true column is such an arrangement, so
// none of its positions is dropped.
function supportedRows (ones, fives, nines, side) {
  let keepOnes = 0
  let keepFives = 0
  let keepNines = 0
  for (let row = 0; row < side; row++) {
    if (!(fives >> row & 1)) continue // no 5 can go here, nothing to support
    const five = 1 << row
    // 1 above. The other 9 cannot sit in the 5's row or the 1's row.
    if (row > 0 && ones >> (row - 1) & 1) {
      const one = 1 << (row - 1)
      const otherNines = nines & ~five & ~one
      if (otherNines !== 0) {
        keepFives |= five
        keepOnes |= one
        keepNines |= otherNines
      }
    }
    // 9 below. The other 1 cannot sit in the 5's row or the 9's row.
    if (row < side - 1 && nines >> (row + 1) & 1) {
      const nine = 1 << (row + 1)
      const otherOnes = ones & ~five & ~nine
      if (otherOnes !== 0) {
        keepFives |= five
        keepNines |= nine
        keepOnes |= otherOnes
      }
    }
  }
  return [keepOnes, keepFives, keepNines]
}

// A column that can repeat: only the 5s that have a 1 above or a 9 below can
// stay, and nothing is known about the 1s and 9s. `ones << 1` moves each 1's row
// down onto the row of the 5 it would sit above, and `nines >> 1` moves each
// 9's row up onto the 5 it would sit below, so the AND keeps the 5s with either.
function flatmatedRows (ones, fives, nines) {
  return [ones, fives & ((ones << 1) | (nines >> 1)), nines]
}

// Remove `digit` from the cells of the rows in the bit set `rows`.
function * removeRows (puzzle, column, digit, rows) {
  for (let row = 0; row < column.length; row++) {
    if (rows >> row & 1) yield puzzle.removeCandidateFromCell(digit, column[row])
  }
}

function * update (instance, puzzle) {
  const { columns, side, seen } = instance
  if (side < 9) return // a board without a 9 cannot hold the arrangement the prune reasons over
  for (let col = 0; col < side; col++) {
    const column = columns[col]
    const rows = readRows(puzzle, column)
    if (sameRows(rows, seen[col])) continue // already pruned, nothing new to reason from
    const [ones, fives, nines] = rows
    // Asked here, never in main code, which runs before the app registers the
    // row and column houses (line-kind.js says why).
    const isHouse = lineKind(instance, puzzle, column).kind === HOUSE
    const keep = isHouse ? supportedRows(ones, fives, nines, side) : flatmatedRows(ones, fives, nines)
    // A house holds a 5 somewhere, so no supported 5 is a dead branch. A column
    // that can repeat need not hold one.
    if (isHouse && keep[1] === 0) {
      yield puzzle.stop(`no 5 in column ${col + 1} can have a flatmate`)
      return
    }
    // What was a candidate and is not kept goes.
    if (ones & ~keep[0]) yield * removeRows(puzzle, column, 1, ones & ~keep[0])
    if (fives & ~keep[1]) yield * removeRows(puzzle, column, 5, fives & ~keep[1])
    if (nines & ~keep[2]) yield * removeRows(puzzle, column, 9, nines & ~keep[2])
    // A pass over the pruned column removes nothing more: every kept position
    // is in an arrangement whose positions all stay.
    seen[col] = keep
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
