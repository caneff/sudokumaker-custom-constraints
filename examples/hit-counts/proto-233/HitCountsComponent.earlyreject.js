/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Hit Counts. An outside clue k on a line counts the "hits": read inward, a
//! cell is a hit when its digit equals its distance from the clue. So line[i]
//! (0-based) is a hit when line[i] === i + 1, and k is the number of hits. The
//! cells are independent, so k is a plain count of booleans; k can be 0. A line
//! is a permutation, so k is never n - 1: fixing n - 1 cells forces the nth.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

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

function * update (instance, puzzle) {
  const { clue, line } = instance
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

  // Every free cell is needed as a hit: pin each to its target.
  if (cmin - forced >= free.length && free.length > 0) {
    for (const i of free) {
      const drop = Array.from(puzzle.getCandidates(line[i])).filter(d => d !== i + 1)
      if (drop.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(drop), line[i])
    }
  }
}

// A line is a permutation, so it can never have exactly n - 1 hits: fix n - 1
// cells on their target and the last value has only its home left, forcing an
// nth hit. So n - 1 is never a legal clue. Drop it once at load; this bites on a
// hidden clue and flows through to the side-sum and pair via the shared cell.
function * initialize (instance, puzzle) {
  const n = instance.line.length
  if (n >= 2 && Array.from(puzzle.getCandidates(instance.clue)).includes(n - 1)) {
    yield puzzle.removeCandidateFromCell(n - 1, instance.clue)
  }
}

// Reject the moment the pinned clue leaves the window the line can still reach:
// the count ends up somewhere in [forced, possible], so a clue below forced or
// above possible is already impossible. update cannot say this — it skips the
// reverse rule once the clue is pinned — so the branch otherwise runs to a leaf.
// A full line has forced === possible === the hit count, so this also covers the
// leaf check it replaces.
function validate (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.hasValue(clue)) return true
  const k = puzzle.getValue(clue)
  if (k === line.length - 1) return false
  const { forced, possible } = scan(puzzle, line)
  return k >= forced && k <= possible
}
