/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! ISOFILL. Divide the grid into ten regions of ten orthogonally connected
//! cells; every cell in a region holds the same digit; all ten digits appear.
//! So each digit fills exactly ten cells.
//!
//! One whole-grid component, five deductions per digit and one across digits:
//!   Cap:   a digit already in ten cells leaves every other cell.
//!   Force: a digit with exactly ten cells still open takes all of them.
//!   Reach: walk from the digit's placed cells through cells that still allow
//!          it, at most (10 - placed) steps; cells beyond the walk lose it.
//!          A placed cell the walk never meets is a split: it is emptied so
//!          the solver sees the dead branch (decision #66).
//!   Capacity: if that walk meets fewer than ten cells the region can never
//!          reach ten; a placed cell is emptied, as for a split.
//!   Cut:   an open cell in that walk whose removal starves it below ten,
//!          or strands a placed cell, must hold the digit.
//!   Budget: every open cell needs a digit, and each digit can take at most
//!          (10 - placed) more cells, only inside its walk. If no assignment
//!          covers every open cell (max flow falls short) the branch is dead.
//!          This is the one rule that sees across digits: a wrong region
//!          for one digit starves the others' budgets.
//! validate is the exact leaf check: each digit one connected blob of ten.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
  instance.side = Math.round(Math.sqrt(cells.length))
  // Neighbour lists once, not per visit: update runs on every search node and
  // the cut rule walks the grid hundreds of times per call.
  instance.nbrs = cells.map((_, i) => neighbours(i, instance.side))
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
// Returns { mask, size }: one byte array per walk plus the count, in place of
// a Set and a fresh neighbour array per visit — this walk is the hot loop of
// every search node.
function reach (starts, depth, allowed, nbrs) {
  const mask = new Uint8Array(nbrs.length)
  let size = 0
  for (const i of starts) if (!mask[i]) { mask[i] = 1; size++ }
  let frontier = starts
  for (let step = 0; step < depth && frontier.length; step++) {
    const next = []
    for (const i of frontier) {
      for (const n of nbrs[i]) {
        if (allowed[n] && !mask[n]) { mask[n] = 1; size++; next.push(n) }
      }
    }
    frontier = next
  }
  return { mask, size }
}

function * update (instance, puzzle) {
  const { cells, nbrs } = instance
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const size = cells.length / (hi - lo + 1) // cells per digit: 10 on a 10x10
  // One scan of the grid builds every digit's state (update runs on every
  // search node, so each cell is read once). Every digit then sees this
  // snapshot, not the removals earlier digits yield in the same call.
  const state = []
  state.digits = []
  for (let d = lo; d <= hi; d++) {
    state[d] = { placed: [], open: [], allowed: new Array(cells.length).fill(false) }
    state.digits.push(d)
  }
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (puzzle.hasValue(c)) {
      const s = state[puzzle.getValue(c)] // a value outside lo..hi throws: fail loud
      s.placed.push(i)
      s.allowed[i] = true
    } else {
      for (const d of Array.from(puzzle.getCandidates(c))) {
        state[d].open.push(i)
        state[d].allowed[i] = true
      }
    }
  }
  for (let d = lo; d <= hi; d++) {
    const { placed, open, allowed } = state[d]
    const others = []
    for (let e = lo; e <= hi; e++) if (e !== d) others.push(e)
    if (placed.length === size) {
      for (const i of open) yield puzzle.removeCandidateFromCell(d, cells[i])
    } else if (placed.length + open.length === size) {
      for (const i of open) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), cells[i])
    } else if (placed.length > 0) {
      // Any region cell is within (size - placed) steps of the placed set.
      const near = reach(placed, size - placed.length, allowed, nbrs)
      // Capacity: the whole region lies inside `near`, so fewer than `size`
      // cells there is a dead branch; empty a placed cell so the solver sees it.
      if (near.size < size) { yield puzzle.removeCandidateFromCell(d, cells[placed[0]]); continue }
      state[d].near = near.mask // budget (below) limits this digit to its walk
      for (const i of open) if (!near.mask[i]) yield puzzle.removeCandidateFromCell(d, cells[i])
      // Cut: an open cell whose removal starves the walk (< size cells) or
      // strands a placed cell must hold the digit (ticket #101).
      const depth = size - placed.length
      for (const x of open) {
        if (!near.mask[x]) continue
        allowed[x] = false
        const without = reach(placed, depth, allowed, nbrs)
        let cut = without.size < size
        if (!cut && placed.length > 1) {
          const joined = reach([placed[0]], size - 1, allowed, nbrs)
          cut = placed.some(i => !joined.mask[i])
        }
        allowed[x] = true
        if (cut) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), cells[x])
      }
    }
    if (placed.length > 1) {
      // Any two cells of a size-cell region are within (size - 1) steps.
      const joined = reach([placed[0]], size - 1, allowed, nbrs)
      for (const i of placed) if (!joined.mask[i]) yield puzzle.removeCandidateFromCell(d, cells[i])
    }
  }
  // Budget: every open cell needs a digit, and digit d can take at most
  // (size - placed) more cells, all inside its walk. If no assignment covers
  // every open cell the branch is dead: empty that cell.
  const dead = budgetDead(state, lo, hi, size)
  if (dead >= 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(state.digits), cells[dead])
}

// Bipartite matching, open cells to digits, where digit d has (size - placed)
// slots and offers them only to open cells inside its walk. Kuhn's augmenting
// path per cell. Returns the first cell that no matching can cover, else -1.
function budgetDead (state, lo, hi, size) {
  const n = state[lo].allowed.length
  const isOpen = new Uint8Array(n)
  const options = [] // cell -> digits whose walk holds it
  const taken = [] // digit -> cells matched to it
  for (let d = lo; d <= hi; d++) {
    taken[d] = []
    const near = state[d].near
    for (const i of state[d].open) {
      isOpen[i] = 1
      if (!near || near[i]) (options[i] || (options[i] = [])).push(d)
    }
  }
  const augment = (x, seen) => {
    for (const d of options[x] || []) {
      if (seen[d]) continue
      seen[d] = 1
      if (taken[d].length < size - state[d].placed.length) { taken[d].push(x); return true }
      for (let k = 0; k < taken[d].length; k++) {
        if (augment(taken[d][k], seen)) { taken[d][k] = x; return true }
      }
    }
    return false
  }
  for (let x = 0; x < n; x++) if (isOpen[x] && !augment(x, new Uint8Array(hi + 1))) return x
  return -1
}

// Exact check on a full grid: every digit is one connected blob of `size` cells.
function validate (instance, puzzle) {
  const { cells, nbrs } = instance
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
    if (count !== size || reach([first], size, allowed, nbrs).size !== size) return false
  }
  return true
}
