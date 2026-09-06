// #323 reported rank 21 pins the top-left to 5, and 6 starts at rank 22.
// The derived table says rank 21 admits 5 or 6. Find a concrete grid where a
// rank-21 window has top-left 6, and check the structural reason.
import { sampleGrids, ranks, windowList } from './quadrank-lib.mjs'

const { kept } = sampleGrids(6, 3000)
let found = null
let count = 0
for (const grid of kept) {
  const rk = ranks(grid)
  for (const w of windowList(6, 6)) {
    if (rk.get(w.id) === 21 && grid[w.r - 1][w.c - 1] === 6) {
      count++
      found ??= { grid, w, rk }
    }
  }
}
console.log(`grids sampled: ${kept.length}`)
console.log(`rank-21 windows with top-left 6: ${count}`)
if (found) {
  const { grid, w } = found
  console.log('\ncounterexample grid:')
  for (const row of grid) console.log('  ' + row.join(' '))
  console.log(`\nwindow ${w.id} (top-left R${w.r}C${w.c}) has rank 21 and top-left digit ${grid[w.r - 1][w.c - 1]}`)
  console.log(`grid[5][5] = ${grid[5][5]}  (the structural predictor: digit 6 appears 5 times in the top-left 5x5 exactly when this is 6)`)
}

// How often does the predictor hold across the sample?
let bottomRight6 = 0
let rank21tl6grids = 0
for (const grid of kept) {
  const rk = ranks(grid)
  const has = windowList(6, 6).some(w => rk.get(w.id) === 21 && grid[w.r - 1][w.c - 1] === 6)
  if (has) rank21tl6grids++
  if (grid[5][5] === 6) bottomRight6++
}
console.log(`\ngrids with a rank-21 top-left-6 window: ${rank21tl6grids}`)
console.log(`grids with grid[5][5] === 6: ${bottomRight6}`)
