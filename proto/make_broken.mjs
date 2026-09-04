// A DIFFERENT valid 6x6 solution, fully given. Sudoku holds; the clued ranks
// from the real board do not. If the constraint binds, the app must reject it.
import fs from 'fs'
import { sampleGrids, ranks } from './quadrank-lib.mjs'
const n = 6
const board = JSON.parse(fs.readFileSync('proto/board.json', 'utf8'))
const { kept } = sampleGrids(n, 5)
const other = kept[1]
const rk = ranks(other)
const broken = board.clues.filter(c => rk.get(`R${c.r}C${c.c}`) !== c.rank)
console.log('clues this grid breaks:', broken.map(c => `R${c.r}C${c.c}: clued ${c.rank}, actual ${rk.get(`R${c.r}C${c.c}`)}`).join(' | '))
fs.writeFileSync('proto/board_broken.json', JSON.stringify({
  grid: other,
  clues: board.clues,
  givens: [...Array(n * n).keys()].map(i => [Math.floor(i / n), i % n])
}, null, 1))
