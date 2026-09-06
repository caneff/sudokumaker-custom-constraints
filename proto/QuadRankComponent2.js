/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! One quad-rank clue: this 2x2 window's four digits, read TL/TR/BL/BR and
//! concatenated, rank at the clued position among all windows (SQL RANK).

// Deduction 1, the leading-digit bound (#324). The top-left cell is the
// window's most significant digit, so the clued rank bounds it: in an n x n
// latin square a top-left-d window's rank lies in
// [(n-2)(d-1)+1, (n-2)(d-1)+(n-1)]. Sound whenever rows == cols == numValues.
function allowedTopLeft (n, rank) {
  const out = []
  for (let d = 1; d <= n; d++) {
    const lo = (n - 2) * (d - 1) + 1
    if (rank >= lo && rank <= lo + n - 2) out.push(d)
  }
  return out
}

// Deduction 2, the counting identity (#335). Rank R means exactly R-1 windows
// hold a strictly smaller value. Every window's value sits in an interval read
// off the candidate sets (concatenation is digit-wise monotone, so the interval
// is the concatenation of the per-cell min and max). Against that:
//   L = windows definitely below  (hi(u) < lo(me))
//   P = windows possibly below    (lo(u) < hi(me))
// and L <= R-1 <= P must hold. Outside that the branch is dead. Fixing one of
// my cells to a digit moves lo(me)/hi(me), so a digit that puts R-1 outside
// [L, P] is not a candidate. Other windows keep their unconditional intervals
// -- a relaxation, so the test stays sound where windows overlap.
function getAffectedCells (cells, rank, allCells, n) {
  // A window's rank is defined against all n*n windows, so this clue reads the
  // whole grid. #328 measured the narrow version: fast and wrong.
  return allCells
}

function setParams (instance, cells, rank, allCells, n) {
  instance.cells = cells
  instance.rank = rank
  instance.allCells = allCells
  instance.n = n
  const wins = []
  for (let r = 0; r + 1 < n; r++) {
    for (let c = 0; c + 1 < n; c++) {
      wins.push([r * n + c, r * n + c + 1, (r + 1) * n + c, (r + 1) * n + c + 1])
    }
  }
  instance.wins = wins
  const tl = allCells.indexOf(cells[0])
  instance.me = wins.findIndex(w => w[0] === tl)
}

// Lowest and highest candidate of a cell, read off the bitmask (bit d = digit d).
function loDigit (mask) { return 31 - Math.clz32(mask & -mask) }
function hiDigit (mask) { return 31 - Math.clz32(mask) }

function * update (instance, puzzle) {
  const { n, rank, allCells, cells, wins, me } = instance

  if (!instance.ldDone) {
    const allowed = allowedTopLeft(n, rank)
    const tl = cells[0]
    for (const d of puzzle.getCandidates(tl)) {
      if (!allowed.includes(d)) yield puzzle.removeCandidateFromCell(d, tl)
    }
    instance.ldDone = true
  }

  const W = wins.length
  const lo = new Array(W)
  const hi = new Array(W)
  const masks = new Array(n * n)
  for (let i = 0; i < n * n; i++) masks[i] = puzzle.getCandidatesBitMask(allCells[i])
  for (let i = 0; i < W; i++) {
    const w = wins[i]
    let a = 0; let b = 0
    for (let j = 0; j < 4; j++) {
      const m = masks[w[j]]
      if (m === 0) return // an emptied cell: the solver is already unwinding
      a = a * 10 + loDigit(m)
      b = b * 10 + hiDigit(m)
    }
    lo[i] = a; hi[i] = b
  }

  const count = (myLo, myHi) => {
    let L = 0; let P = 0
    for (let i = 0; i < W; i++) {
      if (i === me) continue
      if (hi[i] < myLo) L++
      if (lo[i] < myHi) P++
    }
    return [L, P]
  }

  const [L, P] = count(lo[me], hi[me])
  if (rank - 1 < L || rank - 1 > P) {
    yield puzzle.stop(`no assignment gives ${instance.name} rank ${rank}`, cells)
    return
  }

  // Per-cell: pin one of my four cells to each candidate in turn and re-test.
  const mine = wins[me]
  for (let j = 0; j < 4; j++) {
    const mask = masks[mine[j]]
    if ((mask & (mask - 1)) === 0) continue // already pinned
    for (const d of puzzle.getCandidates(cells[j])) {
      let myLo = 0; let myHi = 0
      for (let k = 0; k < 4; k++) {
        const m = masks[mine[k]]
        myLo = myLo * 10 + (k === j ? d : loDigit(m))
        myHi = myHi * 10 + (k === j ? d : hiDigit(m))
      }
      const [Ld, Pd] = count(myLo, myHi)
      if (rank - 1 < Ld || rank - 1 > Pd) yield puzzle.removeCandidateFromCell(d, cells[j])
    }
  }
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
