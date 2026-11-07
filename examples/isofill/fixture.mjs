// The 10x10 board the isofill tests share: one region per row (`rows`), and
// the same board with each row pair bent into two L-shaped regions (`bent`).

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
