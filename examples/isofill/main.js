//! The component finds neighbours by index arithmetic, so the list must be
//! row-major over the board: build it by coordinates, do not trust
//! getAllCellIds() order.
const { width, height } = puzzle.spec.size
const cells = []
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const id = helpers.cellIds.getIdFromCoordsSafe({ x, y })
    // A miss is undefined, and `undefined | 0` is cell 0: keep it loud.
    if (id === undefined) throw new Error(`ISOFILL: no cell at x=${x}, y=${y}`)
    cells.push(id | 0)
  }
}
puzzle.addConstraintComponent(new IsofillComponent('ISOFILL', cells, width, height))
