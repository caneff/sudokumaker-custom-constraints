/* eslint-disable no-unused-vars -- setParams/update/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Skyscrapers with interactive outside clues, one component per line, reading
//! BOTH end clues at once. A clue k on an end means: read the line inward from
//! that end, and exactly k buildings are visible (a building is visible when it
//! is taller than every building before it). Both clues are cells the solver
//! fills, so this component deduces the clues from the line and the line from
//! the clues.
//!
//! The line is a full house, so its tallest building is exactly maxDigit, at
//! one cell p (the peak). The left clue is 1 + the left-to-right maxima among
//! the cells before p; the right clue is 1 + the right-to-left maxima among the
//! cells after p. Prefix and suffix are disjoint, so each is a small
//! (count, running max) DP over digits below the peak, and the two join at
//! every feasible peak position.
//!
//! The DP layers are bitmasks: one 16-bit mask of possible running maxima per
//! (position, visible count), held in a reusable buffer, so a whole layer
//! transition is a handful of bit operations. A forward sweep finds the
//! reachable states; a backward sweep keeps only those a peak and an accepted
//! pair of clues can still complete, and collects the surviving digits.
//!
//! Soundness: the true line is a permutation, so it has exactly one peak cell
//! and its two clues are the counts the split describes. The DPs ignore that
//! digits inside a prefix or suffix are all different, which only makes the
//! reachable state sets supersets of the true path's states. So every true
//! value — each line digit and both clues — sits on a kept path and survives.

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

// clueA reads `line` in order; clueB reads it reversed.
function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
}

// Digit masks use bit d-1, so a 16-cell line still fits a Uint16Array. The
// app's masks use bit d, so every read of one shifts right and every write
// shifts left. A visible count j is stored in the same encoding: bit j means
// "the clue value j+1", so a clue's candidate mask doubles as a count mask.
const MAXN = 16

// Bits strictly above the lowest set bit of x: the running maxima a cell with
// candidate mask x can hide behind.
const higherThanMin = x => -(x & -x) << 1
// Bits strictly below the highest set bit of x.
const belowMax = x => ((1 << (32 - Math.clz32(x))) - 1) >> 1

// Every DP layer lives in one buffer, carved on the first line of a given
// length and zeroed once per call. Index [0] reads the line left to right
// (clueA's direction), index [1] right to left (clueB's).
const SCRATCH = new Uint16Array(4 * MAXN * (MAXN + 1) + 9 * MAXN)
let views = null

function scratchFor (len) {
  if (views === null || views.len !== len) {
    const w = len + 1 // one slot per visible count j = 0..len
    let at = 0
    const take = n => SCRATCH.subarray(at, (at += n))
    views = {
      len,
      w,
      reach: [take(len * w), take(len * w)], // states a prefix can reach
      feas: [take(len * w), take(len * w)], // ...that a peak can still complete
      sub: [take(len), take(len)], // sub-peak candidates, in reading order
      cnt: [take(len), take(len)], // reachable visible counts, bit j
      peak: [take(len), take(len)], // the peak may sit here (far clue accepts)
      keep: [take(len), take(len)], // surviving digits, in reading order
      cand: take(len) // raw candidates, left to right
    }
    views.all = SCRATCH.subarray(0, at)
  }
  views.all.fill(0)
  return views
}

// Forward sweep over direction `d`. reach[k * w + j] = the running maxima
// possible once positions 0..k are read with j buildings visible. Position 0
// always starts one.
function reach (s, d) {
  const { len, w } = s
  const v = s.sub[d]
  const out = s.reach[d]
  if (v[0] === 0) return
  out[1] = v[0]
  for (let k = 1; k < len; k++) {
    const cur = v[k]
    // A cell fixed to the peak has no sub-peak candidate, so no prefix path
    // runs past it and every later layer stays empty.
    if (cur === 0) return
    const htm = higherThanMin(cur)
    const row = k * w
    const prev = row - w
    let any = 0
    for (let j = 1; j <= k + 1; j++) {
      // Hidden: the running max carries over, and must beat the cell's
      // smallest candidate. Visible: the cell's digit becomes the new max,
      // and must beat the smallest max it follows.
      const s = (out[prev + j] & htm) | (cur & higherThanMin(out[prev + j - 1]))
      out[row + j] = s
      any |= s
    }
    if (any === 0) return
  }
}

// Backward sweep over direction `d`. Intersects the reachable states with the
// ones a later peak can still complete — `s.peak[d][p]` says the peak may sit
// at p with the far clue satisfied, and `clue` is the near clue's mask. Writes
// the digits that survive at each position into `s.keep[d]`.
function feasible (s, d, clue) {
  const { len, w } = s
  const v = s.sub[d]
  const reached = s.reach[d]
  const feas = s.feas[d]
  const peakAt = s.peak[d]
  const keep = s.keep[d]
  for (let k = len - 2; k >= 0; k--) {
    const row = k * w
    const next = row + w
    const cur = v[k + 1]
    let value = 0
    if (cur !== 0) {
      const htm = higherThanMin(cur)
      for (let j = 1; j <= len; j++) {
        const s = feas[next + j]
        if (s === 0) continue
        // Position k+1 hidden: same count, same running max.
        const hid = reached[row + j] & s & htm
        if (hid !== 0) {
          feas[row + j] |= hid
          value |= cur & belowMax(hid)
        }
        // Position k+1 visible: its digit is the new running max, so it must
        // be one of the state's maxima and beat the previous one.
        const vis = s & cur
        if (vis !== 0) {
          const prev = reached[row + j - 1]
          const ok = prev & belowMax(vis)
          if (ok !== 0) {
            feas[row + j - 1] |= ok
            value |= vis & higherThanMin(prev)
          }
        }
      }
    }
    keep[k + 1] = value
    // The peak may sit at k+1: then positions 0..k are the whole prefix, and
    // any reachable state whose count the near clue allows is complete.
    if (peakAt[k + 1] !== 0) {
      for (let j = 1; j <= len; j++) if ((clue >> j) & 1) feas[row + j] |= reached[row + j]
    }
  }
  keep[0] = feas[1] & v[0] // position 0 is visible, so its digit is the max
}

// Reads the line's candidates, prunes, and returns the raw and surviving masks
// per cell plus the surviving clue masks. The returned arrays are scratch: read
// them before the next call.
function prune (puzzle, line, Lc, Rc, peak) {
  const len = line.length
  const s = scratchFor(len)
  const w = s.w
  const peakBit = 1 << (peak - 1)
  const subMask = peakBit - 1
  const rev = i => len - 1 - i // cell i's position when the line is read right to left
  for (let i = 0; i < len; i++) {
    const m = puzzle.getCandidatesBitMask(line[i]) >> 1
    s.cand[i] = m
    s.sub[0][i] = m & subMask
    s.sub[1][rev(i)] = m & subMask
  }
  for (let d = 0; d < 2; d++) {
    reach(s, d)
    // Which visible counts a prefix ending at position k can have. Position
    // len-1 is never a prefix end (the peak has to follow it), so skip it.
    const r = s.reach[d]
    const cnt = s.cnt[d]
    for (let k = 0; k < len - 1; k++) {
      let c = 0
      for (let j = 1; j < len; j++) if (r[k * w + j] !== 0) c |= 1 << j
      cnt[k] = c
    }
  }

  // Join the two sides at every peak position: the prefix count must suit the
  // left clue and the suffix count the right clue.
  let keepL = 0
  let keepR = 0
  let peakPos = 0
  for (let p = 0; p < len; p++) {
    if ((s.cand[p] & peakBit) === 0) continue
    const left = (p === 0 ? 1 : s.cnt[0][p - 1]) & Lc
    const right = (p === len - 1 ? 1 : s.cnt[1][rev(p + 1)]) & Rc
    // Each side's sweep only needs the far side to accept; its own clue is
    // applied inside the sweep.
    if (right !== 0) s.peak[0][p] = 1
    if (left !== 0) s.peak[1][rev(p)] = 1
    if (left === 0 || right === 0) continue
    peakPos |= 1 << p
    keepL |= left
    keepR |= right
  }

  feasible(s, 0, Lc)
  feasible(s, 1, Rc)
  // A sub-peak digit survives on either side of the peak; the peak itself
  // survives where the join found a feasible position.
  for (let i = 0; i < len; i++) {
    s.keep[0][i] |= s.keep[1][rev(i)] | ((peakPos >> i) & 1 ? peakBit : 0)
  }
  return { cand: s.cand, keep: s.keep[0], L: keepL, R: keepR }
}

function * update (instance, puzzle) {
  const { clueA, clueB, line } = instance
  const peak = helpers.digits.maxDigit
  // The peak argument needs a full house: maxDigit present exactly once.
  if (line.length !== peak || peak > MAXN) return
  const Lc = puzzle.getCandidatesBitMask(clueA) >> 1
  const Rc = puzzle.getCandidatesBitMask(clueB) >> 1
  if (Lc === 0 || Rc === 0) return // contradiction; the solver sees it on the clue
  const r = prune(puzzle, line, Lc, Rc, peak)
  const rmA = Lc & ~r.L
  const rmB = Rc & ~r.R
  // Copy the line's removals out of the scratch buffer before yielding: the
  // solver may run another line's update between two of our yields.
  let pending = null
  for (let i = 0; i < line.length; i++) {
    const rm = r.cand[i] & ~r.keep[i]
    if (rm !== 0) {
      if (pending === null) pending = []
      pending.push(line[i], rm)
    }
  }
  if (rmA !== 0) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(rmA << 1), clueA)
  if (rmB !== 0) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(rmB << 1), clueB)
  if (pending !== null) {
    for (let i = 0; i < pending.length; i += 2) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(pending[i + 1] << 1), pending[i])
  }
}

// Visible buildings reading `cells` in order: count the running maxima.
function visibleCount (puzzle, cells) {
  let count = 0
  let max = 0
  for (const cell of cells) {
    const v = puzzle.getValue(cell)
    if (v > max) { count++; max = v }
  }
  return count
}

function validate (instance, puzzle) {
  const { clueA, clueB, line } = instance
  if (!puzzle.getCellsAreFilled([clueA, clueB, ...line])) return true
  return puzzle.getValue(clueA) === visibleCount(puzzle, line) &&
    puzzle.getValue(clueB) === visibleCount(puzzle, [...line].reverse())
}
