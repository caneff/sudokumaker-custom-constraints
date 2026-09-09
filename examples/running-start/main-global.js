// Running Start — main (backend) code segment, GLOBAL variant.
//
// No groups are drawn: the frame lines come from the shared reader below, one
// { side, clue, line } per clued line (examples/_shared/frame-lines.js).
// Then register the same line component as main.js, plus the pair
// component, which only makes sense once both ends of a line exist.
// #include ../_shared/frame-lines.js

const lines = frameLines(puzzle)

for (const g of lines) {
  const name = `the running-start clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new RunningStartComponent(name, g.clue, g.line))
}

// The two clues at the ends of one line get a pair component, which couples
// them through A + B <= n + 1 (see RunningStartPairComponent). `framePairs`
// hands over the opposite ends by construction, and `a.line` is the line read
// inward from clue `a`: clue `a` reads it as the increasing prefix, clue `b`
// reads its reverse, i.e. a strictly decreasing suffix of the same line.
for (const { a, b } of framePairs(lines)) {
  const name = `the running-start clues at ${helpers.naming.getCellName(a.clue)} and ${helpers.naming.getCellName(b.clue)}`
  puzzle.addConstraintComponent(
    new RunningStartPairComponent(name, a.clue, b.clue, a.line))
}
