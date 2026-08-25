/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Skyscrapers with an interactive outside clue. An outside clue k on a line
//! means: read the line inward from the clue, and exactly k buildings are
//! visible. A building is visible when it is taller than every building before
//! it. The clue is a cell the solver fills, so this one component deduces the
//! clue from the line AND the line from the clue.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// Visible buildings reading the line in order: count the left-to-right maxima.
function visibleCount (puzzle, line) {
  let count = 0
  let max = 0
  for (const cell of line) {
    const v = puzzle.getValue(cell)
    if (v > max) { count++; max = v }
  }
  return count
}

//! State packs two small numbers: j = buildings visible so far, m = tallest so
//! far (the running max). A step reads the next cell's candidate d: d > m makes
//! a visible building (j+1, new max d); d < m hides behind the max (j, m). d ==
//! m cannot happen on a real line, so neither branch takes it.
const KEY = (j, m) => j * 32 + m

// Forward reachable states after each cell. F[i] is the Set of KEY(j, m) that
// the candidates for cells 0..i can reach. This ignores that the line's digits
// are all different, which only makes the sets larger, so every removal below
// stays sound: a true assignment is always one of these paths.
function forwardStates (puzzle, line) {
  const n = line.length
  const F = []
  let cur = new Set([KEY(0, 0)]) // before cell 0: nothing visible, max 0
  for (let i = 0; i < n; i++) {
    const next = new Set()
    const cands = Array.from(puzzle.getCandidates(line[i]))
    for (const key of cur) {
      const j = (key / 32) | 0
      const m = key % 32
      for (const d of cands) {
        if (d > m) next.add(KEY(j + 1, d))
        else if (d < m) next.add(KEY(j, m))
      }
    }
    F.push(next)
    cur = next
  }
  return F
}

// Backward feasibility over every (j, m) state. C[i] is the Set of states AFTER
// cell i from which the suffix cells i+1..n-1 can still finish with a total
// visible count in `accept`. Ranges are tiny (j, m <= number of digits).
function backwardStates (puzzle, line, accept, hi) {
  const n = line.length
  const C = new Array(n)
  const last = new Set()
  for (const j of accept) for (let m = 0; m <= hi; m++) last.add(KEY(j, m))
  C[n - 1] = last
  for (let i = n - 2; i >= 0; i--) {
    const cands = Array.from(puzzle.getCandidates(line[i + 1]))
    const cur = new Set()
    for (let j = 0; j <= n; j++) {
      for (let m = 0; m <= hi; m++) {
        for (const d of cands) {
          if (d > m) { if (C[i + 1].has(KEY(j + 1, d))) { cur.add(KEY(j, m)); break } } else if (d < m) { if (C[i + 1].has(KEY(j, m))) { cur.add(KEY(j, m)); break } }
        }
      }
    }
    C[i] = cur
  }
  return C
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  const n = line.length
  const hi = helpers.digits.maxDigit

  const F = forwardStates(puzzle, line)
  const terminal = F[n - 1]

  // counts the line can still realize
  const lineFeasible = new Set()
  for (const key of terminal) lineFeasible.add((key / 32) | 0)

  // ---- Reverse: keep only clue values the line can realize ----
  if (!puzzle.hasValue(clue)) {
    const bad = []
    for (const d of puzzle.getCandidates(clue)) if (!lineFeasible.has(d)) bad.push(d)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), clue)
  }

  // counts still open once the clue's own candidates are taken into account
  const accept = new Set()
  for (const d of puzzle.getCandidates(clue)) if (lineFeasible.has(d)) accept.add(d)
  if (accept.size === 0) return // contradiction; the solver sees it on the clue

  // ---- Forward: keep only line candidates on some accepted path ----
  const C = backwardStates(puzzle, line, accept, hi)
  for (let i = 0; i < n; i++) {
    const prev = i === 0 ? new Set([KEY(0, 0)]) : F[i - 1]
    const bad = []
    for (const d of puzzle.getCandidates(line[i])) {
      let ok = false
      for (const key of prev) {
        const j = (key / 32) | 0
        const m = key % 32
        if (d > m) { if (C[i].has(KEY(j + 1, d))) { ok = true; break } } else if (d < m) { if (C[i].has(KEY(j, m))) { ok = true; break } }
      }
      if (!ok) bad.push(d)
    }
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), line[i])
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === visibleCount(puzzle, line)
}
