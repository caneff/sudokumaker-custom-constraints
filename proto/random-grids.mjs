// Random sudoku solutions. The lexicographic walk in quadrank-lib.mjs cannot
// sample 9x9 -- its 6.7e21 solutions have no usable stride, and taking the
// first few gives the degenerate lex-first grids #323 warns about. This fills
// a grid by shuffled backtracking from a seeded PRNG instead: uniform enough
// for a soundness sweep, and reproducible.

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function randomGrid (n, box, rand) {
  const [BR, BC] = box
  const g = Array.from({ length: n }, () => new Array(n).fill(0))
  const ok = (r, c, v) => {
    for (let i = 0; i < n; i++) if (g[r][i] === v || g[i][c] === v) return false
    const br = r - (r % BR); const bc = c - (c % BC)
    for (let i = 0; i < BR; i++) {
      for (let j = 0; j < BC; j++) if (g[br + i][bc + j] === v) return false
    }
    return true
  }
  const rec = (k) => {
    if (k === n * n) return true
    const r = (k / n) | 0; const c = k % n
    const order = [...Array(n).keys()].map(i => i + 1)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]]
    }
    for (const v of order) {
      if (!ok(r, c, v)) continue
      g[r][c] = v
      if (rec(k + 1)) return true
      g[r][c] = 0
    }
    return false
  }
  rec(0)
  return g
}

export function randomGrids (n, box, count, seed = 1) {
  const rand = mulberry32(seed)
  return Array.from({ length: count }, () => randomGrid(n, box, rand))
}
