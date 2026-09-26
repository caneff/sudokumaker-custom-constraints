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

// The line's kind: lineKind(instance, puzzle, cells).
// The repeats answer is latched both ways, since it is geometry fixed once
// `update` first runs. The solver can retire a filled built-in house for the
// rest of a branch, which can only weaken a latched answer, never make a
// removal unsound.
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

// Arc-consistency for "a < b" / "a <= b": below(puzzle, a, b, strict).
// #include ../_shared/below.js

// The clue values the line's live candidates can still realize, as a mask
// (bit k set = clue k possible).
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
//
// Candidates are bitmasks: -(1 << d) masks every digit >= d, m & -m isolates
// the lowest set bit, and 31 - clz32 reads a bit's position.
function feasibleClues (puzzle, line, climbStrict, breakStrict) {
  const n = line.length
  let feasible = 0
  let minClimb = 0 // the smallest digit that climbs from the previous minEnd
  for (let j = 0; j < n; j++) {
    const climb = puzzle.getCandidatesBitMask(line[j]) & -(1 << minClimb)
    if (!climb) break // no length-(j+1) prefix; no longer clue either
    const mn = 31 - Math.clz32(climb & -climb)
    const mx = 31 - Math.clz32(climb)
    minClimb = climbStrict ? mn + 1 : mn
    const k = j + 1
    if (k === n) {
      feasible |= 1 << k
    } else {
      const next = puzzle.getCandidatesBitMask(line[k])
      const minNext = 31 - Math.clz32(next & -next)
      if (next && (breakStrict ? minNext < mx : minNext <= mx)) feasible |= 1 << k
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
  const house = lineKind(instance, puzzle, instance.line).kind >= HOUSE
  const climbStrict = !ALLOW_TIES || house
  const breakStrict = ALLOW_TIES || house

  // ---- Reverse: keep only clue values the line can still realize ----
  // Candidate-aware, so filled cells anywhere on the line count. Stronger than a
  // min/max interval: it also drops interior values whose required break is
  // impossible, not just values outside the reachable run-length range.
  if (!puzzle.hasValue(clue)) {
    const bad = puzzle.getCandidatesBitMask(clue) & ~feasibleClues(puzzle, line, climbStrict, breakStrict)
    if (bad) yield puzzle.removeCandidatesFromCell(bad, clue)
  }

  // ---- Forward: the clue's minimum forces a guaranteed climbing prefix ----
  // Cells line[0..kmin-1] climb for every feasible clue value, so this run has
  // length at least kmin. The neighbour chain follows on any line. The per-cell
  // window does not: it counts j cells strictly below line[j], which only holds
  // while the run climbs strictly. Where it does not, the whole prefix may be
  // one repeated digit and the window would cut digits the line needs.
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
    // Every digit below floor, plus every digit above ceil.
    const bad = puzzle.getCandidatesBitMask(line[j]) & (((1 << floor) - 1) | -(1 << (ceil + 1)))
    if (bad) yield puzzle.removeCandidatesFromCell(bad, line[j])
  }

  // ---- Forward: clue pinned -> the break after the prefix's last cell ----
  if (puzzle.hasValue(clue)) {
    const k = puzzle.getValue(clue) // k === kmin here, so the window above already ran
    // A 0 clue (a board whose digits start at 0) has no last cell; validate rejects it.
    if (k >= 1 && k < n) yield * below(puzzle, line[k], line[k - 1], breakStrict)
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === runningStart(puzzle, line)
}
