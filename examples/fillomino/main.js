// Fillomino -- main (backend) code segment.
//
// A global constraint: the author draws no groups, so there is no
// `input.groups` to read. The main code builds every cell id by coordinates
// and registers ONE component over the whole grid. Board size comes from the
// puzzle spec, so the same code serves any square board.

//! Fillomino is global: one component watches the whole grid. The component
//! finds neighbours by index arithmetic, so the list must be row-major over
//! the square: build it by coordinates, do not trust getAllCellIds() order.
const side = puzzle.spec.size.width
//! A rectangle has no row-major square to index: refuse before registering.
if (puzzle.spec.size.height !== side) {
  throw new Error(`FILLOMINO: needs a square board, got ${side} x ${puzzle.spec.size.height}`)
}
const cells = []
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const id = helpers.cellIds.getIdFromCoordsSafe({ x, y })
    // A miss is undefined, and `undefined | 0` is cell 0: keep it loud.
    if (id === undefined) throw new Error(`FILLOMINO: no cell at x=${x}, y=${y}`)
    cells.push(id | 0)
  }
}
puzzle.addConstraintComponent(new FillominoComponent('Fillomino', cells))
