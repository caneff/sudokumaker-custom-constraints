// Pure decision and formatting logic for app-strip.mjs -- greedy clue removal
// with the live SudokuMaker app as the uniqueness oracle. Split out so this
// runs under node:assert without a browser; the Playwright driver imports it
// alongside parseReadout from app-solve-lib.mjs.

import { parseArgs as parseCli } from 'node:util'

// The driver's command line: `<link_file> <out.json> [seed] --grid <puzzle.json>`.
// `--grid` may sit anywhere among the positionals. A missing link file, out
// file or grid file, or a flag the driver does not know, is a usage error, not
// a run with a null path. Split out here because it is the one branchy part of
// app-strip.mjs a browser is not needed to exercise (#315).
const USAGE = 'usage: app-strip.mjs <link_file> <out.json> [seed] --grid <puzzle.json>'
export function parseArgs (argv) {
  let parsed
  try {
    parsed = parseCli({ args: argv, options: { grid: { type: 'string' } }, allowPositionals: true })
  } catch {
    throw new Error(USAGE)
  }
  const [linkFile, outFile, seedArg] = parsed.positionals
  const gridFile = parsed.values.grid
  if (!linkFile || !outFile || !gridFile) throw new Error(USAGE)
  // No seed given means seed 1: a run is reproducible by default, and the
  // removal order only varies when a seed is asked for.
  return { linkFile, outFile, gridFile, seed: seedArg ? parseInt(seedArg, 10) : 1 }
}

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

// The surviving clue set, sorted, alongside the grid it was cut from.
export function outputJson (grid, clues) {
  const sorted = clues.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return JSON.stringify({ grid, clues: sorted }) + '\n'
}
