//! The component finds neighbours by index arithmetic, so the list must be
//! row-major over the square: build it by coordinates, do not trust
//! getAllCellIds() order.
const side = puzzle.spec.size.width
if (puzzle.spec.size.height !== side) {
  throw new Error(`ISOFILL: needs a square board, got ${side} x ${puzzle.spec.size.height}`)
}
const cells = []
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const id = helpers.cellIds.getIdFromCoordsSafe({ x, y })
    // A miss is undefined, and `undefined | 0` is cell 0: keep it loud.
    if (id === undefined) throw new Error(`ISOFILL: no cell at x=${x}, y=${y}`)
    cells.push(id | 0)
  }
}
puzzle.addConstraintComponent(new IsofillComponent('ISOFILL', cells))
