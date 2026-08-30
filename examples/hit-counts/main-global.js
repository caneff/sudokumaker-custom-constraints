// Hit Counts — main (backend) code segment, GLOBAL variant.
//
// No groups are drawn: build all 4n frame lines from the board size --
// interior n = W-2 ringed by one clue cell per side. `puzzle.getCellAt(row,
// col)` = row*W+col [verified 2026-08-28 via a [probe] log in the app].
// Then register the same line component as main.js, plus the two components
// that only make sense across the whole frame: the opposite-pair coupling
// and the per-side sum.
//
// The interior's rows and columns ARE the frame's lines: a left clue and a
// right clue read one row from opposite ends, a top and a bottom clue one
// column. Build the rows and columns once, then hand each side both its own
// clued lines and the n lines that cross it -- the side sum's proof runs over
// the crossing lines, not the clued ones.
const W = puzzle.spec.size.width
const n = W - 2
const at = (r, c) => puzzle.getCellAt(r, c)
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
const groups = []
for (let i = 0; i < n; i++) for (const side of sides) groups.push(side.groups[i])

for (const g of groups) {
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new HitCountsComponent(name, g.clue, g.line))
}

//! Opposite pair: two clues whose lines are the exact reverse of each other sit on
//! opposite ends of one line. Add a HitCountsPairComponent that couples them.
//! groups[i].line reads inward from clue i (clue i counts its left hits); clue j
//! reads the same line reversed.
function sameReversed (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[a.length - 1 - i]) return false
  return true
}

for (let i = 0; i < groups.length; i++) {
  for (let j = i + 1; j < groups.length; j++) {
    if (!sameReversed(groups[i].line, groups[j].line)) continue
    const name = `hit counts pair ${helpers.naming.getCellName(groups[i].clue)}/${helpers.naming.getCellName(groups[j].clue)}`
    puzzle.addConstraintComponent(
      new HitCountsPairComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
  }
}

//! Side sum: the n clues on one side sum to exactly n. Regroup the side's hits
//! by the crossing line each one lands on: a line that holds 1..n once each has
//! its own value at home exactly once, so it gives one hit, n in all. The
//! component gets those n crossing lines and checks each of them itself
//! (docs/line-contract.md); it prunes nothing until they all prove out.
//! n is the line length (a line is a full row/column), not helpers.digits.maxDigit,
//! which the app can set past n when minDigit is 0.
for (const side of sides) {
  const clueCells = side.groups.map(g => g.clue)
  puzzle.addConstraintComponent(
    new SideSumComponent(`side sum ${side.name}`, clueCells, n, side.across))
}
