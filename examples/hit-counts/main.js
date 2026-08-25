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

//! Side sum: the n clues on one side sum to exactly n. Group the clues by the
//! step between a line's first two cells (+1 left, -1 right, +W top, -W bottom):
//! same step === same side. Only fire on a full side of n clues, where the sum
//! is exactly n; a partial side would make the sum an unsound bound.
const n = helpers.digits.maxDigit
const bySide = new Map()
for (const g of groups) {
  const step = g.line.length >= 2 ? g.line[1] - g.line[0] : g.line[0] - g.clue
  if (!bySide.has(step)) bySide.set(step, [])
  bySide.get(step).push(g.clue)
}
for (const [step, clueCells] of bySide) {
  if (clueCells.length !== n) continue
  puzzle.addConstraintComponent(new SideSumComponent(`side sum step ${step}`, clueCells, n))
}
