// ISOFILL — main (backend) code segment.
//
// A global constraint: the author draws no groups, so there is no
// `input.groups` to read. The main code builds every cell id by coordinates and
// registers ONE component over the whole grid. That component counts each
// digit across every cell and walks each digit's reach.
//
// Board size comes from the puzzle spec, so the same code serves any square
// board whose digit count equals its side: N x N with digits 1-N, or
// (N+1) x (N+1) with digits 0-N. This code refuses a non-square board before
// registering; the component stops the branch if the cells do not divide among
// the digits.

//! ISOFILL is global: one component watches the whole grid. The component
//! finds neighbours by index arithmetic, so the list must be row-major over
//! the square: build it by coordinates, do not trust getAllCellIds() order.
const side = puzzle.spec.size.width
//! A rectangle has no row-major square to index: refuse before registering,
//! as up-to-n does, so no half-built constraint is left behind.
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
