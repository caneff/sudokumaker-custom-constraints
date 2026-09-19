// BACKEND of the CountDigits demo board (#568). This is the constraint's main
// code: SudokuMaker runs it once when the puzzle loads, and again whenever the
// drawn groups change. Its job is to read the groups drawn on this constraint
// and REGISTER one component per group, so the solver knows the rule. It does
// no solving itself.
//
// input.groups is the list of groups drawn on the board. Each has:
//   - cells: the group's cells as cell ids, in the order they were drawn. By
//     this board's convention the FIRST cell is the counter and the rest are
//     the target cells that get counted;
//   - value: the text typed on the group, here the listed digits, "5 6 8".
//
// This puzzle carries two copies of this backend as two separate constraints in
// the Elements panel, each with the same groups. They are identical except
// for the one class name in the registering line below: one registers the app's
// own built-in count-digits rule, the other registers a pruning replacement
// whose code is in that constraint's component box. Exactly one is enabled.
// Disable it and enable the other, then solve again, to compare the two.
//
// Each component takes (name, digits, counterCell, targetCells):
//   - name is only used in messages;
//   - digits is a digit MASK, a number in which bit d is set when digit d is
//     listed (an array is not accepted, see the GAC constraint's component code);
//   - counterCell and targetCells are cell ids, plain numbers.
for (const { cells, value } of input.groups) {
  const [counter, ...targets] = cells
  // Digits are read out of the text, so "5 6 8" and "568" mean the same.
  const digits = [...value.matchAll(/[1-9]/g)].reduce((mask, [d]) => mask | (1 << d), 0)
  // A group still being drawn has no targets, or no digits yet: nothing to
  // enforce, and registering it would only make the app refuse the board.
  if (targets.length === 0 || digits === 0) continue
  const name = `the count at ${helpers.naming.getCellName(counter)}`
  puzzle.addConstraintComponent(new CountDigitsGacComponent(name, digits, counter, targets))
}
