function getAffectedCells (cells) { return cells }
function setParams (instance, cells) { instance.cells = cells }
function * update (instance, puzzle) {
  const cells = instance.cells
  if (puzzle.getCellsCanHaveRepeats(cells)) return
  const n = cells.length
  const dom = new Int32Array(n)
  for (let i = 0; i < n; i++) dom[i] = puzzle.getCandidatesBitMask(cells[i])
  const mv = new Int32Array(64).fill(-1)
  const mc = new Int32Array(n).fill(-1)
  const seen = new Uint8Array(64)
  function aug (i) {
    let x = dom[i]
    while (x) {
      const d = 31 - Math.clz32(x & -x); x &= x - 1
      if (seen[d]) continue
      seen[d] = 1
      if (mv[d] === -1 || aug(mv[d])) { mv[d] = i; mc[i] = d; return true }
    }
    return false
  }
  for (let i = 0; i < n; i++) { seen.fill(0); if (!aug(i)) return }
  // Residual digraph: cell -> unmatched value, value -> its matched cell.
  // Nodes 0..n-1 cells, n+d values. Keep an edge if it lies on an alternating
  // path from a free value, or inside a strongly connected component.
  const V = n + 64
  const keep = new Int32Array(n)
  for (let i = 0; i < n; i++) keep[i] = 1 << mc[i]
  const succ = i => i < n ? (dom[i] & ~(1 << mc[i])) : 0
  const mark = new Uint8Array(V)
  const stack = []
  for (let d = 1; d < 64; d++) if (mv[d] === -1) { mark[n + d] = 1; stack.push(n + d) }
  while (stack.length) { // free values: walk value -> cells that list it -> their matched value
    const u = stack.pop()
    if (u >= n) {
      const d = u - n
      for (let i = 0; i < n; i++) if ((dom[i] >> d & 1) && mc[i] !== d) {
        keep[i] |= 1 << d
        if (!mark[i]) { mark[i] = 1; stack.push(i) }
      }
    } else if (mc[u] >= 0 && !mark[n + mc[u]]) { mark[n + mc[u]] = 1; stack.push(n + mc[u]) }
  }
  const idx = new Int32Array(V).fill(-1)
  const low = new Int32Array(V)
  const onst = new Uint8Array(V)
  const comp = new Int32Array(V).fill(-1)
  const st = []
  let counter = 0
  let nc = 0
  const nbrs = u => {
    const out = []
    if (u < n) { let x = succ(u); while (x) { const d = 31 - Math.clz32(x & -x); x &= x - 1; out.push(n + d) } }
    else if (mv[u - n] >= 0) out.push(mv[u - n])
    return out
  }
  function scc (r) {
    const work = [[r, 0]]
    idx[r] = low[r] = counter++; st.push(r); onst[r] = 1
    while (work.length) {
      const top = work[work.length - 1]
      const u = top[0]
      const ns = nbrs(u)
      if (top[1] < ns.length) {
        const v = ns[top[1]++]
        if (idx[v] === -1) { idx[v] = low[v] = counter++; st.push(v); onst[v] = 1; work.push([v, 0]) }
        else if (onst[v] && idx[v] < low[u]) low[u] = idx[v]
      } else {
        work.pop()
        if (work.length) { const p = work[work.length - 1][0]; if (low[u] < low[p]) low[p] = low[u] }
        if (low[u] === idx[u]) { let w; do { w = st.pop(); onst[w] = 0; comp[w] = nc } while (w !== u); nc++ }
      }
    }
  }
  for (let u = 0; u < V; u++) if (idx[u] === -1 && (u < n || mv[u - n] >= 0 || true)) scc(u)
  for (let i = 0; i < n; i++) {
    let x = succ(i)
    while (x) { const d = 31 - Math.clz32(x & -x); x &= x - 1; if (comp[i] === comp[n + d]) keep[i] |= 1 << d }
  }
  for (let i = 0; i < n; i++) {
    const rm = dom[i] & ~keep[i]
    if (rm !== 0) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(rm), cells[i])
  }
}
