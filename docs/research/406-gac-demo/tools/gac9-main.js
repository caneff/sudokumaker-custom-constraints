// GAC (Regin) all-different on every row, column and 3x3 box of a plain 9x9.
const rows = [...helpers.geometry.getAllRows()].map(r => r.map(c => c | 0))
const cols = [...helpers.geometry.getAllColumns()].map(c => c.map(x => x | 0))
const houses = []
rows.forEach((r, i) => houses.push({ name: `row ${i + 1}`, cells: r }))
cols.forEach((c, i) => houses.push({ name: `column ${i + 1}`, cells: c }))
for (let br = 0; br < 3; br++) {
  for (let bc = 0; bc < 3; bc++) {
    const cells = []
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push(rows[br * 3 + i][bc * 3 + j])
    houses.push({ name: `box ${br * 3 + bc + 1}`, cells })
  }
}
for (const h of houses) puzzle.addConstraintComponent(new AllDiffGacComponent(h.name, h.cells))
