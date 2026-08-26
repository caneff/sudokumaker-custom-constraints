// ISOFILL — main (backend) code segment.
//
// A global constraint: the author draws no groups, so there is no
// `input.groups` to read. The main code takes every cell id from
// `helpers.cellIds.getAllCellIds()` and registers ONE component over the whole
// grid. That component counts each digit across all hundred cells.

//! ISOFILL is global: one component watches the whole grid and caps every
//! digit at ten cells.
puzzle.addConstraintComponent(
  new IsofillComponent('ISOFILL', Array.from(helpers.cellIds.getAllCellIds()))
)
