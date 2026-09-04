// Pick a 6x6 grid and read its true quad-rank clues off the oracle, writing
// proto/board.json for build_board.py.
//
// NOT the lexicographically-first grid: #323 warns it is atypical (three of the
// ISS effort's tickets were burned on it). Take a spread sample and use a grid
// from the middle of the space.
import fs from 'fs'
import { sampleGrids, ranks, windowList } from './quadrank-lib.mjs'

const n = 6
const { kept } = sampleGrids(n, 5)
const grid = kept[3]
const rk = ranks(grid)
const ws = windowList(n, n)

// Six clues spread over the board.
const picks = ['R1C1', 'R1C4', 'R3C2', 'R3C5', 'R5C1', 'R5C4']
const clues = picks.map(id => {
  const w = ws.find(x => x.id === id)
  return { r: w.r, c: w.c, rank: rk.get(id) }
})

// A few givens so the solver has somewhere to start.
const givens = [[0, 0], [1, 3], [2, 1], [3, 4], [4, 2], [5, 5]]

fs.writeFileSync('proto/board.json', JSON.stringify({ grid, clues, givens }, null, 1))
console.log('grid:'); for (const row of grid) console.log('  ' + row.join(' '))
console.log('clues:', clues.map(c => `R${c.r}C${c.c}=${c.rank}`).join(' '))
