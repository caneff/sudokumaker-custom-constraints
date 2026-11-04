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

const read = file => JSON.parse(readFileSync(join(import.meta.dirname, file), 'utf8'))
// The gate's board: a 9x9 grid with digits 1-29, the widest range the app's
// solver runs, committed on its own so changing the shipped board changes no
// gate time.
const pin = read('fixture-9x9.json')
export const pinned = gridOf(pin.grid, pin.cap)
// The shipped board follows `gen.json`. Its digits run past its side, so it
// carries its own cap. Only a small fuzz reads it: it is not in FIXTURES.
const gen = read('gen.json')
export const shipped = gridOf(gen.grid, gen.cap)
export const varied = gridOf(['121212', '323232', '313131', '323234', '121214', '333144'])
// Not square: seven wide, five high. A neighbour step that reads the cell
// count as a side puts the wrong cell beside the edge and fails on it.
export const wide = gridOf(['2333133', '2661223', '1566631', '2551633', '2554444'])
export const FIXTURES = [['pinned 9x9', pinned], ['varied', varied], ['wide', wide]]
