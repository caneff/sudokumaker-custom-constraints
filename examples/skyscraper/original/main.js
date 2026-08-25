// Original "Skyscraper Lines" backend, verbatim from ChinStrap's puzzle
// (decoded from the template link). Kept here only for comparison: it wraps the
// built-in SkyscraperComponent and does no deduction until the clue is entered.
// Cell 0 is the skyscraper value for the rest of the line.
for (const group of input.groups) {
   const name = helpers.naming.getCellsDescription(group.cells)
   puzzle.addConstraintComponent(new CustomSkyscraperLineComponent(name, group.cells[0], group.cells.slice(1)))
}
