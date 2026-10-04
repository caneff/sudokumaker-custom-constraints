// #include window-length.js

for (const { cells } of input.groups) {
  const [clue, ...line] = cells
  // A group still being drawn has only its clue; an empty line would read an
  // undefined cell and throw in the editor.
  if (line.length === 0) continue
  const name = `the outside-sudoku clue at ${helpers.naming.getCellName(clue)}`
  // The window is the box's extent along the line's direction, and a bent path
  // has none, so skip it. A throw would show nothing in the app and leave only
  // the earlier groups registered.
  const oneHouse = line.every(c => puzzle.getRow(c) === puzzle.getRow(line[0])) ||
    line.every(c => puzzle.getColumn(c) === puzzle.getColumn(line[0]))
  if (!oneHouse) continue
  puzzle.addConstraintComponent(new OutsideSudokuComponent(name, clue, line, windowLength(puzzle, line)))
}
