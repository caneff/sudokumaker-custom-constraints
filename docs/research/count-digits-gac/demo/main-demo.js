// BACKEND of the CountDigits demo board (#568). This is the constraint's main
// code: SudokuMaker runs it once when the puzzle loads. Its job is to read the
// board's groups and REGISTER one component per group, so the solver knows
// the rule. It does no solving itself.
//
// GROUPS, on the line above, is a table the board builder writes in: for each
// drawn group, its listed digits (values), its counter cell and its target
// cells, both as [row, column] pairs. The same table is drawn on the grid as
// coloured cages, so the picture and the rule cannot disagree.
//
// This puzzle carries two copies of this backend as two separate constraints in
// the Elements panel. They are identical except for the one class name in the
// registering line below: one registers the app's own built-in count-digits
// rule, the other registers a pruning replacement whose code is in that
// constraint's component box. Exactly one is enabled. Disable it and enable the
// other, then solve again, to compare the two.
//
// Each component takes (name, digits, counterCell, targetCells):
//   - name is only used in messages;
//   - digits is a digit MASK, a number in which bit d is set when digit d is
//     listed (an array is not accepted, see the component code);
//   - counterCell and targetCells are cell ids, plain numbers.
// puzzle.getCellAt(column, row) turns coordinates into a cell id, and the
// "| 0" keeps it a plain integer, which the solver reads faster.
for (const g of GROUPS) {
  const at = ([r, c]) => puzzle.getCellAt(c, r) | 0
  const digits = g.values.reduce((mask, d) => mask | (1 << d), 0)
  puzzle.addConstraintComponent(new CountDigitsGacComponent(g.name, digits, at(g.counter), g.cells.map(at)))
}
