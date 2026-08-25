for (const group of input.groups) {
  const name = helpers.naming.getCellsDescription(group.cells)
  puzzle.addConstraintComponent(new CustomIndexComponent(name, group.cells[0], group.cells.slice(1)))
}