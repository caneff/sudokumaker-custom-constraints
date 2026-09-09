// Hit Counts — main (backend) code segment, GLOBAL variant.
//
// No groups are drawn: the frame lines come from the shared reader below, one
// { side, clue, line } per clued line (examples/_shared/frame-lines.js).
// Then register the same joint line component as main.js, plus the per-side
// sum, which only makes sense across the whole frame.
//
// The interior's rows and columns ARE the frame's lines: a left clue and a
// right clue read one row from opposite ends, a top and a bottom clue one
// column. So the lines that CROSS one side are already in hand -- the left and
// right clues are crossed by the columns, which is what the top clues read, and
// the top and bottom clues by the rows, which is what the left clues read. The
// side sum's proof runs over those crossing lines, not the clued ones, and
// there is no second copy of the geometry here to get them.
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

//! Opposite pair: the two clues at the ends of one line get ONE
//! HitCountsJointComponent, which reads the line, both clues, and the hit
//! conflicts between a position and its mirror. `framePairs` hands over the two
//! ends of each line by construction -- left with right on a row, top with
//! bottom on a column -- and `a.line` is the line read inward from clue `a`.
for (const { a, b } of framePairs(lines)) {
  const name = `the hit-count clues at ${helpers.naming.getCellName(a.clue)} and ${helpers.naming.getCellName(b.clue)}`
  puzzle.addConstraintComponent(new HitCountsJointComponent(name, a.clue, b.clue, a.line))
}

//! Side sum: the n clues on one side sum to exactly n. Regroup the side's hits
//! by the crossing line each one lands on: a line that holds 1..n once each has
//! its own value at home exactly once, so it gives one hit, n in all. The
//! component gets those n crossing lines and checks each of them itself,
//! rather than trusting its caller; it prunes nothing until they all prove out.
//! n is the line length (a line is a full row/column), not helpers.digits.maxDigit,
//! which the app can set past n when minDigit is 0.
//! Side hit matching: the same regrouping, assigned rather than counted. Each
//! of the side's n positions is hosted by exactly one of its n lines, and a line
//! hosts as many positions as its clue says. The component gets the side's clues
//! and its clued lines, and builds each position's cell list from them; it
//! checks itself that a position is a house of 1..n before it prunes anything.
for (const side of sides) {
  const clueCells = side.groups.map(g => g.clue)
  puzzle.addConstraintComponent(
    new SideSumComponent(`the clue sum on the ${side.name} side`, clueCells, side.across.length, side.across))
  puzzle.addConstraintComponent(
    new SideHitMatchingComponent(`the hit matching on the ${side.name} side`, clueCells, side.groups.map(g => g.line)))
}
