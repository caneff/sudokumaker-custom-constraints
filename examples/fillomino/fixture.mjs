// The grids the fillomino soundness harness and update-strength test fuzz
// around: one definition for both (#671).
//
//   shipped — the grid of gen.json, the board the example ships (size follows
//             whatever gen.json holds).
//   varied  — a second valid 6x6 solution: many 1s, 2s and 3s and one 4-region.
//
// `gridOf` reads a grid written as one digit string per row into the truth map
// (cell index -> digit) and its side `n`.

import { join } from 'path'
import { readFileSync } from 'fs'

export const gridOf = rows => {
  const n = rows.length
  const truth = {}
  rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * n + x] = Number(ch) }))
  return { truth, n }
}

export const shipped = gridOf(JSON.parse(readFileSync(join(import.meta.dirname, 'gen.json'), 'utf8')).grid)
export const varied = gridOf(['121212', '323232', '313131', '323234', '121214', '333144'])
