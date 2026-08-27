// ISOFILL — main (backend) code segment.
//
// A global constraint: the author draws no groups, so there is no
// `input.groups` to read. The main code builds every cell id by coordinates and
// registers ONE component over the whole grid. That component counts each
// digit across every cell and walks each digit's reach.
//
// Board size comes from the puzzle spec, so the same code serves any square
// board whose digit count equals its side: N x N with digits 1-N, or
// (N+1) x (N+1) with digits 0-N. The component checks that and throws otherwise.

//! ISOFILL is global: one component watches the whole grid. The component
//! finds neighbours by index arithmetic, so the list must be row-major over
//! the square: build it by coordinates, do not trust getAllCellIds() order.
const side = puzzle.spec.size.width
const cells = []
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) cells.push(helpers.cellIds.getIdFromCoordsSafe({ x, y }))
}
puzzle.addConstraintComponent(new IsofillComponent('ISOFILL', cells))
