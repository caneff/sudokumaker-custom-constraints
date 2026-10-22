import { join } from 'path'
import { readFileSync } from 'fs'

// `n` is the digit cap, the longer side: a board's digits run 1..n.
export const gridOf = rows => {
  const height = rows.length
  const width = rows[0].length
  const truth = {}
  rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * width + x] = Number(ch) }))
  return { truth, width, height, n: Math.max(width, height) }
}

export const shipped = gridOf(JSON.parse(readFileSync(join(import.meta.dirname, 'gen.json'), 'utf8')).grid)
export const varied = gridOf(['121212', '323232', '313131', '323234', '121214', '333144'])
// Not square: seven wide, five high. A neighbour step that reads the cell
// count as a side puts the wrong cell beside the edge and fails on it.
export const wide = gridOf(['2333133', '2661223', '1566631', '2551633', '2554444'])
export const FIXTURES = [['shipped', shipped], ['varied', varied], ['wide', wide]]
