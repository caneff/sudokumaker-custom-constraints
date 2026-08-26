// Numbered Rooms (escape-the-grid). One self-contained component per line does
// all the work — no split across a wrapper and a built-in (see docs/gotchas.md
// #1). group.cells[0] is the outside clue; the rest is the line, nearest the
// clue first (docs/gotchas.md #3: trust the author's group order).
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, g.clue, g.line))
}
