// Outside Sudoku, GLOBAL variant. No groups arrive: the frame lines come from
// the shared reader below, one { side, clue, line } per clued line
// (examples/_shared/frame-lines.js). Every frame line is one row or column by
// construction, so no direction check is needed here (main.js keeps it, for a
// drawn group of any shape).
// #include ../_shared/frame-lines.js

for (const g of frameLines(puzzle)) {
  const name = `the outside-sudoku clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new OutsideSudokuComponent(name, g.clue, g.line))
}
