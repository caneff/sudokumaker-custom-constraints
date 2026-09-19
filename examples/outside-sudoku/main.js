// Outside Sudoku, LOCAL variant. One self-contained component per line does
// all the work. group.cells[0] is the outside clue; the rest is the line,
// nearest the clue first (trust the author's group order).
// #include window-length.js

for (const { cells } of input.groups) {
  const [clue, ...line] = cells
  // A group still being drawn has only its clue; nothing to enforce yet, and
  // an empty line would read an undefined cell and throw in the editor.
  if (line.length === 0) continue
  const name = `the outside-sudoku clue at ${helpers.naming.getCellName(clue)}`
  // The window is the box's extent in the line's DIRECTION, so the line needs
  // one: a bent path spans both a row and a column and has none. Skip such a
  // group. A throw here would say nothing in the app (a main-code throw shows
  // no message) and would leave the earlier groups registered and the later
  // ones not.
  const oneHouse = line.every(c => puzzle.getRow(c) === puzzle.getRow(line[0])) ||
    line.every(c => puzzle.getColumn(c) === puzzle.getColumn(line[0]))
  if (!oneHouse) continue
  puzzle.addConstraintComponent(new OutsideSudokuComponent(name, clue, line, windowLength(puzzle, line)))
}
