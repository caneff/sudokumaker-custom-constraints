/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Fillomino. Divide the grid into orthogonally connected regions; every cell
//! of a region of k cells holds the digit k; two regions of the same size may
//! not touch orthogonally. No houses. Digits run 1..D, so no region is wider
//! than D cells.
//!
//! An ISLAND is a maximal connected set of placed cells of one digit. Two
//! adjacent cells holding k lie in one region, so an island of digit k with p
//! cells sits wholly inside one region, and that region needs k - p more
//! cells.
//!
//! Scope: the merge rules run only at the doors, not at every (open cell,
//! digit) pair. Full scope was built and timed first and ran 1.0x to 4.9x
//! slower than the per-island rules alone. The per-digit component bound keeps
//! the silent-region win, since it needs no placed cell.
//!
//! Merge force -- a walk out of M of exactly k cells forcing every open cell
//! it covers to k -- is NOT here and must not be added. The walk starts at an
//! open cell, and its budget k - |M| already assumes that cell holds k, so the
//! conclusion assumes what it tests: at k = 1 it would place a 1 in every open
//! cell that still allows one. The per-island force is sound because its walk
//! starts from a placed island.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
  instance.side = Math.round(Math.sqrt(cells.length))
  instance.nbrs = cells.map((_, i) => neighbours(i, instance.side))
  // `mask` is one stamped visit mask shared by the scan, every walk and flood,
  // and the door dedupe, which relies on doorRules running last and scan being
  // eager. It is never cleared: a new stamp does that.
  instance.mask = newStampMarks(Int32Array, cells.length)
  instance.stamp = 0
  instance.queue = new Int16Array(cells.length)
  instance.members = new Int16Array(cells.length)
  instance.merge = new Int16Array(cells.length)
  instance.frontier = [new Int16Array(cells.length), new Int16Array(cells.length)]
  // -1 is no code any cell can carry, so the first call reads every cell as
  // changed.
  instance.code = new Int32Array(cells.length)
  instance.prev = new Int32Array(cells.length).fill(-1)
  instance.seeds = new Int16Array(cells.length)
  instance.distStarve = new Int16Array(cells.length)
  instance.domOrder = new Int16Array(cells.length)
  instance.idom = new Int16Array(cells.length)
  instance.ddep = new Int16Array(cells.length)
  instance.domCount = new Int16Array(cells.length)
  instance.skip = new Uint8Array(cells.length)
  instance.others = null
}

// #include ../_shared/dominator.js

// #include ../_shared/stamp.js

function nextStamp (instance) {
  return (instance.stamp = bumpStamp(instance.mask, instance.stamp))
}

function scan (instance, puzzle) {
  const { cells, nbrs, mask, queue } = instance
  const stamp = nextStamp(instance)
  const islands = []
  for (let i = 0; i < cells.length; i++) {
    if (mask[i] === stamp || !puzzle.hasValue(cells[i])) continue
    const digit = puzzle.getValue(cells[i])
    mask[i] = stamp
    queue[0] = i
    let head = 0
    let len = 1
    while (head < len) {
      for (const nb of nbrs[queue[head++]]) {
        if (mask[nb] !== stamp && puzzle.hasValue(cells[nb]) && puzzle.getValue(cells[nb]) === digit) {
          mask[nb] = stamp
          queue[len++] = nb
        }
      }
    }
    islands.push({ digit, seed: i, size: len })
  }
  return islands
}

// `seed` always joins, open or not: a door floods as if it held `digit`.
function placedFlood (instance, puzzle, seed, digit, limit, out) {
  const { cells, nbrs, mask } = instance
  const stamp = nextStamp(instance)
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

// The walk: a 0-1 breadth-first search out of one island. A cell already
// holding the digit costs nothing to enter, an open cell that still allows it
// costs one step, and `budget` is the k - p open cells the region can still
// take. Every cell of the region lies inside the walk, so the walk is a
// superset of the region -- the direction every rule below needs. It stops
// once past `digit` cells; no rule reads a walk wider than that.
function walk (instance, puzzle, members, count, digit, budget, exclude = -1) {
  const { cells, nbrs, mask } = instance
  const stamp = nextStamp(instance)
  const bit = 1 << digit
  let [frontier, next] = instance.frontier
  let len = 0
  for (let i = 0; i < count; i++) { mask[members[i]] = stamp; frontier[len++] = members[i] }
  let size = len

  for (let step = 0; step < budget && len && size <= digit; step++) {
    let nextLen = 0
    for (let f = 0; f < len; f++) {
      for (const nb of nbrs[frontier[f]]) {
        if (mask[nb] === stamp || nb === exclude) continue
        if (!puzzle.hasValue(cells[nb]) && (puzzle.getCandidatesBitMask(cells[nb]) & bit) !== 0) {
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

function cellAllows (puzzle, cell, digit, bit) {
  return puzzle.hasValue(cell) ? puzzle.getValue(cell) === digit : (puzzle.getCandidatesBitMask(cell) & bit) !== 0
}

function domTree (instance, puzzle, starts, nStarts, maxDist, digit, dist) {
  const { cells, nbrs, domOrder } = instance
  const bit = 1 << digit
  dist.fill(-1)
  let len = 0
  for (let i = 0; i < nStarts; i++) {
    const s = starts[i]
    if (dist[s] < 0) { dist[s] = 0; domOrder[len++] = s }
  }
  for (let head = 0; head < len; head++) {
    const u = domOrder[head]
    if (dist[u] >= maxDist) continue
    for (const n of nbrs[u]) if (dist[n] < 0 && cellAllows(puzzle, cells[n], digit, bit)) { dist[n] = dist[u] + 1; domOrder[len++] = n }
  }
  domFold(instance, len, dist)
  return len
}

// The cut filter: answer cut starve for every open cell of the walk at once,
// so the cells it clears need no walk of their own.
//
// Cut starve asks, of each open cell y in the walk, whether dropping y leaves
// the walk under `digit` cells. One BFS plus its dominator tree bounds that
// for every y together: a cell z stays reachable at its own distance without
// y whenever y does not dominate z, so the walk without y keeps at least
// (cells reached) - (cells y dominates).
//
// The BFS is UNIT-step, not the walk's 0-1 -- a dominator tree needs layers a
// step apart. The unit walk is a subset of the 0-1 walk, so its count is a
// lower bound: the filter only ever CLEARS a cell, and every cell it does not
// clear falls through to the exact re-walk.
//
// Writes the verdict into `instance.skip`, 1 where cut is proved false.
function cutFilter (instance, puzzle, starts, nStarts, open, digit, budget) {
  const { distStarve } = instance
  const reached = domTree(instance, puzzle, starts, nStarts, budget, digit, distStarve)
  starveVerdict(instance, reached, distStarve, open, digit)
}

const DEAD = 0
const SETTLED = 1
const OPEN = 2

// Each rule guards its own precondition and never relies on another having
// run: the soundness harness removes rules one at a time.
function * update (instance, puzzle) {
  for (const island of scan(instance, puzzle)) {
    const verdict = yield * islandRule(instance, puzzle, island)
    if (verdict === DEAD) return
    if (verdict === SETTLED) continue
    if ((yield * cutStarveRule(instance, puzzle, island)) === SETTLED) continue
    yield * doorRules(instance, puzzle, island)
  }
  yield * componentBound(instance, puzzle)
}

// `update` yields as it goes, so by the time a later island is reached an
// earlier deduction may have placed a digit right beside it. Every rule
// therefore reads the island's live extent, re-flooded from the scan's seed
// cell, rather than the extent the scan recorded. A placed cell never
// re-opens, so the seed still holds the digit. The walk's cells are read off
// `instance.mask`, which any later walk or flood restamps, so a reader asks
// `walkCells` rather than trusting the stamp.
function islandFacts (instance, puzzle, island) {
  const { digit, seed } = island
  if (island.count === undefined) {
    island.count = placedFlood(instance, puzzle, seed, digit, digit, instance.members)
  }
  if (island.reach === undefined && island.count < digit) walkCells(instance, puzzle, island)
  return island
}

function walkCells (instance, puzzle, island) {
  if (island.walkStamp !== instance.stamp) {
    const { size, stamp } = walk(instance, puzzle, instance.members, island.count, island.digit, island.digit - island.count)
    island.reach = size
    island.walkStamp = stamp
  }
  return island.walkStamp
}

function * islandRule (instance, puzzle, island) {
  const { cells, nbrs, mask, members } = instance
  const { digit, seed, count } = islandFacts(instance, puzzle, island)

  // Overflow: an island wider than k cannot sit in one region of k cells.
  // Kill the branch the way the solver reads it -- empty a placed cell.
  if (count > digit) {
    yield puzzle.removeCandidateFromCell(digit, cells[seed])
    return DEAD
  }

  // Seal: a full island is a finished region, so nothing beside it may hold
  // the digit -- that cell would join the region and make it k + 1.
  if (count === digit) {
    const bit = 1 << digit
    for (let i = 0; i < count; i++) {
      for (const nb of nbrs[members[i]]) {
        if (!puzzle.hasValue(cells[nb]) && (puzzle.getCandidatesBitMask(cells[nb]) & bit) !== 0) {
          yield puzzle.removeCandidateFromCell(digit, cells[nb])
        }
      }
    }
    return SETTLED
  }

  // Starve: the region sits inside the walk and holds k cells, so a walk
  // under k cells is a dead branch.
  if (island.reach < digit) {
    yield puzzle.removeCandidateFromCell(digit, cells[seed])
    return DEAD
  }

  // Force: the region is inside the walk and both hold k cells, so the two
  // sets are equal -- every open cell of the walk holds k.
  if (island.reach === digit) {
    const stamp = walkCells(instance, puzzle, island)
    const others = otherMask(instance, digit)
    for (let i = 0; i < cells.length; i++) {
      if (mask[i] === stamp && !puzzle.hasValue(cells[i])) {
        yield puzzle.removeCandidatesFromCell(others, cells[i])
      }
    }
    return SETTLED
  }
  return OPEN
}

// Cut starve. The region R sits inside the walk and holds k cells. Take an
// open cell y of the walk and run the walk again without it: if that covers
// fewer than k cells then R cannot avoid y, so y is in R and holds k.
// ISOFILL's strand half does not carry over: two islands of one digit need
// not share a region.
//
// Every test below reads ONE snapshot -- this island's extent, this walk, the
// live candidates -- so the cuts are collected and yielded together at the
// end. Yielding inside the loop would place a k beside the island and leave
// every later test, and the door rules, reading an island a deduction out of
// date.
function * cutStarveRule (instance, puzzle, island) {
  const { cells, mask, members, skip } = instance
  const { digit, count } = islandFacts(instance, puzzle, island)
  if (count >= digit || island.reach <= digit) return OPEN
  const stamp = walkCells(instance, puzzle, island)
  const openWalk = []
  for (let i = 0; i < cells.length; i++) {
    if (mask[i] === stamp && !puzzle.hasValue(cells[i])) openWalk.push(i)
  }
  cutFilter(instance, puzzle, members, count, openWalk, digit, digit - count)
  const cuts = []
  for (const y of openWalk) {
    if (skip[y]) continue
    if (walk(instance, puzzle, members, count, digit, digit - count, y).size < digit) cuts.push(y)
  }
  if (cuts.length === 0) return OPEN
  const others = otherMask(instance, digit)
  for (const y of cuts) {
    yield puzzle.removeCandidatesFromCell(others, cells[y])
  }
  // the island just grew; the door rules want a live one, and the next call
  // re-scans for it
  return SETTLED
}

// The doors: the open cells beside the island that still allow k. The island
// is short of its region, so the region grows through a door.
function * doorRules (instance, puzzle, island) {
  const { cells, nbrs, mask, members, merge } = instance
  const { digit, count } = islandFacts(instance, puzzle, island)
  if (count >= digit || island.reach <= digit) return OPEN
  const bit = 1 << digit
  const doors = []
  const doorStamp = nextStamp(instance)
  for (let i = 0; i < count; i++) {
    for (const nb of nbrs[members[i]]) {
      if (mask[nb] !== doorStamp && !puzzle.hasValue(cells[nb]) && (puzzle.getCandidatesBitMask(cells[nb]) & bit) !== 0) {
        mask[nb] = doorStamp
        doors.push(nb)
      }
    }
  }

  // At a door, M is the door plus every island of k it touches: if the door
  // held k, they would all be one region.
  for (const x of doors) {
    const m = placedFlood(instance, puzzle, x, digit, digit, merge)

    // Merge overflow: M alone is already wider than the region it would be, so
    // the door cannot hold k.
    if (m > digit) {
      yield puzzle.removeCandidateFromCell(digit, cells[x])
      continue
    }

    // Merge starve: the region would be a connected k-cell set holding M and
    // lying inside the cells that allow k, so the 0-1 walk out of M with budget
    // k - |M| covers it. A walk under k cells means no such region exists, so
    // the door does not hold k.
    if (walk(instance, puzzle, merge, m, digit, digit - m).size < digit) {
      yield puzzle.removeCandidateFromCell(digit, cells[x])
    }
  }

  // One door: the region must take a cell beside the island, and only one is
  // left that can be it.
  const live = doors.filter(x => !puzzle.hasValue(cells[x]) && (puzzle.getCandidatesBitMask(cells[x]) & bit) !== 0)
  if (live.length === 1) {
    yield puzzle.removeCandidatesFromCell(otherMask(instance, digit), cells[live[0]])
  }
  return OPEN
}

function * componentBound (instance, puzzle) {
  // The component bound, once per digit. Let A(k) be the cells that allow k --
  // open cells with k among their candidates, plus cells already holding k.
  // Every k-region is connected and lies inside A(k), so it lies inside one
  // orthogonally connected component of A(k), and a component of fewer than
  // k cells cannot hold one. This is the only rule that reaches a SILENT
  // REGION, a region with no placed cell in it: every rule above starts from
  // an island.
  //
  // Only dirty components re-flood. `code[i]` is cell i's allowed-digit
  // bitmask, diffed against `prev`, the row the last completed pass finished
  // on. A component whose cells and bordering cells all read the same code as
  // last time IS last time's component and its verdict stands, so only the
  // changed cells and their neighbours seed a flood.
  //
  // The diff, not a dirty flag, is what makes this safe under BACKTRACKING.
  // The solver gives no backtrack signal, so a flag set on our own prunes
  // would go stale the moment the search restores a candidate; comparing this
  // pass's codes against the last pass's cannot. `prev` is written only after
  // the last yield, so a pass the solver abandons half-way leaves the older
  // snapshot in place and the next pass reads a superset of what moved.
  const { cells, nbrs, mask, members, code, prev, seeds } = instance
  const seedStamp = nextStamp(instance)
  let nSeeds = 0
  for (let i = 0; i < cells.length; i++) {
    const c = puzzle.hasValue(cells[i]) ? 1 << puzzle.getValue(cells[i]) : puzzle.getCandidatesBitMask(cells[i])
    code[i] = c
    if (c === prev[i]) continue
    // a changed cell can only merge or split the components of its own closed
    // neighbourhood, so those are the cells that have to seed again
    if (mask[i] !== seedStamp) { mask[i] = seedStamp; seeds[nSeeds++] = i }
    for (const nb of nbrs[i]) {
      if (mask[nb] !== seedStamp) { mask[nb] = seedStamp; seeds[nSeeds++] = nb }
    }
  }
  if (nSeeds === 0) return

  for (let digit = helpers.digits.minDigit; digit <= helpers.digits.maxDigit; digit++) {
    const bit = 1 << digit
    const stamp = nextStamp(instance)
    for (let s = 0; s < nSeeds; s++) {
      const seed = seeds[s]
      if (mask[seed] === stamp || (code[seed] & bit) === 0) continue
      // one whole component of A(k). It is walked to the end even once it is
      // wide enough: stopping early would leave its far cells unstamped, and
      // the next seed would read one of them as a component of its own.
      mask[seed] = stamp
      members[0] = seed
      let head = 0
      let len = 1
      while (head < len) {
        for (const nb of nbrs[members[head++]]) {
          if (mask[nb] !== stamp && (code[nb] & bit) !== 0) {
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
        code[members[i]] &= ~bit
        yield puzzle.removeCandidateFromCell(digit, cells[members[i]])
      }
    }
  }
  prev.set(code)
}

// The digit range only reads right at update time, so the cache is built on
// first use.
function otherMask (instance, digit) {
  if (instance.others === null) instance.others = []
  let out = instance.others[digit]
  if (out === undefined) {
    out = 0
    for (let d = helpers.digits.minDigit; d <= helpers.digits.maxDigit; d++) {
      if (d !== digit) out |= 1 << d
    }
    instance.others[digit] = out
  }
  return out
}

// The separation rule needs no check of its own: two regions of size k
// touching would be one component of at least 2k cells, whose count is not k.
function validate (instance, puzzle) {
  const { cells } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  return scan(instance, puzzle).every(({ digit, size }) => size === digit)
}
