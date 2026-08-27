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

// State packs two small numbers: j = buildings visible so far, m = tallest so
// far. Digits stay below the peak, so m < maxDigit < 32.
const KEY = (j, m) => j * 32 + m
const J = key => (key / 32) | 0
const M = key => key % 32

// Read digit d from state key: d > m is a new visible building, d < m hides.
// d === m cannot happen on a real line, so no state follows it.
function step (key, d) {
  const m = M(key)
  if (d > m) return KEY(J(key) + 1, d)
  if (d < m) return key
  return -1
}

// Reachable states after reading cells in `order`, one Set per cell, from the
// empty state (0, 0). Only digits below the peak take part.
function reach (cands, order, peak) {
  const out = []
  let cur = new Set([KEY(0, 0)])
  for (const i of order) {
    const next = new Set()
    for (const key of cur) for (const d of cands[i]) if (d < peak) { const s = step(key, d); if (s >= 0) next.add(s) }
    out[i] = next
    cur = next
  }
  return out
}

// Pure: per-cell candidate Sets `cands` (left to right), clue Sets `Lc` and
// `Rc`; returns the kept candidates for every cell and both clues.
function prune (cands, Lc, Rc, peak) {
  const len = cands.length
  const empty = new Set([KEY(0, 0)])
  // F[i]: prefix states after cells 0..i. G[i]: suffix states after cells len-1..i.
  const F = reach(cands, [...cands.keys()], peak)
  const G = reach(cands, [...cands.keys()].reverse(), peak)
  const before = i => (i < 0 ? empty : F[i]) // states left of cell i + 1
  const after = i => (i >= len ? empty : G[i]) // states right of cell i - 1
  const accepts = (states, clue) => { for (const key of states) if (clue.has(J(key) + 1)) return true; return false }

  // Every state, for the backward feasibility sweeps below.
  const ALL = []
  for (let j = 0; j <= len; j++) for (let m = 0; m < peak; m++) ALL.push(KEY(j, m))

  // Which peak positions still work, and which clue values they realize.
  const peakOK = new Array(len).fill(false)
  const keepL = new Set()
  const keepR = new Set()
  for (let p = 0; p < len; p++) {
    if (!cands[p].has(peak)) continue
    const ls = []
    for (const key of before(p - 1)) if (Lc.has(J(key) + 1)) ls.push(J(key) + 1)
    const rs = []
    for (const key of after(p + 1)) if (Rc.has(J(key) + 1)) rs.push(J(key) + 1)
    if (ls.length === 0 || rs.length === 0) continue
    peakOK[p] = true
    for (const v of ls) keepL.add(v)
    for (const v of rs) keepR.add(v)
  }

  // OKF[i]: prefix states after cell i from which cells i+1.. can still place the
  // peak and finish with accepted clues. Cell i+1 may be the peak (its prefix
  // count must suit Lc and the suffix past it must suit Rc), or a sub-peak digit
  // leading to a good state after cell i+1.
  const OKF = []
  for (let i = len - 2; i >= 0; i--) {
    const set = new Set()
    const peakNext = cands[i + 1].has(peak) && accepts(after(i + 2), Rc)
    for (const key of ALL) {
      if (peakNext && Lc.has(J(key) + 1)) { set.add(key); continue }
      if (i + 1 < len - 1) for (const d of cands[i + 1]) { if (d >= peak) continue; const s = step(key, d); if (s >= 0 && OKF[i + 1].has(s)) { set.add(key); break } }
    }
    OKF[i] = set
  }
  // OKG[i]: suffix states after cell i (read from the right) from which cells
  // i-1.. can still place the peak and finish. Mirror of OKF.
  const OKG = []
  for (let i = 1; i < len; i++) {
    const set = new Set()
    const peakNext = cands[i - 1].has(peak) && accepts(before(i - 2), Lc)
    for (const key of ALL) {
      if (peakNext && Rc.has(J(key) + 1)) { set.add(key); continue }
      if (i - 1 > 0) for (const d of cands[i - 1]) { if (d >= peak) continue; const s = step(key, d); if (s >= 0 && OKG[i - 1].has(s)) { set.add(key); break } }
    }
    OKG[i] = set
  }

  // A sub-peak digit at cell i survives when it extends some prefix state into a
  // good OKF state (cell is left of the peak) or some suffix state into a good
  // OKG state (right of the peak).
  const cells = []
  for (let i = 0; i < len; i++) {
    const keep = new Set()
    for (const d of cands[i]) {
      if (d === peak) { if (peakOK[i]) keep.add(d); continue }
      if (d > peak) continue
      let ok = false
      if (i < len - 1) for (const key of before(i - 1)) { const s = step(key, d); if (s >= 0 && OKF[i].has(s)) { ok = true; break } }
      if (!ok && i > 0) for (const key of after(i + 1)) { const s = step(key, d); if (s >= 0 && OKG[i].has(s)) { ok = true; break } }
      if (ok) keep.add(d)
    }
    cells.push(keep)
  }
  return { cells, L: keepL, R: keepR }
}

function * update (instance, puzzle) {
  const { clueA, clueB, line } = instance
  // The peak argument needs a full house: maxDigit present exactly once.
  if (line.length !== helpers.digits.maxDigit) return
  const cands = line.map(c => new Set(puzzle.getCandidates(c)))
  const Lc = new Set(puzzle.getCandidates(clueA))
  const Rc = new Set(puzzle.getCandidates(clueB))
  if (Lc.size === 0 || Rc.size === 0) return // contradiction; the solver sees it on the clue
  const r = prune(cands, Lc, Rc, helpers.digits.maxDigit)
  const rmA = [...Lc].filter(d => !r.L.has(d))
  if (rmA.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmA), clueA)
  const rmB = [...Rc].filter(d => !r.R.has(d))
  if (rmB.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rmB), clueB)
  for (let i = 0; i < line.length; i++) {
    const rm = [...cands[i]].filter(d => !r.cells[i].has(d))
    if (rm.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(rm), line[i])
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
