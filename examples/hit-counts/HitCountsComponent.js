/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Hit Counts. An outside clue k on a line counts the "hits": read inward, a
//! cell is a hit when its digit equals its distance from the clue. So line[i]
//! (0-based) is a hit when line[i] === i + 1, and k is the number of hits. The
//! cells are independent, so k is a plain count of booleans; k can be 0. A line
//! that holds 1..n once each can never have n - 1 hits: fixing n - 1 cells
//! forces the nth.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// The line's kind: lineKind(instance, puzzle, cells). The count bounds below
// are sound on a bare line; the no-n-1 rule needs a full house whose digit set
// is {1..n}, which is lineKind's `oneToN`.
// The repeats answer is latched both ways, since it is geometry fixed once
// `update` first runs. The solver can retire a filled built-in house for the
// rest of a branch, which can only weaken a latched answer, never make a
// removal unsound.
// #include ../_shared/line-kind.js

function hitCount (puzzle, line) {
  let count = 0
  for (let i = 0; i < line.length; i++) {
    if (puzzle.getValue(line[i]) === i + 1) count++
  }
  return count
}

// Read each cell once. A cell "can hit" while its target digit i+1 is still a
// candidate; it is a "forced hit" once it is pinned to that target. So the true
// number of hits is at least the forced count and at most the possible count.
function scan (puzzle, line) {
  let forced = 0 // cells pinned to their target: a hit no matter what
  let possible = 0 // cells whose target is still a candidate
  const free = [] // can-hit cells not yet forced: their line indices
  for (let i = 0; i < line.length; i++) {
    const target = i + 1
    const cands = Array.from(puzzle.getCandidates(line[i]))
    if (!cands.includes(target)) continue // this cell can never hit
    possible++
    if (cands.length === 1) forced++ // pinned to the target
    else free.push(i)
  }
  return { forced, possible, free }
}

// A line that holds 1..n once each can never have exactly n - 1 hits: fix n - 1
// cells on their target and the last value has only its home left, forcing an
// nth hit. So n - 1 is never a legal clue there. This bites on a hidden clue and
// flows through to the side-sum and pair via the shared cell.
function * noNMinusOne (instance, puzzle) {
  const n = instance.line.length
  if (n < 2 || !lineKind(instance, puzzle, instance.line).oneToN) return
  if (Array.from(puzzle.getCandidates(instance.clue)).includes(n - 1)) {
    yield puzzle.removeCandidateFromCell(n - 1, instance.clue)
  }
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  yield * noNMinusOne(instance, puzzle)
  const { forced, possible, free } = scan(puzzle, line)

  // ---- Reverse: the clue is the hit count, so it lies in [forced, possible] ----
  if (!puzzle.hasValue(clue)) {
    const bad = Array.from(puzzle.getCandidates(clue)).filter(d => d < forced || d > possible)
    if (bad.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bad), clue)
  }

  // ---- Forward: the clue's range bounds how many free cells may hit ----
  const cc = Array.from(puzzle.getCandidates(clue))
  const cmin = Math.min(...cc)
  const cmax = Math.max(...cc)

  // No more hits allowed: every free cell must miss, so drop its target.
  if (cmax - forced <= 0) {
    for (const i of free) yield puzzle.removeCandidateFromCell(i + 1, line[i])
  }

  // Every free cell is needed as a hit: pin each to its target. A free cell
  // still holds some other digit, so each pin removes something.
  if (cmin - forced >= free.length && free.length > 0) {
    for (const i of free) yield puzzle.filterCandidatesInCell(1 << (i + 1), line[i])
  }
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (puzzle.hasValue(clue) && puzzle.getValue(clue) === line.length - 1 &&
      line.length >= 2 && lineKind(instance, puzzle, line).oneToN) return false
  if (!puzzle.getCellsAreFilled(instance.cells)) return true
  return puzzle.getValue(clue) === hitCount(puzzle, line)
}
