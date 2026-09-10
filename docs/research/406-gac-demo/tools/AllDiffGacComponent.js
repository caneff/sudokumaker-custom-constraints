// Matching-based all-different (Regin GAC) over one house.
//
// A candidate survives only if some assignment of distinct digits to the whole
// house uses it. Testing that per (cell, digit) with a bipartite matching is
// the naive form of Regin's filter: n*d matchings instead of one matching plus
// an SCC pass, which on nine cells is microseconds and a fraction of the code.
//
// Soundness: the true house IS a system of distinct digits, so every true
// candidate sits in a perfect matching and is kept.
function getAffectedCells (cells) {
  return cells
}
function setParams (instance, cells) {
  instance.cells = cells
}
// Perfect matching of cells to digits by augmenting paths. `masks[i]` is cell
// i's candidate bitmask (bit d = digit d).
function matchAll (masks, n) {
  const owner = new Int32Array(32).fill(-1)
  const seen = new Uint8Array(32)
  function aug (i) {
    let m = masks[i]
    while (m !== 0) {
      const b = m & -m
      m ^= b
      const d = 31 - Math.clz32(b)
      if (seen[d]) continue
      seen[d] = 1
      if (owner[d] === -1 || aug(owner[d])) { owner[d] = i; return true }
    }
    return false
  }
  for (let i = 0; i < n; i++) {
    seen.fill(0)
    if (!aug(i)) return false
  }
  return true
}
function * update (instance, puzzle) {
  const cells = instance.cells
  const n = cells.length
  if (!instance.noRepeats) {
    if (puzzle.getCellsCanHaveRepeats(cells)) return
    instance.noRepeats = true
  }
  const masks = new Array(n)
  for (let i = 0; i < n; i++) masks[i] = puzzle.getCandidatesBitMask(cells[i])
  if (!matchAll(masks.slice(), n)) {
    yield puzzle.stop(`no way to give ${instance.name} distinct digits`, cells)
    return
  }
  let pending = null
  for (let i = 0; i < n; i++) {
    let rm = 0
    let m = masks[i]
    while (m !== 0) {
      const b = m & -m
      m ^= b
      const t = masks.slice()
      t[i] = b
      if (!matchAll(t, n)) rm |= b
    }
    if (rm !== 0) {
      if (pending === null) pending = []
      pending.push(cells[i], rm)
    }
  }
  if (pending !== null) {
    for (let k = 0; k < pending.length; k += 2) {
      yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(pending[k + 1]), pending[k])
    }
  }
}
