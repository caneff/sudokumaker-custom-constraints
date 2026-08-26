// Numbered Rooms (escape-the-grid). One self-contained component per line does
// all the work — no split across a wrapper and a built-in (see docs/gotchas.md
// #1). group.cells[0] is the outside clue; the rest is the line, nearest the
// clue first (docs/gotchas.md #3: trust the author's group order).
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  // The component's clue≠index rule needs the line to be one row or column
  // (its cells hold distinct digits). Fail loud on any other group rather than
  // prune unsoundly.
  const oneHouse = g.line.every(c => puzzle.getRow(c) === puzzle.getRow(g.line[0])) ||
    g.line.every(c => puzzle.getColumn(c) === puzzle.getColumn(g.line[0]))
  if (!oneHouse) throw new Error(`Numbered Rooms: ${name} is not one row or column`)
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, g.clue, g.line))
}
