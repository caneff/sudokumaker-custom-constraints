// The readable rewrite of FillominoComponent.js (#870) must deduce exactly what
// the component it replaced did: same removals, same cells, same order, call
// by call. The floor in update-strength.test.mjs only proves "never weaker";
// this proves "the same". The reference is a frozen copy of the component as
// it stood before the rewrite, includes spliced in (`.golden/`, since the
// Pants sandbox holds no git history).
//
// Two drives, each running the frozen copy and the rewrite in lockstep on two
// puzzles that start equal, every `update` call's removals logged and compared:
//
// - A search on each of the 19 frozen timing fixtures, from their givens: the
//   states the app's own search reaches, the component's cache carried from
//   node to node the way the solver carries it.
// - Fuzzed states, around a real solution and not, through one instance pair
//   each, so the cache also sees states that jump around.
//
// Each call is run twice: once with each removal applied as it is made (the
// harness mock's reading) and once with every removal held until the call
// ends, so the comparison does not hang on when the solver applies a change.

import assert from 'assert'
import { installGlobals, makeIo, makePuzzle, makeRng, randomCandidates, total } from '../_shared/harness-lib.mjs'
import { fixtureBoards } from './bound-screen-lib.mjs'
import { FIXTURES } from './fixture.mjs'

const HERE = import.meta.dirname
const FROZEN = '95bf886'
const io = makeIo(HERE)
const NAMES = ['setParams', 'update']
const ref = io.load(`.golden/FillominoComponent.${FROZEN}.js`, NAMES)
const cur = io.load('FillominoComponent.js', NAMES)

const REMOVERS = ['removeCandidateFromCell', 'removeCandidatesFromCell', 'removeCandidateFromCells', 'removeCandidatesFromCells']
// One `update` call on `p`, returning its removals as [cell, digit mask]
// pairs in the order they were made. `deferred` holds them until the call is
// over, then applies them.
function oneCall (mod, inst, p, deferred) {
  const log = []
  const held = []
  const view = Object.create(p)
  for (const name of REMOVERS) {
    const single = name.startsWith('removeCandidateFrom')
    const many = name.endsWith('Cells')
    view[name] = (what, where) => {
      const mask = single ? 1 << what : Number(what)
      for (const c of many ? where : [where]) log.push([c, mask])
      if (deferred) held.push(() => p[name](what, where)); else p[name](what, where)
    }
  }
  Array.from(mod.update(inst, view))
  for (const apply of held) apply()
  return log
}

const state = p => [...p._cand].map(([c, s]) => [c, [...s].sort((a, b) => a - b)])
const restore = (p, snap) => { for (const [c, vals] of snap) p._cand.set(c, new Set(vals)) }
const dead = p => { for (const s of p._cand.values()) if (s.size === 0) return true; return false }

let calls = 0
let removals = 0

// Run both components on `pa`/`pb` (equal on entry) until a call changes
// nothing or a cell empties, comparing each call. Returns false on a dead
// state.
function settle (a, b, pa, pb, label, deferred) {
  for (let pass = 0; pass < 200; pass++) {
    const before = total(pa)
    const la = oneCall(ref, a, pa, deferred)
    const lb = oneCall(cur, b, pb, deferred)
    calls++
    removals += la.length
    assert.deepStrictEqual(lb, la, `${label}: call ${pass} removed differently`)
    assert.deepStrictEqual(state(pb), state(pa), `${label}: call ${pass} left different candidates`)
    if (dead(pa)) return false
    if (total(pa) === before) return true
  }
  throw new Error(`${label}: did not settle in 200 calls`)
}

const blank = (width, height, cap, givens) => {
  const all = Array.from({ length: cap }, (_, d) => d + 1)
  const truth = Object.fromEntries(Array.from({ length: width * height }, (_, i) => [i, 0]))
  return makePuzzle(truth, i => (givens[i] === undefined ? all : [givens[i]]))
}

// A propagate-and-branch search, as the offline scorer runs one, with both
// components in lockstep. Stops at `nodeCap` nodes or a second solution.
function lockstepSearch (board, deferred, nodeCap) {
  const { width, height, cap, givens, name } = board
  installGlobals(1, cap)
  const cells = Array.from({ length: width * height }, (_, i) => i)
  const a = {}
  const b = {}
  ref.setParams(a, cells, width, height)
  cur.setParams(b, cells, width, height)
  const pa = blank(width, height, cap, givens)
  const pb = blank(width, height, cap, givens)
  let nodes = 0
  let solutions = 0
  const go = () => {
    if (!settle(a, b, pa, pb, `${name} node ${nodes}`, deferred)) return
    let best = -1
    let bestSize = Infinity
    for (const [c, s] of pa._cand) if (s.size > 1 && s.size < bestSize) { best = c; bestSize = s.size }
    if (best === -1) { solutions++; return }
    const snap = state(pa)
    for (const d of [...pa._cand.get(best)]) {
      if (nodes >= nodeCap || solutions >= 2) return
      nodes++
      restore(pa, snap)
      restore(pb, snap)
      pa._cand.set(best, new Set([d]))
      pb._cand.set(best, new Set([d]))
      go()
    }
  }
  go()
  return nodes
}

let searched = 0
for (const board of fixtureBoards(HERE)) {
  for (const deferred of [false, true]) searched += lockstepSearch(board, deferred, 150)
}

// Fuzzed states. Around a real solution most rules fire; with no true value
// kept, many states are contradictions and the dead-branch paths run too.
const { rnd } = makeRng(870)
let fuzzed = 0
for (const [name, { truth, width, height, cap }] of FIXTURES) {
  installGlobals(1, cap)
  const cells = Array.from({ length: width * height }, (_, i) => i)
  for (const deferred of [false, true]) {
    for (const keepTruth of [true, false]) {
      const a = {}
      const b = {}
      ref.setParams(a, cells, width, height)
      cur.setParams(b, cells, width, height)
      for (let rep = 0; rep < 300; rep++) {
        const seed = c => randomCandidates(rnd, 1, cap, keepTruth ? truth[c] : null)
        const start = new Map(cells.map(c => [c, seed(c)]))
        const pa = makePuzzle(truth, c => start.get(c))
        const pb = makePuzzle(truth, c => start.get(c))
        settle(a, b, pa, pb, `${name} fuzz ${rep}${keepTruth ? '' : ' (no truth)'}${deferred ? ' deferred' : ''}`, deferred)
        fuzzed++
      }
    }
  }
}

assert.ok(removals > 0, 'nothing was removed: the comparison compared nothing')
console.log(`fillomino equivalence: ${searched} search nodes, ${fuzzed} fuzzed states, ${calls} calls, ${removals} removals, all identical to ${FROZEN}`)
