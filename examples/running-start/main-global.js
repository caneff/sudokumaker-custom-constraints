// Running Start — main (backend) code segment, GLOBAL variant.
//
// No groups are drawn: build every frame line from the board size -- an
// interior nw = W-2 wide and nh = H-2 tall, ringed by one clue cell per row and
// per column. A left or right clue reads one interior row, so it has nw cells
// and there are nh such lines; a top or bottom clue reads one interior column,
// so it has nh cells and there are nw of them. `puzzle.getCellAt(a, b)`
// is the cell at column a, row b (docs/puzzle-api.md), so `at(r, c)` hands it
// the arguments the other way round: it reads row r, column c, the cell its own
// name says. The L/R/T/B labels below are the real sides.
// Then register the same line component as main.js, plus the pair
// component, which only makes sense once both ends of a line exist.
function frameGroups () {
  const W = puzzle.spec.size.width
  const H = puzzle.spec.size.height
  const nw = W - 2
  const nh = H - 2
  // `| 0` is load-bearing, not decoration: an id derived from the board size
  // costs the app's solver ~1.3x per candidate read until it is a plain
  // integer again (docs/puzzle-api.md, `getCellAt`; #276). Every coordinate
  // here is in range, so getCellAt never returns undefined -- and it must
  // stay that way, because `undefined | 0` is 0, a real cell.
  const at = (r, c) => puzzle.getCellAt(c, r) | 0
  const range = (from, to) => Array.from({ length: Math.abs(to - from) + 1 }, (_, k) => from + (to > from ? k : -k))
  const groups = []
  // Clue rank i: a left and a right clue while the interior has an i-th row, a
  // top and a bottom clue while it has an i-th column.
  for (let i = 1; i <= Math.max(nh, nw); i++) {
    if (i <= nh) {
      groups.push({ cells: [at(i, 0), ...range(1, nw).map(c => at(i, c))] }) // L
      groups.push({ cells: [at(i, W - 1), ...range(nw, 1).map(c => at(i, c))] }) // R
    }
    if (i <= nw) {
      groups.push({ cells: [at(0, i), ...range(1, nh).map(r => at(r, i))] }) // T
      groups.push({ cells: [at(H - 1, i), ...range(nh, 1).map(r => at(r, i))] }) // B
    }
  }
  return groups
}

const groups = frameGroups().map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  const name = `the running-start clue at ${helpers.naming.getCellName(g.clue)}`
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
    const name = `the running-start clues at ${helpers.naming.getCellName(groups[i].clue)} and ${helpers.naming.getCellName(groups[j].clue)}`
    // Pass groups[i].line: clue i reads it as the increasing prefix, clue j reads
    // its reverse, i.e. a strictly decreasing suffix of the same line.
    puzzle.addConstraintComponent(
      new RunningStartPairComponent(name, groups[i].clue, groups[j].clue, groups[i].line))
  }
}
