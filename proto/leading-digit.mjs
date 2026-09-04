// The leading-digit deduction: a quad-rank clue bounds its window's top-left
// digit, because the top-left is the most significant digit of the window's
// concatenated value.
//
// Derivation (n x n board, digits 1..n, W = (n-1)^2 windows):
//
// A window's rank is 1 + the number of windows strictly smaller. Every window
// whose top-left digit is below d is strictly smaller; every window above d is
// larger. So a window with top-left d has
//
//   rank = 1 + #{windows with TL < d} + #{same-TL windows strictly smaller}
//
// The W windows' top-left cells are exactly the (n-1)x(n-1) sub-board. In a
// latin square each digit appears once per row and column, so in that
// sub-board exactly one digit appears n-1 times and every other appears n-2
// (the digit whose last-column cell sits in the last row -- i.e. grid[n-1][n-1]
// -- is the one that keeps all n-1). Hence #{TL < d} is (n-2)(d-1) or one more,
// and the same-TL term runs 0..count-1. Both extremes are reachable, giving
//
//   rank of a top-left-d window in [ (n-2)(d-1) + 1 , (n-2)(d-1) + (n-1) ]
//
// Inverting it gives the allowed top-left digits for a clued rank. Ranges
// overlap at one rank per digit boundary, so most ranks pin the cell to a
// single digit and the rest cut it to two.

export const rankRangeForDigit = (n, d) => [(n - 2) * (d - 1) + 1, (n - 2) * (d - 1) + (n - 1)]

// The digits a top-left cell may still hold, given its window's clued rank.
// Empty means the rank is impossible on this board.
export function allowedTopLeft (n, rank) {
  const out = []
  for (let d = 1; d <= n; d++) {
    const [lo, hi] = rankRangeForDigit(n, d)
    if (rank >= lo && rank <= hi) out.push(d)
  }
  return out
}

// The clue's own validity: ranks outside 1..(n-1)^2 name no window.
export const rankInRange = (n, rank) => Number.isInteger(rank) && rank >= 1 && rank <= (n - 1) ** 2
