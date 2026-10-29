/* eslint-disable no-unused-vars -- read by the components that include this file, not from here */
// Grid neighbours, and a shortcut that answers "can the region do without
// this cell?" for many cells at once.
//
// The question. A region still has to grow out of the placed digits it
// started from, and some empty cell near them may be one it cannot avoid.
// The exact check is to search again with that cell blocked off and count
// what is left. Doing that for every empty cell is slow, so one search
// answers most cells first, and only the cells it cannot clear get the exact
// check.
//
// How. Search outward one step at a time. For each cell the search reaches,
// find its BOTTLENECK: the nearest cell that every shortest route to it
// passes through (it has none when two shortest routes share no cell). Block
// off a cell x, and every cell whose shortest routes do not all pass through
// x is still reached in the same number of steps. So blocking x loses at most
// the cells BEHIND x: x itself, and every cell whose chain of bottlenecks
// leads back to x. If the search still has enough cells once those are taken
// away, the region can do without x.
//
// Why it is safe. The count is a low estimate: a cell behind x may still be
// reachable the long way round. A low estimate can only fail to clear a cell,
// which then gets the exact check. It never clears a cell the region needs.
//
// The component that uses this keeps, on its `instance`: `nbrs` (each cell's
// neighbours), `order` (the cells in the order its search reached them),
// `bottleneck`, `bottleneckDepth`, `behind` and `notNeeded`.

// The cells beside cell `i` on a board `width` cells wide and `height` high,
// its cells numbered row by row from the top left.
function neighbours (i, width, height) {
  const out = []
  if (i % width > 0) out.push(i - 1)
  if (i % width < width - 1) out.push(i + 1)
  if (i >= width) out.push(i - width)
  if (i + width < width * height) out.push(i + width)
  return out
}

// Each reached cell's bottleneck, after a search that reached `count` cells,
// listed in `instance.order` in the order it reached them, with `distance`
// the steps to each one (0 for a starting cell, -1 for a cell not reached).
// Fills `instance.bottleneck` (-1 for none) and `instance.bottleneckDepth`
// (1 for a cell with no bottleneck, one more than its bottleneck's otherwise).
function findBottlenecks (instance, count, distance) {
  const { nbrs, order, bottleneck, bottleneckDepth } = instance
  for (let k = 0; k < count; k++) {
    const cell = order[k]
    if (distance[cell] === 0) {
      bottleneck[cell] = -1
      bottleneckDepth[cell] = 1
      continue
    }
    // Every shortest route arrives from a neighbour one step nearer. The
    // bottleneck is the nearest cell that the routes through all of those
    // neighbours share. Each of them was reached earlier, so its own
    // bottleneck is known already.
    let shared = -2 // -2: no such neighbour seen yet
    for (const before of nbrs[cell]) {
      if (distance[before] !== distance[cell] - 1) continue
      shared = shared === -2 ? before : meetingPoint(instance, shared, before)
    }
    bottleneck[cell] = shared
    bottleneckDepth[cell] = shared < 0 ? 1 : bottleneckDepth[shared] + 1
  }
}

// The nearest cell that lies on both `a`'s and `b`'s chain of bottlenecks
// (each chain starts at the cell itself), or -1 when the chains share none.
function meetingPoint (instance, a, b) {
  const { bottleneck, bottleneckDepth } = instance
  while (a !== b) {
    if (a < 0 || b < 0) return -1
    if (bottleneckDepth[a] >= bottleneckDepth[b]) a = bottleneck[a]; else b = bottleneck[b]
  }
  return a
}

// For each of the `count` cells in `instance.order`, add up the cells behind
// it into `instance.behind`. On entry `behind` holds 1 for every cell that
// counts. A cell comes after its bottleneck in `order`, so one pass from the
// far end hands each cell's total on to its bottleneck in time.
function countCellsBehind (instance, count) {
  const { behind, order, bottleneck } = instance
  for (let k = count - 1; k >= 0; k--) {
    const cell = order[k]
    if (bottleneck[cell] >= 0) behind[bottleneck[cell]] += behind[cell]
  }
}

// The shortcut itself. The search just run reached `reached` cells, with
// `distance` as for `findBottlenecks`, and the region needs `size` cells. For
// each cell x of `open`, sets `instance.notNeeded[x]` to 1 when the search
// keeps at least `size` cells with x blocked off, so the region can do
// without x; 0 means the shortcut cannot tell, and x needs the exact check.
function markCellsNotNeeded (instance, reached, distance, open, size) {
  const { notNeeded, behind, order } = instance
  behind.fill(0)
  for (let k = 0; k < reached; k++) behind[order[k]] = 1
  countCellsBehind(instance, reached)
  for (const x of open) {
    // a cell the search never reached takes nothing away when blocked off
    const lost = distance[x] < 0 ? 0 : behind[x]
    notNeeded[x] = reached - lost >= size ? 1 : 0
  }
}
