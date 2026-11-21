// Pure decision and formatting logic for app-strip.mjs -- greedy clue removal
// with the live SudokuMaker app as the uniqueness oracle. Split out so this
// runs under node:assert without a browser; the Playwright driver imports it
// alongside parseReadout from app-solve-lib.mjs.

import { parseArgs as parseCli } from 'node:util'
import { shuffle } from './harness-lib.mjs'

// The driver's command line: `<link_file> <out.json> [seed] --grid <puzzle.json>`.
// `--grid` may sit anywhere among the positionals. A missing link file, out
// file or grid file, or a flag the driver does not know, is a usage error, not
// a run with a null path. Split out here because it is the one branchy part of
// app-strip.mjs a browser is not needed to exercise.
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
// is reproducible across runs without pulling in a dependency.
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

// A copy of `arr` in the order harness-lib's `shuffle` gives under a
// mulberry32 stream seeded with `seed`.
export function seededShuffle (arr, seed) {
  return shuffle(mulberry32(seed), arr.slice())
}

// A grid as integer rows. A row is an integer array or a digit string (the
// shape isofill's gen.json stores and build_link.py reads). A cell that is not
// a non-negative integer is a usage error naming its row and column, not a
// NaN that skips the wide-pad check.
export function gridDigits (grid) {
  return grid.map((row, r) => {
    const cells = typeof row === 'string' ? Array.from(row, Number) : row
    if (!Array.isArray(cells)) throw new Error(`grid row ${r} is neither an array nor a digit string`)
    cells.forEach((v, c) => {
      if (!Number.isInteger(v) || v < 0) throw new Error(`grid cell (${r},${c}) is not a digit: ${JSON.stringify(v)}`)
    })
    return cells
  })
}

// The --grid file's text as the driver uses it: the grid as given (the output
// keeps its shape), its integer rows, and the starting clues.
export function readGridSpec (text) {
  const spec = JSON.parse(text)
  return { grid: spec.grid, digits: gridDigits(spec.grid), clues: spec.clues.map(([r, c]) => [r, c]) }
}

// The surviving clue set, sorted, alongside the grid it was cut from.
export function outputJson (grid, clues) {
  const sorted = clues.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return JSON.stringify({ grid, clues: sorted }) + '\n'
}
