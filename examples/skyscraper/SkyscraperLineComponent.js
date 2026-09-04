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
//!
//! The permutation is the whole premise, so `update` and `validate` both ask
//! the app for it at solve time: the line must be a house whose live
//! candidates union to exactly {1..length}. That one test carries
//! everything the DP assumes -- the peak digit is the line's length, no cell
//! holds 0, and no digit appears twice -- and none of it is inferred from the
//! board's minDigit or from the line's length.

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

// clueA reads `line` in order; clueB reads it reversed.
function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
}

//! Masks here put digit d on bit d-1, one bit below the app's, so every read
//! of an app mask shifts right and every write shifts left. A visible count j
//! rides in the same encoding as the clue value j+1, so a clue's candidate
//! mask doubles as a mask of visible counts. MAXN is the mask width: a longer
//! line stands the component down rather than wrap a shift.
//
// Bit d-1 also keeps a 16-cell line inside a Uint16Array. A DP layer is one
// entry per subset of the sub-peak digits, so the work per call doubles with
// the board size: 12 us at n=9 against 353 us at n=16 (2,000 calls of the
// soundness fuzz's random states). 16 is the mask width; sizes up to 10 are
// timed in the app (README, Timing): at 10x10 the DP proves the board unique
// in 0.1 s where no deduction at all times the solver out.
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

//! Forward sweep, run once from each end inward: which (subset, visible
//! count) states a prefix can reach. Laying digit b at position
//! popcount(subset) is a new maximum exactly when b tops every digit already
//! used, which is what `mask < b` tests.
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

//! Backward sweep: keep only the reachable states a peak and the far side can
//! still complete. `feas` arrives holding the near clue's mask at every subset
//! the join accepted; this walks it back to the empty subset and records, per
//! position, the digits that sit on a surviving path.
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
function prune (puzzle, line, Lc, Rc, peak) {
  const len = line.length
  const m = peak - 1 // the sub-peak digits 1..peak-1
  const s = dpFor(m)
  const peakBit = 1 << m
  const subMask = peakBit - 1
  const rev = i => len - 1 - i // cell i's position when the line is read right to left
  const cand = s.cand
  for (let i = 0; i < len; i++) {
    const c = puzzle.getCandidatesBitMask(line[i]) >> 1
    cand[i] = c
    s.sub[0][i] = c & subMask
    s.sub[1][rev(i)] = c & subMask
  }
  sweepForward(s, 0)
  sweepForward(s, 1)

  //! The join, over every peak position: prefix and suffix partition the
  //! sub-peak digits exactly, so a subset on the left pairs with its
  //! complement on the right. A position survives when it can still hold the
  //! peak and both sides reach it with a count their own clue allows.
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

//! The gate: the line is a house and its live candidates union to exactly
//! {1..length}, so it holds every digit 1..length once -- the full house the
//! DP needs. Until that proves out the component removes nothing.
// The gate is asked at solve time, because main code runs before the built-in
// row and column houses are registered (gotcha 6) and a board that starts its
// digits at 0 keeps a 0 on the line until something else takes it away. Query
// the line alone: a ring cell in the list flips getCellsCanHaveRepeats to true.
// The answer is never cached: the app shares one component object across every
// search node, so a gate latched open deep in a branch stays open after the
// backtrack to a parent state whose line has regained the digits that shut it
// (#336). Re-asking costs one pass over the line's masks.
function gateOpen (instance, puzzle) {
  const line = instance.line
  // The repeats answer is structural -- a house is registered once and a
  // backtrack cannot un-register it -- so it alone is cached.
  if (!instance.noRepeats) {
    if (puzzle.getCellsCanHaveRepeats(line)) return false
    instance.noRepeats = true
  }
  let mask = 0
  for (const c of line) mask |= puzzle.getCandidatesBitMask(c)
  return mask === (1 << (line.length + 1)) - 2 // bits 1..length set, bit 0 clear
}

function * update (instance, puzzle) {
  const { clueA, clueB, line } = instance
  const peak = line.length // the gate proves the line holds 1..length once each
  if (peak > MAXN || !gateOpen(instance, puzzle)) return
  const Lc = puzzle.getCandidatesBitMask(clueA) >> 1
  const Rc = puzzle.getCandidatesBitMask(clueB) >> 1
  if (Lc === 0 || Rc === 0) return // contradiction; the solver sees it on the clue
  const r = prune(puzzle, line, Lc, Rc, peak)
  // A clue with no surviving value means no arrangement satisfies the pair:
  // the branch is dead (this used to surface as an emptied clue cell).
  if (r.L === 0 || r.R === 0) {
    yield puzzle.stop(`no arrangement of heights satisfies both clues of ${instance.name}`, [clueA, clueB, ...line])
    return
  }
  const rmA = Lc & ~r.L
  const rmB = Rc & ~r.R
  //! Copy the line's removals out of the scratch buffers before yielding: a
  //! yield hands the solver control, and it may run another line's update,
  //! which reuses those buffers.
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
  // Judge only a line `update` gates in: the running max below starts at 0, so
  // a board whose digits start at 0 would read a leading 0 as no building.
  if (!gateOpen(instance, puzzle)) return true
  if (!puzzle.getCellsAreFilled([clueA, clueB, ...line])) return true
  return puzzle.getValue(clueA) === visibleCount(puzzle, line) &&
    puzzle.getValue(clueB) === visibleCount(puzzle, [...line].reverse())
}
