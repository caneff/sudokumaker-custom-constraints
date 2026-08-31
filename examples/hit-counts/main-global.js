// Hit Counts — main (backend) code segment, GLOBAL variant.
//
// No groups are drawn: build all 4n frame lines from the board size --
// interior n = W-2 ringed by one clue cell per side. `puzzle.getCellAt(a, b)`
// = a + b*W (docs/puzzle-api.md), so `at(r, c)` below names the transpose of
// the cell its arguments read as. The frame is symmetric under transpose, so
// the 4n lines and their clue pairings come out identical either way -- only
// the side labels below swap (what this file calls 'left' is the top side).
// Then register the same joint line component as main.js, plus the per-side
// sum, which only makes sense across the whole frame.
//
// The interior's rows and columns ARE the frame's lines: a left clue and a
// right clue read one row from opposite ends, a top and a bottom clue one
// column. Build the rows and columns once, then hand each side both its own
// clued lines and the n lines that cross it -- the side sum's proof runs over
// the crossing lines, not the clued ones.
const W = puzzle.spec.size.width
const n = W - 2
// `| 0` is load-bearing, not decoration: an id derived from the board size
// costs the app's solver ~1.3x per candidate read until it is a plain integer
// again (docs/puzzle-api.md, `getCellAt`; #276). Every coordinate here is in
// range, so getCellAt never returns undefined -- and it must stay that way,
// because `undefined | 0` is 0, a real cell.
const at = (r, c) => puzzle.getCellAt(r, c) | 0
const along = f => Array.from({ length: n }, (_, k) => f(k + 1))
const rows = along(i => along(c => at(i, c)))
const cols = along(i => along(r => at(r, i)))
const reversed = line => line.slice().reverse()

// Each side, clue cell first, its line read inward from the cell next to the
// clue -- the group order every line component expects (gotcha 3).
const sides = [
  { name: 'left', across: cols, groups: along(i => ({ clue: at(i, 0), line: rows[i - 1] })) },
  { name: 'right', across: cols, groups: along(i => ({ clue: at(i, W - 1), line: reversed(rows[i - 1]) })) },
  { name: 'top', across: rows, groups: along(i => ({ clue: at(0, i), line: cols[i - 1] })) },
  { name: 'bottom', across: rows, groups: along(i => ({ clue: at(W - 1, i), line: reversed(cols[i - 1]) })) }
]

//! Opposite pair: the two clues at the ends of one line get ONE
//! HitCountsJointComponent, which reads the line, both clues, and the hit
//! conflicts between a position and its mirror. Left and right clue the same
//! row, top and bottom the same column, so the pairs come off the sides by
//! index -- the line is the one read inward from clue A.
const [left, right, top, bottom] = sides
for (const [sa, sb] of [[left, right], [top, bottom]]) {
  for (let i = 0; i < n; i++) {
    const a = sa.groups[i]
    const b = sb.groups[i]
    const name = `hit counts joint ${helpers.naming.getCellName(a.clue)}/${helpers.naming.getCellName(b.clue)}`
    puzzle.addConstraintComponent(new HitCountsJointComponent(name, a.clue, b.clue, a.line))
  }
}

//! Side sum: the n clues on one side sum to exactly n. Regroup the side's hits
//! by the crossing line each one lands on: a line that holds 1..n once each has
//! its own value at home exactly once, so it gives one hit, n in all. The
//! component gets those n crossing lines and checks each of them itself
//! (docs/line-contract.md); it prunes nothing until they all prove out.
//! n is the line length (a line is a full row/column), not helpers.digits.maxDigit,
//! which the app can set past n when minDigit is 0.
//! Side hit matching: the same regrouping, assigned rather than counted. Each
//! of the side's n positions is hosted by exactly one of its n lines, and a line
//! hosts as many positions as its clue says. The component gets the side's clues
//! and its clued lines, and builds each position's cell list from them; it
//! checks itself that a position is a house of 1..n before it prunes anything
//! (docs/line-contract.md).
for (const side of sides) {
  const clueCells = side.groups.map(g => g.clue)
  puzzle.addConstraintComponent(
    new SideSumComponent(`side sum ${side.name}`, clueCells, n, side.across))
  puzzle.addConstraintComponent(
    new SideHitMatchingComponent(`side hit matching ${side.name}`, clueCells, side.groups.map(g => g.line)))
}
