// Naked singles only: no hidden-single scan at all.
function getAffectedCells (cells) {
  return cells
}
function setParams (instance, cells) {
  instance.cells = cells
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
  let fixed = 0
  for (let i = 0; i < n; i++) if (masks[i] !== 0 && (masks[i] & (masks[i] - 1)) === 0) fixed |= masks[i]
  for (let i = 0; i < n; i++) {
    const rm = masks[i] & fixed & ~(((masks[i] & (masks[i] - 1)) === 0) ? masks[i] : 0)
    if (rm !== 0) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(rm), cells[i])
  }
}
