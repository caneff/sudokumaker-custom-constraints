// Original per-line component, verbatim from ChinStrap's puzzle. It is a pure
// wrapper: nothing happens while the clue cell is blank; once the clue holds a
// value it swaps itself for the built-in SkyscraperComponent. So it deduces
// nothing about a blank (interactive) clue and never couples the two ends.
function getAffectedCells (cell, cells) {
  return [cell, ...cells]
}

function setParams (instance, cell, cells) {
  instance.cell = cell
  instance.cells = cells
}

function* update (instance, puzzle) {
  const { cell, cells } = instance

  if (puzzle.hasValue(cell)) {
    yield puzzle.replaceComponent(
      instance,
      new SkyscraperComponent(instance.name, puzzle.getValue(cell), cells)
    )
  }
}
