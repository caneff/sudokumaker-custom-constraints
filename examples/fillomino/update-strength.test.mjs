// Strength gate for FillominoComponent.update, both halves: on any state the
// component never keeps a candidate the vendored baseline removed (half one),
// and on some state it removes one the baseline keeps (half two). Soundness
// (never remove a true value) lives in soundness-harness.mjs; this file checks
// the other direction, against a real reference.
//
//   node examples/fillomino/update-strength.test.mjs
//
// The reference is the community catalog's fillomino constraint, vendored
// verbatim at docs/research/fillomino-baseline/ (#281). Half two binds from
// rung 2, the growth test (#303, #308).
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

const io = makeIo(HERE)
const cur = io.load('FillominoComponent.js', ['setParams', 'update'])
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
let stronger = 0
for (const [name, truth] of [['shipped', shipped], ['varied', varied]]) {
  let fixtureWeaker = 0
  let fixtureStronger = 0
  for (let rep = 0; rep < REPS; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(rnd, 1, N, truth[c]))
    const w = quiet(() => compareStrength(cur, ref, apply, start))
    if (w === null) continue
    // Half two, the same comparison read the other way round: the candidates
    // the baseline keeps and we remove.
    const st = quiet(() => compareStrength(ref, cur, apply, start))
    states++
    fixtureWeaker += w.length
    fixtureStronger += st.length
    if (w.length > 0 && fixtureWeaker <= 5) console.log(name, 'weaker at', w[0])
  }
  console.log('fillomino', name, 'fixture:', REPS, 'states,', fixtureWeaker, 'weaker cells,', fixtureStronger, 'stronger cells')
  weaker += fixtureWeaker
  stronger += fixtureStronger
}
console.log('fillomino strength gate:', states, 'states,', weaker, 'weaker cells,', stronger, 'stronger cells')
// Every state keeps a real solution, so no state may die: a dead one would
// mean a version emptied a cell the solution needs, or called stop on a live
// branch.
assert.strictEqual(states, 2 * REPS, 'a state built around a solution must never die')
assert.strictEqual(weaker, 0)
// Half two: rung 2 out-deduces the baseline, it does not merely match it
// (#303, #308). The count alone does not separate the rungs -- rung 1 already
// removed candidates the baseline keeps on this fuzz (7352 cells over the 600
// states, against rung 2's 21084). The directed demo below is what only the
// growth test passes.
assert.ok(stronger > 0, 'the component must remove a candidate the baseline keeps on some state')

// The fixpoint floor for #312 (rung 2.5, bound-cost optimizations). Those may
// make the bound cheaper; they may not change what it deduces. The floor is
// rung 2 exactly as it shipped, read out of git, and the check runs both
// directions -- a faster bound that prunes one candidate less, or one more, is
// a different component and fails here.
const SHIPPED = 'ac20771'
const shippedRung2 = io.loadAt(SHIPPED, 'FillominoComponent.js', ['setParams', 'update'])
const { rnd: frnd } = makeRng(4242)
let floorStates = 0
for (const truth of [shipped, varied]) {
  for (let rep = 0; rep < 100; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(frnd, 1, N, truth[c]))
    const lost = quiet(() => compareStrength(cur, shippedRung2, apply, start))
    if (lost === null) continue
    floorStates++
    assert.deepStrictEqual(lost, [], `the component prunes less than rung 2 as shipped (${SHIPPED})`)
    assert.deepStrictEqual(quiet(() => compareStrength(shippedRung2, cur, apply, start)), [],
      `the component prunes more than rung 2 as shipped (${SHIPPED})`)
  }
}
assert.strictEqual(floorStates, 200, 'a state built around a solution must never die')
console.log('fillomino fixpoint floor:', floorStates, 'states, same fixpoint as', SHIPPED)

// The silent-region win, directed (transfer doc §6). No cell is placed, so
// every baseline rule is idle -- they all start from a placed island. r0c0's
// two neighbours drop 6, which leaves r0c0 as the only cell around it that
// allows 6: one cell for a region of six. The growth test drops 6 from r0c0;
// the baseline keeps it.
const NO_SIX = [1, 2, 3, 4, 5]
const silentStart = new Map(CELLS.map(c => [c, c === 1 || c === 6 ? NO_SIX : [1, 2, 3, 4, 5, 6]]))
const silentWin = quiet(() => compareStrength(ref, cur, apply, silentStart))
assert.deepStrictEqual(silentWin, [{ cell: 0, digit: 6 }], 'the clue-less region deduction the baseline misses')
console.log('fillomino silent-region demo: baseline keeps 6 at r0c0, the growth test drops it')
console.log('PASS')
