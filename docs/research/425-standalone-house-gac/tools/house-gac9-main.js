// The shipped `HouseGacComponent` (examples/_shared/HouseGacComponent.js) on
// every row, column and box of a plain 9x9 with no clue ring (#425).
//
// `examples/_shared/house-gac.js` cannot register this board: it assumes a
// frame board's one-cell ring and reads the ring's own row/column count into
// its `.slice(1, -1)`, so on a ringless 9x9 it would drop two whole houses
// and clip a cell off each end of the rest (house-gac.test.mjs proves it only
// against W x H boards that carry a ring). This backend reads all 27 houses
// whole, the way `docs/research/406-gac-demo/tools/gac9-main.js` reads them
// for `AllDiffGacComponent`.
const rows = [...helpers.geometry.getAllRows()].map(line => line.map(cell => cell | 0))
const cols = [...helpers.geometry.getAllColumns()].map(line => line.map(cell => cell | 0))
const boxes = puzzle.getRegions()

const houses = []
rows.forEach((cells, i) => houses.push([`row ${i + 1}`, cells]))
cols.forEach((cells, i) => houses.push([`column ${i + 1}`, cells]))
boxes.forEach((cells, i) => houses.push([`box ${i + 1}`, cells]))

for (const [name, cells] of houses) {
  puzzle.addConstraintComponent(new HouseGacComponent(name, cells))
}
