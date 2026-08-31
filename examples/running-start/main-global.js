// Running Start — main (backend) code segment, GLOBAL variant.
//
// No groups are drawn: build all 4n frame lines from the board size --
// interior n = W-2 ringed by one clue cell per side. `puzzle.getCellAt(a, b)`
// = a + b*W (docs/puzzle-api.md), so `at(r, c)` below names the transpose of
// the cell its arguments read as. The frame is symmetric under transpose, so
// the 4n lines and their clue pairings come out identical either way -- only
// the L/R/T/B labels swap.
// Then register the same line component as main.js, plus the pair
// component, which only makes sense once both ends of a line exist.
function frameGroups () {
  const W = puzzle.spec.size.width
  const n = W - 2
  // `| 0` is load-bearing, not decoration: an id derived from the board size
  // costs the app's solver ~1.3x per candidate read until it is coerced back
  // to a plain integer (#276; numbered-rooms README, "The lane swap"). Every
  // coordinate here is in range, so getCellAt never returns undefined.
  const at = (r, c) => puzzle.getCellAt(r, c) | 0
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
  puzzle.addConstraintComponent(new RunningStartComponent(name, g.clue, g.line))
}

// When two clues sit on opposite ends of the same line, add a pair component
// that couples them through A + B <= n + 1 (see RunningStartPairComponent).
function sameReversed (a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[a.length - 1 - i]) return false
  return true
}

for (let i = 0; i < groups.length; i++) {
  for (let j = i + 1; j < groups.length; j++) {
    if (!sameReversed(groups[i].line, groups[j].line)) continue
    const name = `running start pair ${helpers.naming.getCellName(groups[i].clue)}/${helpers.naming.getCellName(groups[j].clue)}`
    // Pass groups[i].line: clue i reads it as the increasing prefix, clue j reads
    // its reverse, i.e. a strictly decreasing suffix of the same line.
    puzzle.addConstraintComponent(
      new RunningStartPairComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
  }
}
