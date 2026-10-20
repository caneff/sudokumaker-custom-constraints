// Squishdoku geometry forces 13 extra houses beyond the nine boxes (proved
// with CP-SAT: together they cover every pair of cells the rules force to
// differ). Telling the solver about them gives it hidden singles and
// eliminations it cannot find from rows, columns and boxes alone.
//   cross:   column and row through an inner box corner, 2 cells each way
//   bowtie:  an inner box corner plus the 2x2 blocks diagonally either side
//   central: row 4 and column 4 minus the four box-5 border cells beside r4c4
const W = 7
const id = (r, c) => r * W + c
const rc = (r, c) => `r${r + 1}c${c + 1}`
const block = (r, c) => [id(r, c), id(r, c + 1), id(r + 1, c), id(r + 1, c + 1)]
const house = (name, cells) => puzzle.addConstraintComponent(new HouseComponent(name, cells))

for (const R of [2, 4]) {
  for (const C of [2, 4]) {
    house(`cross at ${rc(R, C)}`, [
      ...[-2, -1, 0, 1, 2].map(d => id(R + d, C)),
      ...[-2, -1, 1, 2].map(d => id(R, C + d))
    ])
    house(`bowtie at ${rc(R, C)} (\\)`, [...block(R - 2, C - 2), id(R, C), ...block(R + 1, C + 1)])
    house(`bowtie at ${rc(R, C)} (/)`, [...block(R - 2, C + 1), id(R, C), ...block(R + 1, C - 2)])
  }
}
house('central cross', [0, 1, 3, 5, 6].map(r => id(r, 3)).concat([0, 1, 5, 6].map(c => id(3, c))))
