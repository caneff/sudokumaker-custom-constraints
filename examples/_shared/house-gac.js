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

const lines = [
  ['row', helpers.geometry.getAllRows()],
  ['column', helpers.geometry.getAllColumns()]
].flatMap(([kind, all]) =>
  [...all].slice(1, -1).map((line, i) => [`${kind} ${i + 1}`, line.slice(1, -1).map(cell => cell | 0)])
)
const boxes = puzzle.getRegions().map((cells, i) => [`box ${i + 1}`, cells])

for (const [name, cells] of [...lines, ...boxes]) {
  puzzle.addConstraintComponent(new HouseGacComponent(name, cells))
}
