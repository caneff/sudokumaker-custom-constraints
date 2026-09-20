/* eslint-disable no-unused-vars -- read by the components that include this file, not from here */
// The pieces of ISOFILL's and FILLOMINO's cut filter that do not depend on how a
// walk decides a cell is open: the grid neighbours, the dominator fold, and the
// starve verdict. One copy, spliced into each component by
// `// #include ../_shared/dominator.js` (examples/_shared/minify.py). Not a
// module: the app runs the assembled component as a bare script.
//
// The including component keeps its own BFS (`domTree`) -- the isofill walk
// reads an `allowed` array, the fillomino walk asks the puzzle -- and hands the
// walk to `domFold` and the starve verdict to `starveVerdict`. It owns
// `instance.nbrs`, `domOrder`, `idom`, `ddep`, `domCount` and `skip`.

// Orthogonal neighbours by index arithmetic; cells are row-major on a square.
function neighbours (i, side) {
  const out = []
  if (i % side > 0) out.push(i - 1)
  if (i % side < side - 1) out.push(i + 1)
  if (i >= side) out.push(i - side)
  if (i + side < side * side) out.push(i + side)
  return out
}

// The dominator tree of the walk `domOrder[0..len)` just left in `dist`. A
// cell's dominator is the deepest cell dominating all its DAG predecessors, so
// fold them pairwise, walking the deeper one up the tree built so far. A start
// has no predecessor and no dominator. A predecessor is any neighbour one step
// nearer; the walk reached it, so it is a start or a cell the walk let in.
// Fills `idom` (-1 where nothing dominates) and `ddep` (depth in that tree).
function domFold (instance, len, dist) {
  const { nbrs, domOrder, idom, ddep } = instance
  for (let k = 0; k < len; k++) {
    const v = domOrder[k]
    if (dist[v] === 0) { idom[v] = -1; ddep[v] = 1; continue }
    let a = -2
    for (const p of nbrs[v]) {
      if (dist[p] !== dist[v] - 1) continue
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
}

// Roll `domCount` up the dominator tree `domFold` just left behind, so each
// cell's entry counts itself and everything it dominates. BFS order puts a cell
// after its dominator, so one backward pass does it.
function subtreeSums (instance, len) {
  const { domCount, domOrder, idom } = instance
  for (let k = len - 1; k >= 0; k--) {
    const v = domOrder[k]
    if (idom[v] >= 0) domCount[idom[v]] += domCount[v]
  }
}

// The starve half of the cut filter: for each open cell x, 1 in `skip` when the
// walk without x still keeps `size` cells, which is (cells reached) - (cells x
// dominates) at least. `reached` is the walk's cell count and `dist` its
// distances; a cell the walk never reached changes nothing by leaving it.
function starveVerdict (instance, reached, dist, open, size) {
  const { skip, domCount, domOrder } = instance
  domCount.fill(0)
  for (let k = 0; k < reached; k++) domCount[domOrder[k]] = 1
  subtreeSums(instance, reached)
  for (const x of open) skip[x] = (dist[x] < 0 ? reached : reached - domCount[x]) >= size ? 1 : 0
}
