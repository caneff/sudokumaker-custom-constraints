import { join } from 'path'
import { readFileSync } from 'fs'

// `cap` is the top digit, by default the longer side: a board's digits run 1..cap.
export const gridOf = (rows, cap = Math.max(rows.length, rows[0].length)) => {
  const height = rows.length
  const width = rows[0].length
  const truth = {}
  rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * width + x] = Number(ch) }))
  return { truth, width, height, cap }
}

const gen = JSON.parse(readFileSync(join(import.meta.dirname, 'gen.json'), 'utf8'))
// The shipped board's digits run past its side, so it carries its own cap.
export const shipped = gridOf(gen.grid, gen.cap)
export const varied = gridOf(['121212', '323232', '313131', '323234', '121214', '333144'])
// Not square: seven wide, five high. A neighbour step that reads the cell
// count as a side puts the wrong cell beside the edge and fails on it.
export const wide = gridOf(['2333133', '2661223', '1566631', '2551633', '2554444'])
export const FIXTURES = [['shipped', shipped], ['varied', varied], ['wide', wide]]
