// Soundness fuzz for the ISOFILL component. Soundness = a component never
// removes a cell's TRUE value. We seed random partial states in which every
// cell still allows its true value, run the component to a fixpoint, and check
// the true value survived.
//
//   node examples/isofill/soundness-harness.mjs
//
// Two fixtures, both valid ISOFILL solutions:
//   rows — row r holds digit r (covers cap and force).
//   bent — each pair of rows splits into two L-shaped regions, so the seed
//          walk goes around corners.
//   silent35 — the grid of gen_35g_silent.json, fuzzed with a seeder that
//          never pins digit 2, so that digit stays silent (no placed cell) in
//          every state and only the silent-digit rule prunes it.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng()

installGlobals(0, 9)

const mod = load('IsofillComponent.js', ['setParams', 'update', 'validate', 'seedWalk'])

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = Array.from({ length: N }, (_, d) => d)

const rows = {}
for (const c of CELLS) rows[c] = Math.floor(c / N)

// Rows 2r,2r+1: digit 2r takes cols 0-5 of the top row and cols 0-3 of the
// bottom row; digit 2r+1 takes the rest. Ten cells each, both connected.
const bent = {}
for (const c of CELLS) {
  const r = Math.floor(c / N)
  const x = c % N
  const top = r % 2 === 0
  const band = Math.floor(r / 2)
  bent[c] = (top ? x <= 5 : x <= 3) ? 2 * band : 2 * band + 1
}

// The same seeder, but digit `d` is never pinned, so no cell ever holds it as
// a value: `d` stays silent and the silent-digit rule is the only one that can
// prune it.
function silentSeeder (d) {
  return (c, v) => {
    const s = seeder(c, v)
    return s.length === 1 && s[0] === d ? ALL : s
  }
}

// A random candidate seed for a cell: pinned, full, or a subset that keeps true.
function seeder (c, v) {
  const mode = pick(['pin', 'full', 'subset'])
  if (mode === 'pin') return [v]
  if (mode === 'full') return ALL
  const s = new Set([v])
  for (const d of ALL) if (rnd() < 0.5) s.add(d)
  return [...s]
}

function run (truth, seed) {
  const p = makePuzzle(truth, seed)
  const inst = {}
  mod.setParams(inst, CELLS)
  return { p, v: violates(mod, inst, p, truth) }
}

// shipped — the grid in gen.json (also the grid of the 44-clue fixture).
const grid = f => JSON.parse(readFileSync(join(HERE, f), 'utf8')).grid
const shippedGrid = grid('gen.json')
if (shippedGrid.join() !== grid('gen_44g.json').join()) throw new Error('gen_44g.json grid differs from gen.json')
const shipped = {}
shippedGrid.forEach((row, r) => [...row].forEach((ch, x) => { shipped[r * N + x] = Number(ch) }))
// hard — the 32-given fixture's grid, the one budget was tuned on.
const hard = {}
grid('gen_32g.json').forEach((row, r) => [...row].forEach((ch, x) => { hard[r * N + x] = Number(ch) }))
// silent35 — the grid whose 35-given fixture leaves digit 2 with no given.
const silent35 = {}
grid('gen_35g_silent.json').forEach((row, r) => [...row].forEach((ch, x) => { silent35[r * N + x] = Number(ch) }))

// Run update once (one call is enough for a directed check) and return the puzzle.
function once (truth, seed) {
  const p = makePuzzle(truth, seed)
  const inst = {}
  mod.setParams(inst, CELLS)
  Array.from(mod.update(inst, p))
  return p
}

// ---- Fuzz: true values survive, on all fixtures ----
// ponytail: 2,000 per fixture keeps `just check` at ~10 s now that cut
// pruning walks per open cell; FUZZ=20000 for the deep run before a ship.
const FUZZ = Number(process.env.FUZZ) || 2000
let bad = 0
for (const [name, truth, seed] of [['rows', rows, seeder], ['bent', bent, seeder], ['shipped', shipped, seeder], ['hard', hard, seeder], ['silent35', silent35, silentSeeder(2)]]) {
  let fails = 0
  for (let iter = 0; iter < FUZZ; iter++) {
    const { v } = run(truth, seed)
    if (v) { fails++; if (fails <= 5) console.log(name, 'violation', v) }
  }
  console.log('isofill', name, `fixture: ${FUZZ} tests,`, fails, 'violations')
  bad += fails
}

// ---- Cap: digit 0 fills row 0, so no other cell may keep 0 ----
const cap = run(rows, (c, v) => (v === 0 ? [v] : ALL))
const capOk = !cap.v && CELLS.slice(N).every(c => !cap.p.getCandidates(c).has(0))

// ---- Force: digit 0 has exactly ten open cells (row 0), so they must be 0 ----
const force = run(rows, (c, v) => (v === 0 ? ALL : ALL.slice(1)))
const forceOk = !force.v && CELLS.slice(0, N).every(c => force.p.getCandidates(c).size === 1)

// ---- Outside the walk: only cell 0 is placed (digit 0), so cell 99 (18
// steps away, far past the budget of nine) loses 0 ----
const outside = run(bent, (c, v) => (c === 0 ? [v] : ALL))
const outsideOk = !outside.v && !outside.p.getCandidates(99).has(0) && outside.p.getCandidates(9).has(0)

// ---- Stranded: cells 0 and 99 both placed as 0 can never join, so the walk
// misses one of them and a placed cell empties ----
const stranded = once(bent, (c, v) => (c === 0 || c === 99 ? [0] : ALL))
const strandedOk = stranded.getCandidates(0).size === 0

// ---- Stranded at cap: ten placed 0s (cells 0-8 and 99) can never join
// either, and at cap the walk has no budget at all ----
const capStranded = once(bent, (c, v) => (c <= 8 || c === 99 ? [0] : ALL))
const capStrandedOk = capStranded.getCandidates(0).size === 0

// ---- Starved: digit 0 placed at cell 0 and allowed only in cells 1-8 (nine
// cells in all) can never grow to ten; the placed cell empties ----
const starved = once(bent, (c, v) => (c === 0 ? [0] : c <= 8 ? ALL : ALL.slice(1)))
const starvedOk = starved.getCandidates(0).size === 0

// ---- Seed walk, budget boundary: digit 0 placed at cells 0 and 19. The
// shortest path between them crosses nine open cells, one more than the
// budget of ten minus two placed, so the walk never meets cell 19: dead ----
const farDead = once(bent, (c, v) => (c === 0 || c === 19 ? [0] : ALL))
const farDeadOk = farDead.getCandidates(0).size === 0

// ---- Seed walk, the other side of that boundary: cells 0 and 18 are eight
// open cells apart, exactly the budget, so both placed cells survive ----
const farLive = once(bent, (c, v) => (c === 0 || c === 18 ? [0] : ALL))
const farLiveOk = farLive.getCandidates(0).has(0) && farLive.getCandidates(18).has(0)

// ---- Tighter than the old walk: digit 1 placed at cells 7, 14 and 17, digit
// 0 at cell 12, which walls off row 1 to the left of 14. The seed is cell 7
// and the budget is seven open cells. Linking 7 to 14 costs two of them
// (cells 16 and 15), so the six cells from 14 down and back along row 2 to
// cell 10 come to eight in all and cell 10 falls outside the walk. The old
// walk started from every placed cell at no cost, so it reached cell 10 in
// six steps from 14 and kept the candidate ----
const linked = once(bent, (c, v) => ([7, 14, 17].includes(c) ? [1] : c === 12 ? [0] : ALL))
const linkedOk = !linked.getCandidates(10).has(1)

// ---- Seed walk, walled off: digit 0 is placed at cell 0 and at cell 55,
// whose four neighbours all hold digit 1. No path of cells allowing 0 joins
// them, so the walk cannot meet cell 55 whatever the budget: dead ----
const walled = once(bent, (c, v) => (c === 0 || c === 55 ? [0] : [45, 54, 56, 65].includes(c) ? [1] : ALL))
const walledOk = walled.getCandidates(0).size === 0

// ---- Cut: digit 0 placed at cell 0, allowed in row 0 and cell 10 (eleven
// cells). Without cell 1 the walk holds two cells, so cell 1 must be 0;
// without cell 10 it still holds ten, so cell 10 stays open ----
const cut = once(bent, (c, v) => (c === 0 ? [0] : c <= 10 ? ALL : ALL.slice(1)))
const cutOk = cut.getCandidates(1).size === 1 && cut.getCandidates(1).has(0) && cut.getCandidates(10).size > 1

// ---- Budget: rows 0-1 (twenty cells) allow only digits 1 and 2 while every
// other row is fixed, so digit 2 is complete and digit 1 can take ten cells:
// no assignment covers twenty cells. Per digit nothing is wrong (cap only
// drops 2), but the max flow falls short and a cell empties ----
const budget = once(rows, (c, v) => (c < 2 * N ? [1, 2] : [v]))
const budgetOk = CELLS.some(c => budget.getCandidates(c).size === 0)

// ---- Tour bound: digit 0 placed at cells 0 and 9 (nine apart). Cell 50 is
// five steps from cell 0, inside the depth bound (8), but a region holding
// cells 0, 9 and 50 needs 1 + (5 + 14 + 9) / 2 = 15 cells; cell 4 needs 10 ----
const tour = once(rows, (c, v) => (c === 0 || c === 9 ? [0] : ALL))
const tourOk = !tour.getCandidates(50).has(0) && tour.getCandidates(4).has(0)

// ---- Budget prune: rows 0-1 allow [0,1], row 2 [0,1,2], row 3 [2,3], row 4
// [2,3,4], rows 5-9 fixed. Rows 0-1 use up digits 0 and 1, so row 2 must be
// 2: no single digit is forced, but the matching prune drops 0 and 1 there ----
const prune = once(rows, (c, v) => (c < 2 * N ? [0, 1] : c < 3 * N ? [0, 1, 2] : c < 4 * N ? [2, 3] : c < 5 * N ? [2, 3, 4] : [v]))
const pruneOk = CELLS.slice(2 * N, 3 * N).every(c => prune.getCandidates(c).size === 1 && prune.getCandidates(c).has(2))

// ---- Silent digit: digits 0 and 1 have no placed cell anywhere. Their
// candidate cells are a sixteen-cell blob B and a detached two-by-two corner
// S, walled off by digit 2. A ten-cell region does not fit in four cells, so
// S loses both digits and B keeps them. No other rule sees this: every walk
// rule starts from a placed cell, and the budget matching is perfect with or
// without the pair (S cell, 0) ----
const S = [0, 1, 10, 11]
const B = [3, 4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17, 18, 19, 23, 24]
const pinned = {}
const put = (d, cs) => cs.forEach(c => { pinned[c] = d })
put(2, [2, 12, 22, 21, 20, 30, 40, 50, 60, 70]) // the wall: an L that isolates S
put(3, [25, 26, 27, 28, 29, 31, 32, 33, 34, 35])
put(4, [36, 37, 38, 39, 41, 42, 43, 44, 45, 46])
put(5, [47, 48, 49, 51, 52, 53, 54, 55, 56, 57])
put(6, [58, 59, 61, 62, 63, 64, 65, 66, 67, 68])
put(7, [69, 71, 72, 73, 74, 75, 76, 77, 78, 79])
put(8, [80, 81, 82, 83, 84, 85, 86, 87, 88, 89])
put(9, [90, 91, 92, 93, 94, 95, 96, 97, 98, 99])
const silent = once(rows, c => (c in pinned ? [pinned[c]] : [0, 1]))
const silentOk = S.every(c => !silent.getCandidates(c).has(0) && !silent.getCandidates(c).has(1)) &&
  B.every(c => silent.getCandidates(c).has(0) && silent.getCandidates(c).has(1))

// ---- Silent digit, dead board: same shape, but digit 2's comb cuts the open
// cells into blobs of eight, six and six. No blob holds ten, so neither silent
// digit has anywhere to go and the branch is dead: a cell empties ----
const deadPinned = {}
const deadPut = (d, cs) => cs.forEach(c => { deadPinned[c] = d })
deadPut(2, [2, 12, 22, 21, 23, 24, 25, 26, 16, 6]) // the comb
deadPut(3, [27, 28, 29, 37, 38, 39, 36, 35, 34, 33])
deadPut(4, [31, 32, 41, 42, 43, 44, 45, 46, 47, 48])
deadPut(5, [49, 59, 58, 57, 56, 55, 54, 53, 52, 51])
deadPut(6, [60, 61, 62, 63, 64, 65, 66, 67, 68, 69])
deadPut(7, [70, 71, 72, 73, 74, 75, 76, 77, 78, 79])
deadPut(8, [80, 81, 82, 83, 84, 85, 86, 87, 88, 89])
deadPut(9, [90, 91, 92, 93, 94, 95, 96, 97, 98, 99])
const silentDead = once(rows, c => (c in deadPinned ? [deadPinned[c]] : [0, 1]))
const silentDeadOk = CELLS.some(c => silentDead.getCandidates(c).size === 0)

// ---- Perimeter split arc: digit 0 sits at border cells 0 and 3, digit 1 at
// border cells 1 and 5. Read round the border those four are 0, 1, 0, 1, so
// the two regions would have to interleave. Two disjoint connected regions
// cannot, so the board is dead and a cell empties ----
const arc = once(rows, c => (c === 0 || c === 3 ? [0] : c === 1 || c === 5 ? [1] : ALL))
const arcOk = CELLS.some(c => arc.getCandidates(c).size === 0)

// ---- Perimeter flank: digit 0 at border cells 0 and 3 flanks open border
// cells 1 and 2, and digit 1 is placed at border cell 6, outside that arc. So
// cell 1 cannot be 1 -- that reads 0, 1, 0, 1 round the border -- and it loses
// nothing else: digit 2, placed only at interior cell 12, has no border
// witness, and the silent digits stay. Interior cell 11 is not on the walk ----
const flank = once(rows, c => (c === 0 || c === 3 ? [0] : c === 6 ? [1] : c === 12 ? [2] : ALL))
// Cell 1 keeps every digit but 1 -- the assertion is the whole surviving set,
// so a rule that stripped more than the outside digit would fail here.
const flankKept = ALL.filter(d => d !== 1)
const flankOk = [...flank.getCandidates(1)].sort((a, b) => a - b).join() === flankKept.join() &&
  !flank.getCandidates(2).has(1) && flank.getCandidates(11).has(1)

// ---- Differential: the seed walk never holds a cell the old reach walk
// missed. The reference below is that removed walk -- BFS from every placed
// cell of the digit, at most (size - placed) steps through the cells that
// allow it. The seed walk starts from one placed cell instead and charges
// only open cells, so it is a subset, and on some states a proper one ----
function nbrs10 (i) {
  const out = []
  if (i % N > 0) out.push(i - 1)
  if (i % N < N - 1) out.push(i + 1)
  if (i >= N) out.push(i - N)
  if (i + N < N * N) out.push(i + N)
  return out
}

function oldWalk (placed, allowed) {
  const seen = new Uint8Array(N * N)
  let frontier = []
  for (const i of placed) { seen[i] = 1; frontier.push(i) }
  for (let step = 0; step < N - placed.length && frontier.length; step++) {
    const next = []
    for (const f of frontier) for (const n of nbrs10(f)) if (allowed[n] && !seen[n]) { seen[n] = 1; next.push(n) }
    frontier = next
  }
  return seen
}

const diffInst = {}
mod.setParams(diffInst, CELLS)
let diffWalks = 0
let diffSmaller = 0
let diffEscaped = 0
let diffMissized = 0
for (const truth of [rows, bent, hard, shipped]) {
  for (let iter = 0; iter < FUZZ; iter++) {
    const p = makePuzzle(truth, seeder)
    const value = new Int8Array(N * N).fill(-1)
    const allowedOf = ALL.map(() => new Uint8Array(N * N))
    const placedOf = ALL.map(() => [])
    for (const c of CELLS) {
      const cand = [...p.getCandidates(c)]
      if (cand.length === 1) { value[c] = cand[0]; allowedOf[cand[0]][c] = 1; placedOf[cand[0]].push(c) } else for (const d of cand) allowedOf[d][c] = 1
    }
    for (const d of ALL) {
      const placed = placedOf[d].sort((a, b) => a - b)
      if (placed.length === 0) continue
      const walk = mod.seedWalk(diffInst, placed[0], N - placed.length, allowedOf[d], value, d)
      const old = oldWalk(placed, allowedOf[d])
      let newSize = 0
      let oldSize = 0
      for (const c of CELLS) {
        if (old[c]) oldSize++
        if (diffInst.mask[c] !== walk.stamp) continue
        newSize++
        if (!old[c]) diffEscaped++
      }
      if (newSize !== walk.size) diffMissized++ // the reported size must match the mask
      diffWalks++
      if (newSize < oldSize) diffSmaller++
    }
  }
}
const diffOk = diffEscaped === 0 && diffMissized === 0 && diffSmaller > 0
console.log('isofill seed-walk differential:', diffWalks, 'walks,', diffEscaped, 'escaped the old walk,', diffMissized, 'with a size that misses the mask,', diffSmaller, 'strictly smaller')

// ---- One pass: update reads each cell's candidates at most once per call ----
const onePass = makePuzzle(rows, () => ALL)
let reads = 0
const getCandidates = onePass.getCandidates.bind(onePass)
onePass.getCandidates = c => { reads++; return getCandidates(c) }
const onePassInst = {}
mod.setParams(onePassInst, CELLS)
Array.from(mod.update(onePassInst, onePass))
const onePassOk = reads <= CELLS.length

// ---- Validate: full valid grid passes; swap two cells across regions (still ten each) fails ----
const full = makePuzzle(bent, (c, v) => [v])
const inst = {}
mod.setParams(inst, CELLS)
const swapped = { ...bent, 0: bent[99], 99: bent[0] }
const swapP = makePuzzle(swapped, (c, v) => [v])
const validateOk = mod.validate(inst, full) === true && mod.validate(inst, swapP) === false

// ---- 9x9 with digits 1-9: the same component on the other supported board.
// One fuzz fixture (rows, one digit per row) plus a cap check, with the
// globals re-installed for the 1-9 range ----
installGlobals(1, 9)
const N9 = 9
const CELLS9 = Array.from({ length: N9 * N9 }, (_, i) => i)
const ALL9 = Array.from({ length: N9 }, (_, d) => d + 1)
const rows9 = {}
for (const c of CELLS9) rows9[c] = Math.floor(c / N9) + 1
let bad9 = 0
for (let iter = 0; iter < FUZZ; iter++) {
  const p = makePuzzle(rows9, (c, v) => {
    const mode = pick(['pin', 'full', 'subset'])
    if (mode === 'pin') return [v]
    if (mode === 'full') return ALL9
    const s = new Set([v])
    for (const d of ALL9) if (rnd() < 0.5) s.add(d)
    return [...s]
  })
  const inst = {}
  mod.setParams(inst, CELLS9)
  const v = violates(mod, inst, p, rows9)
  if (v) { bad9++; if (bad9 <= 5) console.log('9x9 violation', v) }
}
console.log('isofill 9x9 fixture:', `${FUZZ} tests,`, bad9, 'violations')
const cap9 = makePuzzle(rows9, (c, v) => (v === 1 ? [v] : ALL9))
const cap9Inst = {}
mod.setParams(cap9Inst, CELLS9)
Array.from(mod.update(cap9Inst, cap9))
const cap9Ok = CELLS9.slice(N9).every(c => !cap9.getCandidates(c).has(1))
// A board that does not split evenly among its digits must throw, not prune.
installGlobals(0, 9)
const badInst = {}
mod.setParams(badInst, CELLS9)
let threw = false
try { Array.from(mod.update(badInst, makePuzzle(rows9, () => ALL))) } catch { threw = true }
console.log('9x9 cap fired:', cap9Ok, '| uneven board throws:', threw)

console.log('validate:', validateOk)
console.log('perimeter arc fired:', arcOk, '| perimeter flank fired:', flankOk)
console.log('cap fired:', capOk, '| force fired:', forceOk, '| outside walk:', outsideOk, '| stranded:', strandedOk, '| stranded at cap:', capStrandedOk, '| starved:', starvedOk, '| far dead:', farDeadOk, '| far live:', farLiveOk, '| linked walk tighter:', linkedOk, '| walled off:', walledOk, '| differential:', diffOk, '| cut fired:', cutOk, '| tour fired:', tourOk, '| budget fired:', budgetOk, '| budget prune fired:', pruneOk, '| silent fired:', silentOk, '| silent dead fired:', silentDeadOk, '| one pass:', onePassOk, `(${reads} reads)`)

const ok = bad === 0 && bad9 === 0 && cap9Ok && threw && capOk && forceOk && outsideOk && strandedOk && capStrandedOk && starvedOk && farDeadOk && farLiveOk && linkedOk && walledOk && diffOk && cutOk && tourOk && budgetOk && pruneOk && silentOk && silentDeadOk && arcOk && flankOk && onePassOk && validateOk
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
