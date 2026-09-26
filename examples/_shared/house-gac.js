//! A `HouseGacComponent` on every house of a frame board's interior: each row,
//! each column, each box.
//!
//! The component adds no rule. Every one of these houses is already declared
//! all-different -- rows and columns by `frame-rowcol.js`, boxes by the region
//! constraint -- and this only filters them harder (#406, #408).
//!
//! Rows and columns are read the way `frame-rowcol.js` reads them: the ring is
//! the first and last line, and the first and last cell of every line between,
//! with `| 0` on every id (#276, #394). Boxes come from `puzzle.getRegions()`,
//! which leaves out every cell outside a region, so the ring never joins one.
//! Its ids are the state's own loop indices, already plain integers. The
//! region constraint registers before any custom constraint, so the boxes are
//! there when this runs (bundle: `priority: -1e3`).
//!
//! Every name opens with `GAC`: `frame-rowcol.js` already names its houses
//! `row 1`, `column 1`, and the app's step log and stop message name the
//! component that fired, so a shared name hides which of the two it was.

const interiorHouses = (kind, all) =>
  [...all].slice(1, -1).map((line, i) => [`GAC ${kind} ${i + 1}`, line.slice(1, -1).map(cell => cell | 0)])
const rows = interiorHouses('row', helpers.geometry.getAllRows())
const columns = interiorHouses('column', helpers.geometry.getAllColumns())
const boxes = puzzle.getRegions().map((cells, i) => [`GAC box ${i + 1}`, cells])

//! One box per interior row, each a row long: a count-and-size check, not a
//! proof the boxes tile the interior. A short region list would register
//! fewer filters, and `getRegions` back-fills a missing region id with an
//! empty array, a zero-cell filter; either way the filter goes quietly
//! weaker. The RangeError fails the Node harness loudly; in the app it only
//! reaches the console, before any house registers.
const rowLength = rows[0][1].length
if (boxes.length !== rows.length || boxes.some(([, cells]) => cells.length !== rowLength)) {
  throw new RangeError(`House GAC: expected ${rows.length} boxes of ${rowLength} cells, got ${boxes.map(([, cells]) => cells.length).join('/')}`)
}

for (const [name, cells] of [...rows, ...columns, ...boxes]) {
  puzzle.addConstraintComponent(new HouseGacComponent(name, cells))
}
