/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Running Start. An outside clue k on a line means: read inward, the first
//! ascending run is k cells long. So line[0..k-1] ascend, then (unless k is
//! the whole line) line[k] breaks the run.
//!
//! Every rule here is sound on every line kind. The line's kind only decides
//! how hard each one may push: on a house two neighbours can never be equal,
//! so both the climb and the break tighten to strict comparisons there
//! (docs/line-contract.md).

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

// Is the line a house? Asked at solve time and re-tested until it settles: it
// cannot be asked once at register time, because main code runs before the
// built-in row/column houses exist and would read every line as bare (gotcha
// 6). Query the line alone -- a clue cell in the list flips
// getCellsCanHaveRepeats to true. A house never repeats again, so the true
// answer caches on the instance.
function isHouse (instance, puzzle) {
  if (instance.house) return true
  instance.house = !puzzle.getCellsCanHaveRepeats(instance.line)
  return instance.house
}

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

// Arc-consistency for "a < b" (strict) or "a <= b" (not strict) using live
// candidates.
function * below (puzzle, a, b, strict) {
  const ca = Array.from(puzzle.getCandidates(a))
  const cb = Array.from(puzzle.getCandidates(b))
  const maxB = Math.max(...cb)
  const minA = Math.min(...ca)
  const rmA = ca.filter(d => (strict ? d >= maxB : d > maxB))
  const rmB = cb.filter(d => (strict ? d <= minA : d < minA))
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), a)
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), b)
}

// The set of clue values the line's live candidates can still realize.
//
// A clue value k means: cells line[0..k-1] climb, then (if k < n) cell line[k]
// breaks the run. So k is possible only if both hold:
//   1. a climbing prefix of length k exists in the candidates, and
//   2. k == n, or a break at position k is achievable.
//
// Walk the line tracking, for each prefix length, the smallest and largest end
// value a climbing prefix can reach:
//   minEnd[j] = smallest value at line[j] ending a length-(j+1) climbing run
//               (greedy smallest-above-previous — the longest-prefix walk),
//   maxEnd[j] = largest candidate at line[j] that still climbs from that
//               minimal previous end.
// A prefix of length k=j+1 exists exactly while minEnd stays defined. The break
// at k needs some candidate of line[k] that fails to climb from an achievable
// end value, so from maxEnd[k-1]. Rejecting k only when even the largest
// reachable predecessor cannot be broken keeps this sound — it never drops a
// true clue.
function feasibleClues (puzzle, line, climbStrict, breakStrict) {
  const n = line.length
  const feasible = new Set()
  let prevMin = -Infinity
  for (let j = 0; j < n; j++) {
    let mn = Infinity
    let mx = -Infinity
    for (const d of puzzle.getCandidates(line[j])) {
      if (climbStrict ? d > prevMin : d >= prevMin) {
        if (d < mn) mn = d
        if (d > mx) mx = d
      }
    }
    if (mn === Infinity) break // no length-(j+1) prefix; no longer clue either
    prevMin = mn
    const k = j + 1
    if (k === n) {
      feasible.add(k)
    } else {
      let minNext = Infinity
      for (const d of puzzle.getCandidates(line[k])) if (d < minNext) minNext = d
      if (breakStrict ? minNext < mx : minNext <= mx) feasible.add(k)
    }
  }
  return feasible
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  const n = line.length
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit

  // How hard each half may push. The climb is `<` when a tie ends the run and
  // `<=` when a tie carries it on; the break is the negation, so it reads the
  // other way round. On a house that distinction vanishes -- no two cells hold
  // the same digit, so `<=` implies `<` -- and both comparisons go strict
  // whichever way ALLOW_TIES reads. On a drawn line that may repeat, only the
  // reading the flag names is sound. Recovering the strict break on a house is
  // not cosmetic: the shipped frame board solves 3.4x slower without it
  // (OPTIMIZATION_LOG.md).
  const house = isHouse(instance, puzzle)
  const climbStrict = !ALLOW_TIES || house
  const breakStrict = ALLOW_TIES || house

  // ---- Reverse: keep only clue values the line can still realize ----
  // Candidate-aware, so filled cells anywhere on the line count. Stronger than a
  // min/max interval: it also drops interior values whose required break is
  // impossible, not just values outside the reachable run-length range.
  if (!puzzle.hasValue(clue)) {
    const feasible = feasibleClues(puzzle, line, climbStrict, breakStrict)
    const bad = []
    for (let d = lo; d <= hi; d++) if (!feasible.has(d)) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), clue)
  }

  // ---- Forward: the clue's minimum forces a guaranteed climbing prefix ----
  // Cells line[0..kmin-1] climb for every feasible clue value, so this run has
  // length at least kmin. The neighbour chain follows on any line. The per-cell
  // window does not: it counts j cells strictly below line[j], which only holds
  // while the run climbs strictly. Where it does not, the whole prefix may be
  // one repeated digit and the window would cut digits the line needs.
  const kmin = Math.min(...Array.from(puzzle.getCandidates(clue)))
  for (let j = 0; j < kmin && j < n; j++) {
    if (j >= 1) yield * below(puzzle, line[j - 1], line[j], climbStrict)
    if (!climbStrict) continue
    // line[j] needs j cells below it and kmin-1-j above. Using kmin (the
    // smallest feasible length) gives the loosest ceiling, so a value it drops
    // is impossible for every feasible clue.
    const floor = lo + j
    const ceil = hi - (kmin - 1 - j)
    const bad = []
    for (let d = lo; d <= hi; d++) if (d < floor || d > ceil) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), line[j])
  }

  // ---- Forward: clue pinned -> the break after the prefix's last cell ----
  if (puzzle.hasValue(clue)) {
    const k = puzzle.getValue(clue) // k === kmin here, so the window above already ran
    if (k < n) yield * below(puzzle, line[k], line[k - 1], breakStrict)
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === runningStart(puzzle, line)
}
