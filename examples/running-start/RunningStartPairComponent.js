/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
// Two Running Start clues on opposite ends of one line: A counts the run
// inward from the left, B the run inward from the right. Read in array order
// the right run is strictly decreasing, so the two share at most one cell --
// the peak -- and A + B <= n + 1: neither clue can exceed n + 1 minus the
// other's smallest remaining value.
//
// When A + B is forced to exactly n + 1 the runs meet at one peak and cover
// the line: strictly up to the line maximum, then strictly down. Propagating
// both runs then pins the peak (a 9 on a full row) and tightens every cell --
// deductions no single-line component can reach.

// No ALLOW_TIES constant here, deliberately: the pair prunes only on a house,
// where two cells cannot be equal and both readings of the rule coincide. A
// copy of the constant would have to track RunningStartComponent's by hand,
// and a pair left on `false` beside a line set to `true` would enforce
// A + B <= n + 1 on a bare line, where a run of equal digits sits in both end
// runs at once and the cap does not hold. Nothing is lost: only
// main-global.js registers the pair (it needs both ends of a line, which only
// a full frame has), and every frame line is a house.

// #include ../_shared/line-kind.js

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
  instance.n = line.length
}

// #include ../_shared/below.js

// `cells` is one strictly increasing run of exactly k = cells.length: cell j
// needs j cells below it and k-1-j above.
function * incRun (puzzle, cells) {
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit
  const k = cells.length
  for (let j = 0; j < k; j++) {
    if (j >= 1) yield * below(puzzle, cells[j - 1], cells[j], true)
    const floor = lo + j
    const ceil = hi - (k - 1 - j)
    const bad = []
    for (let d = lo; d <= hi; d++) if (d < floor || d > ceil) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), cells[j])
  }
}

function * update (instance, puzzle) {
  const { clueA, clueB, line, n } = instance
  if (lineKind(instance, puzzle, instance.line).kind < HOUSE) return
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
    const a = minA
    const peak = a - 1
    yield * incRun(puzzle, line.slice(0, peak + 1))
    yield * incRun(puzzle, line.slice(peak).reverse())
  }
}

// The pair adds no rule of its own: each clue is checked by its own line
// component's validate. Accepting every state lets the solver retire the pair
// once its cells are all filled (getIsDone), which a component with no
// validate never is.
function validate (instance, puzzle) {
  return true
}
