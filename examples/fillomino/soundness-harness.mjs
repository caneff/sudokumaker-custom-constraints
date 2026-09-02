// Soundness fuzz for the fillomino component. Soundness = a component never
// removes a cell's TRUE value. We seed random partial states in which every
// cell still allows its true value, run the component to a fixpoint, and check
// the true value survived.
//
//   node examples/fillomino/soundness-harness.mjs
//
// Two fixtures, both valid 6x6 fillomino solutions:
//   shipped — the grid of gen.json, the board the example ships.
//   varied  — a second grid, with a different mix of region sizes.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng()

const N = 6
installGlobals(1, N)

const mod = load('FillominoComponent.js', ['setParams', 'update', 'validate'])

const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = Array.from({ length: N }, (_, d) => d + 1)

const gridOf = rows => {
  const truth = {}
  rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * N + x] = Number(ch) }))
  return truth
}

// shipped — the grid of gen.json, the board the example ships.
const shipped = gridOf(JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid)
// varied — a second valid solution: many 1s, 2s and 3s and one 4-region.
const varied = gridOf(['121212', '323232', '313131', '323234', '121214', '333144'])

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

// Run update once (one call is enough for a directed check) and return the puzzle.
function once (truth, seed) {
  const p = makePuzzle(truth, seed)
  const inst = {}
  mod.setParams(inst, CELLS)
  Array.from(mod.update(inst, p))
  return p
}

const empty = p => CELLS.some(c => p.getCandidates(c).size === 0)

let bad = 0

// ---- Fuzz: true values survive, on both fixtures ----
const FUZZ = Number(process.env.FUZZ) || 20000
for (const [name, truth] of [['shipped', shipped], ['varied', varied]]) {
  let fails = 0
  for (let iter = 0; iter < FUZZ; iter++) {
    const { v } = run(truth, seeder)
    if (v) { fails++; if (fails <= 5) console.log(name, 'violation', v) }
  }
  console.log('fillomino', name, `fixture: ${FUZZ} tests,`, fails, 'violations')
  bad += fails
}

// ---- Seal (transfer doc §1): r5c0 holds 1, an island of one cell, so it is a
// finished region. Both its orthogonal neighbours lose the candidate 1. ----
const seal = once(shipped, c => (c === 30 ? [1] : ALL))
const sealOk = ![24, 31].some(c => seal.getCandidates(c).has(1))
if (!sealOk) { console.log('fillomino seal: r5c0 did not seal its border'); bad++ }

// ---- Overflow (transfer doc §1): r0c0 and r0c1 both hold 1, one island of
// two cells for a region of one. A dead branch: a cell is emptied so the
// solver sees it. ----
const overflow = once(shipped, c => (c === 0 || c === 1 ? [1] : ALL))
if (!empty(overflow)) { console.log('fillomino overflow: a 2-cell island of 1 was not killed'); bad++ }

// ---- Starve (transfer doc §3, reading b): r0c0 holds 5, and both its
// neighbours hold another digit. The walk out of that island covers one cell,
// under the five its region needs, so the branch is dead. ----
const starve = once(shipped, c => (c === 0 ? [5] : c === 1 ? [1] : c === 6 ? [2] : ALL))
if (starve.getCandidates(0).size !== 0) { console.log('fillomino starve: a boxed-in 5 was not killed'); bad++ }

// ---- Force (transfer doc §2): r0c0 holds 2 and r0c1 holds 3, so the walk out
// of the 2 reaches r1c0 and nothing more. Two cells for a region of two: the
// walk IS the region, so r1c0 holds 2. ----
const force = once(shipped, c => (c === 0 ? [2] : c === 1 ? [3] : ALL))
const forced = force.getCandidates(6)
if (!(forced.size === 1 && forced.has(2))) { console.log('fillomino force: a walk of exactly 2 did not place its digit'); bad++ }

// ---- One door (transfer doc §3): r0c0 holds 4 and r0c1 holds 1, so r1c0 is
// the only open cell beside that island still allowing 4. The region has to
// grow, and that is the only way out, so r1c0 holds 4. The walk does not
// settle this one: it runs well past four cells. ----
const door = once(shipped, c => (c === 0 ? [4] : c === 1 ? [1] : ALL))
const doorCell = door.getCandidates(6)
if (!(doorCell.size === 1 && doorCell.has(4))) { console.log('fillomino door: the only way out of an island was not forced'); bad++ }

// ---- Merge overflow (transfer doc §3): r0c0 and r0c2 both hold 2, two
// islands of one cell. r0c1 touches both, so a 2 there would make one region
// of three cells for a digit of two. ----
const merge = once(shipped, c => (c === 0 || c === 2 ? [2] : ALL))
if (merge.getCandidates(1).has(2)) { console.log('fillomino merge overflow: a door joining two islands kept the digit'); bad++ }

// ---- validate (transfer doc §9): the leaf check. Every same-digit component
// of a full grid must hold as many cells as its digit. ----
function judge (truth) {
  const p = makePuzzle(truth, (c, v) => [v])
  const inst = {}
  mod.setParams(inst, CELLS)
  return mod.validate(inst, p)
}
if (!judge(shipped)) { console.log('fillomino validate: rejected a real solution'); bad++ }
// r0c0 turned from 5 to 1: the 1 stands alone and passes, but its 5-region is
// now four cells for a digit of five.
if (judge({ ...shipped, 0: 1 })) { console.log('fillomino validate: accepted a broken grid'); bad++ }
// A partly filled grid is not judged yet.
const partial = makePuzzle(shipped, (c, v) => (c === 0 ? ALL : [v]))
const partialInst = {}
mod.setParams(partialInst, CELLS)
if (!mod.validate(partialInst, partial)) { console.log('fillomino validate: judged an unfilled grid'); bad++ }

console.log('fillomino soundness-harness:', bad, 'failures')
process.exit(bad ? 1 : 0)
