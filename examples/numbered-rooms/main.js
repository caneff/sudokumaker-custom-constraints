// Numbered Rooms (escape-the-grid). One self-contained component per line does
// all the work — no split across a wrapper and a built-in (see docs/gotchas.md
// #1). group.cells[0] is the outside clue; the rest is the line, nearest the
// clue first (docs/gotchas.md #3: trust the author's group order).
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, g.clue, g.line))
}

// Two clues on opposite ends of one line couple through a + b === N + 1 <=>
// equal clues (see NumberedRoomsPairComponent). A left group's line is the right
// group's line reversed, so match them that way.
function sameReversed (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[a.length - 1 - i]) return false
  return true
}

for (let i = 0; i < groups.length; i++) {
  for (let j = i + 1; j < groups.length; j++) {
    if (!sameReversed(groups[i].line, groups[j].line)) continue
    const name = `numbered rooms pair ${helpers.naming.getCellName(groups[i].clue)}/${helpers.naming.getCellName(groups[j].clue)}`
    puzzle.addConstraintComponent(
      new NumberedRoomsPairComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
  }
}
