// Pure decision and formatting logic for app-strip.mjs -- greedy clue removal
// with the live SudokuMaker app as the uniqueness oracle. Split out so this
// runs under node:assert without a browser; the Playwright driver imports it
// alongside readVerdict/parseReadout from app-solve-lib.mjs.

// A small deterministic PRNG (mulberry32) so a "seeded-random" removal order
// is reproducible across runs without pulling in a dependency. Module-local:
// only seededShuffle needs it.
function mulberry32 (seed) {
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

// Settle a trial's verdict: a '?' (no readout appeared) gets exactly one
// retry, and whatever that retry returns is final -- never a second retry.
// v2 is only read when v1 is '?'.
export function settleVerdict (v1, v2) {
  return v1 === '?' ? v2 : v1
}

// The surviving clue set, sorted, alongside the grid it was cut from.
export function outputJson (grid, clues) {
  const sorted = clues.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return JSON.stringify({ grid, clues: sorted }) + '\n'
}
