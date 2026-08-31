// Numbered Rooms (escape-the-grid), GLOBAL variant. No groups arrive: build
// all 4n frame lines from the board size — interior n = W-2 ringed by one
// clue cell per side. `puzzle.getCellAt(row, col)` = row*W+col [verified
// 2026-08-28 via a [probe] log in the app]. Every frame line is one row or
// column, so the component's house rules all fire — but it asks the app for
// that at solve time, not here (docs/line-contract.md).
function frameGroups () {
  const W = puzzle.spec.size.width
  const n = W - 2
  const at = (r, c) => puzzle.getCellAt(r, c)
  const range = (from, to) => Array.from({ length: n }, (_, k) => from + (to > from ? k : -k))
  const groups = []
  for (let i = 1; i <= n; i++) {
    groups.push({ cells: [at(i, 0), ...range(1, n).map(c => at(i, c))] }) // L
    groups.push({ cells: [at(i, W - 1), ...range(n, 1).map(c => at(i, c))] }) // R
    groups.push({ cells: [at(0, i), ...range(1, n).map(r => at(r, i))] }) // T
    groups.push({ cells: [at(W - 1, i), ...range(n, 1).map(r => at(r, i))] }) // B
  }
  return groups
}

for (const { cells } of frameGroups()) {
  const [clue, ...line] = cells
  const name = helpers.naming.getCellsDescription(cells)
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, clue, line))
}
