// The board geometry window-length.js reads, mocked for the Node harnesses.
// The clue cell gets row, column and region -1, as a ring cell does in the app.

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

  const api = {
    getRow: row,
    getColumn: column,
    getRegion: region,
    getRegionCells: regionCells
  }

  const rowLine = (r, from, len) => Array.from({ length: len }, (_, k) => r * N + from + k)
  const columnLine = (c, from, len) => Array.from({ length: len }, (_, k) => (from + k) * N + c)

  return { clue, api, rowLine, columnLine }
}
