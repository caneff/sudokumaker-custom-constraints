// Pure decision and formatting logic for app-strip.mjs -- greedy clue removal
// with the live SudokuMaker app as the uniqueness oracle. Split out so this
// runs under node:assert without a browser; the Playwright driver imports it
// alongside readVerdict from app-solve-lib.mjs.

// A small deterministic PRNG (mulberry32) so a "seeded-random" removal order
// is reproducible across runs without pulling in a dependency.
export function mulberry32 (seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle (arr, seed) {
  const rng = mulberry32(seed)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Whether a removal trial survives, given the verdict(s) the app returned.
// The driver runs one solve; on a '?' verdict (no readout appeared) it
// retries once and passes both here. A retried '?' still keeps the given --
// this never loops beyond one retry.
export function decideRemoval (verdict1, verdict2 = null) {
  const needsRetry = verdict1 === '?' && verdict2 === null
  const finalVerdict = needsRetry ? verdict1 : (verdict1 === '?' ? verdict2 : verdict1)
  return { needsRetry, finalVerdict, remove: finalVerdict === 'unique' }
}

export function keptLine (n, verdict, ms) {
  return `${n} givens  ${verdict}  ${ms} ms`
}

export function keepLine (cell, verdict) {
  return `keep (${cell[0]},${cell[1]})  (${verdict})`
}

export function minimumLine (n) {
  return `minimum ${n} givens`
}

// The surviving clue set, sorted, alongside the grid it was cut from --
// matches proto_strip_app.py's output shape.
export function outputJson (grid, clues) {
  const sorted = clues.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return JSON.stringify({ grid, clues: sorted }) + '\n'
}
