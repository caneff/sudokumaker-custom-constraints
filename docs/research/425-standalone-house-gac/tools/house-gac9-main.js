// The shipped `HouseGacComponent` on every row, column and box of a plain
// 9x9 with no clue ring (#425). `examples/_shared/house-gac.js` cannot
// register this board -- it assumes a frame board's ring and would clip two
// houses and a cell off each of the rest; see this folder's README, "Why its
// own backend".
const rows = [...helpers.geometry.getAllRows()].map(line => line.map(cell => cell | 0))
const cols = [...helpers.geometry.getAllColumns()].map(line => line.map(cell => cell | 0))
const boxes = puzzle.getRegions()

// A silently short list here (empty regions, a resized board) would register
// fewer than 27 houses with no error -- the filter just goes quietly weaker.
// Fail loud instead, matching the shipped component's own RangeErrors.
if (rows.length !== 9 || cols.length !== 9 || boxes.length !== 9) {
  throw new RangeError(`House GAC: expected 9 rows, 9 columns and 9 boxes, got ${rows.length}/${cols.length}/${boxes.length}`)
}

rows.forEach((cells, i) => puzzle.addConstraintComponent(new HouseGacComponent(`row ${i + 1}`, cells)))
cols.forEach((cells, i) => puzzle.addConstraintComponent(new HouseGacComponent(`column ${i + 1}`, cells)))
boxes.forEach((cells, i) => puzzle.addConstraintComponent(new HouseGacComponent(`box ${i + 1}`, cells)))
