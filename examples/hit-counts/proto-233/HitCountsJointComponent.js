/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Joint hit counts (#246). One component for a whole line and both its clues.
//! Position j (0-based from clue A) hits for A when it holds digit j+1 and for B
//! when it holds digit n-j. So digit d can hit in only two places: position d-1
//! for A, position n-d for B. Reading hits as a matching between digits and
//! positions, the graph splits into four-cycles, each joining position j to its
//! mirror n-1-j, plus the centre alone when n is odd. Each mirrored pair is
//! independent, so the reachable (A, B) counts of the line are the convolution of
//! one small set per pair. On a house a pair can never give one A hit and one B
//! hit: both readings would put the same digit in both cells. A forward and a
//! backward sweep over those sets say which case each position can still take —
//! hit for A, hit for B, or neither — and the clue candidates that survive.

const CASE_L = 0
const CASE_R = 1
const CASE_M = 2

function getAffectedCells (clueA, clueB, line) {
  return [clueA, clueB, ...line]
}

function setParams (instance, clueA, clueB, line) {
  instance.clueA = clueA
  instance.clueB = clueB
  instance.line = line
  instance.n = line.length
  // Units: one per mirrored pair {j, n-1-j}, then the centre on its own (k = -1).
  const units = []
  const n = line.length
  for (let j = 0; j * 2 < n - 1; j++) units.push([j, n - 1 - j])
  if (n % 2 === 1) units.push([(n - 1) / 2, -1])
  instance.units = units
  instance.house = false
}

// The three cases a position can take, read off its candidate mask.
function caseBits (mask, j, n) {
  const lBit = 1 << (j + 1)
  const rBit = 1 << (n - j)
  let bits = 0
  if (mask & lBit) bits |= 1
  if (mask & rBit) bits |= 2
  if (mask & ~(lBit | rBit) & ~1) bits |= 4 // a candidate that is neither target
  return bits
}

// One unit's combinations, flat: caseJ, caseK, dA, dB per entry. k < 0 is the
// centre, whose single hit counts for both clues at once.
function unitCombos (cm, j, k, n, house) {
  const out = []
  if (k < 0) {
    const c = caseBits(cm[j], j, n)
    if (c & 1) out.push(CASE_L, -1, 1, 1)
    if (c & 4) out.push(CASE_M, -1, 0, 0)
    return out
  }
  const a = caseBits(cm[j], j, n)
  const b = caseBits(cm[k], k, n)
  if ((a & 4) && (b & 4)) out.push(CASE_M, CASE_M, 0, 0)
  if ((a & 1) && (b & 4)) out.push(CASE_L, CASE_M, 1, 0)
  if ((a & 4) && (b & 1)) out.push(CASE_M, CASE_L, 1, 0)
  if ((a & 2) && (b & 4)) out.push(CASE_R, CASE_M, 0, 1)
  if ((a & 4) && (b & 2)) out.push(CASE_M, CASE_R, 0, 1)
  if ((a & 1) && (b & 1)) out.push(CASE_L, CASE_L, 2, 0)
  if ((a & 2) && (b & 2)) out.push(CASE_R, CASE_R, 0, 2)
  // Position j hits for A with digit j+1; its mirror hits for B with digit
  // n-k = j+1. One digit, two cells — impossible on a house, allowed otherwise.
  if (!house) {
    if ((a & 1) && (b & 2)) out.push(CASE_L, CASE_R, 1, 1)
    if ((a & 2) && (b & 1)) out.push(CASE_R, CASE_L, 1, 1)
  }
  return out
}

// The DP reads three bits per cell and both clue masks. Hash exactly those, so a
// change anywhere else on the line costs one pass over the cells and no solve.
function signature (puzzle, instance) {
  const { clueA, clueB, line, n } = instance
  let h = (Math.imul(puzzle.getCandidatesBitMask(clueA), 31) + puzzle.getCandidatesBitMask(clueB)) | 0
  for (let j = 0; j < n; j++) {
    h = (Math.imul(h, 31) + caseBits(puzzle.getCandidatesBitMask(line[j]), j, n)) | 0
  }
  return h
}

function * update (instance, puzzle) {
  const { clueA, clueB, line, n, units } = instance
  // The house exclusion needs the line to hold each digit once. Ask the app, and
  // keep asking until it says house — the exclusion groups grow as the app builds
  // the puzzle (line contract). A mock with no such call reads as a house.
  if (!instance.house) {
    instance.house = puzzle.getCellsCanHaveRepeats ? !puzzle.getCellsCanHaveRepeats(line) : true
  }
  const sig = signature(puzzle, instance)
  if (sig === instance.sig) return

  const all = (1 << (n + 1)) - 1
  const maskA = puzzle.getCandidatesBitMask(clueA) & all
  const maskB = puzzle.getCandidatesBitMask(clueB) & all
  if (maskA === 0 || maskB === 0) return
  const cm = []
  for (let j = 0; j < n; j++) cm.push(puzzle.getCandidatesBitMask(line[j]))

  const U = units.length
  const combos = []
  for (let u = 0; u < U; u++) combos.push(unitCombos(cm, units[u][0], units[u][1], n, instance.house))

  // F[u][a] — bitmask of the B counts reachable with A count a, over the units
  // before u. F[0] is the single state (0, 0).
  const F = new Array(U + 1)
  F[0] = new Array(n + 1).fill(0)
  F[0][0] = 1
  for (let u = 0; u < U; u++) {
    const nx = new Array(n + 1).fill(0)
    const co = combos[u]
    for (let a = 0; a <= n; a++) {
      const m = F[u][a]
      if (m === 0) continue
      for (let t = 0; t < co.length; t += 4) {
        const na = a + co[t + 2]
        if (na <= n) nx[na] |= (m << co[t + 3]) & all
      }
    }
    F[u + 1] = nx
  }

  // H[u][a] — the states from which the units from u on can still finish inside
  // the clue box. H[U] is the box itself.
  const H = new Array(U + 1)
  const box = new Array(n + 1).fill(0)
  for (let a = 0; a <= n; a++) if ((maskA >> a) & 1) box[a] = maskB
  H[U] = box
  for (let u = U - 1; u >= 0; u--) {
    const pv = new Array(n + 1).fill(0)
    const co = combos[u]
    const nxt = H[u + 1]
    for (let a = 0; a <= n; a++) {
      for (let t = 0; t < co.length; t += 4) {
        const na = a + co[t + 2]
        if (na <= n) pv[a] |= nxt[na] >>> co[t + 3]
      }
    }
    H[u] = pv
  }

  // No (A, B) the line can reach lies in the box: the branch is dead. Empty a
  // clue cell, the contradiction signal the per-line rule already raises.
  if ((H[0][0] & 1) === 0) {
    const cands = Array.from(puzzle.getCandidates(clueA))
    if (cands.length > 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(cands), clueA)
    return
  }

  // Which cases each position can still take.
  const open = new Array(n).fill(0)
  for (let u = 0; u < U; u++) {
    const co = combos[u]
    const cur = F[u]
    const nxt = H[u + 1]
    const j = units[u][0]
    const k = units[u][1]
    for (let t = 0; t < co.length; t += 4) {
      const da = co[t + 2]
      const db = co[t + 3]
      let ok = false
      for (let a = 0; a + da <= n; a++) {
        if (((cur[a] << db) & nxt[a + da]) !== 0) { ok = true; break }
      }
      if (!ok) continue
      open[j] |= 1 << co[t]
      if (k >= 0) open[k] |= 1 << co[t + 1]
    }
  }

  // Clue candidates: keep the values that appear in a reachable pair in the box.
  let keepA = 0
  let keepB = 0
  const S = F[U]
  for (let a = 0; a <= n; a++) {
    const both = S[a] & box[a]
    if (both === 0) continue
    keepA |= 1 << a
    keepB |= both
  }
  const rmA = maskA & ~keepA
  if (rmA !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rmA)), clueA)
  const rmB = maskB & ~keepB
  if (rmB !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rmB)), clueB)

  // Cell candidates: an impossible case takes its digits with it.
  for (let j = 0; j < n; j++) {
    const lBit = 1 << (j + 1)
    const rBit = 1 << (n - j)
    const o = open[j]
    let rm = 0
    // At the centre the two targets are one digit, held by CASE_L alone.
    if ((o & (1 << CASE_L)) === 0) rm |= lBit
    if (rBit !== lBit && (o & (1 << CASE_R)) === 0) rm |= rBit
    if ((o & (1 << CASE_M)) === 0) rm |= ~(lBit | rBit)
    rm &= cm[j] & ~1
    if (rm !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rm)), line[j])
  }
  instance.sig = signature(puzzle, instance)
}

function bits (mask) {
  const out = []
  for (let m = mask; m; m &= m - 1) out.push(31 - Math.clz32(m & -m))
  return out
}

// A line is a permutation, so it can never have exactly n - 1 hits: fix n - 1
// cells on target and the last value has only its home left, forcing an nth hit.
// The hit matching does not see this, so keep the per-line rule for both clues.
function * initialize (instance, puzzle) {
  const { clueA, clueB, n } = instance
  if (n >= 2) {
    for (const clue of [clueA, clueB]) {
      if (Array.from(puzzle.getCandidates(clue)).includes(n - 1)) {
        yield puzzle.removeCandidateFromCell(n - 1, clue)
      }
    }
  }
  yield * update(instance, puzzle)
}

function validate (instance, puzzle) {
  const { clueA, clueB, line, n } = instance
  if (puzzle.hasValue(clueA) && puzzle.getValue(clueA) === n - 1) return false
  if (puzzle.hasValue(clueB) && puzzle.getValue(clueB) === n - 1) return false
  if (!puzzle.getCellsAreFilled([clueA, clueB, ...line])) return true
  let a = 0
  let b = 0
  for (let j = 0; j < n; j++) {
    const v = puzzle.getValue(line[j])
    if (v === j + 1) a++
    if (v === n - j) b++
  }
  return puzzle.getValue(clueA) === a && puzzle.getValue(clueB) === b
}
