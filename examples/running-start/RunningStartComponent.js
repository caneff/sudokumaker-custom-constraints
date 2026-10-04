/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Running Start. An outside clue k on a line means: read inward, the first
//! ascending run is k cells long. So line[0..k-1] ascend, then (unless k is
//! the whole line) line[k] breaks the run.
//!
//! Every rule here is sound on every line kind. The line's kind only decides
//! how hard each one may push: on a house two neighbours can never be equal,
//! so both the climb and the break tighten to strict comparisons there.

// Ties, per docs/line-contract.md. false: the run climbs strictly, so an equal
// neighbour ends it. true: an equal neighbour continues the run, and only a
// strict drop ends it. The author flips the constant in the segment; the rules
// text must say the same thing.
const ALLOW_TIES = false

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// #include ../_shared/line-kind.js

function runningStart (puzzle, line) {
  let count = 1
  for (let i = 1; i < line.length; i++) {
    const prev = puzzle.getValue(line[i - 1])
    const d = puzzle.getValue(line[i])
    if (ALLOW_TIES ? d >= prev : d > prev) count++
    else break
  }
  return count
}

// #include ../_shared/below.js

// The clue values the line's live candidates can still realize, as a mask
// (bit k set = clue k possible). Clue k needs a climbing prefix of length k
// and, if k < n, a break at line[k].
//
// Walk the line tracking, per prefix length, the smallest and largest end
// value a climbing prefix can reach: minEnd[j] (`mn`, greedy
// smallest-above-previous) and maxEnd[j] (`mx`, the largest candidate that
// still climbs from minEnd[j-1]). A prefix of length j+1 exists while minEnd
// stays defined. The break at k is tested against maxEnd[k-1], the largest
// reachable predecessor, so a true clue is never dropped.
//
// Bitmasks: -(1 << d) masks every digit >= d, (1 << d) - 1 every digit < d,
// m & -m isolates the lowest set bit, and 31 - clz32 reads a bit's position.
function feasibleClues (puzzle, line, climbStrict, breakStrict) {
  const n = line.length
  let feasible = 0
  let minClimb = 0
  for (let j = 0; j < n; j++) {
    const climb = puzzle.getCandidatesBitMask(line[j]) & -(1 << minClimb)
    if (!climb) break
    const mn = 31 - Math.clz32(climb & -climb)
    const mx = 31 - Math.clz32(climb)
    minClimb = climbStrict ? mn + 1 : mn
    const k = j + 1
    if (k === n) {
      feasible |= 1 << k
    } else {
      const next = puzzle.getCandidatesBitMask(line[k])
      if (next) {
        const minNext = 31 - Math.clz32(next & -next)
        if (breakStrict ? minNext < mx : minNext <= mx) feasible |= 1 << k
      }
    }
  }
  return feasible
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  const n = line.length
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit

  // On a house no two cells are equal, so `<=` implies `<` and both the climb
  // and the break go strict whatever ALLOW_TIES says; on a line that may repeat
  // only the flag's own reading is sound. The strict break on a house is not
  // cosmetic: the shipped frame board solves 3.4x slower without it
  // (OPTIMIZATION_LOG.md).
  const house = lineKind(instance, puzzle, instance.line).kind >= HOUSE
  const climbStrict = !ALLOW_TIES || house
  const breakStrict = ALLOW_TIES || house

  // Reverse: keep only clue values the line can still realize. Stronger than a
  // min/max interval: it also drops interior values whose required break is
  // impossible.
  if (!puzzle.hasValue(clue)) {
    const bad = puzzle.getCandidatesBitMask(clue) & ~feasibleClues(puzzle, line, climbStrict, breakStrict)
    if (bad) yield puzzle.removeCandidatesFromCell(bad, clue)
  }

  // Forward: cells line[0..kmin-1] climb for every feasible clue. The neighbour
  // chain holds on any line; the per-cell window counts j cells strictly below
  // line[j], so it holds only while the run climbs strictly -- otherwise the
  // prefix may be one repeated digit and the window would cut digits it needs.
  const clueM = puzzle.getCandidatesBitMask(clue)
  const kmin = 31 - Math.clz32(clueM & -clueM)
  for (let j = 0; j < kmin && j < n; j++) {
    if (j >= 1) yield * below(puzzle, line[j - 1], line[j], climbStrict)
    if (!climbStrict) continue
    // line[j] needs j cells below it and kmin-1-j above. Using kmin (the
    // smallest feasible length) gives the loosest ceiling, so a value it drops
    // is impossible for every feasible clue.
    const floor = lo + j
    const ceil = hi - (kmin - 1 - j)
    const bad = puzzle.getCandidatesBitMask(line[j]) & (((1 << floor) - 1) | -(1 << (ceil + 1)))
    if (bad) yield puzzle.removeCandidatesFromCell(bad, line[j])
  }

  if (puzzle.hasValue(clue)) {
    const k = puzzle.getValue(clue)
    // A 0 clue (a board whose digits start at 0) has no last cell; validate rejects it.
    if (k >= 1 && k < n) yield * below(puzzle, line[k], line[k - 1], breakStrict)
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === runningStart(puzzle, line)
}
