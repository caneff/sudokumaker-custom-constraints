// Backend for the RequiredDigits-wrapper comparison board (#534). Same frame
// lines as main-global.js, but registers RequiredDigitsWrapperComponent
// instead of OutsideSudokuComponent -- the host that idles until its clue
// fills, then swaps itself for a required-digits rule over the window
// (RequiredDigitsWrapperComponent.js's own header says why). Never shipped
// as the real Outside Sudoku backend; build_required_digits.py splices this
// in over "Custom Outside Sudoku" only on the derived boards it writes.
// #include ../../../examples/_shared/frame-lines.js

for (const g of frameLines(puzzle)) {
  const name = `the outside-sudoku clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new RequiredDigitsWrapperComponent(name, g.clue, g.line))
}
