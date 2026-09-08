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
// and L <= R-1 <= P must hold.
//
// Deduction 3, cross-clue order (#375). The other clues' ranks are known too,
// and ranks order windows exactly: rank(a) < rank(b) iff value(a) < value(b),
// and rank(a) == rank(b) iff the windows are digit-identical. Verified at 0
// mismatches over 604,800 window pairs (proto/order-check.mjs). So:
//   3a. A tied clue carries the same four digits -- intersect cell-wise.
//   3b. In the L/P count a clued window needs no interval test: smaller rank is
//       below, anything else is not. Exact where the intervals overlap and the
//       interval test would have given up either way.
//   3c. Pairwise, directly: rank(u) < rank(me) means value(u) < value(me), so a
//       digit that forces value(me) <= lo(u) is dead. The counting rule only
//       ever sees this through the aggregate; here it is read off one pair.
// Where the rank relation and the intervals contradict each other outright, the
// branch is dead -- checked rather than silently dropped, which is what an
// earlier draft of 3b did (it counted fewer removals than deduction 2 alone).
function getAffectedCells (cells, rank, allCells, n) {
  // A window's rank is defined against all n*n windows, so this clue reads the
  // whole grid. #328 measured the narrow version: fast and wrong.
  return allCells
}

function setParams (instance, cells, rank, allCells, n, clues) {
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

  // Every OTHER clue as [windowIndex, rank]; twins are those at my own rank.
  const clued = []
  const twins = []
  for (const [cell, r] of (clues || [])) {
    const i = wins.findIndex(w => w[0] === allCells.indexOf(cell))
    if (i < 0 || i === instance.me) continue
    clued.push([i, r])
    if (r === rank) twins.push(i)
  }
  instance.clued = clued
  instance.twins = twins
}

// Lowest and highest candidate of a cell, read off the bitmask (bit d = digit d).
function loDigit (mask) { return 31 - Math.clz32(mask & -mask) }
function hiDigit (mask) { return 31 - Math.clz32(mask) }

function * update (instance, puzzle) {
  const { n, rank, allCells, cells, wins, me, clued, twins } = instance

  if (!instance.ldDone) {
    const allowed = allowedTopLeft(n, rank)
    const tl = cells[0]
    for (const d of puzzle.getCandidates(tl)) {
      if (!allowed.includes(d)) yield puzzle.removeCandidateFromCell(d, tl)
    }
    instance.ldDone = true
  }

  // 3a: a tied clue is the same four digits, so intersect cell-wise.
  const mineCells = wins[me]
  for (const t of twins) {
    const twin = wins[t]
    for (let j = 0; j < 4; j++) {
      const other = puzzle.getCandidatesBitMask(allCells[twin[j]])
      if (other === 0) return
      for (const d of puzzle.getCandidates(allCells[mineCells[j]])) {
        if (!(other & (1 << d))) yield puzzle.removeCandidateFromCell(d, allCells[mineCells[j]])
      }
    }
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

  // Windows whose relation to me the ranks already settle, so the interval test
  // is skipped for them in the count.
  const known = new Array(W).fill(0) // 0 unknown, 1 below, -1 not below
  for (const [i, r] of clued) known[i] = r < rank ? 1 : -1

  // 3c, and the contradiction check: does any clued pair conflict outright with
  // the current intervals? Answered on `me`'s full interval first.
  const pairDead = (myLo, myHi) => {
    for (const [i, r] of clued) {
      // u must be below me, above me, or equal to me -- and cannot be.
      if (r < rank) {
        if (lo[i] >= myHi) return true
      } else if (r > rank) {
        if (hi[i] <= myLo) return true
      } else if (hi[i] < myLo || lo[i] > myHi) {
        return true
      }
    }
    return false
  }

  const count = (myLo, myHi) => {
    let L = 0; let P = 0
    for (let i = 0; i < W; i++) {
      if (i === me) continue
      if (known[i] === 1) { L++; P++; continue }
      if (known[i] === -1) continue
      if (hi[i] < myLo) L++
      if (lo[i] < myHi) P++
    }
    return [L, P]
  }

  const dead = (myLo, myHi) => {
    if (pairDead(myLo, myHi)) return true
    const [L, P] = count(myLo, myHi)
    return rank - 1 < L || rank - 1 > P
  }

  if (dead(lo[me], hi[me])) {
    yield puzzle.stop(`no assignment gives ${instance.name} rank ${rank}`, cells)
    return
  }

  // Per-cell: pin one of my four cells to each candidate in turn and re-test.
  for (let j = 0; j < 4; j++) {
    const mask = masks[mineCells[j]]
    if ((mask & (mask - 1)) === 0) continue // already pinned
    for (const d of puzzle.getCandidates(cells[j])) {
      let myLo = 0; let myHi = 0
      for (let k = 0; k < 4; k++) {
        const m = masks[mineCells[k]]
        myLo = myLo * 10 + (k === j ? d : loDigit(m))
        myHi = myHi * 10 + (k === j ? d : hiDigit(m))
      }
      if (dead(myLo, myHi)) yield puzzle.removeCandidateFromCell(d, cells[j])
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
