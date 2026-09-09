// Numbered Rooms (escape-the-grid), GLOBAL variant. No groups arrive: the
// frame lines come from the shared reader below, one { side, clue, line } per
// clued line (examples/_shared/frame-lines.js).
// Every frame line is one row or column, so the component's house rules all
// fire — but it asks the app for that at solve time, not here
// (docs/line-contract.md).
// #include ../_shared/frame-lines.js

for (const g of frameLines(puzzle)) {
  const name = `the numbered-rooms clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new NumberedRoomsComponent(name, g.clue, g.line))
}
