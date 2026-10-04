// The 4x4 left side the side hit matching tests share.
//
// Four rows, each clued 1, so the four clues host the four positions between
// them, one line each. Position i is live on line L while digit i + 1 is still
// a candidate at line L's cell i. Position 0 is live on lines 0 and 1,
// position 1 on lines 1 and 2, position 2 on lines 2 and 3, and position 3 on
// line 3 alone. So the assignment of positions to lines has exactly one
// answer: line 3 takes position 3, which leaves position 2 to line 2, position
// 1 to line 1 and position 0 to line 0. Every cell on that diagonal is pinned
// to its target, and every other live edge dies.
//
// Row r's cell in column c drops digit c + 1 exactly where that shape wants
// the edge dead. Every column still shows all of 1..4, which is the fact that
// makes position c the home of digit c + 1 exactly once.

export const CLUES = [400, 401, 402, 403]
export const cell = (r, c) => r * 4 + c
export const LINES = [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => cell(r, c)))
export const CANDS = [
  [[1, 2, 3, 4], [1, 3, 4], [1, 2, 4], [1, 2, 3]],
  [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 4], [1, 2, 3]],
  [[2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3]],
  [[2, 3, 4], [1, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]]
]
// The grid those candidates admit: row r is a permutation of 1..4, each column
// too, and every line hits exactly once. So the truth really does complete this
// state, which is what makes a lost candidate a violation.
export const TRUTH = [[1, 3, 4, 2], [4, 2, 1, 3], [2, 4, 3, 1], [3, 1, 2, 4]]
export const HOUSES = [...LINES, ...[0, 1, 2, 3].map(c => LINES.map(line => line[c]))]
