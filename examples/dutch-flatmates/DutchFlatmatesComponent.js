/* eslint-disable no-unused-vars -- the app calls these functions by name */
// Dutch Flatmates: every 5 needs a 1 directly above it or a 9 directly below it.
//
// How this speeds up the solver: look at one column at a time. A column holds
// exactly one 1, one 5 and one 9. For each cell that could still be the 5,
// check whether the cell above could be the 1 or the cell below could be
// the 9, and that the column's other digit still has somewhere to go. Any 1, 5
// or 9 that no valid placement uses is removed.
//
// If the app says a column may repeat digits (not a normal sudoku column),
// only the simple check is used: a 5 must have a possible 1 above or 9 below.

// Every cell takes part in the rule, so a change to any cell wakes `update`.
function getAffectedCells (cells) {
  return cells
}

// `cells` lists the grid row by row. We also keep each column's cells, top row
// first, and a note of how each column looked the last time we pruned it.
function setParams (instance, cells) {
  const size = Math.round(Math.sqrt(cells.length))
  instance.size = size
  instance.columns = Array.from({ length: size }, (_, col) =>
    Array.from({ length: size }, (_, row) => cells[row * size + col]))
  instance.mayRepeat = new Array(size).fill(null) // filled in by columnMayRepeat
  instance.lastLeft = new Array(size).fill(null) // where we left each column
}

// Rows (0 = top) of this column where each of the digits 1, 5 and 9 can still go.
function readColumn (puzzle, column) {
  const ones = []
  const fives = []
  const nines = []
  for (let row = 0; row < column.length; row++) {
    const candidates = puzzle.getCandidates(column[row])
    if (candidates.has(1)) ones.push(row)
    if (candidates.has(5)) fives.push(row)
    if (candidates.has(9)) nines.push(row)
  }
  return { ones, fives, nines }
}

// A short description of a column's state, to tell whether it has changed.
function describe ({ ones, fives, nines }) {
  return `${ones}|${fives}|${nines}`
}

// Whether this column may repeat digits. The app only knows once solving has
// started, so this is asked here and not in the setup code, and only once: the
// answer does not change as the puzzle is solved.
function columnMayRepeat (instance, puzzle, col) {
  if (instance.mayRepeat[col] === null) {
    instance.mayRepeat[col] = puzzle.getCellsCanHaveRepeats(instance.columns[col])
  }
  return instance.mayRepeat[col]
}

// Which rows of a normal column can still hold its 1, 5 and 9.
function rowsToKeep (ones, fives, nines) {
  const keep = { ones: new Set(), fives: new Set(), nines: new Set() }
  for (const five of fives) {
    // The 1 directly above, with the 9 anywhere else it can go.
    const one = five - 1
    if (ones.includes(one)) {
      const otherNines = nines.filter(row => row !== five && row !== one)
      if (otherNines.length > 0) {
        keep.fives.add(five)
        keep.ones.add(one)
        for (const row of otherNines) keep.nines.add(row)
      }
    }
    // The 9 directly below, with the 1 anywhere else it can go.
    const nine = five + 1
    if (nines.includes(nine)) {
      const otherOnes = ones.filter(row => row !== five && row !== nine)
      if (otherOnes.length > 0) {
        keep.fives.add(five)
        keep.nines.add(nine)
        for (const row of otherOnes) keep.ones.add(row)
      }
    }
  }
  return keep
}

// A column that may repeat digits: a 5 stays only if a 1 can go above it or a
// 9 below it. Nothing is known about the 1s and 9s, so they all stay.
function rowsToKeepIfRepeatsAllowed (ones, fives, nines) {
  return {
    ones: new Set(ones),
    fives: new Set(fives.filter(row => ones.includes(row - 1) || nines.includes(row + 1))),
    nines: new Set(nines)
  }
}

function * update (instance, puzzle) {
  const { columns, size, lastLeft } = instance
  if (size < 9) return // no 9 on a board this small, so the rule has nothing to say
  for (let col = 0; col < size; col++) {
    const column = columns[col]
    const { ones, fives, nines } = readColumn(puzzle, column)
    if (describe({ ones, fives, nines }) === lastLeft[col]) continue // nothing new since we pruned it
    const mayRepeat = columnMayRepeat(instance, puzzle, col)
    const keep = mayRepeat
      ? rowsToKeepIfRepeatsAllowed(ones, fives, nines)
      : rowsToKeep(ones, fives, nines)
    // A normal column must hold a 5 somewhere, so if none can stay, this branch is dead.
    if (!mayRepeat && keep.fives.size === 0) {
      yield puzzle.stop(`no 5 in column ${col + 1} can have a flatmate`)
      return
    }
    for (const [digit, rows, kept] of [[1, ones, keep.ones], [5, fives, keep.fives], [9, nines, keep.nines]]) {
      for (const row of rows) {
        if (!kept.has(row)) yield puzzle.removeCandidateFromCell(digit, column[row])
      }
    }
    // Pruning again would remove nothing more, so remember the column as it now stands.
    lastLeft[col] = describe({
      ones: ones.filter(row => keep.ones.has(row)),
      fives: fives.filter(row => keep.fives.has(row)),
      nines: nines.filter(row => keep.nines.has(row))
    })
  }
}

// On a full grid, every 5 needs a 1 directly above it or a 9 directly below it.
function validate (instance, puzzle) {
  const { cells, size } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  for (let i = 0; i < cells.length; i++) {
    if (puzzle.getValue(cells[i]) !== 5) continue
    const oneAbove = i >= size && puzzle.getValue(cells[i - size]) === 1
    const nineBelow = i + size < cells.length && puzzle.getValue(cells[i + size]) === 9
    if (!oneAbove && !nineBelow) return false
  }
  return true
}
