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

// Run update once (one call is enough for a directed check) and return the puzzle.
function once (truth, seed) {
  const p = makePuzzle(truth, seed)
  const inst = {}
  mod.setParams(inst, CELLS)
  Array.from(mod.update(inst, p))
  return p
}

// ---- Fuzz: true values survive, on all fixtures ----
let bad = 0
for (const [name, truth] of [['rows', rows], ['bent', bent], ['shipped', shipped]]) {
  let fails = 0
  for (let iter = 0; iter < 20000; iter++) {
    const { v } = run(truth, seeder)
    if (v) { fails++; if (fails <= 5) console.log(name, 'violation', v) }
  }
  console.log('isofill', name, 'fixture: 20000 tests,', fails, 'violations')
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

// ---- Validate: full valid grid passes; swap two cells across regions (still ten each) fails ----
const full = makePuzzle(bent, (c, v) => [v])
const inst = {}
mod.setParams(inst, CELLS)
const swapped = { ...bent, 0: bent[99], 99: bent[0] }
const swapP = makePuzzle(swapped, (c, v) => [v])
const validateOk = mod.validate(inst, full) === true && mod.validate(inst, swapP) === false

console.log('validate:', validateOk)
console.log('cap fired:', capOk, '| force fired:', forceOk, '| reach fired:', reachOk, '| split fired:', splitOk, '| split at cap:', capSplitOk, '| capacity fired:', capacityOk)

const ok = bad === 0 && capOk && forceOk && reachOk && splitOk && capSplitOk && capacityOk && validateOk
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
