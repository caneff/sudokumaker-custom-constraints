/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Skyscrapers, the running cap: ONE outside clue at ONE end of a drawn line.
//! The clue counts the visible buildings reading inward -- a building is
//! visible when it tops every building before it. This is the component the
//! local variant registers per drawn group (docs/line-contract.md), so it
//! assumes nothing about the line: digits may repeat, the line may be any
//! length, and there may be no clue at the far end at all.
//!
//! Everything it knows comes from one scan that reads each cell's smallest and
//! largest candidate and carries two running maxima along the line: the
//! smallest running max any completion can put before a cell, and the largest.
//! A cell is a FORCED visible when even its smallest candidate tops the largest
//! possible running max before it, and a POSSIBLE visible when its largest
//! candidate tops the smallest. The true line is one of the completions the
//! scan bounds, so its visible count sits between the two, which gives four
//! rules:
//!
//!   clue bounds    the clue is at least the forced count, at most the possible
//!   first-cell cap with a clue of k the visible heights strictly increase from
//!                  the first cell, so it is at most maxDigit - (k - 1)
//!   no more        once the forced count reaches the clue's largest value, no
//!                  other cell may become visible
//!   all must       once the possible count falls to the clue's smallest value,
//!                  every cell that can be visible has to be
//!
//! Soundness: each rule removes only digits that contradict a bound the true
//! line satisfies, and every bound is a relaxation -- the scan treats the cells
//! as independent, so its two running maxima bracket the true one. Nothing here
//! needs the line to be a house, a full house, or a board whose digits start
//! at 1.

// Ties, per docs/line-contract.md. false: a building tied with the tallest so
// far is hidden. true: it counts as visible. The author flips the constant in
// the segment; the rules text must say the same thing.
const ALLOW_TIES = false
// `d + TIE > max` reads "a building of height d is visible over a running max
// of `max`": strict when a tie is hidden, `>=` when a tie counts.
const TIE = ALLOW_TIES ? 1 : 0

// Digit and count masks are the app's: bit d means digit d. A count of j is a
// clue value, so it lives in the same encoding. 30 keeps every mask below the
// sign bit; a longer line stands the component down rather than wrap a shift.
const MAXLEN = 30

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// Scratch for one scan, reused across calls and instances: read it out before
// the first yield, because the solver may run another line between two yields.
let scan = null
function scanFor (len) {
  if (scan === null || scan.len < len) {
    scan = {
      len,
      cand: new Int32Array(len),
      lo: new Int32Array(len), // smallest running max any completion puts before cell i
      hi: new Int32Array(len), // largest running max any completion puts before cell i
      forced: new Uint8Array(len), // visible in every completion
      possible: new Uint8Array(len) // visible in some completion
    }
  }
  return scan
}

// The digits at or above `t`, as a mask. `t` at or below 0 means every digit.
function atLeast (t) {
  return t <= 0 ? -1 : ~((1 << t) - 1)
}

// The digits that are visible over a running max of `max`.
function visibleOver (max) {
  return atLeast(max - TIE + 1)
}

// One pass along the line. Returns null when a cell has no candidates left --
// the solver already sees that contradiction, and the bounds below would read
// it as a cell that is visible and impossible at once.
function scanLine (puzzle, line) {
  const len = line.length
  const s = scanFor(len)
  let runLo = -1 // no building before the first cell, so it is always visible
  let runHi = -1
  s.forcedCount = 0
  s.possibleCount = 0
  for (let i = 0; i < len; i++) {
    const c = puzzle.getCandidatesBitMask(line[i])
    if (c === 0) return null
    const mn = 31 - Math.clz32(c & -c)
    const mx = 31 - Math.clz32(c)
    s.cand[i] = c
    s.lo[i] = runLo
    s.hi[i] = runHi
    s.forced[i] = mn + TIE > runHi ? 1 : 0
    s.possible[i] = mx + TIE > runLo ? 1 : 0
    s.forcedCount += s.forced[i]
    s.possibleCount += s.possible[i]
    if (mn > runLo) runLo = mn
    if (mx > runHi) runHi = mx
  }
  return s
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  const len = line.length
  if (len === 0 || len > MAXLEN) return // a clue with no line, or too long to mask
  const s = scanLine(puzzle, line)
  if (s === null) return
  const clueCand = puzzle.getCandidatesBitMask(clue)
  // The clue counts visible buildings, so it lies between the forced count and
  // the possible count -- and never outside 1..len, which those two bracket.
  const inRange = ((1 << (s.possibleCount + 1)) - 1) & ~((1 << s.forcedCount) - 1)
  const keep = clueCand & inRange
  if (keep === 0) return // contradiction; the solver sees it on the clue cell
  const kLo = 31 - Math.clz32(keep & -keep)
  const kHi = 31 - Math.clz32(keep)

  // Collect every removal before yielding: the scratch above is shared, and a
  // yield hands the solver control, which may run another line's update.
  const pending = []
  const drop = (cell, mask) => { if (mask !== 0) pending.push(cell, mask) }

  if (!ALLOW_TIES) {
    // The visible buildings rise strictly from the first one, so a clue of k
    // leaves k - 1 taller storeys above the first cell.
    drop(line[0], s.cand[0] & atLeast(helpers.digits.maxDigit - kLo + 2))
  }
  if (s.forcedCount === kHi) {
    // No room for another visible building: every cell not already forced must
    // stay under the tallest run that can reach it.
    for (let i = 0; i < len; i++) {
      if (!s.forced[i]) drop(line[i], s.cand[i] & visibleOver(s.hi[i]))
    }
  }
  if (s.possibleCount === kLo) {
    // Every cell that can be visible has to be: none may drop under the
    // shortest run that can reach it.
    for (let i = 0; i < len; i++) {
      if (s.possible[i]) drop(line[i], s.cand[i] & ~visibleOver(s.lo[i]))
    }
  }

  const rmClue = clueCand & ~inRange
  if (rmClue !== 0) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(rmClue), clue)
  for (let i = 0; i < pending.length; i += 2) {
    yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(pending[i + 1]), pending[i])
  }
}

// Visible buildings reading `cells` in order: the running maxima, with a tie
// counted or not per ALLOW_TIES. The running max starts below every digit, so a
// board whose digits start at 0 reads the same as any other.
function visibleCount (puzzle, cells) {
  let count = 0
  let max = -1
  for (const cell of cells) {
    const v = puzzle.getValue(cell)
    if (v + TIE > max) count++
    if (v > max) max = v
  }
  return count
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (line.length === 0) return true
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === visibleCount(puzzle, line)
}
