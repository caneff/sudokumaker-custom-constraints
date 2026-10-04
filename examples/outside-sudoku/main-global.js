// Every frame line is one row or column by construction, so no direction
// check is needed here (main.js keeps one for drawn groups).
// #include ../_shared/frame-lines.js
// #include window-length.js

for (const g of frameLines(puzzle)) {
  const name = `the outside-sudoku clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new OutsideSudokuComponent(name, g.clue, g.line, windowLength(puzzle, g.line)))
}
