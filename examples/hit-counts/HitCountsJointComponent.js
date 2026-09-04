/* eslint-disable no-unused-vars -- setParams/update/initialize/validate/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
// Soundness. The true solution induces one concrete case at every position —
// hit for A, hit for B, or neither — and one concrete (A, B) hit count for the
// line. Every set this component builds is a SUPERSET of what the true solution
// uses: the forward sets F hold every (A, B) the cells' own candidates allow,
// the backward sets H hold every state from which the clue candidates are still
// reachable, and neither asks whether the non-hit cells can be filled in. A
// candidate is removed only when NO combination in those supersets keeps it, so
// the true solution's own case is never the one removed.
//
// The permutation sweep is sound for the same reason and one step further: on a
// line that holds 1..n once each, every filling IS a permutation, so the sets it
// builds are the reachable (A, B) counts themselves rather than a superset. The
// true solution is one of those permutations, so its digit at every position and
// its own (A, B) pair are always among the survivors.
//
// Two rules read outside the line's own candidates, and each carries its gate.
// The mirrored-pair exclusion needs a house: on a bare line, where a digit may
// repeat, both (L, R) and (R, L) stay open. The "no n-1 clue" rule needs the
// line's live digits to be exactly 1..n, which a house alone does not promise.
// The permutation sweep needs that same full house of 1..n.

//! Joint hit counts. One component for a whole line and both its clues.
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
//! On a line that holds 1..n once each the same two sweeps run over whole
//! permutations instead of cases: the state is the set of digits already placed,
//! and a (position, digit) pair survives only when some permutation through it
//! lands both clues on a candidate they still hold. That reads the misses as well
//! as the hits, so it also removes a digit no permutation can put there.

const CASE_L = 0
const CASE_R = 1
const CASE_M = 2

// Line kinds, ordered (docs/line-contract.md): a rule that needs one kind also
// holds on every kind above it. The mirrored-pair exclusion needs a house; the
// no-n-1 rule needs a full house whose digit set is {1..n}.
const BARE = 0
const HOUSE = 1
const FULL_HOUSE = 2

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
}

// The three cases a position can take, read off its candidate mask, as bits
// 1 << CASE_L, 1 << CASE_R and 1 << CASE_M.
function caseBits (mask, j, n) {
  const lBit = 1 << (j + 1)
  const rBit = 1 << (n - j)
  let bits = 0
  if (mask & lBit) bits |= 1 << CASE_L
  if (mask & rBit) bits |= 1 << CASE_R
  if (mask & ~(lBit | rBit)) bits |= 1 << CASE_M // any digit that is neither target
  return bits
}

// The centre cell's combinations: its single hit counts for both clues at once,
// so CASE_L there is one hit for each.
function centreCombos (c) {
  const out = []
  if (c & 1) out.push(CASE_L, -1, 1, 1)
  if (c & 4) out.push(CASE_M, -1, 0, 0)
  return out
}

// One unit's combinations, flat: caseJ, caseK, dA, dB per entry. k < 0 is the
// centre.
function unitCombos (cm, j, k, n, house) {
  if (k < 0) return centreCombos(caseBits(cm[j], j, n))
  return pairCombos(caseBits(cm[j], j, n), caseBits(cm[k], k, n), house)
}

// A mirrored pair's cases, six numbers each: the case bit the j end must hold,
// the bit the k end must hold, then the entry to emit — caseJ, caseK, dA, dB.
const PAIR_CASES = [
  4, 4, CASE_M, CASE_M, 0, 0,
  1, 4, CASE_L, CASE_M, 1, 0,
  4, 1, CASE_M, CASE_L, 1, 0,
  2, 4, CASE_R, CASE_M, 0, 1,
  4, 2, CASE_M, CASE_R, 0, 1,
  1, 1, CASE_L, CASE_L, 2, 0,
  2, 2, CASE_R, CASE_R, 0, 2
]
// Position j hits for A with digit j+1; its mirror hits for B with digit
// n-k = j+1. One digit, two cells — impossible on a house, allowed otherwise.
const PAIR_CASES_OFF_HOUSE = [
  1, 2, CASE_L, CASE_R, 1, 1,
  2, 1, CASE_R, CASE_L, 1, 1
]

// Emit every case in `table` both ends can still take.
function pushCases (out, table, a, b) {
  for (let t = 0; t < table.length; t += 6) {
    if ((a & table[t]) && (b & table[t + 1])) out.push(table[t + 2], table[t + 3], table[t + 4], table[t + 5])
  }
}

// A mirrored pair's combinations, from the case bits of each end.
function pairCombos (a, b, house) {
  const out = []
  pushCases(out, PAIR_CASES, a, b)
  if (!house) pushCases(out, PAIR_CASES_OFF_HOUSE, a, b)
  return out
}

// The case sweep reads three bits per cell, both clue masks, and the line kind;
// the permutation sweep reads every candidate. Hash exactly what the sweep about to
// run reads, so a change it cannot see costs one pass over the cells and no
// solve. The kind is in the hash because it can climb while no candidate moves,
// and a higher kind opens a stronger rule -- which is also what picks the sweep,
// so one hash cannot be mistaken for the other.
function signature (puzzle, instance, exact) {
  const { clueA, clueB, line, n } = instance
  const kind = (instance.kind || 0) * 2 + (instance.oneToN ? 1 : 0)
  let h = (Math.imul(puzzle.getCandidatesBitMask(clueA), 31) + puzzle.getCandidatesBitMask(clueB)) | 0
  for (let j = 0; j < n; j++) {
    const m = puzzle.getCandidatesBitMask(line[j])
    h = (Math.imul(h, 31) + (exact ? m : caseBits(m, j, n))) | 0
  }
  return (Math.imul(h, 31) + kind) | 0
}

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
// The same test lives in HitCountsComponent and SideSumComponent: the app
// pastes each component as its own segment, so the copies cannot share code.
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

// The permutation sweep holds two tables of 2^n * (n + 1) counts and walks them
// three times, so its cost climbs as n * 2^n: one step up in n is twice the
// work. It has been timed on the shipped boards and pays there; past nine cells
// nothing has measured it, so a longer line keeps the case sweep rather than
// take a cost no board has priced. See examples/hit-counts/OPTIMIZATION_LOG.md.
const PERM_MAX = 9

// Every buffer the sweep needs, sized by n alone, built once per instance and
// cleared per call: a solve calls `update` far more often than it changes n, and
// `docs/agents/per-call-cost.md` asks the hot path to allocate nothing.
function permScratch (instance, n) {
  const size = (1 << n) * (n + 1)
  if (instance.F && instance.F.length === size) {
    instance.F.fill(0)
    instance.H.fill(0)
    instance.reach.fill(0)
    instance.keep.fill(0)
    return
  }
  instance.F = new Int32Array(size)
  instance.H = new Int32Array(size)
  instance.reach = new Uint8Array(1 << n)
  instance.dig = new Int32Array(n) // filled per call from the cells' own masks
  instance.keep = new Int32Array(n)
  const pc = new Uint8Array(1 << n)
  for (let m = 1; m < pc.length; m++) pc[m] = pc[m >> 1] + (m & 1)
  instance.pc = pc
}

// Forward sweep: `F[mask][a]` gains the B counts a prefix using exactly the
// digits in `mask` can reach with A count a. `reach` marks the states a prefix
// can actually build -- most subsets of the digits are not among them once a
// few cells are pinned, and the two sweeps after this one walk only the ones
// that are.
function permForward (F, reach, dig, pc, n, W, last) {
  F[0] = 1
  reach[0] = 1
  for (let mask = 0; mask < last; mask++) {
    if (reach[mask] === 0) continue
    const i = pc[mask]
    const base = mask * W
    for (let open = dig[i] & ~mask; open; open &= open - 1) {
      const bit = open & -open
      const d = 32 - Math.clz32(bit)
      const da = d === i + 1 ? 1 : 0
      const db = d === n - i ? 1 : 0
      const to = (mask | bit) * W + da
      let hit = 0
      for (let a = 0; a + da <= n; a++) {
        const v = F[base + a]
        if (v !== 0) { F[to + a] |= v << db; hit = 1 }
      }
      if (hit) reach[mask | bit] = 1
    }
  }
}

// Backward sweep: `H[mask][a]` gains the B counts that, added to a prefix
// holding (a, b), let the rest of the line finish on a pair both clues hold.
// The last state is seeded with the clue box itself.
function permBackward (H, reach, dig, pc, n, W, last, maskA, maskB) {
  const tail = last * W
  for (let a = 0; a <= n; a++) H[tail + a] = ((maskA >> a) & 1) ? maskB : 0
  for (let mask = last - 1; mask >= 0; mask--) {
    if (reach[mask] === 0) continue
    const i = pc[mask]
    const base = mask * W
    for (let open = dig[i] & ~mask; open; open &= open - 1) {
      const bit = open & -open
      const d = 32 - Math.clz32(bit)
      const da = d === i + 1 ? 1 : 0
      const db = d === n - i ? 1 : 0
      const to = (mask | bit) * W + da
      for (let a = 0; a + da <= n; a++) H[base + a] |= H[to + a] >>> db
    }
  }
}

// Clue candidates: the (A, B) pairs a full permutation reaches inside the box.
function permKeepClues (F, tail, maskA, maskB, n) {
  let keepA = 0
  let keepB = 0
  for (let a = 0; a <= n; a++) {
    if (((maskA >> a) & 1) === 0) continue
    const both = F[tail + a] & maskB
    if (both === 0) continue
    keepA |= 1 << a
    keepB |= both
  }
  return { keepA, keepB }
}

// Final sweep: `keep[i]` gains digit d where some state meets its own future --
// the prefix reaches (a, b) and the suffix after d finishes from there. A digit
// proved possible stays out of the search, so a position with few live digits
// costs a few tests and a pinned one costs none.
function permKeepDigits (F, H, keep, reach, dig, pc, n, W, last) {
  for (let mask = 0; mask < last; mask++) {
    if (reach[mask] === 0) continue
    const i = pc[mask]
    const base = mask * W
    for (let open = dig[i] & ~mask & ~keep[i]; open; open &= open - 1) {
      const bit = open & -open
      const d = 32 - Math.clz32(bit)
      const da = d === i + 1 ? 1 : 0
      const db = d === n - i ? 1 : 0
      const to = (mask | bit) * W + da
      for (let a = 0; a + da <= n; a++) {
        if ((F[base + a] & (H[to + a] >>> db)) !== 0) { keep[i] |= bit; break }
      }
    }
  }
}

// The permutation sweep, for a line that holds 1..n once each. A state is the
// set of digits already placed; its size names the position to fill next, so
// `permForward` and `permBackward` walk the same states in opposite directions.
//   F[mask][a] — the B counts a prefix can reach with A count a, having used
//     exactly the digits in `mask`.
//   H[mask][a] — the B counts that, added to a prefix already holding (a, b),
//     let the rest of the line finish on a pair both clues still hold.
// Digit d at position i is possible when some state meets its own future: the
// prefix reaches (a, b) and the suffix after d finishes from there. Anything no
// state supports is a digit no permutation can put in that cell.
// The three sweeps step a digit the same way -- read the low bit, name the
// digit, work out whether it hits for A, for B, and where it lands. That inner
// step is written out three times rather than shared, because a call in a loop
// this hot costs more than the repetition; change one and change all three.
function * permutationPrune (instance, puzzle, cm, maskA, maskB) {
  const { clueA, clueB, line, n } = instance
  const W = n + 1
  const last = (1 << n) - 1
  permScratch(instance, n)
  const { F, H, pc, reach, dig, keep } = instance

  // Each position's open digits as bits 0..n-1, bit d-1 for digit d.
  for (let j = 0; j < n; j++) dig[j] = (cm[j] >> 1) & last

  permForward(F, reach, dig, pc, n, W, last)
  const tail = last * W
  permBackward(H, reach, dig, pc, n, W, last, maskA, maskB)

  // No permutation of the line lands both clues on a candidate: the branch is
  // dead. Stop with the reason, the same signal the case sweep raises too.
  if ((H[0] & 1) === 0) {
    yield puzzle.stop(`no ordering of the line satisfies both clues of ${instance.name}`, [clueA, clueB, ...line])
    return
  }

  const { keepA, keepB } = permKeepClues(F, tail, maskA, maskB, n)
  permKeepDigits(F, H, keep, reach, dig, pc, n, W, last)

  const rmA = maskA & ~keepA
  if (rmA !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rmA)), clueA)
  const rmB = maskB & ~keepB
  if (rmB !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rmB)), clueB)
  for (let j = 0; j < n; j++) {
    const rm = dig[j] & ~keep[j]
    if (rm !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rm << 1)), line[j])
  }
}

// A line that holds 1..n once each can never have exactly n - 1 hits: fix
// n - 1 cells on target and the last value has only its home left, forcing an
// nth hit. The hit matching does not see this, so it is its own rule. Returns
// true when it fired: yielding makes both clue masks stale, so `update` leaves
// the sweep to the next pass.
function * noNMinusOne (instance, puzzle, maskA, maskB, kind) {
  const { clueA, clueB, n } = instance
  if (kind !== FULL_HOUSE || !instance.oneToN || n < 2) return false
  if ((((maskA | maskB) >> (n - 1)) & 1) === 0) return false
  if ((maskA >> (n - 1)) & 1) yield puzzle.removeCandidateFromCell(n - 1, clueA)
  if ((maskB >> (n - 1)) & 1) yield puzzle.removeCandidateFromCell(n - 1, clueB)
  return true
}

function * update (instance, puzzle) {
  const { clueA, clueB, line, n } = instance
  const all = (1 << (n + 1)) - 1
  const maskA = puzzle.getCandidatesBitMask(clueA) & all
  const maskB = puzzle.getCandidatesBitMask(clueB) & all
  if (maskA === 0 || maskB === 0) return
  const cm = []
  for (let j = 0; j < n; j++) cm.push(puzzle.getCandidatesBitMask(line[j]))
  const kind = lineKind(instance, puzzle)

  if (yield * noNMinusOne(instance, puzzle, maskA, maskB, kind)) return

  // On a line that holds 1..n once each the permutation sweep answers everything
  // the case sweep answers and more -- every case it keeps is realised by a real
  // permutation -- so the line takes one sweep or the other, never both.
  const exact = kind === FULL_HOUSE && instance.oneToN && n <= PERM_MAX
  const sig = signature(puzzle, instance, exact)
  if (sig === instance.sig) return
  if (exact) {
    yield * permutationPrune(instance, puzzle, cm, maskA, maskB)
    instance.sig = signature(puzzle, instance, exact)
    return
  }

  // A sweep that stopped leaves no memo: the dead-branch signal has to fire
  // again on the next call, and a memo would let a later state with the same
  // signature return early and never raise it.
  const stopped = yield * caseSweep(instance, puzzle, cm, maskA, maskB, kind, all)
  if (!stopped) instance.sig = signature(puzzle, instance, exact)
}

// F[u][a] — bitmask of the B counts reachable with A count a, over the units
// before u. F[0] is the single state (0, 0).
function caseForward (combos, U, n, all) {
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
  return F
}

// H[u][a] — the states from which the units from u on can still finish inside
// the clue box `box`, which is H[U] itself.
function caseBackward (combos, U, n, box) {
  const H = new Array(U + 1)
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
  return H
}

// Which cases each position can still take: a combination survives where the
// units before it reach a state the units after it can finish from.
function openCases (combos, units, F, H, U, n) {
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
  return open
}

// Clue candidates: keep the values that appear in a reachable pair in the box.
function caseKeepClues (S, box, n) {
  let keepA = 0
  let keepB = 0
  for (let a = 0; a <= n; a++) {
    const both = S[a] & box[a]
    if (both === 0) continue
    keepA |= 1 << a
    keepB |= both
  }
  return { keepA, keepB }
}

// The digits an impossible case takes with it at position j.
function caseCellDrop (o, j, n) {
  const lBit = 1 << (j + 1)
  const rBit = 1 << (n - j)
  let rm = 0
  // At the centre the two targets are one digit, held by CASE_L alone.
  if ((o & (1 << CASE_L)) === 0) rm |= lBit
  if (rBit !== lBit && (o & (1 << CASE_R)) === 0) rm |= rBit
  if ((o & (1 << CASE_M)) === 0) rm |= ~(lBit | rBit)
  return rm
}

// The case sweep: a forward and a backward pass over the mirrored units, each
// unit contributing the (case, hit) combinations its two cells still allow.
// Weaker than the permutation sweep but it runs on any line kind. Returns true
// when it stopped on a dead branch, which is what keeps `update` from memoising
// the state it stopped on.
function * caseSweep (instance, puzzle, cm, maskA, maskB, kind, all) {
  const { clueA, clueB, line, n, units } = instance
  const U = units.length
  const house = kind >= HOUSE
  const combos = []
  for (let u = 0; u < U; u++) combos.push(unitCombos(cm, units[u][0], units[u][1], n, house))

  const F = caseForward(combos, U, n, all)
  const box = new Array(n + 1).fill(0)
  for (let a = 0; a <= n; a++) if ((maskA >> a) & 1) box[a] = maskB
  const H = caseBackward(combos, U, n, box)

  // No (A, B) the line can reach lies in the box: the branch is dead. Stop
  // with the reason, the same signal the per-line rule already raises.
  if ((H[0][0] & 1) === 0) {
    yield puzzle.stop(`no hit count the line can reach satisfies both clues of ${instance.name}`, [clueA, clueB, ...line])
    return true
  }

  const open = openCases(combos, units, F, H, U, n)
  const { keepA, keepB } = caseKeepClues(F[U], box, n)
  const rmA = maskA & ~keepA
  if (rmA !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rmA)), clueA)
  const rmB = maskB & ~keepB
  if (rmB !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rmB)), clueB)

  for (let j = 0; j < n; j++) {
    const rm = caseCellDrop(open[j], j, n) & cm[j]
    if (rm !== 0) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(bits(rm)), line[j])
  }
  return false
}

function bits (mask) {
  const out = []
  for (let m = mask; m; m &= m - 1) out.push(31 - Math.clz32(m & -m))
  return out
}

// Run once at creation: two given opposite clues can pin the whole line at load.
function * initialize (instance, puzzle) {
  yield * update(instance, puzzle)
}

// A full line must realise both its clues exactly. The n - 1 reject rides the
// same gate the rule in `update` does: a clue of n - 1 is illegal only on a line
// that holds 1..n once each.
function validate (instance, puzzle) {
  const { clueA, clueB, line, n } = instance
  if (n >= 2 && lineKind(instance, puzzle) === FULL_HOUSE && instance.oneToN) {
    if (puzzle.hasValue(clueA) && puzzle.getValue(clueA) === n - 1) return false
    if (puzzle.hasValue(clueB) && puzzle.getValue(clueB) === n - 1) return false
  }
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
