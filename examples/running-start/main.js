// No pair component here: it needs both ends of a line, which only a full
// frame has -- see main-global.js.

//! Each group is one clued line: cell 0 is the outside clue, the rest is the
//! line read inward from the cell next to the clue.
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = `the running-start clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new RunningStartComponent(name, g.clue, g.line))
}
