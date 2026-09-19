/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! ISOFILL. Divide the grid into N regions of N orthogonally connected cells;
//! every cell in a region holds the same digit; all N digits appear. So each
//! digit fills exactly N cells. N is the digit count, which must equal the
//! board side: a 10x10 with digits 0-9, or a 9x9 with digits 1-9.
//!
//! One whole-grid component, five deductions per digit and two across digits:
//!   Cap:   a digit already in N cells leaves every other cell.
//!   Force: a digit with exactly N cells still open takes all of them.
//!   Seed walk: a 0-1 BFS from the digit's lowest-index placed cell. A cell
//!          already holding the digit costs nothing to enter, an open cell
//!          that still allows it costs one step, and the budget is the open
//!          cells the region has left, (N - placed). Cells outside the walk
//!          lose the digit. A placed cell the walk never meets, or a walk
//!          under N cells, is a dead branch: a placed cell is emptied so
//!          the solver sees it.
//!   Cut:   an open cell in that walk whose removal starves it below N,
//!          or strands a placed cell, must hold the digit. Two dominator
//!          passes clear most open cells before the per-cell walks that
//!          answer this exactly (see cutFilter).
//!   Silent: a digit with no placed cell has no walk to start. Its region
//!          still sits inside one connected component of the cells that allow
//!          it, so every component under N cells loses the digit; if none
//!          reaches N the branch is dead.
//!   Perimeter: two disjoint connected regions cannot interleave round the
//!          border, so four border cells never read a,b,a,b in cyclic order.
//!          A digit whose placed border cells fall in two arcs separated by
//!          one other digit both ways is that interleave: a dead branch. An
//!          open border cell flanked by digit a both ways loses every digit
//!          placed elsewhere on the border. The flank pass is one lap of the
//!          border; the split-arc pass is one lap per digit holding two or
//!          more border cells, over the compacted list of placed cells.
//!   Budget: every open cell needs a digit, and each digit can take at most
//!          (N - placed) more cells, only inside its walk. If no assignment
//!          covers every open cell (max flow falls short) the branch is dead.
//!          Then the matching prune: a (cell, digit) pair that no perfect
//!          matching uses loses that candidate (Régin). This rule weighs
//!          every digit at once: a wrong region for one digit starves the
//!          others' budgets.
//! validate is the exact leaf check: each digit one connected island of N.

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  instance.cells = cells
  instance.side = Math.round(Math.sqrt(cells.length))
  // Neighbour lists once, not per visit: update runs on every search node and
  // the cut rule walks the grid hundreds of times per call.
  instance.nbrs = cells.map((_, i) => neighbours(i, instance.side))
  instance.mask = new Uint32Array(cells.length) // stamped visit mask, see seedWalk
  instance.targets = new Uint32Array(cells.length)
  instance.stamp = 0
  instance.targetStamp = 0
  instance.holds = new Uint8Array(cells.length) // validate's per-digit mask
  instance.budget = null // sized on first update, once the digit range is known
  // Per-call scratch, reused so update allocates almost nothing (GC was 12%
  // of a call): one allowed and one walk mask per digit, BFS frontiers,
  // distance rows for the tour bound, and the "every other digit" masks.
  instance.allowed = []
  instance.near = []
  instance.frontier = [new Int16Array(cells.length), new Int16Array(cells.length)]
  instance.dist = []
  instance.others = []
  instance.allMask = 0
  // Cut filter scratch: the two shortest-path DAGs cut's tests walk (one from
  // all placed cells, one from the seed), their dominator trees, the subtree
  // counts read off them, and the per-cell verdict. See cutFilter.
  instance.distStarve = new Int16Array(cells.length)
  instance.distStrand = new Int16Array(cells.length)
  instance.domOrder = new Int16Array(cells.length)
  instance.idom = new Int16Array(cells.length)
  instance.ddep = new Int16Array(cells.length)
  instance.domCount = new Int16Array(cells.length)
  instance.skip = new Uint8Array(cells.length)
  // The border cells in cyclic order, and the scratch the perimeter rule walks
  // them with: the placed positions and their digits. Its arc-id row is sized
  // from the digit range, which only update reads.
  instance.border = perimeter(instance.side)
  instance.value = new Int8Array(cells.length)
  instance.at = new Int16Array(instance.border.length)
  instance.dig = new Int8Array(instance.border.length)
}

// The border cells of a `side` x `side` grid, in cyclic order clockwise from
// the top-left corner.
function perimeter (side) {
  const out = []
  for (let x = 0; x < side; x++) out.push(x)
  for (let y = 1; y < side; y++) out.push(y * side + side - 1)
  for (let x = side - 2; x >= 0; x--) out.push((side - 1) * side + x)
  for (let y = side - 2; y >= 1; y--) out.push(y * side)
  return out
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

// The next visit stamp. `mask` and `targets` are Uint32Array, so a counter
// that reached 2^32 would store 0 and every cell would read as unvisited; clear
// the array and start over one step before that.
function nextStamp (instance) {
  if (instance.stamp >= 0xFFFFFFFF) { instance.mask.fill(0); instance.stamp = 0 }
  return ++instance.stamp
}

// The same wrap guard for the target stamp `reachesAll` reads: a stale one
// would read as "no targets" and report a cut that is not there.
function nextTargetStamp (instance) {
  if (instance.targetStamp >= 0xFFFFFFFF) { instance.targets.fill(0); instance.targetStamp = 0 }
  return ++instance.targetStamp
}

// How far a walk from `starts` spreads: the cells reachable in at most `depth`
// steps through `allowed`, stopping once it holds `limit` cells. Returns
// { size, stamp }: `instance.mask[i] === stamp` marks a visited cell until the
// next walk. Mask and stamp live on `instance` so a walk allocates nothing --
// this is the hot loop of every search node.
function reachSize (instance, starts, depth, allowed, limit = Infinity) {
  const { nbrs, mask } = instance
  const stamp = nextStamp(instance)
  let size = 0
  let [frontier, next] = instance.frontier
  let len = 0
  for (const i of starts) {
    if (mask[i] === stamp) continue
    mask[i] = stamp; size++; frontier[len++] = i
  }
  for (let step = 0; step < depth && len && size < limit; step++) {
    let nextLen = 0
    for (let f = 0; f < len; f++) {
      for (const n of nbrs[frontier[f]]) {
        if (allowed[n] && mask[n] !== stamp) {
          mask[n] = stamp; size++; next[nextLen++] = n
          if (size >= limit) return { size, stamp }
        }
      }
    }
    [frontier, next, len] = [next, frontier, nextLen]
  }
  return { size, stamp }
}

// Does a walk from `start`, at most `depth` steps through `allowed`, reach all
// `want` cells of the stamped target set `instance.targets`? Stops the moment
// it has seen them all.
function reachesAll (instance, start, depth, allowed, want) {
  const { nbrs, mask, targets, targetStamp } = instance
  const stamp = nextStamp(instance)
  let [frontier, next] = instance.frontier
  mask[start] = stamp
  frontier[0] = start
  let len = 1
  if (targets[start] === targetStamp && --want <= 0) return true
  for (let step = 0; step < depth && len; step++) {
    let nextLen = 0
    for (let f = 0; f < len; f++) {
      for (const n of nbrs[frontier[f]]) {
        if (allowed[n] && mask[n] !== stamp) {
          mask[n] = stamp; next[nextLen++] = n
          if (targets[n] === targetStamp && --want === 0) return true
        }
      }
    }
    [frontier, next, len] = [next, frontier, nextLen]
  }
  return false
}

// The seed walk: a 0-1 BFS from `start`, one placed cell of digit `d`. A cell
// already holding `d` costs nothing to enter, an open cell that allows `d`
// costs one step, and `budget` is how many open cells the region has left.
// Every cell of the region is inside the walk: the region is connected and
// holds `start`, so a path inside it from `start` to any region cell crosses
// at most `budget` open cells. Returns { size, stamp }, with
// `instance.mask[i] === stamp` marking a visited cell until the next walk.
// Buffers live on `instance`, so a walk allocates nothing.
function seedWalk (instance, start, budget, allowed, value, d) {
  const { nbrs, mask } = instance
  const stamp = nextStamp(instance)
  let size = 1
  let [frontier, next] = instance.frontier
  let len = 1
  mask[start] = stamp
  frontier[0] = start
  for (let step = 0; len; step++) {
    // Free closure: placed cells of this digit cost nothing, so they join the
    // current step. The loop reads cells it appends, which is the point.
    for (let f = 0; f < len; f++) {
      for (const n of nbrs[frontier[f]]) {
        if (value[n] === d && mask[n] !== stamp) { mask[n] = stamp; size++; frontier[len++] = n }
      }
    }
    if (step >= budget) break
    let nextLen = 0
    for (let f = 0; f < len; f++) {
      for (const n of nbrs[frontier[f]]) {
        if (allowed[n] && value[n] < 0 && mask[n] !== stamp) { mask[n] = stamp; size++; next[nextLen++] = n }
      }
    }
    [frontier, next, len] = [next, frontier, nextLen]
  }
  return { size, stamp }
}

// BFS distance from `start` to every cell through `allowed`; unreachable
// cells read as 999, so any bound they enter fails.
function distances (instance, start, allowed, dist) {
  const { nbrs } = instance
  dist.fill(999)
  dist[start] = 0
  let [frontier, next] = instance.frontier
  let len = 1
  frontier[0] = start
  for (let step = 1; len; step++) {
    let nextLen = 0
    for (let f = 0; f < len; f++) {
      for (const n of nbrs[frontier[f]]) if (allowed[n] && dist[n] === 999) { dist[n] = step; next[nextLen++] = n }
    }
    [frontier, next, len] = [next, frontier, nextLen]
  }
  return dist
}

// BFS from `starts` through `allowed`, no further than `maxDist` steps, and
// the dominator tree of the shortest-path DAG it builds. A cell y keeps a path
// of its own length from some start when the removed cell does not dominate y,
// which is what the cut filter reads. Fills `dist` (-1 where unreached),
// `domOrder` (the cells in BFS order), `idom` (the dominator, -1 for a cell no
// other cell dominates) and `ddep` (its depth in that tree); returns how many
// cells the walk reached.
function domTree (instance, starts, maxDist, allowed, dist) {
  const { nbrs, domOrder, idom, ddep } = instance
  dist.fill(-1)
  let len = 0
  for (const s of starts) if (dist[s] < 0) { dist[s] = 0; domOrder[len++] = s }
  for (let head = 0; head < len; head++) {
    const u = domOrder[head]
    if (dist[u] >= maxDist) continue
    for (const n of nbrs[u]) if (allowed[n] && dist[n] < 0) { dist[n] = dist[u] + 1; domOrder[len++] = n }
  }
  // A cell's dominator is the deepest cell dominating all its DAG predecessors,
  // so fold them pairwise, walking the deeper one up the tree built so far. A
  // start has no predecessor and no dominator.
  for (let k = 0; k < len; k++) {
    const v = domOrder[k]
    if (dist[v] === 0) { idom[v] = -1; ddep[v] = 1; continue }
    let a = -2
    for (const p of nbrs[v]) {
      if (!allowed[p] || dist[p] !== dist[v] - 1) continue
      if (a === -2) { a = p; continue }
      let b = p
      while (a !== b) {
        if (ddep[a] >= ddep[b]) a = idom[a]; else b = idom[b]
        if (a < 0 || b < 0) { a = -1; b = -1 }
      }
    }
    idom[v] = a
    ddep[v] = a < 0 ? 1 : ddep[a] + 1
  }
  return len
}

// Roll `domCount` up the dominator tree of the walk `domTree` just left
// behind, so each cell's entry counts itself and everything it dominates. BFS
// order puts a cell after its dominator, so one backward pass does it.
function subtreeSums (instance, len) {
  const { domCount, domOrder, idom } = instance
  for (let k = len - 1; k >= 0; k--) {
    const v = domOrder[k]
    if (idom[v] >= 0) domCount[idom[v]] += domCount[v]
  }
}

// The cut filter (#258): answer both of cut's tests for every open cell at
// once, so the cells it clears need no walk of their own.
//
// Cut asks, of each open cell x in the digit's walk, whether removing x leaves
// fewer than `size` cells within `depth` steps of the placed cells (starve) or
// puts some placed cell out of reach of the seed within `size - 1` steps
// (strand). Both are reachability questions on the same two walks, so one BFS
// each plus its dominator tree bounds them for every x together: a cell y stays
// reachable at its own distance without x whenever x does not dominate y. So
// the starve walk keeps at least (cells reached) - (cells x dominates), and no
// placed cell is stranded when x dominates none of them.
//
// The bound is a lower bound, not the test: a cell y that x dominates may still
// be reachable by a longer path inside the budget. So the filter only ever
// clears a cell, and every cell it does not clear falls through to the exact
// re-walks. Returns the per-cell verdict, 1 where cut is proved false.
function cutFilter (instance, placed, open, allowed, size, depth) {
  const { skip, domCount, domOrder, distStarve, distStrand } = instance
  // Starve: how many cells each cell dominates in the walk from all placed
  // cells. A cell outside that walk changes nothing by leaving it. This
  // verdict is read before the strand walk below overwrites the tree.
  const reached = domTree(instance, placed, depth, allowed, distStarve)
  domCount.fill(0)
  for (let k = 0; k < reached; k++) domCount[domOrder[k]] = 1
  subtreeSums(instance, reached)
  for (const x of open) skip[x] = (distStarve[x] < 0 ? reached : reached - domCount[x]) >= size ? 1 : 0
  if (placed.length < 2) return skip // one placed cell strands nothing
  // Strand: how many placed cells each cell dominates in the walk from the
  // seed. A placed cell the seed does not reach inside the budget already
  // fails the test with nothing removed, so the filter clears no cell there.
  const seen = domTree(instance, [placed[0]], size - 1, allowed, distStrand)
  domCount.fill(0)
  for (const i of placed) {
    if (distStrand[i] < 0) { skip.fill(0); return skip }
    domCount[i] = 1
  }
  subtreeSums(instance, seen)
  for (const x of open) if (domCount[x] > 0) skip[x] = 0
  return skip
}

// One scan of the grid builds every digit's state (update runs on every search
// node, so each cell is read once). Every digit then sees this snapshot, not
// the removals earlier digits yield in the same call. `state[d]` holds d's
// placed cells, its open cells, and a per-cell mask of the cells that allow it;
// `state.digits` is the digit range itself.
function scanBoard (instance, puzzle, lo, hi) {
  const { cells } = instance
  instance.allMask = 0
  for (let e = lo; e <= hi; e++) instance.allMask |= 1 << e
  const state = []
  state.digits = []
  for (let d = lo; d <= hi; d++) {
    const allowed = instance.allowed[d] || (instance.allowed[d] = new Uint8Array(cells.length))
    allowed.fill(0)
    state[d] = { placed: [], open: [], allowed }
    if (instance.others[d] === undefined) instance.others[d] = instance.allMask & ~(1 << d)
    state.digits.push(d)
  }
  const value = instance.value // cell -> its value, or -1 while open
  value.fill(-1)
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (puzzle.hasValue(c)) {
      const d = puzzle.getValue(c)
      value[i] = d
      const s = state[d] // a value outside lo..hi throws: fail loud
      s.placed.push(i)
      s.allowed[i] = 1
    } else {
      // Lowest set bit first, so digits come in ascending order.
      for (let m = puzzle.getCandidatesBitMask(c); m; m &= m - 1) {
        const d = 31 - Math.clz32(m & -m)
        state[d].open.push(i)
        state[d].allowed[i] = 1
      }
    }
  }
  return state
}

//! Seed walk: bound d's region to what one placed cell can still reach.
// The region holds every placed cell and lies inside the walk. So a placed cell
// the walk misses, or a walk under `size` cells, is a dead branch: empty a
// placed cell and the solver drops it.
function seedIsDead (instance, placed, walk, size) {
  if (walk.size < size) return true
  for (const i of placed) if (instance.mask[i] !== walk.stamp) return true
  return false
}

// Tour bound: the region is a connected set holding every placed cell and x, so
// walking round a spanning tree of it is a closed tour through them all; its
// cells number at least 1 + half the perimeter of any three of those points
// (BFS distances through `allowed`). Tighter than the depth bound when the
// placed cells are spread out. Clears the cells the bound rules out of `near`,
// and returns true when it rules out the digit itself.
function tourBoundIsDead (instance, placed, open, allowed, near, size) {
  const dist = placed.map((p, k) => distances(instance, p, allowed, instance.dist[k] || (instance.dist[k] = new Int16Array(instance.cells.length))))
  let base = 0
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      for (let k = j + 1; k < placed.length; k++) {
        base = Math.max(base, dist[i][placed[j]] + dist[i][placed[k]] + dist[j][placed[k]])
      }
    }
  }
  if (1 + Math.ceil(base / 2) > size) return true
  for (const x of open) {
    if (!near.mask[x]) continue
    let per = base
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        per = Math.max(per, dist[i][x] + dist[j][x] + dist[i][placed[j]])
      }
    }
    if (1 + Math.ceil(per / 2) > size) { near.mask[x] = 0; near.size-- }
  }
  return near.size < size
}

// Does removing open cell x break d's region? Either test: the walk starves
// below `size` cells, or a placed cell is stranded (ticket #101). Each walk
// stops as soon as it has its answer: `size` cells, or every placed cell.
function cutsRegion (instance, x, placed, allowed, near, size, depth, skip) {
  let ways = 0
  for (const n of instance.nbrs[x]) if (allowed[n]) ways++
  // A dead end: removing it removes only itself.
  if (ways <= 1) return near.size - 1 < size
  if (skip[x]) return false // the filter cleared this cell: no cut
  allowed[x] = 0
  let cut = reachSize(instance, placed, depth, allowed, size).size < size
  if (!cut && placed.length > 1) cut = !reachesAll(instance, placed[0], size - 1, allowed, placed.length)
  allowed[x] = 1
  return cut
}

//! Cut: an open cell whose removal breaks the region must hold d.
function * cutRule (instance, puzzle, state, d, size, near) {
  const { cells } = instance
  const { placed, open, allowed } = state[d]
  const others = instance.others[d]
  const depth = size - placed.length
  const targetStamp = nextTargetStamp(instance)
  for (const i of placed) instance.targets[i] = targetStamp
  const skip = cutFilter(instance, placed, open, allowed, size, depth)
  const held = []
  for (const x of open) {
    if (!near.mask[x]) continue
    if (cutsRegion(instance, x, placed, allowed, near, size, depth, skip)) held.push(cells[x])
  }
  if (held.length) yield puzzle.removeCandidatesFromCells(others, held)
}

//! Tour bound and cut filter, for a digit with a seed and room left to grow.
function * seededRule (instance, puzzle, state, d, size, walk) {
  const { cells } = instance
  const { placed, open, allowed } = state[d]
  // Own copy: later walks reuse instance.mask.
  const near = { size: walk.size, mask: instance.near[d] || (instance.near[d] = new Uint8Array(cells.length)) }
  for (let i = 0; i < cells.length; i++) near.mask[i] = instance.mask[i] === walk.stamp ? 1 : 0
  if (placed.length > 1 && tourBoundIsDead(instance, placed, open, allowed, near, size)) {
    yield puzzle.removeCandidateFromCell(d, cells[placed[0]])
    return null
  }
  const out = open.filter(i => !near.mask[i]).map(i => cells[i])
  if (out.length) yield puzzle.removeCandidateFromCells(d, out)
  yield * cutRule(instance, puzzle, state, d, size, near)
  return near.mask // budget limits this digit to its walk
}

//! Silent: d has no seed, so it needs one component of size cells or more.
// Every walk above starts from a placed cell, so a digit with none gets none.
// Its region still lies inside a single orthogonally connected component of the
// cells that allow it, so a component smaller than `size` can hold no region
// (ticket #142).
function * noSeedRule (instance, puzzle, state, d, size) {
  const { cells } = instance
  const { open, allowed } = state[d]
  const near = instance.near[d] || (instance.near[d] = new Uint8Array(cells.length))
  near.fill(0)
  const small = []
  const smallCells = []
  let big = false
  for (const start of open) {
    if (near[start]) continue
    const comp = reachSize(instance, [start], Infinity, allowed)
    for (const i of open) if (instance.mask[i] === comp.stamp) { near[i] = 1; if (comp.size < size) { small.push(i); smallCells.push(cells[i]) } }
    if (comp.size >= size) big = true
  }
  // No component fits the region: a dead branch, so empty a cell.
  if (!big) { yield puzzle.removeCandidatesFromCell(instance.allMask, cells[open[0]]); return null }
  for (const i of small) near[i] = 0
  if (smallCells.length) yield puzzle.removeCandidateFromCells(d, smallCells)
  return near // budget limits this digit to the components that fit
}

// Everything one digit's own region says, in order: the seed walk that bounds
// it, then whichever of cap, force, the seeded rules or the no-seed component
// search applies. Returns the digit's `near` bound for the budget -- a mask of
// the cells its region can still reach -- or null when no rule drew one.
function * digitRule (instance, puzzle, state, d, size) {
  const { cells } = instance
  const { placed, open, allowed } = state[d]
  let walk = null
  if (placed.length > 0) {
    walk = seedWalk(instance, placed[0], size - placed.length, allowed, instance.value, d)
    if (seedIsDead(instance, placed, walk, size)) {
      yield puzzle.removeCandidateFromCell(d, cells[placed[0]])
      return null
    }
  }
  if (placed.length === size) {
    //! Cap: d already fills all size cells, so every open cell loses it.
    if (open.length) yield puzzle.removeCandidateFromCells(d, open.map(i => cells[i]))
  } else if (placed.length + open.length === size) {
    //! Force: exactly size cells can hold d, so every open one takes d.
    if (open.length) yield puzzle.removeCandidatesFromCells(instance.others[d], open.map(i => cells[i]))
  } else if (placed.length > 0) {
    return yield * seededRule(instance, puzzle, state, d, size, walk)
  } else if (open.length > 0) {
    return yield * noSeedRule(instance, puzzle, state, d, size)
  }
  return null
}

function * update (instance, puzzle) {
  const { cells } = instance
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const size = cells.length / (hi - lo + 1) // cells per digit: 10 on a 10x10
  if (!Number.isInteger(size)) {
    // stop, not throw: a throw in update reaches only the console, and the
    // board would solve as if ISOFILL were absent.
    yield puzzle.stop(`ISOFILL: ${cells.length} cells do not split evenly among digits ${lo}-${hi}`, cells)
    return
  }
  const state = scanBoard(instance, puzzle, lo, hi)
  const near = []
  for (let d = lo; d <= hi; d++) near[d] = yield * digitRule(instance, puzzle, state, d, size)
  // Budget: every open cell needs a digit, and digit d can take at most
  // (size - placed) more cells, all inside its walk. If no assignment covers
  // every open cell the branch is dead: empty that cell.
  const b = budget(instance, state, near, lo, hi, size)
  if (b.dead >= 0) yield puzzle.removeCandidatesFromCell(instance.allMask, cells[b.dead])
  for (let d = lo; d <= hi; d++) {
    const out = []
    for (let k = 0; k < b.dropCount; k++) if (b.dropDigit[k] === d) out.push(cells[b.dropCell[k]])
    if (out.length) yield puzzle.removeCandidateFromCells(d, out)
  }
  yield * perimeterRule(instance, puzzle, lo, hi)
}

// Perimeter: two disjoint orthogonally connected regions cannot interleave
// round the border. There are no four border cells in cyclic order a, b, a, b:
// region a holds a path joining its two cells and region b one joining its
// own, and extending each path's ends to the grid edge inside their own cells
// gives two curves in the rectangle whose ends interleave on its boundary, so
// the curves cross -- and two axis-aligned centre-to-centre paths cross only at
// a cell centre, which the regions cannot share.
//
// Two deductions follow, both reading only the border cycle:
//   Split arc: a digit whose placed border cells fall in two arcs with one
//     other digit placed in each is exactly that a, b, a, b -- a dead branch,
//     so a placed cell is emptied and the solver sees it.
//   Flank: an open border cell whose nearest placed border cells in both
//     directions hold digit a loses every digit b placed elsewhere on the
//     border, since a, b, a, b is what the cycle would then read. A digit
//     placed only in the interior witnesses no such arc and is left alone.
//! Perimeter: two regions cannot interleave, so no four border cells in cyclic
//! order read a, b, a, b.
function * perimeterRule (instance, puzzle, lo, hi) {
  const { cells, border, value, at, dig } = instance
  const arcOf = instance.arcOf || (instance.arcOf = new Int8Array(hi + 1)) // arc id per digit
  const n = border.length
  let m = 0 // placed border cells, in cyclic order
  let mask = 0 // digits placed somewhere on the border
  for (let k = 0; k < n; k++) {
    const d = value[border[k]]
    if (d >= 0) { at[m] = k; dig[m++] = d; mask |= 1 << d }
  }
  if (m < 2) return // one arc at most, and no second digit to interleave with
  // Split arc: for a digit placed at two or more border cells, walk the cycle
  // from one of them. Its cells cut the cycle into arcs; a digit that lands in
  // two of them interleaves with it.
  for (let a = lo; a <= hi; a++) {
    if (!(mask & (1 << a))) continue
    let first = -1
    let count = 0
    for (let s = 0; s < m; s++) if (dig[s] === a) { count++; if (first < 0) first = s }
    if (count < 2) continue
    arcOf.fill(-1)
    let id = -1
    for (let t = 0; t < m; t++) {
      const d = dig[(first + t) % m]
      if (d === a) { id++; continue }
      if (arcOf[d] < 0) arcOf[d] = id
      else if (arcOf[d] !== id) { yield puzzle.removeCandidateFromCell(a, cells[border[at[first]]]); return }
    }
  }
  // Flank: one lap, stripping each gap whose two flanking cells hold the same
  // digit. Every cell strictly between two consecutive placed cells is open.
  for (let s = 0; s < m; s++) {
    const a = dig[s]
    if (dig[(s + 1) % m] !== a) continue
    const strip = mask & ~(1 << a)
    if (!strip) continue
    const q = at[(s + 1) % m]
    const gap = []
    for (let k = at[s] + 1 >= n ? 0 : at[s] + 1; k !== q; k = k + 1 >= n ? 0 : k + 1) gap.push(cells[border[k]])
    if (gap.length) yield puzzle.removeCandidatesFromCells(strip, gap)
  }
}

// Bipartite matching, open cells to digits, where digit d has (size - placed)
// slots and offers them only to open cells inside its walk. Kuhn's augmenting
// path per cell. Open cells and slots count the same, so a full matching is
// perfect: `dead` is the first cell no matching covers (else -1).
// Then Régin's prune on a perfect matching: an unmatched pair (cell, digit)
// lies in some other perfect matching only if cell and digit share a strongly
// connected component of the residual graph (cell -> digit for an unmatched
// pair, digit -> cell for a matched one). Every other pair is in no solution,
// so they go in `dropCell`/`dropDigit`.
//! Budget: match open cells to the digits' free slots. No full matching is a
//! dead branch; a pair no matching can use loses that candidate.
// Every buffer is owned by `instance.budget`, sized once from the board and the
// digit range, so a call allocates nothing. Returns that scratch object: `dead`
// (a cell, or -1) and `dropCell[k]`/`dropDigit[k]` for k < `dropCount`.
function budget (instance, state, near, lo, hi, size) {
  const n = state[lo].allowed.length
  const D = hi + 1
  const b = instance.budget || (instance.budget = {
    D,
    isOpen: new Uint8Array(n),
    optCount: new Uint8Array(n), // cell -> how many digits' walks hold it
    optList: new Uint8Array(n * D), // cell x -> optList[x * D ...], ascending digits
    taken: new Int16Array(D * size), // digit d -> cells matched to it, taken[d * size ...]
    takenLen: new Uint8Array(D),
    matched: new Int8Array(n),
    seen: new Uint32Array(D),
    seenStamp: 0,
    adjStart: new Int32Array(n + D + 1), // residual graph in CSR form
    adjFill: new Int32Array(n + D),
    adjList: new Int32Array(n * D),
    idx: new Int32Array(n + D),
    low: new Int32Array(n + D),
    comp: new Int32Array(n + D),
    stack: new Int32Array(n + D),
    dropCell: new Int16Array(n * D),
    dropDigit: new Int8Array(n * D),
    dead: -1,
    dropCount: 0,
    size,
    state: null,
    sp: 0,
    next: 0,
    count: 0
  })
  b.state = state
  b.size = size
  b.dead = -1
  b.dropCount = 0
  b.isOpen.fill(0)
  b.optCount.fill(0)
  b.takenLen.fill(0)
  b.matched.fill(-1)
  let slots = 0
  for (let d = lo; d <= hi; d++) {
    slots += size - state[d].placed.length
    for (const i of state[d].open) {
      b.isOpen[i] = 1
      if (!near[d] || near[d][i]) b.optList[i * D + b.optCount[i]++] = d
    }
  }
  let open = 0
  for (let x = 0; x < n; x++) {
    if (!b.isOpen[x]) continue
    open++
    if (b.seenStamp >= 0xFFFFFFFF) { b.seen.fill(0); b.seenStamp = 0 }
    b.seenStamp++
    if (!augment(b, x)) { b.dead = x; return b }
  }
  if (open !== slots) return b // an emptied cell: not perfect, prune unsound
  // Residual graph over cells 0..n-1 and digits n+d, in CSR form.
  const V = n + D
  b.adjStart.fill(0)
  for (let x = 0; x < n; x++) {
    for (let k = 0; k < b.optCount[x]; k++) {
      const d = b.optList[x * D + k]
      b.adjStart[(d === b.matched[x] ? n + d : x) + 1]++
    }
  }
  for (let v = 0; v < V; v++) { b.adjStart[v + 1] += b.adjStart[v]; b.adjFill[v] = b.adjStart[v] }
  for (let x = 0; x < n; x++) {
    for (let k = 0; k < b.optCount[x]; k++) {
      const d = b.optList[x * D + k]
      if (d === b.matched[x]) b.adjList[b.adjFill[n + d]++] = x; else b.adjList[b.adjFill[x]++] = n + d
    }
  }
  b.idx.fill(-1)
  b.comp.fill(-1)
  b.sp = 0
  b.next = 0
  b.count = 0
  for (let v = 0; v < V; v++) if (b.idx[v] < 0) sccVisit(b, v)
  for (let x = 0; x < n; x++) {
    for (let k = 0; k < b.optCount[x]; k++) {
      const d = b.optList[x * D + k]
      if (d !== b.matched[x] && b.comp[x] !== b.comp[n + d]) { b.dropCell[b.dropCount] = x; b.dropDigit[b.dropCount++] = d }
    }
  }
  return b
}

// Kuhn's augmenting path from open cell x; `b.seenStamp` marks the digits this
// search already tried.
function augment (b, x) {
  const { D, size, state, taken, takenLen, seen } = b
  for (let k = 0; k < b.optCount[x]; k++) {
    const d = b.optList[x * D + k]
    if (seen[d] === b.seenStamp) continue
    seen[d] = b.seenStamp
    if (takenLen[d] < size - state[d].placed.length) { taken[d * size + takenLen[d]++] = x; b.matched[x] = d; return true }
    for (let j = 0; j < takenLen[d]; j++) {
      if (augment(b, taken[d * size + j])) { taken[d * size + j] = x; b.matched[x] = d; return true }
    }
  }
  return false
}

// Tarjan's strongly connected components over the CSR graph in `b`; fills
// `b.comp` with a component id per node.
function sccVisit (b, v) {
  const { idx, low, comp, stack, adjStart, adjList } = b
  idx[v] = low[v] = b.next++
  stack[b.sp++] = v
  for (let e = adjStart[v]; e < adjStart[v + 1]; e++) {
    const w = adjList[e]
    if (idx[w] < 0) { sccVisit(b, w); low[v] = Math.min(low[v], low[w]) } else if (comp[w] < 0) low[v] = Math.min(low[v], idx[w])
  }
  if (low[v] === idx[v]) {
    let w
    do { w = stack[--b.sp]; comp[w] = b.count } while (w !== v)
    b.count++
  }
}

// Exact check on a full grid: every digit is one connected island of `size` cells.
function validate (instance, puzzle) {
  const { cells, nbrs } = instance
  if (!puzzle.getCellsAreFilled(cells)) return true
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const size = cells.length / (hi - lo + 1)
  const allowed = instance.holds
  for (let d = lo; d <= hi; d++) {
    allowed.fill(0)
    let first = -1
    let count = 0
    for (let i = 0; i < cells.length; i++) {
      if (puzzle.getValue(cells[i]) !== d) continue
      allowed[i] = 1
      count++
      if (first < 0) first = i
    }
    if (count !== size || reachSize(instance, [first], size, allowed).size !== size) return false
  }
  return true
}
