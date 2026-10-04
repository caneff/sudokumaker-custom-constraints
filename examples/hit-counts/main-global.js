// The interior's rows and columns ARE the frame's lines, so the lines that
// CROSS one side are already in hand -- the left and right clues are crossed by
// the columns, which is what the top clues read, and the top and bottom clues
// by the rows, which is what the left clues read. The side sum's proof runs
// over those crossing lines, not the clued ones.
// #include ../_shared/frame-lines.js

const lines = frameLines(puzzle)
const bySide = s => lines.filter(g => g.side === s)
const rows = bySide('L').map(g => g.line)
const cols = bySide('T').map(g => g.line)

const sides = [
  { name: 'left', across: cols, groups: bySide('L') },
  { name: 'right', across: cols, groups: bySide('R') },
  { name: 'top', across: rows, groups: bySide('T') },
  { name: 'bottom', across: rows, groups: bySide('B') }
]

//! `framePairs` hands over the two ends of each line -- left with right on a
//! row, top with bottom on a column -- and `a.line` is the line read inward from
//! clue `a`.
for (const { a, b } of framePairs(lines)) {
  const name = `the hit-count clues at ${helpers.naming.getCellName(a.clue)} and ${helpers.naming.getCellName(b.clue)}`
  puzzle.addConstraintComponent(new HitCountsPairComponent(name, a.clue, b.clue, a.line))
}

//! The side sum's target n is the line length, not helpers.digits.maxDigit,
//! which the app can set past n when minDigit is 0.
for (const side of sides) {
  const clueCells = side.groups.map(g => g.clue)
  puzzle.addConstraintComponent(
    new SideSumComponent(`the clue sum on the ${side.name} side`, clueCells, side.across.length, side.across))
  puzzle.addConstraintComponent(
    new SideHitMatchingComponent(`the hit matching on the ${side.name} side`, clueCells, side.groups.map(g => g.line)))
}
