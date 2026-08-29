// Running Start — main (backend) code segment, LOCAL variant.
//
// One local group per clued line. Cell 0 of each group is the outside clue
// cell; the rest is the line read from the cell next to the clue inward.
// We add ONE self-contained component per line (see the gotcha about
// replaceComponent and custom components in ../../docs/gotchas.md).
//
// The opposite-pair component needs both ends of a line, which only exists
// once every frame line is drawn -- see main-global.js.

//! Each group is one clued line: cell 0 is the outside clue, the rest is the
//! line read inward from the cell next to the clue.
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new RunningStartComponent(name, g.clue, g.line))
}
