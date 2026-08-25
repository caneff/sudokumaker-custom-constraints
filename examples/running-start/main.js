// Running Start — main (backend) code segment.
//
// One local group per clued line. Cell 0 of each group is the outside clue
// cell; the rest is the line read from the cell next to the clue inward.
// We add ONE self-contained component per line (see the gotcha about
// replaceComponent and custom components in ../../docs/gotchas.md).

//! Each group is one clued line: cell 0 is the outside clue, the rest is the
//! line read inward from the cell next to the clue.
const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

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
