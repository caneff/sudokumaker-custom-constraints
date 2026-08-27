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
//!   Silent: a digit with no placed cell has no walk to start. Its region
//!          still sits inside one connected component of the cells that allow
//!          it, so every component under ten cells loses the digit; if none
//!          reaches ten the branch is dead.
//!   Budget: every open cell needs a digit, and each digit can take at most
//!          (10 - placed) more cells, only inside its walk. If no assignment
//!          covers every open cell (max flow falls short) the branch is dead.
//!          Then the matching prune: a (cell, digit) pair that no perfect
//!          matching uses loses that candidate (Régin). This is the one rule
//!          that sees across digits: a wrong region for one digit starves
//!          the others' budgets.
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
  instance.mask = new Uint32Array(cells.length) // stamped visit mask, see reach
  instance.targets = new Uint32Array(cells.length)
  instance.stamp = 0
  instance.targetStamp = 0
  // Per-call scratch, reused so update allocates almost nothing (GC was 12%
  // of a call): one allowed and one walk mask per digit, BFS frontiers,
  // distance rows for the tour bound, and the "every other digit" lists (the
  // DigitSet the app receives is built fresh per yield).
  instance.allowed = []
  instance.near = []
  instance.frontier = [new Int16Array(cells.length), new Int16Array(cells.length)]
  instance.dist = []
  instance.others = []
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
// Returns { size, stamp }: `instance.mask[i] === stamp` marks a visited cell
// until the next walk. Mask and stamp live on `instance` so a walk allocates nothing — this is the hot
// loop of every search node. `limit` stops the walk once it holds that many
// cells; `targets` (a stamped set of `want` cells) stops it once every target
// is seen. Both callers only ask a yes/no, so they need no more of the walk.
function reach (instance, starts, depth, allowed, limit = Infinity, targets = null, want = 0) {
  const { nbrs, mask, targetStamp } = instance
  const stamp = ++instance.stamp
  let size = 0
  let [frontier, next] = instance.frontier
  let len = 0
  for (const i of starts) {
    if (mask[i] === stamp) continue
    mask[i] = stamp; size++; frontier[len++] = i
    if (targets && targets[i] === targetStamp) want--
  }
  if (targets && want <= 0) return { size, stamp, done: true }
  for (let step = 0; step < depth && len && size < limit; step++) {
    let nextLen = 0
    for (let f = 0; f < len; f++) {
      for (const n of nbrs[frontier[f]]) {
        if (allowed[n] && mask[n] !== stamp) {
          mask[n] = stamp; size++; next[nextLen++] = n
          if (targets && targets[n] === targetStamp && --want === 0) return { size, stamp, done: true }
          if (size >= limit) return { size, stamp, done: false }
        }
      }
    }
    [frontier, next, len] = [next, frontier, nextLen]
  }
  return { size, stamp, done: false }
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
    const allowed = instance.allowed[d] || (instance.allowed[d] = new Uint8Array(cells.length))
    allowed.fill(0)
    state[d] = { placed: [], open: [], allowed }
    if (!instance.others[d]) {
      const others = []
      for (let e = lo; e <= hi; e++) if (e !== d) others.push(e)
      instance.others[d] = others
    }
    state.digits.push(d)
  }
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (puzzle.hasValue(c)) {
      const s = state[puzzle.getValue(c)] // a value outside lo..hi throws: fail loud
      s.placed.push(i)
      s.allowed[i] = 1
    } else {
      for (const d of Array.from(puzzle.getCandidates(c))) {
        state[d].open.push(i)
        state[d].allowed[i] = 1
      }
    }
  }
  for (let d = lo; d <= hi; d++) {
    const { placed, open, allowed } = state[d]
    const others = instance.others[d]
    if (placed.length === size) {
      for (const i of open) yield puzzle.removeCandidateFromCell(d, cells[i])
    } else if (placed.length + open.length === size) {
      for (const i of open) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), cells[i])
    } else if (placed.length > 0) {
      // Any region cell is within (size - placed) steps of the placed set.
      const walk = reach(instance, placed, size - placed.length, allowed)
      // Capacity: the whole region lies inside the walk, so fewer than `size`
      // cells there is a dead branch; empty a placed cell so the solver sees it.
      if (walk.size < size) { yield puzzle.removeCandidateFromCell(d, cells[placed[0]]); continue }
      // Own copy: later walks reuse instance.mask.
      const near = { size: walk.size, mask: instance.near[d] || (instance.near[d] = new Uint8Array(cells.length)) }
      for (let i = 0; i < cells.length; i++) near.mask[i] = instance.mask[i] === walk.stamp ? 1 : 0
      // Tour bound: the region is a connected set holding every placed cell
      // and x, so walking round a spanning tree of it is a closed tour through
      // them all; its cells number at least 1 + half the perimeter of any
      // three of those points (BFS distances through `allowed`). Tighter than
      // the depth bound when the placed cells are spread out.
      if (placed.length > 1) {
        const dist = placed.map((p, k) => distances(instance, p, allowed, instance.dist[k] || (instance.dist[k] = new Int16Array(cells.length))))
        let base = 0
        for (let i = 0; i < placed.length; i++) {
          for (let j = i + 1; j < placed.length; j++) {
            for (let k = j + 1; k < placed.length; k++) {
              base = Math.max(base, dist[i][placed[j]] + dist[i][placed[k]] + dist[j][placed[k]])
            }
          }
        }
        if (1 + Math.ceil(base / 2) > size) { yield puzzle.removeCandidateFromCell(d, cells[placed[0]]); continue }
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
        if (near.size < size) { yield puzzle.removeCandidateFromCell(d, cells[placed[0]]); continue }
      }
      state[d].near = near.mask // budget (below) limits this digit to its walk
      for (const i of open) if (!near.mask[i]) yield puzzle.removeCandidateFromCell(d, cells[i])
      // Cut: an open cell whose removal starves the walk (< size cells) or
      // strands a placed cell must hold the digit (ticket #101). Each walk
      // stops as soon as it has its answer: `size` cells, or every placed cell.
      const depth = size - placed.length
      const targetStamp = ++instance.targetStamp
      for (const i of placed) instance.targets[i] = targetStamp
      for (const x of open) {
        if (!near.mask[x]) continue
        let cut
        let ways = 0
        for (const n of nbrs[x]) if (allowed[n]) ways++
        if (ways <= 1) {
          // A dead end: removing it removes only itself.
          cut = near.size - 1 < size
        } else {
          allowed[x] = 0
          cut = reach(instance, placed, depth, allowed, size).size < size
          if (!cut && placed.length > 1) cut = !reach(instance, [placed[0]], size - 1, allowed, Infinity, instance.targets, placed.length).done
          allowed[x] = 1
        }
        if (cut) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), cells[x])
      }
    } else if (open.length > 0) {
      // Silent: a digit with no placed cell gets no walk above, because every
      // walk starts from one. Its region still lies inside a single
      // orthogonally connected component of the cells that allow it, so a
      // component smaller than `size` can hold no region (ticket #142).
      const near = instance.near[d] || (instance.near[d] = new Uint8Array(cells.length))
      near.fill(0)
      const small = []
      let big = false
      for (const start of open) {
        if (near[start]) continue
        const comp = reach(instance, [start], Infinity, allowed)
        for (const i of open) if (instance.mask[i] === comp.stamp) { near[i] = 1; if (comp.size < size) small.push(i) }
        if (comp.size >= size) big = true
      }
      // No component fits the region: a dead branch, so empty a cell.
      if (!big) { yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(state.digits), cells[open[0]]); continue }
      for (const i of small) { near[i] = 0; yield puzzle.removeCandidateFromCell(d, cells[i]) }
      state[d].near = near // budget (below) limits this digit to the components that fit
    }
    if (placed.length > 1) {
      // Any two cells of a size-cell region are within (size - 1) steps.
      const joined = reach(instance, [placed[0]], size - 1, allowed)
      for (const i of placed) if (instance.mask[i] !== joined.stamp) yield puzzle.removeCandidateFromCell(d, cells[i])
    }
  }
  // Budget: every open cell needs a digit, and digit d can take at most
  // (size - placed) more cells, all inside its walk. If no assignment covers
  // every open cell the branch is dead: empty that cell.
  const { dead, drops } = budget(state, lo, hi, size)
  if (dead >= 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(state.digits), cells[dead])
  for (const [x, d] of drops) yield puzzle.removeCandidateFromCell(d, cells[x])
}

// Bipartite matching, open cells to digits, where digit d has (size - placed)
// slots and offers them only to open cells inside its walk. Kuhn's augmenting
// path per cell. Open cells and slots count the same, so a full matching is
// perfect: `dead` is the first cell no matching covers (else -1).
// Then Régin's prune on a perfect matching: an unmatched pair (cell, digit)
// lies in some other perfect matching only if cell and digit share a strongly
// connected component of the residual graph (cell -> digit for an unmatched
// pair, digit -> cell for a matched one). Every other pair is in no solution,
// so `drops` lists them as [cell, digit].
function budget (state, lo, hi, size) {
  const n = state[lo].allowed.length
  const isOpen = new Uint8Array(n)
  const options = [] // cell -> digits whose walk holds it
  const taken = [] // digit -> cells matched to it
  const matched = new Int8Array(n).fill(-1) // cell -> digit
  let slots = 0
  for (let d = lo; d <= hi; d++) {
    taken[d] = []
    slots += size - state[d].placed.length
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
      if (taken[d].length < size - state[d].placed.length) { taken[d].push(x); matched[x] = d; return true }
      for (let k = 0; k < taken[d].length; k++) {
        if (augment(taken[d][k], seen)) { taken[d][k] = x; matched[x] = d; return true }
      }
    }
    return false
  }
  let open = 0
  for (let x = 0; x < n; x++) {
    if (!isOpen[x]) continue
    open++
    if (!augment(x, new Uint8Array(hi + 1))) return { dead: x, drops: [] }
  }
  const drops = []
  if (open !== slots) return { dead: -1, drops } // an emptied cell: not perfect, prune unsound
  // Residual graph over cells 0..n-1 and digits n+d; Tarjan's SCC.
  const adj = []
  for (let v = 0; v < n + hi + 1; v++) adj[v] = []
  for (let x = 0; x < n; x++) {
    for (const d of options[x] || []) {
      if (d === matched[x]) adj[n + d].push(x); else adj[x].push(n + d)
    }
  }
  const comp = sccs(adj)
  for (let x = 0; x < n; x++) {
    for (const d of options[x] || []) {
      if (d !== matched[x] && comp[x] !== comp[n + d]) drops.push([x, d])
    }
  }
  return { dead: -1, drops }
}

// Tarjan's strongly connected components; returns a component id per node.
function sccs (adj) {
  const n = adj.length
  const idx = new Int32Array(n).fill(-1)
  const low = new Int32Array(n)
  const comp = new Int32Array(n).fill(-1)
  const stack = []
  let next = 0
  let count = 0
  const visit = v => {
    idx[v] = low[v] = next++
    stack.push(v)
    for (const w of adj[v]) {
      if (idx[w] < 0) { visit(w); low[v] = Math.min(low[v], low[w]) } else if (comp[w] < 0) low[v] = Math.min(low[v], idx[w])
    }
    if (low[v] === idx[v]) {
      let w
      do { w = stack.pop(); comp[w] = count } while (w !== v)
      count++
    }
  }
  for (let v = 0; v < n; v++) if (idx[v] < 0) visit(v)
  return comp
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
    if (count !== size || reach(instance, [first], size, allowed).size !== size) return false
  }
  return true
}
