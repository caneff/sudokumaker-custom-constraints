/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! ISOFILL. Divide the grid into ten regions of ten orthogonally connected
//! cells; every cell in a region holds the same digit; all ten digits appear.
//! So each digit fills exactly ten cells.
//!
//! One whole-grid component, three deductions per digit:
//!   Cap:   a digit already in ten cells leaves every other cell.
//!   Force: a digit with exactly ten cells still open takes all of them.
//!   Reach: walk from the digit's placed cells through cells that still allow
//!          it, at most (10 - placed) steps; cells beyond the walk lose it.
//!          A placed cell the walk never meets is a split: it is emptied so
//!          the solver sees the dead branch (decision #66).
//!   Capacity: if that walk meets fewer than ten cells the region can never
//!          reach ten; a placed cell is emptied, as for a split.
//! validate is the exact leaf check: each digit one connected blob of ten.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
  instance.side = Math.round(Math.sqrt(cells.length))
}

// Orthogonal neighbours by index arithmetic; cells are row-major on a square.
function neighbours (i, side) {
  const out = []
  if (i % side > 0) out.push(i - 1)
  if (i % side < side - 1) out.push(i + 1)
  if (i >= side) out.push(i - side)
  if (i + side < side * side) out.push(i + side)
  return out
}

// Cells reachable from `starts` in at most `depth` steps through `allowed`.
function reach (starts, depth, allowed, side) {
  const seen = new Set(starts)
  let frontier = starts
  for (let step = 0; step < depth && frontier.length; step++) {
    const next = []
    for (const i of frontier) {
      for (const n of neighbours(i, side)) {
        if (allowed[n] && !seen.has(n)) { seen.add(n); next.push(n) }
      }
    }
    frontier = next
  }
  return seen
}

function * update (instance, puzzle) {
  const { cells, side } = instance
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const size = cells.length / (hi - lo + 1) // cells per digit: 10 on a 10x10
  for (let d = lo; d <= hi; d++) {
    const others = []
    for (let e = lo; e <= hi; e++) if (e !== d) others.push(e)
    const placed = []
    const open = []
    const allowed = new Array(cells.length).fill(false)
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      if (puzzle.hasValue(c)) {
        if (puzzle.getValue(c) === d) { placed.push(i); allowed[i] = true }
      } else if (Array.from(puzzle.getCandidates(c)).includes(d)) {
        open.push(i); allowed[i] = true
      }
    }
    if (placed.length === size) {
      for (const i of open) yield puzzle.removeCandidateFromCell(d, cells[i])
    } else if (placed.length + open.length === size) {
      for (const i of open) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), cells[i])
    } else if (placed.length > 0) {
      // Any region cell is within (size - placed) steps of the placed set.
      const near = reach(placed, size - placed.length, allowed, side)
      // Capacity: the whole region lies inside `near`, so fewer than `size`
      // cells there is a dead branch; empty a placed cell so the solver sees it.
      if (near.size < size) { yield puzzle.removeCandidateFromCell(d, cells[placed[0]]); continue }
      for (const i of open) if (!near.has(i)) yield puzzle.removeCandidateFromCell(d, cells[i])
    }
    if (placed.length > 1) {
      // Any two cells of a size-cell region are within (size - 1) steps.
      const joined = reach([placed[0]], size - 1, allowed, side)
      for (const i of placed) if (!joined.has(i)) yield puzzle.removeCandidateFromCell(d, cells[i])
    }
  }
}

// Exact check on a full grid: every digit is one connected blob of `size` cells.
function validate (instance, puzzle) {
  const { cells, side } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const size = cells.length / (hi - lo + 1)
  for (let d = lo; d <= hi; d++) {
    const allowed = new Array(cells.length).fill(false)
    let first = -1
    let count = 0
    for (let i = 0; i < cells.length; i++) {
      if (puzzle.getValue(cells[i]) !== d) continue
      allowed[i] = true
      count++
      if (first < 0) first = i
    }
    if (count !== size || reach([first], size, allowed, side).size !== size) return false
  }
  return true
}
