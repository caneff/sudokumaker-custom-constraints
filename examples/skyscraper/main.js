//! Skyscrapers with interactive outside clues, LOCAL variant. Each group the
//! author draws is one clued line: cell 0 is the outside clue cell, the rest is
//! the line read inward from the cell next to the clue. Every group gets one
//! SkyscraperOneSidedComponent, the one-sided DP: it reads that one clue and
//! that one line and assumes nothing else about it -- the line may bend, repeat
//! a digit, and have no clue at its far end.
//!
//! A group of one cell is a clue an author has started and not finished, so it
//! is skipped rather than thrown on: the editor rebuilds every component on
//! every edit, mid-draw included.
//!
//! Two other skyscraper rules -- reading both end clues of one line at once,
//! and counting the single clue of 1 a whole side must have -- need a shape
//! only a full clued frame has, so neither runs on drawn groups.

const groups = input.groups.map(g => ({ clue: g.cells[0], line: g.cells.slice(1) }))

for (const g of groups) {
  if (g.line.length === 0) continue
  const name = `the skyscraper clue at ${helpers.naming.getCellName(g.clue)}`
  puzzle.addConstraintComponent(new SkyscraperOneSidedComponent(name, g.clue, g.line))
}
