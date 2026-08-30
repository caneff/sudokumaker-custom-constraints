/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
// Soundness. The true solution induces one concrete assignment of positions to
// lines: position i goes to the single line whose cell i holds digit i + 1, and
// line L takes exactly clue(L) of them. That assignment is one of the ones this
// component enumerates — every edge it uses is live (the digit is still a
// candidate there) and every line's load sits inside the range its clue still
// allows. The flow filtering keeps every edge some valid assignment uses, so a
// dropped edge is one the true assignment cannot use, and a forced edge is one
// every valid assignment uses, the true one included. Both removals therefore
// only ever take candidates no solution needs.
//
// The regrouping itself needs each position to be a house of 1..n, which
// `gateOpen` checks on the cells rather than trusting the caller
// (docs/line-contract.md). Until it holds the component prunes nothing.

//! Side hit matching. Read one side by position instead of by line. Position i
//! of a side is the cells that sit i+1 steps in from each of the side's n clues;
//! those n cells are a house holding 1..n, so digit i+1 sits in exactly one of
//! them. So each of the n positions is hosted by exactly one line, and line L
//! hosts exactly clue(L) positions. That is a bipartite assignment: positions to
//! lines, edge (i, L) live while digit i+1 is still a candidate in line L's cell
//! at position i, line L's capacity the range its clue still allows. An edge in
//! no valid assignment loses the digit; an edge in every valid assignment forces
//! the digit -- the hit the per-line rule can only forbid.

function getAffectedCells (clues, lines) {
  const cells = clues.slice()
  for (const line of lines) for (const cell of line) cells.push(cell)
  return cells
}

function setParams (instance, clues, lines) {
  instance.clues = clues
  instance.lines = lines
  // Position i, as its own cell list: one cell per line, i steps in.
  instance.positions = lines.length === 0
    ? []
    : lines[0].map((_, i) => lines.map(line => line[i]))
}

// The gate: n clues, n lines of n cells, and every position a house whose live
// digits are exactly {1..n} -- n cells, n digits, no repeats, so digit i+1 sits
// at position i exactly once, which is the fact the assignment is built on.
// Asked at solve time, because main code runs before the built-in row/column
// houses are registered (gotcha 6) and a hit-counts board only loses the 0 off
// its inner grid once the cage bites during solving. A house never repeats
// again and a shrinking union never regains a digit, so the answer is cached
// once it turns true.
// The size bound is the reachability search below, which holds one bitmask of
// 2n + 1 nodes in a 31-bit integer.
function gateOpen (instance, puzzle) {
  if (instance.gateOpen) return true
  const { clues, lines, positions } = instance
  const n = lines.length
  if (n < 1 || n > 15 || clues.length !== n) return false
  for (const line of lines) if (line.length !== n) return false
  for (const at of positions) {
    if (puzzle.getCellsCanHaveRepeats(at)) return false
    let mask = 0
    for (const c of at) mask |= puzzle.getCandidatesBitMask(c)
    if (mask !== (1 << (n + 1)) - 2) return false // bits 1..n set, bit 0 clear
  }
  instance.gateOpen = true
  return true
}

// ---- a tiny max-flow (Edmonds-Karp; the graphs here are ~20 nodes) ----

function newGraph (nodes) {
  return { head: new Array(nodes).fill(-1), to: [], nxt: [], cap: [], size: nodes }
}

// Edges go in pairs, so edge e's reverse is always e ^ 1.
function addEdge (g, u, v, c) {
  const e = g.to.length
  g.to.push(v); g.cap.push(c); g.nxt.push(g.head[u]); g.head[u] = e
  g.to.push(u); g.cap.push(0); g.nxt.push(g.head[v]); g.head[v] = e + 1
  return e
}

function maxflow (g, s, t) {
  let total = 0
  for (;;) {
    const via = new Array(g.size).fill(-1)
    via[s] = -2
    const queue = [s]
    for (let qi = 0; qi < queue.length && via[t] === -1; qi++) {
      const u = queue[qi]
      for (let e = g.head[u]; e !== -1; e = g.nxt[e]) {
        if (g.cap[e] > 0 && via[g.to[e]] === -1) { via[g.to[e]] = e; queue.push(g.to[e]) }
      }
    }
    if (via[t] === -1) return total
    let push = Infinity
    for (let v = t; v !== s;) { const e = via[v]; if (g.cap[e] < push) push = g.cap[e]; v = g.to[e ^ 1] }
    for (let v = t; v !== s;) { const e = via[v]; g.cap[e] -= push; g.cap[e ^ 1] += push; v = g.to[e ^ 1] }
    total += push
  }
}

// Build the assignment problem as a flow with lower bounds and solve it by the
// standard circulation transform: an edge with bounds [low, cap] becomes an edge
// of capacity cap - low plus a unit of supply at its head and demand at its tail,
// and a feasible assignment exists exactly when a super-source can meet all the
// supply. Returns the per-edge flow, or null when no assignment exists.
//   live[i][L]  edge (position i, line L) is available
//   lo[L], hi[L]  how many positions line L may host
function solveFlow (live, lo, hi, n) {
  const POS = i => i
  const LINE = L => n + L
  const T = 2 * n
  const S = 2 * n + 1
  const SS = 2 * n + 2
  const TT = 2 * n + 3
  let loSum = 0
  for (let L = 0; L < n; L++) {
    if (hi[L] < lo[L]) return null
    loSum += lo[L]
  }
  const g = newGraph(2 * n + 4)
  const edge = []
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(-1)
    for (let L = 0; L < n; L++) if (live[i][L]) row[L] = addEdge(g, POS(i), LINE(L), 1)
    edge.push(row)
  }
  for (let L = 0; L < n; L++) addEdge(g, LINE(L), T, hi[L] - lo[L])
  addEdge(g, T, S, n + loSum) // the circulation's return edge; n is its ceiling
  for (let i = 0; i < n; i++) addEdge(g, SS, POS(i), 1) // supply: each position is hosted once
  if (loSum > 0) addEdge(g, SS, T, loSum)
  addEdge(g, S, TT, n)
  for (let L = 0; L < n; L++) if (lo[L] > 0) addEdge(g, LINE(L), TT, lo[L])
  if (maxflow(g, SS, TT) !== n + loSum) return null
  const flow = []
  const load = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0)
    for (let L = 0; L < n; L++) {
      if (edge[i][L] < 0) continue
      row[L] = 1 - g.cap[edge[i][L]]
      load[L] += row[L]
    }
    flow.push(row)
  }
  return { flow, load }
}

// Which live edges are the same in every valid assignment? An edge can change
// only if it lies on a cycle of the residual graph, so an edge whose ends fall in
// different strongly connected components is fixed: fixed at 0 means the digit is
// impossible, fixed at 1 means the hit is forced. Reachability by one search per
// node is enough at this size; nodes are positions, lines, and the sink.
function fixedEdges (live, flow, load, lo, hi, n) {
  const T = 2 * n
  const size = 2 * n + 1
  const adj = []
  for (let v = 0; v < size; v++) adj.push([])
  for (let i = 0; i < n; i++) {
    for (let L = 0; L < n; L++) {
      if (!live[i][L]) continue
      if (flow[i][L] === 0) adj[i].push(n + L)
      else adj[n + L].push(i)
    }
  }
  for (let L = 0; L < n; L++) {
    if (load[L] < hi[L]) adj[n + L].push(T)
    if (load[L] > lo[L]) adj[T].push(n + L)
  }
  const reach = new Array(size).fill(0)
  for (let start = 0; start < size; start++) {
    let seen = 1 << start
    const queue = [start]
    for (let qi = 0; qi < queue.length; qi++) {
      for (const v of adj[queue[qi]]) {
        if (seen & (1 << v)) continue
        seen |= 1 << v
        queue.push(v)
      }
    }
    reach[start] = seen
  }
  return (i, L) => {
    const together = (reach[i] & (1 << (n + L))) !== 0 && (reach[n + L] & (1 << i)) !== 0
    return !together
  }
}

// Read the side's state, solve the assignment, and return the candidate changes.
// A clue counts positions, so it never exceeds n; candidates above n are read
// off before the range is taken.
function sideDeductions (puzzle, clues, lines) {
  const n = lines.length
  const lo = []
  const hi = []
  for (let L = 0; L < n; L++) {
    const mask = puzzle.getCandidatesBitMask(clues[L]) & ((1 << (n + 1)) - 1)
    if (mask === 0) return null
    lo.push(31 - Math.clz32(mask & -mask))
    hi.push(31 - Math.clz32(mask))
  }
  const live = []
  for (let i = 0; i < n; i++) {
    const row = []
    for (let L = 0; L < n; L++) row.push(((puzzle.getCandidatesBitMask(lines[L][i]) >> (i + 1)) & 1) === 1)
    live.push(row)
  }
  const solved = solveFlow(live, lo, hi, n)
  if (solved === null) return null
  const { flow, load } = solved
  const fixed = fixedEdges(live, flow, load, lo, hi, n)
  const drop = []
  const pin = []
  for (let i = 0; i < n; i++) {
    for (let L = 0; L < n; L++) {
      if (!live[i][L] || !fixed(i, L)) continue
      if (flow[i][L] === 0) drop.push([lines[L][i], i + 1])
      else pin.push([lines[L][i], i + 1])
    }
  }
  return { drop, pin }
}

// The side sees 4n cells on a 9x9 board and the solver calls update after every
// change to any of them, but the assignment reads only two things: whether digit
// i + 1 is still a candidate at position i of each line, and what each clue
// still allows. Hash exactly those and record the hash of the state this
// component itself produced; an entry hash equal to it means the assignment
// cannot have changed, so there is nothing to find. A backtrack restores
// candidates and changes the hash, so the deductions are made again on the way
// back down.
function signature (puzzle, clues, lines) {
  let h = 0
  for (let L = 0; L < lines.length; L++) {
    let bits = 0
    for (let i = 0; i < lines[L].length; i++) {
      if ((puzzle.getCandidatesBitMask(lines[L][i]) >> (i + 1)) & 1) bits |= 1 << i
    }
    h = (Math.imul(h, 31) + bits) | 0
    h = (Math.imul(h, 31) + puzzle.getCandidatesBitMask(clues[L])) | 0
  }
  return h
}

function * update (instance, puzzle) {
  if (!gateOpen(instance, puzzle)) return
  const { clues, lines } = instance
  const sig = signature(puzzle, clues, lines)
  if (sig === instance.sig) return
  const found = sideDeductions(puzzle, clues, lines)
  if (found === null) {
    // No assignment of positions to lines survives: this branch is dead. Empty a
    // clue cell, the same contradiction signal the per-line rule already raises.
    const all = Array.from(puzzle.getCandidates(clues[0]))
    if (all.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(all), clues[0])
    return
  }
  for (const [cell, digit] of found.drop) yield puzzle.removeCandidateFromCell(digit, cell)
  for (const [cell, keep] of found.pin) {
    const rm = Array.from(puzzle.getCandidates(cell)).filter(d => d !== keep)
    if (rm.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rm), cell)
  }
  instance.sig = signature(puzzle, clues, lines)
}

// Run once at creation: given clues can settle part of the side at load.
function * initialize (instance, puzzle) {
  yield * update(instance, puzzle)
}

// Every line of a filled side must realise its clue exactly.
function validate (instance, puzzle) {
  const { clues, lines } = instance
  if (!puzzle.getCellsAreFilled(getAffectedCells(clues, lines))) return true
  for (let L = 0; L < lines.length; L++) {
    let hits = 0
    for (let i = 0; i < lines[L].length; i++) if (puzzle.getValue(lines[L][i]) === i + 1) hits++
    if (hits !== puzzle.getValue(clues[L])) return false
  }
  return true
}
