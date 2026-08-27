// The ISOFILL grids and candidate seeders that the soundness harness and the
// cut-gate differential test both fuzz over. Keeping one copy stops the two
// from drifting onto different boards and reporting on different searches.
//
// A fixture is a truth map: cell index -> the digit that cell holds in a valid
// ISOFILL solution. A seeder turns (cell, true value) into the cell's starting
// candidate array, which always contains the true value.

import { readFileSync } from 'fs'
import { join } from 'path'

export const N = 10
export const CELLS = Array.from({ length: N * N }, (_, i) => i)
export const ALL = Array.from({ length: N }, (_, d) => d)

// rows — row r holds digit r (covers cap and force).
export const rows = {}
for (const c of CELLS) rows[c] = Math.floor(c / N)

// bent — rows 2r,2r+1: digit 2r takes cols 0-5 of the top row and cols 0-3 of
// the bottom row; digit 2r+1 takes the rest. Ten cells each, both connected,
// so the reach deduction walks around corners.
export const bent = {}
for (const c of CELLS) {
  const r = Math.floor(c / N)
  const x = c % N
  const top = r % 2 === 0
  const band = Math.floor(r / 2)
  bent[c] = (top ? x <= 5 : x <= 3) ? 2 * band : 2 * band + 1
}

// The `grid` field of one of the example's puzzle JSON files, as a truth map.
export function gridTruth (here, file) {
  const grid = JSON.parse(readFileSync(join(here, file), 'utf8')).grid
  const truth = {}
  grid.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * N + x] = Number(ch) }))
  return truth
}

// A random candidate seed for a cell: pinned, full, or a subset that keeps true.
export function makeSeeder (rnd, pick) {
  return (c, v) => {
    const mode = pick(['pin', 'full', 'subset'])
    if (mode === 'pin') return [v]
    if (mode === 'full') return ALL
    const s = new Set([v])
    for (const d of ALL) if (rnd() < 0.5) s.add(d)
    return [...s]
  }
}

// The same seeder, but digit `d` is never pinned, so no cell ever holds it as a
// value: `d` stays silent and only the silent-digit rule can prune it.
export function makeSilentSeeder (seeder, d) {
  return (c, v) => {
    const s = seeder(c, v)
    return s.length === 1 && s[0] === d ? ALL : s
  }
}
