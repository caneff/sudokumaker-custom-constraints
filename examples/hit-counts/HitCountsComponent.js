/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
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

// Line kinds, ordered (docs/line-contract.md): a rule that needs one kind also
// holds on every kind above it. The count bounds below are sound on a bare
// line; the no-n-1 rule needs a full house whose digit set is {1..n}.
const BARE = 0
const HOUSE = 1
const FULL_HOUSE = 2

// The line's kind, asked at solve time and re-tested until it settles. Two
// reasons it cannot be asked once: main code runs before the built-in
// row/column houses are registered and would read every line as bare (gotcha
// 6), and a hit-counts board runs minDigit 0 for its clue ring with a cage that
// takes 0 off the inner grid during solving, so the line's digit set only
// settles after the first update. Query the line alone -- a ring cell in the
// list flips getCellsCanHaveRepeats to true.
// `instance.oneToN` rides along: the union of the line's live candidates is
// exactly {1..n}, the extra fact the no-n-1 rule needs. That is the answer the
// early return reads, not the kind: a line of nine cells holding {0..8} counts
// as a full house while its digit set is still wrong, and caching on the kind
// there would hold the gate shut for good once the cage removed the 0. A house
// never repeats again and a shrinking union never regains a digit, so once
// `oneToN` is true nothing needs asking again.
function lineKind (instance, puzzle) {
  if (instance.oneToN) return FULL_HOUSE
  const line = instance.line
  if (puzzle.getCellsCanHaveRepeats(line)) { instance.kind = BARE; return BARE }
  let mask = 0
  for (const c of line) mask |= puzzle.getCandidatesBitMask(c)
  let live = 0
  for (let m = mask; m; m &= m - 1) live++
  instance.oneToN = mask === (1 << (line.length + 1)) - 2 // bits 1..n set, bit 0 clear
  instance.kind = live === line.length ? FULL_HOUSE : HOUSE
  return instance.kind
}

function fullHouseOfOneToN (instance, puzzle) {
  return lineKind(instance, puzzle) === FULL_HOUSE && instance.oneToN
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

// A line that holds 1..n once each can never have exactly n - 1 hits: fix n - 1
// cells on their target and the last value has only its home left, forcing an
// nth hit. So n - 1 is never a legal clue there. This bites on a hidden clue and
// flows through to the side-sum and pair via the shared cell.
function * noNMinusOne (instance, puzzle) {
  const n = instance.line.length
  if (n < 2 || !fullHouseOfOneToN(instance, puzzle)) return
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

  // Every free cell is needed as a hit: pin each to its target.
  if (cmin - forced >= free.length && free.length > 0) {
    for (const i of free) {
      const drop = Array.from(puzzle.getCandidates(line[i])).filter(d => d !== i + 1)
      if (drop.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(drop), line[i])
    }
  }
}

// Take the n - 1 clue at load, when the line already proves itself a full house
// of {1..n}. While a cage has yet to remove the 0 the gate is shut here and
// `update` takes the clue on the pass that opens it.
function * initialize (instance, puzzle) {
  yield * noNMinusOne(instance, puzzle)
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (puzzle.hasValue(clue) && puzzle.getValue(clue) === line.length - 1 &&
      line.length >= 2 && fullHouseOfOneToN(instance, puzzle)) return false
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === hitCount(puzzle, line)
}
