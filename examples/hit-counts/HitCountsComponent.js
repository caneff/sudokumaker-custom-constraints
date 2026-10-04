/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Hit Counts. An outside clue k on a line counts the "hits": read inward, a
//! cell is a hit when its digit equals its distance from the clue, so line[i]
//! (0-based) is a hit when line[i] === i + 1. k can be 0.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// The count bounds are sound on a bare line; only the no-n-1 rule needs
// lineKind's `oneToN`.
// #include ../_shared/line-kind.js

function hitCount (puzzle, line) {
  let count = 0
  for (let i = 0; i < line.length; i++) {
    if (puzzle.getValue(line[i]) === i + 1) count++
  }
  return count
}

function scan (puzzle, line) {
  let forced = 0
  let possible = 0
  const free = []
  for (let i = 0; i < line.length; i++) {
    const target = i + 1
    const cands = Array.from(puzzle.getCandidates(line[i]))
    if (!cands.includes(target)) continue
    possible++
    if (cands.length === 1) forced++
    else free.push(i)
  }
  return { forced, possible, free }
}

// A line that holds 1..n once each can never have exactly n - 1 hits: fix n - 1
// cells on their target and the last value has only its home left, forcing an
// nth hit.
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

  if (!puzzle.hasValue(clue)) {
    let bad = 0
    for (const d of puzzle.getCandidates(clue)) if (d < forced || d > possible) bad |= 1 << d
    if (bad !== 0) yield puzzle.removeCandidatesFromCell(bad, clue)
  }

  const cc = Array.from(puzzle.getCandidates(clue))
  const cmin = Math.min(...cc)
  const cmax = Math.max(...cc)

  if (cmax - forced <= 0) {
    for (const i of free) yield puzzle.removeCandidateFromCell(i + 1, line[i])
  }

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
