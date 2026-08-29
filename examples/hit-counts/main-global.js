// Hit Counts — main (backend) code segment, GLOBAL variant.
//
// No groups are drawn: build all 4n frame lines from the board size --
// interior n = W-2 ringed by one clue cell per side. `puzzle.getCellAt(row,
// col)` = row*W+col [verified 2026-08-28 via a [probe] log in the app].
// Then register the same line component as main.js, plus the two components
// that only make sense across the whole frame: the opposite-pair coupling
// and the per-side sum.
//
// Two Hit Counts clues on opposite ends of one line couple through
// A + B <= n (+1 when n is odd): a left hit and a right hit share a cell only at
// the exact center. At that cap every cell is a hit, so each cell pins to two
// values — a strong cut from the clues alone (see HitCountsPairComponent).
function frameGroups () {
  const W = puzzle.spec.size.width
  const n = W - 2
  const at = (r, c) => puzzle.getCellAt(r, c)
  const range = (from, to) => Array.from({ length: n }, (_, k) => from + (to > from ? k : -k))
  const groups = []
  for (let i = 1; i <= n; i++) {
    groups.push({ cells: [at(i, 0), ...range(1, n).map(c => at(i, c))] }) // L
    groups.push({ cells: [at(i, W - 1), ...range(n, 1).map(c => at(i, c))] }) // R
    groups.push({ cells: [at(0, i), ...range(1, n).map(r => at(r, i))] }) // T
    groups.push({ cells: [at(W - 1, i), ...range(n, 1).map(r => at(r, i))] }) // B
  }
  return groups
}

const groups = frameGroups().map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

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

//! Side sum: the n clues on one side sum to exactly n. Group the clues by the
//! step between a line's first two cells (+1 left, -1 right, +W top, -W bottom):
//! same step === same side. Only fire on a full side of n clues, where the sum
//! is exactly n; a partial side would make the sum an unsound bound.
//! n is the line length (a line is a full row/column), not helpers.digits.maxDigit,
//! which the app can set past n when minDigit is 0.
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
