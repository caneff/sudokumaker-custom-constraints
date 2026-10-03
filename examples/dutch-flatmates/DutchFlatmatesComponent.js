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
  instance.lastPruned = new Array(size).fill(null) // each column's state when we last pruned it
}

// Rows (0 = top) of this column where each of the digits 1, 5 and 9 can still go.
function readColumn (puzzle, column) {
  const rows = { 1: [], 5: [], 9: [] }
  for (let row = 0; row < column.length; row++) {
    const candidates = puzzle.getCandidates(column[row])
    for (const digit of [1, 5, 9]) {
      if (candidates.has(digit)) rows[digit].push(row)
    }
  }
  return rows
}

// A short text for a column's state, to tell whether it has changed.
function columnState (rows) {
  return `${rows[1]}|${rows[5]}|${rows[9]}`
}

// Whether this column may repeat digits. The app only knows once solving has
// started, so this is asked here and not in the setup code, and only once: the
// board's layout decides it, so one answer is kept for the whole solve.
function columnMayRepeat (instance, puzzle, col) {
  if (instance.mayRepeat[col] === null) {
    instance.mayRepeat[col] = puzzle.getCellsCanHaveRepeats(instance.columns[col])
  }
  return instance.mayRepeat[col]
}

// Which rows of a normal column can still hold its 1, 5 and 9.
function rowsToKeep (rows) {
  const keep = { 1: new Set(), 5: new Set(), 9: new Set() }
  for (const five of rows[5]) {
    // The 1 directly above, with the 9 anywhere else it can go.
    const one = five - 1
    if (rows[1].includes(one)) {
      const otherNines = rows[9].filter(row => row !== five && row !== one)
      if (otherNines.length > 0) {
        keep[5].add(five)
        keep[1].add(one)
        for (const row of otherNines) keep[9].add(row)
      }
    }
    // The 9 directly below, with the 1 anywhere else it can go.
    const nine = five + 1
    if (rows[9].includes(nine)) {
      const otherOnes = rows[1].filter(row => row !== five && row !== nine)
      if (otherOnes.length > 0) {
        keep[5].add(five)
        keep[9].add(nine)
        for (const row of otherOnes) keep[1].add(row)
      }
    }
  }
  return keep
}

// A column that may repeat digits: a 5 stays only if a 1 can go above it or a
// 9 below it. Nothing is known about the 1s and 9s, so they all stay.
function rowsToKeepIfRepeatsAllowed (rows) {
  return {
    1: new Set(rows[1]),
    5: new Set(rows[5].filter(row => rows[1].includes(row - 1) || rows[9].includes(row + 1))),
    9: new Set(rows[9])
  }
}

function * update (instance, puzzle) {
  const { columns, size, lastPruned } = instance
  if (size < 9) return // no 9 fits on a board this small, so there is nothing to prune
  for (let col = 0; col < size; col++) {
    const column = columns[col]
    const rows = readColumn(puzzle, column)
    if (columnState(rows) === lastPruned[col]) continue // nothing new since we pruned it
    const mayRepeat = columnMayRepeat(instance, puzzle, col)
    const keep = mayRepeat ? rowsToKeepIfRepeatsAllowed(rows) : rowsToKeep(rows)
    // A normal column must hold a 5 somewhere, so if none can stay, this branch is dead.
    if (!mayRepeat && keep[5].size === 0) {
      yield puzzle.stop(`no 5 in column ${col + 1} can have a flatmate`)
      return
    }
    // Remove each digit from the rows we are not keeping, and note the rows left.
    const left = { 1: [], 5: [], 9: [] }
    for (const digit of [1, 5, 9]) {
      for (const row of rows[digit]) {
        if (keep[digit].has(row)) left[digit].push(row)
        else yield puzzle.removeCandidateFromCell(digit, column[row])
      }
    }
    // Pruning again would remove nothing more, so remember the column as it now stands.
    lastPruned[col] = columnState(left)
  }
}

// On a full grid, every 5 needs a 1 directly above it or a 9 directly below it.
// `instance.cells` is the list of every cell, row by row, which the app fills in.
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
