// Numbered Rooms (escape-the-grid). One self-contained component per line does
// all the work — no split across a wrapper and a built-in. group.cells[0] is
// the outside clue; the rest is the line, nearest the clue first (trust the
// author's group order).
//
// Two modes, one file. Local (definition input has a `groups` entry): the
// author draws each clued line. Global (definition input is `[]`): no groups
// arrive, so build all 4n frame lines from the board size — interior n = W-2
// ringed by one clue cell per side. `puzzle.getCellAt(row, col)` = row*W+col
// [verified 2026-08-28 via a [probe] log in the app].
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

for (const { cells } of input.groups || frameGroups()) {
  const [clue, ...line] = cells
  const name = helpers.naming.getCellsDescription(cells)
  // The component's clue≠index rule needs the line to be one row or column
  // (its cells hold distinct digits). Fail loud on any other group rather than
  // prune unsoundly.
  const oneHouse = line.every(c => puzzle.getRow(c) === puzzle.getRow(line[0])) ||
    line.every(c => puzzle.getColumn(c) === puzzle.getColumn(line[0]))
  if (!oneHouse) throw new Error(`Numbered Rooms: ${name} is not one row or column`)
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, clue, line))
}
