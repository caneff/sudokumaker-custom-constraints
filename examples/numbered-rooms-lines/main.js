// Numbered Rooms Lines: Numbered Rooms on any drawn line. group.cells[0] is
// the clue; the rest is the line, nearest the clue first (drawn order). The
// line may be a row, a diagonal, a bent path — anything. `distinct` is true
// when the app proves the line cells all see each other (only constraints
// defined ABOVE this one count, so put this constraint last); it unlocks two
// extra prunes that need distinct digits.
for (const { cells } of input.groups) {
  const [clue, ...line] = cells
  if (line.length === 0) continue // group still being drawn: clue only
  const name = helpers.naming.getCellsDescription(cells)
  const distinct = line.length > 1 && puzzle.getCellsSeeEachOther(line)
  puzzle.addConstraintComponent(new NumberedRoomsLinesComponent(name, clue, line, distinct))
}
