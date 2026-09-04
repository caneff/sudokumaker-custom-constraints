// Quad Rank geometry and rank oracle, ported from ~/src/iss-stuff/quad-rank/
// quadrank.js (the API-free half) plus the 6x6 grid sampler from its grids.js.
//
// Rule: read every overlapping 2x2 window TL/TR/BL/BR, concatenate the four
// digits into a number, and rank all windows by SQL RANK -- 1 = smallest, ties
// share the lower rank, ranks after a tie are skipped.

export const SIZES = {
  4: { box: [2, 2], solutions: 288 },
  6: { box: [2, 3], solutions: 28200960 }
}

// Top-left positions of every 2x2 window, row-major. 1-based ids.
export const windowList = (rows, cols) => {
  const out = []
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) out.push({ r, c, id: `R${r}C${c}` })
  }
  return out
}

// The window's four cells in reading order: TL, TR, BL, BR.
export const windowCells = ({ r, c }) => [
  `R${r}C${c}`, `R${r}C${c + 1}`, `R${r + 1}C${c}`, `R${r + 1}C${c + 1}`
]

const windowDigits = (grid, { r, c }) =>
  [grid[r - 1][c - 1], grid[r - 1][c], grid[r][c - 1], grid[r][c]]

// String concatenation, read as a number: (1,2,3,4) -> 1234.
export const windowValue = (grid, w) => Number(windowDigits(grid, w).join(''))

// Every window's rank, keyed by top-left cell id. This is the definition of
// the constraint; every deduction below is checked against it.
export function ranks (grid) {
  const ws = windowList(grid.length, grid[0].length)
  const vals = ws.map(w => windowValue(grid, w))
  const out = new Map()
  ws.forEach((w, i) => {
    // SQL RANK: 1 + how many are strictly smaller. Ties share, and the ranks
    // immediately after a tie are skipped.
    out.set(w.id, 1 + vals.reduce((n, v) => n + (v < vals[i] ? 1 : 0), 0))
  })
  return out
}

// Walks solutions in lexicographic order, keeping every stride-th one.
export function sampleGrids (size, want, stride) {
  const { box: [BR, BC], solutions } = SIZES[size]
  stride ??= Math.max(1, Math.floor(solutions / want))
  const kept = []
  let seen = 0
  const g = Array.from({ length: size }, () => new Array(size).fill(0))
  const ok = (r, c, v) => {
    for (let i = 0; i < size; i++) if (g[r][i] === v || g[i][c] === v) return false
    const br = r - (r % BR); const bc = c - (c % BC)
    for (let i = 0; i < BR; i++) {
      for (let j = 0; j < BC; j++) if (g[br + i][bc + j] === v) return false
    }
    return true
  }
  const rec = (k) => {
    if (kept.length === want) return
    if (k === size * size) {
      if (seen % stride === 0) kept.push(g.map(row => [...row]))
      seen++
      return
    }
    const r = (k / size) | 0; const c = k % size
    for (let v = 1; v <= size; v++) {
      if (!ok(r, c, v)) continue
      g[r][c] = v; rec(k + 1); g[r][c] = 0
    }
  }
  rec(0)
  return { kept, seen }
}
