/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! One quad-rank clue: this 2x2 window's four digits, read TL/TR/BL/BR and
//! concatenated, rank at the clued position among all windows (SQL RANK).

// The deduction: the top-left cell is the window's most significant digit, so
// the clued rank bounds it. In an n x n latin square the (n-1)x(n-1) sub-board
// of top-left cells holds one digit n-1 times and every other n-2 times, so a
// top-left-d window's rank lies in [(n-2)(d-1)+1, (n-2)(d-1)+(n-1)]. Inverting
// that gives the digits the top-left may still hold. See proto/leading-digit.mjs
// for the derivation and proto/soundness-harness.mjs for the sweep.
function allowedTopLeft (n, rank) {
  const out = []
  for (let d = 1; d <= n; d++) {
    const lo = (n - 2) * (d - 1) + 1
    if (rank >= lo && rank <= lo + n - 2) out.push(d)
  }
  return out
}

function getAffectedCells (cells, rank, allCells, n) {
  return allCells
}

function setParams (instance, cells, rank, allCells, n) {
  instance.cells = cells
  instance.rank = rank
  instance.allCells = allCells
  instance.n = n
}

function * update (instance, puzzle) {
  if (instance.done) return
  const allowed = allowedTopLeft(instance.n, instance.rank)
  const tl = instance.cells[0]
  for (const d of puzzle.getCandidates(tl)) {
    if (!allowed.includes(d)) yield puzzle.removeCandidateFromCell(d, tl)
  }
  // The bound never tightens -- it depends only on the clue -- so one pass is
  // the whole deduction. Latch it off rather than re-walking on every call.
  instance.done = true
}

// The rule itself, checked once the grid is full: every window's value ranked
// against every other, and this window's rank must be the clued one.
function validate (instance, puzzle) {
  const { allCells, n, cells, rank } = instance
  const grid = []
  for (let r = 0; r < n; r++) {
    const row = []
    for (let c = 0; c < n; c++) {
      const v = puzzle.getValue(allCells[r * n + c])
      if (v === undefined || v === null) return true // incomplete: nothing to check yet
      row.push(v)
    }
    grid.push(row)
  }
  const values = []
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      values.push({ r, c, v: Number(`${grid[r][c]}${grid[r][c + 1]}${grid[r + 1][c]}${grid[r + 1][c + 1]}`) })
    }
  }
  const tlIndex = allCells.indexOf(cells[0])
  const tr = Math.floor(tlIndex / n); const tc = tlIndex % n
  const mine = values.find(w => w.r === tr && w.c === tc)
  const actual = 1 + values.reduce((acc, w) => acc + (w.v < mine.v ? 1 : 0), 0)
  return actual === rank
}
