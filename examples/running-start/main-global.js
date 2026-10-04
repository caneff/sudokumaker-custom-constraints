// #include ../_shared/frame-lines.js

const lines = frameLines(puzzle)

for (const g of lines) {
  const name = `the running-start clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new RunningStartComponent(name, g.clue, g.line))
}

// `a.line` is read inward from clue `a`, the orientation the pair takes for
// its first clue; clue `b` reads its reverse.
for (const { a, b } of framePairs(lines)) {
  const name = `the running-start clues at ${helpers.naming.getCellName(a.clue)} and ${helpers.naming.getCellName(b.clue)}`
  puzzle.addConstraintComponent(
    new RunningStartPairComponent(name, a.clue, b.clue, a.line))
}
