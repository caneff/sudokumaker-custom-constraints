// Numbered Rooms (escape-the-grid), GLOBAL variant. No groups arrive: build
// every frame line from the board size — an interior nw = W-2 wide and
// nh = H-2 tall, ringed by one clue cell per row and per column. A left or
// right clue reads one interior row, so it has nw cells and there are nh such
// lines; a top or bottom clue reads one interior column, so it has nh cells and
// there are nw of them. `puzzle.getCellAt(a, b)` is the cell at column a, row b
// (docs/puzzle-api.md), so `at(r, c)` hands it the arguments the other way
// round: it reads row r, column c, the cell its own name says. The L/R/T/B
// labels below are the real sides.
// Every frame line is one row or column, so the component's house rules all
// fire — but it asks the app for that at solve time, not here
// (docs/line-contract.md).
function frameGroups () {
  const W = puzzle.spec.size.width
  const H = puzzle.spec.size.height
  const nw = W - 2
  const nh = H - 2
  // `| 0` is load-bearing, not decoration: an id derived from the board size
  // costs the app's solver ~1.3x per candidate read until it is a plain
  // integer again (docs/puzzle-api.md, `getCellAt`; #276). Every coordinate
  // here is in range, so getCellAt never returns undefined -- and it must
  // stay that way, because `undefined | 0` is 0, a real cell.
  const at = (r, c) => puzzle.getCellAt(c, r) | 0
  const range = (from, to) => Array.from({ length: Math.abs(to - from) + 1 }, (_, k) => from + (to > from ? k : -k))
  const groups = []
  // Clue rank i: a left and a right clue while the interior has an i-th row, a
  // top and a bottom clue while it has an i-th column.
  for (let i = 1; i <= Math.max(nh, nw); i++) {
    if (i <= nh) {
      groups.push({ cells: [at(i, 0), ...range(1, nw).map(c => at(i, c))] }) // L
      groups.push({ cells: [at(i, W - 1), ...range(nw, 1).map(c => at(i, c))] }) // R
    }
    if (i <= nw) {
      groups.push({ cells: [at(0, i), ...range(1, nh).map(r => at(r, i))] }) // T
      groups.push({ cells: [at(H - 1, i), ...range(nh, 1).map(r => at(r, i))] }) // B
    }
  }
  return groups
}

for (const { cells } of frameGroups()) {
  const [clue, ...line] = cells
  const name = helpers.naming.getCellsDescription(cells)
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, clue, line))
}
