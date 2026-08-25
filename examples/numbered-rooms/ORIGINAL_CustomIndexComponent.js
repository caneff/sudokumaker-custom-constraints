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
      new IndexComponent(instance.name, puzzle.getValue(cell), cells[0], cells)
    )
  }
}
