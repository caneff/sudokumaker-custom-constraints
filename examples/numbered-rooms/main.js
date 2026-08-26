// Numbered Rooms (escape-the-grid). One self-contained component per line does
// all the work — no split across a wrapper and a built-in. group.cells[0] is
// the outside clue; the rest is the line, nearest the clue first (trust the
// author's group order).
for (const { cells } of input.groups) {
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
