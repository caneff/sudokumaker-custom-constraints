// Numbered Rooms (escape-the-grid), GLOBAL variant. No groups arrive: build
// all 4n frame lines from the board size — interior n = W-2 ringed by one
// clue cell per side. `puzzle.getCellAt(a, b)` is the cell at column a, row b
// (docs/puzzle-api.md), so `at(r, c)` hands it the arguments the other way
// round: it reads row r, column c, the cell its own name says. The L/R/T/B
// labels below are the real sides.
// Every frame line is one row or column, so the component's house rules all
// fire — but it asks the app for that at solve time, not here
// (docs/line-contract.md).
function frameGroups () {
  const W = puzzle.spec.size.width
  const n = W - 2
  // `| 0` is load-bearing, not decoration: an id derived from the board size
  // costs the app's solver ~1.3x per candidate read until it is a plain
  // integer again (docs/puzzle-api.md, `getCellAt`; #276). Every coordinate
  // here is in range, so getCellAt never returns undefined -- and it must
  // stay that way, because `undefined | 0` is 0, a real cell.
  const at = (r, c) => puzzle.getCellAt(c, r) | 0
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
