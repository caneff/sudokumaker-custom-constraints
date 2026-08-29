// Hit Counts — main (backend) code segment, prototype wiring C′ + D (#246).
//
// One local group per clued line. Cell 0 of each group is the outside clue
// cell; the rest is the line read from the cell next to the clue inward.
//
// A line clued at both ends gets ONE HitCountsJointComponent, which carries the
// per-line rule for both clues and the pair coupling at once (see
// HitCountsJointComponent). A line clued at one end only keeps the per-line
// HitCountsComponent.

//! Each group is one clued line: cell 0 is the outside clue, the rest is the
//! line read inward from the cell next to the clue.
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

//! Opposite pair: two clues whose lines are the exact reverse of each other sit
//! on opposite ends of one line.
function sameReversed (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[a.length - 1 - i]) return false
  return true
}

const paired = new Set()
for (let i = 0; i < groups.length; i++) {
  for (let j = i + 1; j < groups.length; j++) {
    if (paired.has(i) || paired.has(j)) continue
    if (!sameReversed(groups[i].line, groups[j].line)) continue
    paired.add(i)
    paired.add(j)
    const name = `hit counts joint ${helpers.naming.getCellName(groups[i].clue)}/${helpers.naming.getCellName(groups[j].clue)}`
    puzzle.addConstraintComponent(
      new HitCountsJointComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
  }
}

for (let i = 0; i < groups.length; i++) {
  if (paired.has(i)) continue
  const g = groups[i]
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new HitCountsComponent(name, g.clue, g.line))
}

//! Side sum: the n clues on one side sum to exactly n. Group the clues by the
//! step between a line's first two cells (+1 left, -1 right, +W top, -W bottom):
//! same step === same side. Only fire on a full side of n clues, where the sum
//! is exactly n; a partial side would make the sum an unsound bound.
const n = groups.length > 0 ? groups[0].line.length : 0
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

//! Side hit matching (C′): the same side, read by position instead of by line.
//! Give the component every clue on the side and every line, in the same order.
const linesBySide = new Map()
for (const g of groups) {
  const step = g.line.length >= 2 ? g.line[1] - g.line[0] : g.line[0] - g.clue
  if (!linesBySide.has(step)) linesBySide.set(step, { clues: [], lines: [] })
  const side = linesBySide.get(step)
  side.clues.push(g.clue)
  side.lines.push(g.line)
}
for (const [step, side] of linesBySide) {
  if (side.clues.length !== n) continue
  puzzle.addConstraintComponent(
    new SideHitMatchingComponent(`side hit matching step ${step}`, side.clues, side.lines))
}
