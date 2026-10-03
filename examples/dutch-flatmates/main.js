// Dutch Flatmates: add the rule once, over the whole grid.
//
// The rule looks at the cell above and the cell below each 5, so the rule gets
// the cells listed row by row (top row first, left to right). We build that list
// by position instead of trusting the order the app hands cells out in.

// Above and below only make sense on a square grid, so stop here on any other
// shape, before anything has been added.
const side = puzzle.spec.size.width
if (puzzle.spec.size.height !== side) {
  throw new Error(`DUTCH FLATMATES: needs a square board, got ${side} x ${puzzle.spec.size.height}`)
}
const cells = []
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const id = helpers.cellIds.getIdFromCoordsSafe({ x, y })
    // The app answers "no such cell" with undefined, and a bare undefined would
    // quietly turn into cell 0 below, so stop loudly instead.
    if (id === undefined) throw new Error(`DUTCH FLATMATES: no cell at x=${x}, y=${y}`)
    cells.push(id | 0)
  }
}
puzzle.addConstraintComponent(new DutchFlatmatesComponent('Dutch Flatmates', cells))
