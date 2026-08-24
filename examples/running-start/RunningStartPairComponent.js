// Cross-constraint deduction for two Running Start clues on opposite ends of one
// line. The left clue A counts a strictly increasing run inward from the left;
// the right clue B counts one inward from the right. On the same line those are
// a strictly increasing prefix (cells 0..A-1) and a strictly increasing-inward
// suffix (cells n-1..n-B). Read in array order the suffix is strictly
// decreasing, so the two runs can share at most one cell — the peak. Hence
//     A + B <= n + 1.
// This couples the two clues: neither can exceed n + 1 minus the other's
// smallest remaining value. It fires whenever either clue's candidates shrink.
//
// When A + B is forced to exactly n + 1, the two runs meet at one shared peak
// and cover the whole line: it is strictly increasing up to the peak, then
// strictly decreasing. The peak is the line maximum. We then propagate both
// monotone runs, which pins the peak (a 9 on a full row) and tightens every
// cell — deductions no single-line component can reach.

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
  instance.n = line.length
}

// Arc-consistency for a strict "a < b" using live candidates.
function* less (puzzle, a, b) {
  const ca = Array.from(puzzle.getCandidates(a))
  const cb = Array.from(puzzle.getCandidates(b))
  const maxB = Math.max(...cb)
  const minA = Math.min(...ca)
  const rmA = ca.filter(d => d >= maxB)
  const rmB = cb.filter(d => d <= minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), a)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), b)
}

// Treat cells as one strictly increasing run of pinned length cells.length:
// cell j needs j cells below it and (k-1-j) above, so it sits in
// [lo+j, hi-(k-1-j)]. Also chain adjacent cells with `less`.
function* incRun (puzzle, cells) {
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const k = cells.length
  for (let j = 0; j < k; j++) {
    if (j >= 1) yield* less(puzzle, cells[j - 1], cells[j])
    const floor = lo + j
    const ceil = hi - (k - 1 - j)
    const bad = []
    for (let d = lo; d <= hi; d++) if (d < floor || d > ceil) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), cells[j])
  }
}

function* update (instance, puzzle) {
  const { clueA, clueB, line, n } = instance
  const cap = n + 1
  const ca = Array.from(puzzle.getCandidates(clueA))
  const cb = Array.from(puzzle.getCandidates(clueB))
  const minA = Math.min(...ca)
  const minB = Math.min(...cb)
  const rmA = ca.filter(d => d > cap - minB)
  const rmB = cb.filter(d => d > cap - minA)
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), clueA)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), clueB)

  // A + B <= cap always, and A >= minA, B >= minB. So minA + minB === cap forces
  // A = minA and B = minB (both pinned) with A + B = n + 1: the unimodal case.
  if (minA + minB === cap) {
    const a = minA                       // increasing prefix length; peak at index a-1
    const peak = a - 1
    yield* incRun(puzzle, line.slice(0, peak + 1))       // line[0..peak] strictly up
    yield* incRun(puzzle, line.slice(peak).reverse())    // line[peak..n-1] strictly down
  }
}
