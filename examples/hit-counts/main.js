// Hit Counts — main (backend) code segment.
//
// One local group per clued line. Cell 0 of each group is the outside clue
// cell; the rest is the line read from the cell next to the clue inward.
// We add ONE self-contained component per line (see the gotcha about
// replaceComponent and custom components in ../../docs/gotchas.md).
//
// There is no pair component. Two Hit Counts clues on opposite ends of one line
// barely couple: a left hit and a right hit land on the same cell only at the
// exact middle, so the only cross bound is A + B <= n (+1 when n is odd). Fixed
// points average one per line, so that bound almost never bites. The per-line
// component is the whole constraint.

//! Each group is one clued line: cell 0 is the outside clue, the rest is the
//! line read inward from the cell next to the clue.
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new HitCountsComponent(name, g.clue, g.line))
}
