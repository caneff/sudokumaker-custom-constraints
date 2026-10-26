// Fillomino covers the whole board, so one component watches every cell. It
// finds a cell's neighbours from its place in the list, so the list must run
// row by row from the top left: build it from coordinates rather than trust
// the order getAllCellIds() returns.
const { width, height } = puzzle.spec.size
const cells = []
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const id = helpers.cellIds.getIdFromCoordsSafe({ x, y })
    // A missing cell reads as undefined, and `undefined | 0` would quietly
    // become cell 0, so stop here instead.
    if (id === undefined) throw new Error(`FILLOMINO: no cell at x=${x}, y=${y}`)
    cells.push(id | 0)
  }
}
puzzle.addConstraintComponent(new FillominoComponent('Fillomino', cells, width, height))
