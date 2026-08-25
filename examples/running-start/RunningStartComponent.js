//! Running Start. An outside clue k on a line means: read inward, the first
//! strictly ascending run is k cells long. So line[0..k-1] strictly increase,
//! then (unless k is the whole line) line[k] drops below it.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

function runningStart (puzzle, line) {
  let count = 1
  for (let i = 1; i < line.length; i++) {
    if (puzzle.getValue(line[i]) > puzzle.getValue(line[i - 1])) count++
    else break
  }
  return count
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

// The set of clue values the line's live candidates can still realize.
//
// A clue value k means: cells line[0..k-1] strictly increase, then (if k < n)
// cell line[k] drops below line[k-1]. So k is possible only if both hold:
//   1. an increasing prefix of length k exists in the candidates, and
//   2. k == n, or a descent at position k is achievable.
//
// Walk the line tracking, for each prefix length, the smallest and largest end
// value an increasing prefix can reach:
//   minEnd[j] = smallest value at line[j] ending a length-(j+1) increasing run
//               (greedy smallest-above-previous — the longest-prefix walk),
//   maxEnd[j] = largest candidate at line[j] above that minimal previous end.
// A prefix of length k=j+1 exists exactly while minEnd stays defined. The
// descent at k needs some candidate of line[k] below an achievable end value,
// so below maxEnd[k-1]. Rejecting k only when even the largest reachable
// predecessor cannot be beaten keeps this sound — it never drops a true clue.
function feasibleClues (puzzle, line) {
  const n = line.length
  const feasible = new Set()
  let prevMin = -Infinity
  for (let j = 0; j < n; j++) {
    let mn = Infinity
    let mx = -Infinity
    for (const d of puzzle.getCandidates(line[j])) {
      if (d > prevMin) {
        if (d < mn) mn = d
        if (d > mx) mx = d
      }
    }
    if (mn === Infinity) break                 // no length-(j+1) prefix; no longer clue either
    prevMin = mn
    const k = j + 1
    if (k === n) {
      feasible.add(k)
    } else {
      let minNext = Infinity
      for (const d of puzzle.getCandidates(line[k])) if (d < minNext) minNext = d
      if (minNext < mx) feasible.add(k)         // a descent below the largest reachable end is possible
    }
  }
  return feasible
}

function* update (instance, puzzle) {
  const { clue, line } = instance
  const n = line.length
  const lo = helpers.digits.minDigit
  const hi = helpers.digits.maxDigit

  // ---- Reverse: keep only clue values the line can still realize ----
  // Candidate-aware, so filled cells anywhere on the line count. Stronger than a
  // min/max interval: it also drops interior values whose required descent is
  // impossible, not just values outside the reachable run-length range.
  if (!puzzle.hasValue(clue)) {
    const feasible = feasibleClues(puzzle, line)
    const bad = []
    for (let d = lo; d <= hi; d++) if (!feasible.has(d)) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), clue)
  }

  // ---- Forward: the clue's minimum forces a guaranteed increasing prefix ----
  // Cells line[0..kmin-1] strictly increase for every feasible clue value, so
  // this run has length at least kmin. That justifies the same per-cell window
  // the pinned case used, driven by kmin: line[j] needs j cells below it and
  // kmin-1-j above it. Using kmin (the smallest feasible length) gives the
  // loosest ceiling, so a value it drops is impossible for every feasible clue.
  // Stronger than the neighbour-only `less` chain, which only looks one step.
  const kmin = Math.min(...Array.from(puzzle.getCandidates(clue)))
  for (let j = 0; j < kmin && j < n; j++) {
    if (j >= 1) yield* less(puzzle, line[j - 1], line[j])
    const floor = lo + j
    const ceil = hi - (kmin - 1 - j)
    const bad = []
    for (let d = lo; d <= hi; d++) if (d < floor || d > ceil) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), line[j])
  }

  // ---- Forward: clue pinned -> the descent below the prefix's last cell ----
  if (puzzle.hasValue(clue)) {
    const k = puzzle.getValue(clue)      // k === kmin here, so the window above already ran
    if (k < n) yield* less(puzzle, line[k], line[k - 1])
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === runningStart(puzzle, line)
}
