// One AllDiffGacComponent per house of the inner grid: every row, every
// column, every box. The board is the interior ringed by one clue cell, so
// each row and column of the app's geometry is sliced at both ends.
const rows = [...helpers.geometry.getAllRows()].slice(1, -1).map(r => r.slice(1, -1))
const cols = [...helpers.geometry.getAllColumns()].slice(1, -1).map(c => c.slice(1, -1))
const n = rows.length
const bh = Math.round(Math.sqrt(n))
const bw = n / bh
const houses = []
rows.forEach((r, i) => houses.push({ name: `row ${i + 1}`, cells: r }))
cols.forEach((c, i) => houses.push({ name: `column ${i + 1}`, cells: c }))
for (let br = 0; br < n / bh; br++) {
  for (let bc = 0; bc < n / bw; bc++) {
    const cells = []
    for (let i = 0; i < bh; i++) for (let j = 0; j < bw; j++) cells.push(rows[br * bh + i][bc * bw + j])
    houses.push({ name: `box ${br * (n / bw) + bc + 1}`, cells })
  }
}
for (const h of houses) puzzle.addConstraintComponent(new AllDiffGacComponent(h.name, h.cells))
