// Running Start — main (backend) code segment.
//
// One local group per clued line. Cell 0 of each group is the outside clue
// cell; the rest is the line read from the cell next to the clue inward.
// We add ONE self-contained component per line (see the gotcha about
// replaceComponent and custom components in ../../docs/gotchas.md).

for (const group of input.groups) {
   const clue = group.cells[0]
   const line = group.cells.slice(1)
   const name = helpers.naming.getCellsDescription(group.cells)
   puzzle.addConstraintComponent(new RunningStartComponent(name, clue, line))
}
