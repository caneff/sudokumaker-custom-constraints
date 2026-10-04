/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Skyscrapers, ONE outside clue at ONE end of a drawn line. The clue counts
//! the visible buildings reading inward -- a building is visible when it tops
//! every building before it. One instance runs on one drawn group, and it
//! assumes nothing about that group: digits may repeat along it, it may be any
//! length, and there may be no clue at its far end at all.
//!
//! A DP over (position, tallest so far, visible count) decides the line. The
//! tallest so far and the count are all a prefix leaves behind -- what a cell
//! may hold depends on the prefix through nothing else -- so those two, with
//! the position, are the whole state. A forward sweep finds the reachable
//! states; a backward sweep, seeded with the clue's own candidates at the far
//! end, finds the states a completion can still finish from; a digit survives
//! where the two meet. One 32-bit mask of visible counts per (position,
//! tallest) is a whole layer.
//!
//! Soundness: the true line is one of the fills the sweeps enumerate, so every
//! true digit and the true clue sit on a kept path. Because the state is exact
//! for a line whose cells are tied to nothing but their own candidates, the
//! sweep is a DECISION PROCEDURE for a drawn line: a value survives only if
//! some fill consistent with the candidates and the clue uses it. Nothing here
//! needs the line to be a house, a full house, or a board whose digits start
//! at 1, so it runs on every line kind with no gate.

//! What a tie means, since a line may repeat a digit. false: a building the
//! same height as the tallest so far is hidden. true: it counts as visible.
//! An author flips it here, and the puzzle's rules text must say the same
//! thing it says.
const ALLOW_TIES = false
const TIE = ALLOW_TIES ? 1 : 0

//! Digit and count masks are the app's: bit d means digit d. A count of j is a
//! clue value, so it lives in the same encoding and a clue's candidate mask
//! doubles as a mask of visible counts.
// The widest shift is `1 << count` for a count up to the line length, so a cap
// of 24 keeps every mask inside a 32-bit int; a longer line, or a board with
// more digits, stands the component down rather than wrap a shift.
const MAXLEN = 24
// A DP layer holds one count mask per value of the tallest so far: the digits
// maxDigit - minDigit + 1 of them, plus "nothing built yet".
const MAXTALL = MAXLEN + 2
const CAP = (MAXLEN + 1) * MAXTALL

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// Scratch for one line, reused across calls and instances: read the removals
// out before the first yield, because the solver may run another line between
// two yields.
let scratch = null
function scratchFor () {
  if (scratch === null) {
    scratch = {
      fwd: new Int32Array(CAP),
      bwd: new Int32Array(CAP),
      cand: new Int32Array(MAXLEN),
      keep: new Int32Array(MAXLEN)
    }
  }
  return scratch
}

function forwardSweep (fwd, cand, len, tallest, minDigit) {
  fwd[0] = 1
  for (let i = 0; i < len; i++) {
    const base = i * tallest
    const next = base + tallest
    for (let t = 0; t < tallest; t++) {
      const counts = fwd[base + t]
      if (counts === 0) continue
      const max = t + minDigit - 1
      let avail = cand[i]
      while (avail !== 0) {
        const bit = avail & -avail
        avail ^= bit
        const d = 31 - Math.clz32(bit)
        const nt = d - minDigit + 1
        fwd[next + (nt > t ? nt : t)] |= d + TIE > max ? counts << 1 : counts
      }
    }
  }
}

//! Backward sweep from the far end, seeded with the clue's own candidates --
//! the counts a finished line may show. `bwd[i][t]` holds the counts a prefix
//! may already have used; a digit is kept at cell i where some reachable
//! state there leads into a count the rest of the line can finish.
function backwardSweep (fwd, bwd, cand, keep, len, tallest, minDigit, clueCand) {
  const last = len * tallest
  for (let t = 0; t < tallest; t++) bwd[last + t] = clueCand
  for (let i = len - 1; i >= 0; i--) {
    const base = i * tallest
    const next = base + tallest
    let kept = 0
    for (let t = 0; t < tallest; t++) {
      const counts = fwd[base + t]
      if (counts === 0) continue
      const max = t + minDigit - 1
      let feasible = 0
      let avail = cand[i]
      while (avail !== 0) {
        const bit = avail & -avail
        avail ^= bit
        const d = 31 - Math.clz32(bit)
        const nt = d - minDigit + 1
        const ahead = bwd[next + (nt > t ? nt : t)]
        const back = d + TIE > max ? ahead >> 1 : ahead
        feasible |= back
        if ((back & counts) !== 0) kept |= bit
      }
      bwd[base + t] = feasible
    }
    keep[i] = kept
  }
}

function collectRemovals (clue, line, len, clueDrop, cand, keep) {
  let pending = null
  if (clueDrop !== 0) pending = [clue, clueDrop]
  for (let i = 0; i < len; i++) {
    const mask = cand[i] & ~keep[i]
    if (mask === 0) continue
    if (pending === null) pending = []
    pending.push(line[i], mask)
  }
  return pending
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  const len = line.length
  const { minDigit, maxDigit } = helpers.digits
  if (len === 0 || len > MAXLEN || maxDigit > MAXLEN) return
  const tallest = maxDigit - minDigit + 2
  const clueCand = puzzle.getCandidatesBitMask(clue)
  if (clueCand === 0) return
  const { fwd, bwd, cand, keep } = scratchFor()
  const layers = (len + 1) * tallest
  fwd.fill(0, 0, layers)
  bwd.fill(0, 0, layers)
  // Only digits the board can hold drive the DP; a candidate outside that
  // range is left where it is rather than read as a building.
  const inRange = (-1 << minDigit) & ~(-2 << maxDigit)
  for (let i = 0; i < len; i++) {
    const c = puzzle.getCandidatesBitMask(line[i]) & inRange
    if (c === 0) return
    cand[i] = c
  }

  forwardSweep(fwd, cand, len, tallest, minDigit)

  const last = len * tallest
  backwardSweep(fwd, bwd, cand, keep, len, tallest, minDigit, clueCand)

  let reached = 0
  for (let t = 0; t < tallest; t++) reached |= fwd[last + t]
  if ((clueCand & reached) === 0) {
    yield puzzle.stop(`no arrangement of the line shows the count ${instance.name} asks for`, [clue, ...line])
    return
  }
  const pending = collectRemovals(clue, line, len, clueCand & ~reached, cand, keep)
  if (pending !== null) {
    for (let i = 0; i < pending.length; i += 2) {
      yield puzzle.removeCandidatesFromCell(pending[i + 1], pending[i])
    }
  }
}

// The running max starts below every digit, so a board whose digits start at
// 0 reads the same as any other.
function visibleCountTies (puzzle, cells) {
  let count = 0
  let max = -1
  for (let i = 0; i < cells.length; i++) {
    const v = puzzle.getValue(cells[i])
    if (v + TIE > max) count++
    if (v > max) max = v
  }
  return count
}

function validate (instance, puzzle) {
  const { clue, line } = instance
  if (line.length === 0) return true
  if (!puzzle.getCellsAreFilled([clue, ...line])) return true
  return puzzle.getValue(clue) === visibleCountTies(puzzle, line)
}
