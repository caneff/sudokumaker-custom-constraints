// Outside Sudoku, LOCAL variant. One self-contained component per line does
// all the work. group.cells[0] is the outside clue; the rest is the line,
// nearest the clue first (trust the author's group order).

for (const { cells } of input.groups) {
  const [clue, ...line] = cells
  // A group still being drawn has only its clue; nothing to enforce yet, and
  // an empty line would read an undefined cell and throw in the editor.
  if (line.length === 0) continue
  const name = helpers.naming.getCellsDescription(cells)
  // The window is the box's extent in the line's DIRECTION, so the line needs
  // one: a bent path spans both a row and a column and has none. Fail loud on
  // any other group rather than size a window from nothing.
  const oneHouse = line.every(c => puzzle.getRow(c) === puzzle.getRow(line[0])) ||
    line.every(c => puzzle.getColumn(c) === puzzle.getColumn(line[0]))
  if (!oneHouse) throw new Error(`Outside Sudoku: ${name} is not one row or column`)
  puzzle.addConstraintComponent(new OutsideSudokuComponent(name, clue, line))
}
