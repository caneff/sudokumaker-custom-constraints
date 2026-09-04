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
import { installGlobals, makeIo, makeRng, makePuzzle, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

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

// The fixpoint floor: rung 2 exactly as it shipped, read out of git. Every
// rung above it has to stand on it -- never one candidate less, anywhere --
// and has to be worth its name: it must reach something rung 2 does not. The
// directed demo at the end of this file names the deduction that does it.
const SHIPPED = 'ac20771'
const shippedRung2 = io.loadAt(SHIPPED, 'FillominoComponent.js', ['setParams', 'update'])
const { rnd: frnd } = makeRng(4242)
let floorStates = 0
let pastRung2 = 0
for (const truth of [shipped, varied]) {
  for (let rep = 0; rep < 100; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(frnd, 1, N, truth[c]))
    const lost = quiet(() => compareStrength(cur, shippedRung2, apply, start))
    if (lost === null) continue
    floorStates++
    assert.deepStrictEqual(lost, [], `the component prunes less than rung 2 as shipped (${SHIPPED})`)
    pastRung2 += quiet(() => compareStrength(shippedRung2, cur, apply, start)).length
  }
}
assert.strictEqual(floorStates, 200, 'a state built around a solution must never die')
assert.ok(pastRung2 > 0, `rung 3 must remove a candidate rung 2 (${SHIPPED}) keeps`)
console.log('fillomino fixpoint floor:', floorStates, 'states, 0 weaker than', SHIPPED + ',', pastRung2, 'stronger')

// The reused instance (#312). The component bound caches the allowed-digit
// row it last finished on and re-floods only what moved since -- the one thing
// the component carries between calls. The solver never says it backtracked,
// so the same instance sees states that jump around: a candidate it watched
// disappear comes back. Drive ONE instance over a run of unrelated states and
// each has to settle exactly where a fresh instance settles it.
const reused = { cells: CELLS }
cur.setParams(reused, CELLS)
const { rnd: brnd } = makeRng(31337)
const settle = (inst, start) => {
  const cells = {}; for (const c of CELLS) cells[c] = 0
  const p = makePuzzle(cells, c => start.get(c))
  quiet(() => fixpoint(cur, inst, p))
  return CELLS.map(c => [...p._cand.get(c)].sort((a, b) => a - b).join(''))
}
let reuseStates = 0
for (const truth of [shipped, varied, shipped, varied]) {
  for (let rep = 0; rep < 100; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(brnd, 1, N, truth[c]))
    const fresh = { cells: CELLS }
    cur.setParams(fresh, CELLS)
    assert.deepStrictEqual(settle(reused, start), settle(fresh, start),
      'a reused instance settled a state somewhere a fresh one does not')
    reuseStates++
  }
}
console.log('fillomino reused instance:', reuseStates, 'states, same fixpoint as a fresh one')

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

// Cut starve, directed (transfer doc §4). r0c0 holds 5 and the only other
// cells that still allow 5 are r0c1, r1c0, r1c1, r2c1 and r3c1 -- a fork at
// r0c1/r1c0 that closes again at r1c1 and then runs on alone. The walk out of
// the island covers six cells for a region of five, so the force is idle, and
// the island has two doors, so the one-door rule is idle too; the merge rules
// and the component bound find nothing. Drop r1c1 from the walk and it starves
// at three cells, drop r2c1 and it starves at four: both are in the region, so
// both hold 5. Nothing in rung 2 reaches either, at a fixpoint or otherwise.
const NO_FIVE = [1, 2, 3, 4, 6]
const CORRIDOR = new Set([1, 6, 7, 13, 19])
const cutStart = new Map(CELLS.map(c => [c, c === 0 ? [5] : CORRIDOR.has(c) ? [1, 2, 3, 4, 5, 6] : NO_FIVE]))
const cutWin = quiet(() => compareStrength(shippedRung2, cur, apply, cutStart))
assert.deepStrictEqual(cutWin, [7, 13].flatMap(cell => [1, 2, 3, 4, 6].map(digit => ({ cell, digit }))),
  'the two cut-starve cells rung 2 misses')
console.log('fillomino cut-starve demo: rung 2 leaves r1c1 and r2c1 open, cut starve places the 5 in both')
console.log('PASS')
