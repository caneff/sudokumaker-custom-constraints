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
