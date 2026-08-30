//! Skyscrapers with interactive outside clues, LOCAL variant. Each group the
//! author draws is one clued line: cell 0 is the outside clue cell, the rest is
//! the line read inward from the cell next to the clue. Every group gets one
//! SkyscraperRunningCapComponent, which reads that one clue and that one line
//! and assumes nothing else about it -- the line may bend, repeat a digit, and
//! have no clue at its far end (docs/line-contract.md).
//!
//! A group of one cell is a clue an author has started and not finished, so it
//! is skipped rather than thrown on: the editor rebuilds every component on
//! every edit, mid-draw included.
//!
//! The two-clue DP and the one-1-per-side count both need a shape only the
//! whole frame has -- see main-global.js.

const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  if (g.line.length === 0) continue
  const name = helpers.naming.getCellsDescription([g.clue, ...g.line])
  puzzle.addConstraintComponent(new SkyscraperRunningCapComponent(name, g.clue, g.line))
}
