/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Fillomino. Divide the grid into orthogonally connected regions; every cell
//! of a region of k cells holds the digit k; two regions of the same size may
//! not touch orthogonally. No houses. Digits run 1..D, so no region is wider
//! than D cells.
//!
//! One whole-grid component. Every call makes one grid scan that finds the
//! ISLANDS -- a maximal connected set of placed cells of one digit. Two
//! adjacent cells holding k lie in one region, so an island of digit k with p
//! cells sits wholly inside one region, and that region needs k - p more
//! cells. Nothing is carried between calls: the solver gives no backtrack
//! signal, so state kept across calls would be a correctness risk, not a
//! speed win.
//!
//! Rung 1 of the ladder, per island:
//!   Overflow: an island of more than k cells holding k is a dead branch.
//!   Seal:     an island of k cells holding k is a finished region, so every
//!             open cell touching it loses k.
//!   Walk:     a 0-1 walk out of the island. A cell already holding k costs
//!             nothing to enter, an open cell that still allows k costs one
//!             step, and the budget is the k - p open cells the region can
//!             still take. The walk is a superset of the region.
//!   Starve:   a walk under k cells is a dead branch.
//!   Force:    a walk of exactly k cells IS the region, so every open cell in
//!             it holds k.
//!   Doors:    a door is an open cell beside the island that still allows k.
//!             The region has to grow through one, so one door left means
//!             that cell holds k; and a door that touches islands of k adding
//!             up past k cells cannot hold k.
//!
//! Rung 2, the growth test (§6), at the scope the clock allowed:
//!   Merge:          at a DOOR, M is the door plus every island of the digit
//!                   it touches. If the door held k they would all be one
//!                   region.
//!   Merge overflow: |M| > k, so the door does not hold k.
//!   Merge starve:   the 0-1 walk out of M with budget k - |M| covers the
//!                   whole region, so a walk under k cells means no such
//!                   region exists and the door does not hold k.
//!   Component bound: once per digit, the cells that allow k split into
//!                   orthogonally connected components; a k-region lies inside
//!                   one of them, so every cell of a component under k cells
//!                   loses k. This is the only rule that reaches a SILENT
//!                   REGION -- a region with no placed cell in it -- because
//!                   every other rule starts from an island.
//!
//! Scope, and why it is not the whole board. #308's rung 2 asks for the growth
//! test at FULL scope: the merge rules per (open cell, candidate digit) pair,
//! every open cell. That was built and timed first, and the clock refused it --
//! against rung 1 it ran 1.0x to 4.9x on the frozen fixtures, worst on the
//! digits-1-12 boards. #308's named fallback is this: frontier-only scope (the
//! doors) plus the per-digit component bound. It keeps the silent-region win,
//! since the component bound needs no placed cell, and it costs one flood per
//! digit instead of one bounded walk per (cell, digit) pair. The measured rows
//! are in this example's README.
//!
//! Merge force -- "a walk of exactly k cells IS the region, so every open cell
//! it covers holds k" -- is NOT here. The transfer doc's §6 box states it, but
//! it is unsound whenever the walk starts at an open cell: the walk's budget
//! k - |M| already assumes the cell holds k, so the conclusion is conditional
//! on the very thing under test. The smallest counterexample is k = 1, where M
//! is the cell alone, the walk covers exactly one cell, and the rule would
//! place a 1 in every open cell that still allows one. Rung 1's force is the
//! sound reading of the same shape: its walk starts from a PLACED island, so
//! the region is known to exist.
//!
//! validate: one flood over a full grid; every same-digit component's cell
//! count must equal its digit.
//!
//! Rule statements and soundness arguments: docs/research/
//! fillomino-isofill-transfer.md, sections 0-3, 6 and 9.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
  instance.side = Math.round(Math.sqrt(cells.length))
  // Neighbour lists once, not per visit: update runs on every search node.
  instance.nbrs = cells.map((_, i) => neighbours(i, instance.side))
  // Per-call scratch, reused so a call allocates almost nothing. `islandId`
  // is the scan's cell -> island id row; `mask` is the stamped walk mask,
  // shared by every walk and flood and never cleared -- the stamp does that.
  instance.islandId = new Int16Array(cells.length)
  instance.mask = new Int32Array(cells.length)
  instance.stamp = 0
  instance.queue = new Int16Array(cells.length)
  instance.members = new Int16Array(cells.length)
  instance.merge = new Int16Array(cells.length)
  instance.frontier = [new Int16Array(cells.length), new Int16Array(cells.length)]
  // The digits other than k, per k, for the force yield. Built on first use:
  // the digit range only reads right at update time.
  instance.others = null
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

// One grid scan: flood every placed cell into its island. Returns the island
// list, each entry the digit, one seed cell and the cell count;
// `instance.islandId[i]` is the island of cell i, or -1 where the cell is open.
function scan (instance, puzzle) {
  const { cells, nbrs, islandId, queue } = instance
  islandId.fill(-1)
  const islands = []
  for (let i = 0; i < cells.length; i++) {
    if (islandId[i] !== -1 || !puzzle.hasValue(cells[i])) continue
    const digit = puzzle.getValue(cells[i])
    const id = islands.length
    islandId[i] = id
    queue[0] = i
    let head = 0
    let len = 1
    while (head < len) {
      for (const nb of nbrs[queue[head++]]) {
        if (islandId[nb] === -1 && puzzle.hasValue(cells[nb]) && puzzle.getValue(cells[nb]) === digit) {
          islandId[nb] = id
          queue[len++] = nb
        }
      }
    }
    islands.push({ digit, seed: i, size: len })
  }
  return islands
}

// Flood from `seed` through the cells that hold `digit`, writing the cells
// into `out` and returning how many. `seed` itself always joins, open or not.
// The flood stops once it holds more than `limit` cells: no rule reads a
// placed set wider than its digit, and stopping keeps the buffer small.
function placedFlood (instance, puzzle, seed, digit, limit, out) {
  const { cells, nbrs, mask } = instance
  const stamp = ++instance.stamp
  mask[seed] = stamp
  out[0] = seed
  let head = 0
  let len = 1
  while (head < len && len <= limit) {
    for (const nb of nbrs[out[head++]]) {
      if (mask[nb] === stamp) continue
      if (puzzle.hasValue(cells[nb]) && puzzle.getValue(cells[nb]) === digit) {
        mask[nb] = stamp
        out[len++] = nb
      }
    }
  }
  return len
}

// A free closure: from `layer[from..len)`, sweep at no cost through the cells
// that already hold `digit`, appending them to the same layer. The loop
// re-reads what it appends, so a whole further island joins in one pass.
// Returns the new length.
function freeClosure (instance, puzzle, layer, from, len, digit, stamp) {
  const { cells, nbrs, mask } = instance
  for (let j = from; j < len; j++) {
    for (const nb of nbrs[layer[j]]) {
      if (mask[nb] === stamp) continue
      if (puzzle.hasValue(cells[nb]) && puzzle.getValue(cells[nb]) === digit) {
        mask[nb] = stamp
        layer[len++] = nb
      }
    }
  }
  return len
}

// The walk (§0, §3): a 0-1 breadth-first search out of one island. A cell
// already holding the digit costs nothing to enter, an open cell that still
// allows it costs one step, and `budget` is the k - p open cells the region
// can still take. Every cell of the region lies inside the walk, so the walk
// is a superset of the region -- the direction every rule below needs. Marks
// visited cells with `instance.mask[i] === stamp` and returns `{ size, stamp }`.
// It stops once the walk holds more than `digit` cells: no rung-1 rule reads
// a walk past that.
function walk (instance, puzzle, members, count, digit, budget) {
  const { cells, nbrs, mask } = instance
  const stamp = ++instance.stamp
  let [frontier, next] = instance.frontier
  let len = 0
  for (let i = 0; i < count; i++) { mask[members[i]] = stamp; frontier[len++] = members[i] }
  let size = len

  for (let step = 0; step < budget && len && size <= digit; step++) {
    let nextLen = 0
    // one paid step: into the open cells that still allow the digit
    for (let f = 0; f < len; f++) {
      for (const nb of nbrs[frontier[f]]) {
        if (mask[nb] === stamp) continue
        if (!puzzle.hasValue(cells[nb]) && puzzle.getCandidates(cells[nb]).has(digit)) {
          mask[nb] = stamp
          next[nextLen++] = nb
        }
      }
    }
    nextLen = freeClosure(instance, puzzle, next, 0, nextLen, digit, stamp)
    size += nextLen
    const swap = frontier
    frontier = next
    next = swap
    len = nextLen
  }
  return { size, stamp }
}

function * update (instance, puzzle) {
  const { cells, nbrs, mask, members, merge } = instance

  // `update` yields as it goes, so by the time a later island is reached an
  // earlier deduction may have placed a digit right beside it. Every rule
  // below therefore reads the island's live extent, re-flooded from the
  // scan's seed cell, rather than the extent the scan recorded. A placed cell
  // never re-opens, so the seed is still placed and still holds the digit.
  for (const { digit, seed } of scan(instance, puzzle)) {
    const count = placedFlood(instance, puzzle, seed, digit, digit, members)

    // Overflow (§1): every cell of the island is in one region of k cells, so
    // an island wider than k cannot be. Kill the branch the way the solver
    // reads it -- empty a placed cell.
    if (count > digit) {
      yield puzzle.removeCandidateFromCell(digit, cells[seed])
      return
    }

    // Seal (§1): a full island is a finished region, so nothing beside it may
    // hold the digit -- that cell would join the region and make it k + 1.
    if (count === digit) {
      for (let i = 0; i < count; i++) {
        for (const nb of nbrs[members[i]]) {
          if (!puzzle.hasValue(cells[nb]) && puzzle.getCandidates(cells[nb]).has(digit)) {
            yield puzzle.removeCandidateFromCell(digit, cells[nb])
          }
        }
      }
      continue
    }

    // The walk out of an unfinished island, budget k - p.
    const { size, stamp } = walk(instance, puzzle, members, count, digit, digit - count)

    // Starve (§3, reading b): the region sits inside the walk and holds k
    // cells, so a walk under k cells is a dead branch.
    if (size < digit) {
      yield puzzle.removeCandidateFromCell(digit, cells[seed])
      return
    }

    // Force (§2): the region is inside the walk and both hold k cells, so the
    // two sets are equal -- every open cell of the walk holds k.
    if (size === digit) {
      const others = otherDigits(instance, digit)
      for (let i = 0; i < cells.length; i++) {
        if (mask[i] === stamp && !puzzle.hasValue(cells[i])) {
          yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), cells[i])
        }
      }
      continue
    }

    // The doors: the open cells beside the island that still allow k. The
    // island is short of its region, so the region grows through a door.
    const doors = []
    for (let i = 0; i < count; i++) {
      for (const nb of nbrs[members[i]]) {
        if (!puzzle.hasValue(cells[nb]) && puzzle.getCandidates(cells[nb]).has(digit) && !doors.includes(nb)) {
          doors.push(nb)
        }
      }
    }

    // The growth test at a door (§6). The merged set M is the door plus every
    // island of k it touches: if the door held k, Lemma A puts them all in one
    // region.
    for (const x of doors) {
      const m = placedFlood(instance, puzzle, x, digit, digit, merge)

      // Merge overflow (§3, §6): M alone is already wider than the region it
      // would be, so the door cannot hold k.
      if (m > digit) {
        yield puzzle.removeCandidateFromCell(digit, cells[x])
        continue
      }

      // Merge starve (§6): the region would be a connected k-cell set holding
      // M and lying inside the cells that allow k, so the 0-1 walk out of M
      // with budget k - |M| covers it. A walk under k cells means no such
      // region exists, so the door does not hold k.
      if (walk(instance, puzzle, merge, m, digit, digit - m).size < digit) {
        yield puzzle.removeCandidateFromCell(digit, cells[x])
      }
    }

    // One door (§3): the region must take a cell beside the island, and only
    // one is left that can be it.
    const live = doors.filter(x => !puzzle.hasValue(cells[x]) && puzzle.getCandidates(cells[x]).has(digit))
    if (live.length === 1) {
      yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(otherDigits(instance, digit)), cells[live[0]])
    }
  }

  // The component bound (§6(i)), once per digit. Let A(k) be the cells that
  // allow k -- open cells with k among their candidates, plus cells already
  // holding k. Every k-region is connected and lies inside A(k), so it lies
  // inside one orthogonally connected component of A(k), and a component of
  // fewer than k cells cannot hold one. This is the only rule that reaches a
  // SILENT REGION, a region with no placed cell in it: every rule above starts
  // from an island.
  for (let digit = helpers.digits.minDigit; digit <= helpers.digits.maxDigit; digit++) {
    const stamp = ++instance.stamp
    for (let seed = 0; seed < cells.length; seed++) {
      if (mask[seed] === stamp || !allows(puzzle, cells[seed], digit)) continue
      // one whole component of A(k). It is walked to the end even once it is
      // wide enough: stopping early would leave its far cells unstamped, and
      // the next seed would read one of them as a component of its own.
      mask[seed] = stamp
      members[0] = seed
      let head = 0
      let len = 1
      while (head < len) {
        for (const nb of nbrs[members[head++]]) {
          if (mask[nb] !== stamp && allows(puzzle, cells[nb], digit)) {
            mask[nb] = stamp
            members[len++] = nb
          }
        }
      }
      if (len >= digit) continue
      for (let i = 0; i < len; i++) {
        // A short component holding a placed k is a dead branch, not a prune:
        // that island can never reach k cells. Emptying the placed cell is how
        // the solver reads it.
        yield puzzle.removeCandidateFromCell(digit, cells[members[i]])
      }
    }
  }
}

// A cell allows `digit` when it already holds it, or is open and still lists
// it -- the set A(k) of the component bound (§6).
function allows (puzzle, cell, digit) {
  // getCandidatesBitMask, not getCandidates: the latter allocates a fresh
  // DigitSet per call, and the bound runs this once per (cell, digit) pair.
  return puzzle.hasValue(cell) ? puzzle.getValue(cell) === digit : (puzzle.getCandidatesBitMask(cell) & (1 << digit)) !== 0
}

// The digits other than `digit`, cached per digit. The digit range only reads
// right at update time, so the cache is built on first use.
function otherDigits (instance, digit) {
  if (instance.others === null) instance.others = []
  let out = instance.others[digit]
  if (out === undefined) {
    out = []
    for (let d = helpers.digits.minDigit; d <= helpers.digits.maxDigit; d++) {
      if (d !== digit) out.push(d)
    }
    instance.others[digit] = out
  }
  return out
}

// The leaf check (§9): on a full grid, flood every maximal connected
// same-digit component; the rule holds exactly when each component's cell
// count equals its digit. The separation rule needs no check of its own --
// two regions of size k touching would be one component of at least 2k cells,
// whose count is not k, so this rejects them already.
function validate (instance, puzzle) {
  const { cells } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  return scan(instance, puzzle).every(({ digit, size }) => size === digit)
}
