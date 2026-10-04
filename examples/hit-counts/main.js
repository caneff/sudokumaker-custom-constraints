// The side components need a whole side, which only exists once every frame
// line is drawn, so they are main-global.js's alone.

//! Each group is one clued line: cell 0 is the outside clue, the rest is the
//! line read inward from the cell next to the clue.
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

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
      new HitCountsPairComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
    break
  }
}

for (let i = 0; i < groups.length; i++) {
  if (paired.has(i)) continue
  const g = groups[i]
  const name = `the hit-count clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new HitCountsComponent(name, g.clue, g.line))
}
