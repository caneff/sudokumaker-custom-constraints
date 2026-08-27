// Differential test for the blob-count gate on the cut rule (ticket #150).
//
//   node examples/isofill/cut-gate.test.mjs
//
// The gate is meant to be a speed change and nothing else: the strand half of
// the cut rule runs only when the digit's placed cells sit in more than one
// blob, because a single blob is joined by a path of placed cells that no open
// cell can break. This test holds it to that. It runs three builds of the
// component over the same fuzz states and compares the candidates they remove:
//
//   gated     the component as it ships.
//   ungated   the strand test on every open cell, the rule before the gate.
//   overgated the strand test never, a deliberately wrong gate.
//
// gated must match ungated on every state. overgated must differ on some
// state -- that is what proves the comparison can fail, so a gate that skipped
// a case the ungated rule catches would be caught here rather than pass quietly.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle } from '../_shared/harness-lib.mjs'
import { CELLS, rows, bent, gridTruth, makeSeeder, makeSilentSeeder } from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { read, loadSource } = makeIo(HERE)
const { rnd, pick } = makeRng()

installGlobals(0, 9)

const SRC = read('IsofillComponent.js')
const GATE = 'if (!cut && blobs > 1) cut ='
if (!SRC.includes(GATE)) throw new Error('cut gate not found in IsofillComponent.js: ' + GATE)

const API = ['setParams', 'update']
const variant = (name, condition) => ({
  name,
  mod: loadSource(SRC.replace(GATE, 'if (!cut && ' + condition + ') cut ='), API)
})
const gated = variant('gated', 'blobs > 1')
const ungated = variant('ungated', 'placed.length > 1')
const overgated = variant('overgated', 'false')

// Every candidate a variant removes, running update to a fixpoint from `start`
// (cell -> candidate array). Each pass is tagged, so a removal made on a later
// pass never cancels out against the same removal made on an earlier one.
function removals (v, truth, start) {
  const p = makePuzzle(truth, c => start[c])
  const log = []
  let pass = 0
  const one = p.removeCandidateFromCell
  const many = p.removeCandidatesFromCell
  p.removeCandidateFromCell = (d, c) => { log.push(pass + ':' + c + ':' + d); one(d, c) }
  p.removeCandidatesFromCell = (s, c) => { for (const d of s) if (p._cand.get(c).has(d)) log.push(pass + ':' + c + ':' + d); many(s, c) }
  const inst = {}
  v.mod.setParams(inst, CELLS)
  const total = () => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }
  for (; pass < 20; pass++) {
    const before = total()
    Array.from(v.mod.update(inst, p))
    if (total() === before) break
  }
  return log.join(' ')
}

const DIFF = Number(process.env.DIFF) || 300
const seeder = makeSeeder(rnd, pick)
const fixtures = [
  ['rows', rows, seeder],
  ['bent', bent, seeder],
  ['shipped', gridTruth(HERE, 'puzzle.json'), seeder],
  ['hard', gridTruth(HERE, 'puzzle-32.json'), seeder],
  ['silent35', gridTruth(HERE, 'puzzle-35-silent.json'), makeSilentSeeder(seeder, 2)]
]

let mismatches = 0
let caught = 0
for (const [name, truth, seed] of fixtures) {
  let differs = 0
  let same = 0
  for (let iter = 0; iter < DIFF; iter++) {
    const start = {}
    for (const c of CELLS) start[c] = seed(c, truth[c])
    const b = removals(ungated, truth, start)
    if (removals(gated, truth, start) === b) same++; else if (++mismatches <= 3) console.log(name, 'state', iter, 'gated and ungated differ')
    if (removals(overgated, truth, start) !== b) differs++
  }
  caught += differs
  console.log('isofill cut gate', name, `fixture: ${DIFF} states, gated == ungated on`, same, '| overgated caught on', differs)
}

// The mutant check: an overgated build skips strand cuts the ungated rule
// makes, so the comparison above has to see a difference somewhere. If it does
// not, this test proves nothing and fails.
const ok = mismatches === 0 && caught > 0
console.log('gated == ungated:', mismatches === 0, '| overgated caught:', caught > 0, `(${caught} states)`)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
