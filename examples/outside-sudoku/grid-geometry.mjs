// The board geometry OutsideSudokuComponent reads, mocked for the Node
// harnesses. The component sizes its window from the box the line starts in,
// so a mock puzzle has to answer getRow/getColumn/getRegion/getRegionCells the
// way the app does — a fuzz over a mock with no boxes would never exercise the
// rule the app enforces.
//
// Cells are an N x N grid in row-major order (id = row * N + col), boxes bh
// tall and bw wide. The clue cell sits outside the grid: it gets the id N * N,
// row and column -1, and region -1, as a ring cell does in the app.

export function gridGeometry (N, bh, bw) {
  const clue = N * N
  const boxesAcross = N / bw
  const row = c => (c === clue ? -1 : Math.floor(c / N))
  const column = c => (c === clue ? -1 : c % N)
  const region = c =>
    c === clue ? -1 : Math.floor(row(c) / bh) * boxesAcross + Math.floor(column(c) / bw)

  function regionCells (r) {
    const cells = []
    const top = Math.floor(r / boxesAcross) * bh
    const left = (r % boxesAcross) * bw
    for (let dr = 0; dr < bh; dr++) {
      for (let dc = 0; dc < bw; dc++) cells.push((top + dr) * N + left + dc)
    }
    return cells
  }

  // The puzzle-mock methods, ready to Object.assign onto a makePuzzle result.
  const api = {
    getRow: row,
    getColumn: column,
    getRegion: region,
    getRegionCells: regionCells
  }

  // `rowLine(r, from, len)` and `columnLine(c, from, len)` return the line
  // cells of one row/column, nearest-first from the given index.
  const rowLine = (r, from, len) => Array.from({ length: len }, (_, k) => r * N + from + k)
  const columnLine = (c, from, len) => Array.from({ length: len }, (_, k) => (from + k) * N + c)

  return { clue, api, rowLine, columnLine }
}
