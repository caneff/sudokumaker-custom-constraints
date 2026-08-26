// ISOFILL — main (backend) code segment.
//
// A global constraint: the author draws no groups, so there is no
// `input.groups` to read. The main code builds every cell id by coordinates and
// registers ONE component over the whole grid. That component counts each
// digit across all hundred cells and walks each digit's reach.

//! ISOFILL is global: one component watches the whole grid. The component
//! finds neighbours by index arithmetic, so the list must be row-major over
//! the square: build it by coordinates, do not trust getAllCellIds() order.
const cells = []
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) cells.push(helpers.cellIds.getIdFromCoordsSafe({ x, y }))
}
puzzle.addConstraintComponent(new IsofillComponent('ISOFILL', cells))
