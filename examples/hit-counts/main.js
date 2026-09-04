// Hit Counts — main (backend) code segment, LOCAL variant.
//
// One local group per clued line. Cell 0 of each group is the outside clue
// cell; the rest is the line read from the cell next to the clue inward.
// We add ONE self-contained component per line (see the gotcha about
// replaceComponent and custom components in ../../docs/gotchas.md).
//
// Two groups that cover the same cells in opposite directions are the two ends
// of one line, and they get a single HitCountsJointComponent, which reads the
// line, both clues, and the hit conflicts between a position and its mirror. A
// group with no such partner -- a drawn path, or half a frame an author is
// still drawing -- keeps the per-line HitCountsComponent, whose bounds need
// only one clue.
//
// The side-sum component needs a whole side, which only exists once every
// frame line is drawn -- see main-global.js.

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
  if (paired.has(i)) continue
  for (let j = i + 1; j < groups.length; j++) {
    if (paired.has(j)) continue
    if (!sameReversed(groups[i].line, groups[j].line)) continue
    paired.add(i)
    paired.add(j)
    const name = `the hit-count clues at ${helpers.naming.getCellName(groups[i].clue)} and ${helpers.naming.getCellName(groups[j].clue)}`
    puzzle.addConstraintComponent(
      new HitCountsJointComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
    break
  }
}

for (let i = 0; i < groups.length; i++) {
  if (paired.has(i)) continue
  const g = groups[i]
  const name = `the hit-count clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new HitCountsComponent(name, g.clue, g.line))
}
