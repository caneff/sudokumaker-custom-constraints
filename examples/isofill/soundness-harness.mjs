// Soundness fuzz for the ISOFILL component. Soundness = a component never
// removes a cell's TRUE value. We seed random partial states in which every
// cell still allows its true value, run the component to a fixpoint, and check
// the true value survived.
//
//   node examples/isofill/soundness-harness.mjs
//
// Two fixtures, both valid ISOFILL solutions:
//   rows — row r holds digit r (covers cap and force).
//   bent — each pair of rows splits into two L-shaped regions, so the reach
//          deduction walks around corners.
//   silent35 — the grid of puzzle-35-silent.json, fuzzed with a seeder that
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

const mod = load('IsofillComponent.js', ['setParams', 'update', 'validate'])

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

// shipped — the grid in puzzle.json (also the grid of the 44-clue fixture).
const grid = f => JSON.parse(readFileSync(join(HERE, f), 'utf8')).grid
const shippedGrid = grid('puzzle.json')
if (shippedGrid.join() !== grid('puzzle-44.json').join()) throw new Error('puzzle-44.json grid differs from puzzle.json')
const shipped = {}
shippedGrid.forEach((row, r) => [...row].forEach((ch, x) => { shipped[r * N + x] = Number(ch) }))
// hard — the 32-given fixture's grid, the one budget was tuned on.
const hard = {}
grid('puzzle-32.json').forEach((row, r) => [...row].forEach((ch, x) => { hard[r * N + x] = Number(ch) }))
// silent35 — the grid whose 35-given fixture leaves digit 2 with no given.
const silent35 = {}
grid('puzzle-35-silent.json').forEach((row, r) => [...row].forEach((ch, x) => { silent35[r * N + x] = Number(ch) }))

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

// ---- Reach: only cell 0 is placed (digit 0), so cell 99 (18 steps away) loses 0 ----
const reach = run(bent, (c, v) => (c === 0 ? [v] : ALL))
const reachOk = !reach.v && !reach.p.getCandidates(99).has(0) && reach.p.getCandidates(9).has(0)

// ---- Split: cells 0 and 99 both placed as 0 can never join; the stranded cell empties ----
const split = once(bent, (c, v) => (c === 0 || c === 99 ? [0] : ALL))
const splitOk = split.getCandidates(0).size === 0 || split.getCandidates(99).size === 0

// ---- Split at cap: ten placed 0s (cells 0-8 and 99) can never join either ----
const capSplit = once(bent, (c, v) => (c <= 8 || c === 99 ? [0] : ALL))
const capSplitOk = capSplit.getCandidates(99).size === 0

// ---- Capacity: digit 0 placed at cell 0 and allowed only in cells 1-8 (nine
// cells in all) can never grow to ten; the placed cell empties ----
const capacity = once(bent, (c, v) => (c === 0 ? [0] : c <= 8 ? ALL : ALL.slice(1)))
const capacityOk = capacity.getCandidates(0).size === 0

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

console.log('validate:', validateOk)
console.log('perimeter arc fired:', arcOk, '| perimeter flank fired:', flankOk)
console.log('cap fired:', capOk, '| force fired:', forceOk, '| reach fired:', reachOk, '| split fired:', splitOk, '| split at cap:', capSplitOk, '| capacity fired:', capacityOk, '| cut fired:', cutOk, '| tour fired:', tourOk, '| budget fired:', budgetOk, '| budget prune fired:', pruneOk, '| silent fired:', silentOk, '| silent dead fired:', silentDeadOk, '| one pass:', onePassOk, `(${reads} reads)`)

const ok = bad === 0 && capOk && forceOk && reachOk && splitOk && capSplitOk && capacityOk && cutOk && tourOk && budgetOk && pruneOk && silentOk && silentDeadOk && arcOk && flankOk && onePassOk && validateOk
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
