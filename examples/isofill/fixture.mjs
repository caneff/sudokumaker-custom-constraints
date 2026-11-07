// The boards the isofill tests share. The 10x10 board: one region per row
// (`rows`), and the same board with each row pair bent into two L-shaped
// regions (`bent`). Two that are not square, so the region size is cells /
// digits (6) and the border walk has a width and a height of its own: 6 wide by
// 10 high with one row per digit (`rowsTall`), and 10 wide by 6 high with one
// column per digit (`colsWide`) or column pairs bent into regions (`bentWide`).

export const N = 10
export const CELLS = Array.from({ length: N * N }, (_, i) => i)

export const rows = {}
for (const c of CELLS) rows[c] = Math.floor(c / N)

// Rows 2r,2r+1: digit 2r takes cols 0-5 of the top row and cols 0-3 of the
// bottom row; digit 2r+1 takes the rest. Ten cells each, both connected.
export const bent = {}
for (const c of CELLS) {
  const r = Math.floor(c / N)
  const x = c % N
  const top = r % 2 === 0
  const band = Math.floor(r / 2)
  bent[c] = (top ? x <= 5 : x <= 3) ? 2 * band : 2 * band + 1
}

// A `w` x `h` board, cells numbered row by row.
export const shapeOf = (w, h) => ({ w, h, cells: Array.from({ length: w * h }, (_, i) => i) })
export const tall = shapeOf(6, 10)
export const wide = shapeOf(10, 6)
const truthOf = (shape, at) => Object.fromEntries(shape.cells.map(c => [c, at(c % shape.w, Math.floor(c / shape.w))]))
export const rowsTall = truthOf(tall, (x, y) => y)
export const colsWide = truthOf(wide, x => x)
// Column pair 2k, 2k+1: digit 2k takes rows 0-3 of the first and 0-1 of the
// second; digit 2k+1 the rest. Six cells each, both connected.
export const bentWide = truthOf(wide, (x, y) => {
  const first = x % 2 === 0
  return (first ? y <= 3 : y <= 1) ? x - (x % 2) : x - (x % 2) + 1
})
