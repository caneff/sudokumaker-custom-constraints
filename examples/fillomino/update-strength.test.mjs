// Strength gate for FillominoComponent.update, half one: on any state, the
// component never keeps a candidate the vendored baseline removed. Soundness
// (never remove a true value) lives in soundness-harness.mjs; this file checks
// the other direction, against a real reference.
//
//   node examples/fillomino/update-strength.test.mjs
//
// The reference is the community catalog's fillomino constraint, vendored
// verbatim at docs/research/fillomino-baseline/ (#281). Half two of the gate
// -- more candidates removed on some state -- binds from rung 2, the growth
// test (#303, #308), and is not asserted here.
//
// The rules read placed digits and walk regions, so a state drawn at random is
// contradictory and prunes nothing worth comparing. States are drawn around a
// real solution instead, the way soundness-harness.mjs draws them.
//
// HOW THE REFERENCE IS DRIVEN. The baseline scans its island list once per
// call and then yields as it goes, so by its third island the list can be a
// deduction out of date. Two of its rules read that list as fact -- the seal
// and the one-door force -- and on a stale, under-sized island neither is
// sound: the force says "the region has to grow through the one open cell
// beside this island" when the island's other half is a placed cell it never
// saw. Driven that way it removes a true value on about one state in ten of
// this fuzz. So the reference here is driven ONE CHANGE PER CALL: every island
// it reads is freshly scanned, and every rule it fires is the sound reading of
// itself. Measured on this fuzz, that is the whole difference -- 22 candidates
// over 536 states where the published drive prunes more, none of them under
// the fresh drive.
//
// Our own component reads each island's live extent instead, which is why it
// needs no such handling.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASELINE = join(HERE, '..', '..', 'docs', 'research', 'fillomino-baseline')

const cur = makeIo(HERE).load('FillominoComponent.js', ['setParams', 'update'])
const ref = makeIo(BASELINE).load('FillominoComponent.js', ['initialize', 'update'])

const N = 6
installGlobals(1, N)

const { rnd } = makeRng(9001)
const REPS = 300

const CELLS = Array.from({ length: N * N }, (_, i) => i)

const gridOf = rows => {
  const truth = {}
  rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * N + x] = Number(ch) }))
  return truth
}
const shipped = gridOf(JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid)
const varied = gridOf(['121212', '323232', '313131', '323234', '121214', '333144'])

const total = p => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }

// One version's whole run on a state. The baseline sets its scratch up in
// `initialize` off `instance.cells`; ours does it in `setParams`. The baseline
// is stopped after each change so its next island comes off a fresh scan --
// see HOW THE REFERENCE IS DRIVEN above.
const apply = (mod, p) => {
  const inst = { cells: CELLS }
  if (mod.setParams) {
    mod.setParams(inst, CELLS)
    fixpoint(mod, inst, p)
    return
  }
  Array.from(mod.initialize(inst, p))
  for (let call = 0; call < 4000; call++) {
    const before = total(p)
    const changes = mod.update(inst, p)
    changes.next()
    changes.return()
    if (total(p) === before) return
  }
  throw new Error('the reference did not settle in 4000 calls')
}

// The baseline logs its island list on every update call, verbatim as
// published. Silence it for the run rather than edit the reference.
const quiet = fn => {
  const log = console.log
  console.log = () => {}
  try { return fn() } finally { console.log = log }
}

let states = 0
let weaker = 0
for (const [name, truth] of [['shipped', shipped], ['varied', varied]]) {
  let fixtureWeaker = 0
  for (let rep = 0; rep < REPS; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(rnd, 1, N, truth[c]))
    const w = quiet(() => compareStrength(cur, ref, apply, start))
    if (w === null) continue
    states++
    fixtureWeaker += w.length
    if (w.length > 0 && fixtureWeaker <= 5) console.log(name, 'weaker at', w[0])
  }
  console.log('fillomino', name, 'fixture:', REPS, 'states,', fixtureWeaker, 'weaker cells')
  weaker += fixtureWeaker
}
console.log('fillomino never-weaker:', states, 'states,', weaker, 'weaker cells')
// Every state keeps a real solution, so no state may die: a dead one would
// mean a version emptied a cell the solution needs, or called stop on a live
// branch.
assert.strictEqual(states, 2 * REPS, 'a state built around a solution must never die')
assert.strictEqual(weaker, 0)
console.log('PASS')
