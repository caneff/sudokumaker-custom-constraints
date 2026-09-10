// Refutation-only all-different. Checks its house for a Hall violation: is
// there a perfect matching of cells to distinct digits? If not, the branch is
// dead and it says so with puzzle.stop(). It NEVER removes a candidate.
//
// At any GAC-consistent state a perfect matching exists by definition, so at a
// propagation fixpoint this component can never fire. It carries no
// information. Its only possible effect is to kill a hypothesis the solver is
// trying -- which is exactly what it is here to demonstrate.
function getAffectedCells (cells) {
  return cells
}
function setParams (instance, cells) {
  instance.cells = cells
}
function hasPerfectMatching (masks, n) {
  const owner = new Int32Array(32).fill(-1)
  const seen = new Uint8Array(32)
  function aug (i) {
    let m = masks[i]
    while (m !== 0) {
      const d = 31 - Math.clz32(m & -m)
      m &= m - 1
      if (seen[d]) continue
      seen[d] = 1
      if (owner[d] === -1 || aug(owner[d])) { owner[d] = i; return true }
    }
    return false
  }
  for (let i = 0; i < n; i++) { seen.fill(0); if (!aug(i)) return false }
  return true
}
function * update (instance, puzzle) {
  const cells = instance.cells
  if (puzzle.getCellsCanHaveRepeats(cells)) { console.log('[probe] gated-off', instance.name); return }
  instance.calls = (instance.calls || 0) + 1
  if (instance.calls % 100 === 0) console.log('[probe] called', instance.name, instance.calls)
  const n = cells.length
  const masks = new Array(n)
  for (let i = 0; i < n; i++) masks[i] = puzzle.getCandidatesBitMask(cells[i])
  if (!hasPerfectMatching(masks, n)) {
    instance.kills = (instance.kills || 0) + 1
    console.log('[probe] refuted', instance.name)
    yield puzzle.stop('no way to fill ' + instance.name + ' with different digits', cells)
  }
}
