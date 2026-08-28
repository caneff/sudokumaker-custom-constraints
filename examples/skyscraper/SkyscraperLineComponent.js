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
//! cells after p. Prefix and suffix are disjoint and together use every digit
//! below the peak exactly once, so each is a DP over SUBSETS of those digits
//! and the two join at every feasible peak position on complementary subsets.
//!
//! The DP state is (subset of sub-peak digits used, visible count). The subset
//! fixes both the prefix length (its popcount) and the running max (its highest
//! digit), so one 16-bit mask of visible counts per subset is the whole layer,
//! held in a reusable buffer indexed by subset. A forward sweep finds the
//! reachable states; a backward sweep keeps only those a peak and an accepted
//! pair of clues can still complete, and collects the surviving digits.
//!
//! Soundness: the true line is a permutation, so it has exactly one peak cell,
//! its prefix and suffix use complementary digit subsets, and its two clues are
//! the counts the split describes. Every step of the true line is therefore a
//! transition the DP takes, so each line digit and both clues sit on a kept
//! path and survive. Because the DP tracks the exact digit set, the sweep is a
//! decision procedure for the line: a value survives only if some full line
//! assignment consistent with the candidates and both clues uses it.

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

// clueA reads `line` in order; clueB reads it reversed.
function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
}

// Line masks use bit d-minDigit, so a 16-cell line still fits a Uint16Array.
// The app's masks use bit d, so every read of one shifts right by minDigit and
// every write shifts back. A clue holds a visible count, which runs 1..length
// whatever the board's digits are, so a clue mask shifts by one instead: bit j
// means "the clue value j+1", and a clue's candidate mask doubles as a count
// mask.
//
// A DP layer is one entry per subset of the sub-peak digits, so the work per
// call doubles with the board size: 12 us at n=9 against 353 us at n=16 (2,000
// calls of the soundness fuzz's random states). 16 is the mask width; sizes
// up to 10 are timed in the app (README, Timing): at 10x10 the DP proves the
// board unique in 0.1 s where no deduction at all times the solver out.
const MAXN = 16

// One entry per subset of the sub-peak digits, per direction: a bitmask of the
// visible counts that subset can be laid out with. The subset already fixes the
// prefix length (its popcount) and the running max (its highest digit), so the
// pair (subset, count) is the whole DP state.
let dp = null
function dpFor (m) {
  const size = 1 << m
  if (dp === null || dp.m !== m) {
    const pc = new Uint8Array(size)
    for (let i = 1; i < size; i++) pc[i] = pc[i >> 1] + (i & 1)
    dp = {
      m,
      size,
      pc,
      sub: [new Uint16Array(MAXN), new Uint16Array(MAXN)],
      keep: [new Uint16Array(MAXN), new Uint16Array(MAXN)],
      cand: new Uint16Array(MAXN),
      reach: [new Uint16Array(size), new Uint16Array(size)],
      feas: [new Uint16Array(size), new Uint16Array(size)]
    }
  }
  for (let d = 0; d < 2; d++) {
    dp.reach[d].fill(0)
    dp.feas[d].fill(0)
    dp.keep[d].fill(0)
  }
  return dp
}

// Forward sweep: which (subset, visible count) states a prefix can reach.
// Placing digit b at position popcount(subset) is a new maximum exactly when b
// tops every digit already used, i.e. when subset < b.
function sweepForward (s, d) {
  const { m, size, pc } = s
  const sub = s.sub[d]
  const out = s.reach[d]
  out[0] = 1
  for (let mask = 0; mask < size; mask++) {
    const c = out[mask]
    if (c === 0) continue
    const k = pc[mask]
    if (k >= m) continue
    let avail = sub[k] & ~mask
    while (avail !== 0) {
      const b = avail & -avail
      avail ^= b
      out[mask | b] |= mask < b ? c << 1 : c
    }
  }
}

// Backward sweep: intersect the reachable states with the ones a peak and the
// far side can still complete. `feas` starts holding the near clue's mask at
// every subset the join accepted; this walks it back to the empty subset and
// records, per position, the digits that sit on a surviving path.
function sweepBackward (s, d) {
  const { m, size, pc } = s
  const sub = s.sub[d]
  const reached = s.reach[d]
  const feas = s.feas[d]
  const keep = s.keep[d]
  for (let mask = size - 1; mask >= 0; mask--) {
    const c = reached[mask]
    if (c === 0) { feas[mask] = 0; continue }
    let f = feas[mask] & c
    const k = pc[mask]
    if (k < m) {
      let avail = sub[k] & ~mask
      while (avail !== 0) {
        const b = avail & -avail
        avail ^= b
        const nf = feas[mask | b]
        const back = mask < b ? nf >> 1 : nf
        const ok = back & c
        if (ok !== 0) { f |= ok; keep[k] |= b }
      }
    }
    feas[mask] = f
  }
}

// Reads the line's candidates, prunes, and returns the raw and surviving masks
// per cell plus the surviving clue masks. The returned arrays are scratch: read
// them before the next call.
function prune (puzzle, line, Lc, Rc, lo, peak) {
  const len = line.length
  const m = peak - lo // the sub-peak digits lo..peak-1
  const s = dpFor(m)
  const peakBit = 1 << m
  const subMask = peakBit - 1
  const rev = i => len - 1 - i // cell i's position when the line is read right to left
  const cand = s.cand
  for (let i = 0; i < len; i++) {
    const c = puzzle.getCandidatesBitMask(line[i]) >> lo
    cand[i] = c
    s.sub[0][i] = c & subMask
    s.sub[1][rev(i)] = c & subMask
  }
  sweepForward(s, 0)
  sweepForward(s, 1)

  // Join the two sides at every peak position. The prefix and the suffix
  // partition the sub-peak digits exactly, so a subset on the left pairs with
  // its complement on the right and the join is exact, not a count match.
  const R0 = s.reach[0]
  const R1 = s.reach[1]
  const F0 = s.feas[0]
  const F1 = s.feas[1]
  const pc = s.pc
  let keepL = 0
  let keepR = 0
  let peakPos = 0
  for (let mask = 0; mask < s.size; mask++) {
    const l = R0[mask] & Lc
    if (l === 0) continue
    const p = pc[mask]
    if ((cand[p] & peakBit) === 0) continue
    const comp = subMask & ~mask
    const r = R1[comp] & Rc
    if (r === 0) continue
    peakPos |= 1 << p
    keepL |= l
    keepR |= r
    F0[mask] |= Lc
    F1[comp] |= Rc
  }

  sweepBackward(s, 0)
  sweepBackward(s, 1)
  // A sub-peak digit survives on either side of the peak; the peak itself
  // survives where the join found a feasible position.
  const keep = s.keep[0]
  for (let i = 0; i < len; i++) {
    keep[i] |= s.keep[1][rev(i)] | ((peakPos >> i) & 1 ? peakBit : 0)
  }
  return { cand, keep, L: keepL, R: keepR }
}

function * update (instance, puzzle) {
  const { clueA, clueB, line } = instance
  const { minDigit: lo, maxDigit: peak } = helpers.digits
  // The peak argument needs a full house: every digit once, maxDigit included.
  // A line as long as maxDigit is not enough -- on a board starting at 0 the
  // digit count is one more than maxDigit.
  if (line.length !== peak - lo + 1 || line.length > MAXN) return
  // A clue holds a visible count, not a board digit, so its mask shifts by one
  // whatever minDigit is. A count the board's digits cannot spell is a count no
  // clue cell can hold, and the DP is right to drop it.
  const Lc = puzzle.getCandidatesBitMask(clueA) >> 1
  const Rc = puzzle.getCandidatesBitMask(clueB) >> 1
  if (Lc === 0 || Rc === 0) return // contradiction; the solver sees it on the clue
  const r = prune(puzzle, line, Lc, Rc, lo, peak)
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
    for (let i = 0; i < pending.length; i += 2) yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(pending[i + 1] << lo), pending[i])
  }
}

// Visible buildings reading `cells` in order: count the running maxima.
function visibleCount (puzzle, cells) {
  let count = 0
  let max = helpers.digits.minDigit - 1
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
