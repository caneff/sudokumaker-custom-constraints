// Cut's share of `update` wall time (#170). Cut walks the grid once or twice
// per open cell of every digit; every other rule walks it once per digit. The
// question the spec parks a Tarjan articulation pass behind is how much of a
// call cut actually costs, measured on states the app's search really reaches.
//
//   node examples/isofill/cut-profile.mjs            # both hard fixtures
//   node examples/isofill/cut-profile.mjs gen_28g 200 5 777   # board, snapshots, reps, seed
//
// How it measures. `snapshots` replays a search over a fixture: propagate to a
// fixpoint with the real component, pin a random candidate in a random open
// cell, and on a dead node backtrack and pin something else. Every state the
// component is called on is one search snapshot. `instrument` then patches the
// component's source so the cut loop adds its own wall time to
// `globalThis.__cutMs`, and `timeUpdate` clocks whole `update` calls around it.
// The patch matches two anchor lines, so `cut-profile.test.mjs` holds it to
// firing at all and to removing exactly what the unpatched component removes.
//
// Two things the number includes, both small and both in cut's favour: one
// `performance.now()` pair per digit per call, and the removals cut yields
// inside its own loop (the consumer here drains them at once).

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeRng, makePuzzle } from '../_shared/harness-lib.mjs'

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = Array.from({ length: N }, (_, d) => d)
// The cut loop's two ends. Both lines are unique in the component; if either
// moves, `instrument` throws rather than time the wrong span.
const CUT_START = '      const depth = size - placed.length\n'
const CUT_END = '        if (cut) yield puzzle.removeCandidatesFromCell(SudokuDigitSet.from(others), cells[x])\n      }\n'

// Patch the component so the cut loop accumulates its wall time. Throws when
// an anchor is missing or no longer unique.
export function instrument (src) {
  for (const [name, anchor] of [['CUT_START', CUT_START], ['CUT_END', CUT_END]]) {
    const at = src.indexOf(anchor)
    if (at < 0) throw new Error(`cut-profile: ${name} anchor not found in IsofillComponent.js`)
    if (src.indexOf(anchor, at + 1) >= 0) throw new Error(`cut-profile: ${name} anchor is not unique`)
  }
  return src
    .replace(CUT_START, '      const _cutT0 = performance.now()\n' + CUT_START)
    .replace(CUT_END, CUT_END + '      globalThis.__cutMs += performance.now() - _cutT0\n')
}

// Load the component, optionally through a source transform. This is
// `harness-lib`'s `load` with the transform added; the shared harness API is
// out of scope for spec #165, so the eval lives here instead.
export function loadComponent (here, transform = s => s) {
  const src = transform(readFileSync(join(here, 'IsofillComponent.js'), 'utf8'))
  return eval('(function(){' + src + '\n return {setParams,update};})()') // eslint-disable-line no-eval
}

// The hard fixtures (#166), each as its true grid plus its given cells.
export function GRIDS (here) {
  const out = {}
  for (const name of ['gen_28g', 'gen_24g']) {
    const spec = JSON.parse(readFileSync(join(here, `${name}.json`), 'utf8'))
    const truth = {}
    spec.grid.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * N + x] = Number(ch) }))
    out[name] = { here, truth, given: new Set(spec.clues.map(([r, c]) => r * N + c)) }
  }
  return out
}

const clone = m => { const o = new Map(); for (const [k, v] of m) o.set(k, v.slice()); return o }

// Run the component once over a candidate map. Returns the new map, or null
// when a cell empties (a dead search node).
function propagate (mod, fx, cand) {
  const p = makePuzzle(fx.truth, c => cand.get(c))
  const inst = {}
  mod.setParams(inst, CELLS)
  Array.from(mod.update(inst, p))
  const next = new Map()
  for (const c of CELLS) {
    const s = [...p._cand.get(c)].sort((a, b) => a - b)
    if (s.length === 0) return null
    next.set(c, s)
  }
  return next
}

// Pin a random candidate in a random open cell. Returns false when the state
// has no open cell left.
function branch (rnd, cand) {
  const open = CELLS.filter(c => cand.get(c).length > 1)
  if (open.length === 0) return false
  const c = open[(rnd() * open.length) | 0]
  const ds = cand.get(c)
  cand.set(c, [ds[(rnd() * ds.length) | 0]])
  return true
}

// Search snapshots: the states a DFS over this fixture calls `update` on.
export function snapshots (fx, want, seed = 12345) {
  const mod = loadComponent(fx.here)
  const { rnd } = makeRng(seed)
  const root = new Map()
  for (const c of CELLS) root.set(c, fx.given.has(c) ? [fx.truth[c]] : ALL.slice())
  const trail = []
  const reset = () => { const s = clone(root); branch(rnd, s); return s }
  let cand = clone(root)
  const out = []
  while (out.length < want) {
    out.push(clone(cand))
    const next = propagate(mod, fx, cand)
    if (next === null) { // dead node: go back up and pin something else
      cand = trail.length ? trail.pop() : clone(root)
      if (!branch(rnd, cand)) cand = reset()
      continue
    }
    const settled = CELLS.every(c => next.get(c).length === cand.get(c).length)
    cand = next
    if (!settled) continue
    trail.push(clone(cand))
    if (!branch(rnd, cand)) cand = reset()
  }
  return out
}

// Wall time of whole `update` calls and of the cut loop inside them.
export function timeUpdate (mod, snaps, reps = 3) {
  let totalMs = 0
  let cutMs = 0
  let calls = 0
  // One instance for every call, as in the app: `setParams` runs once and
  // `update` once per search node. A fresh instance per call would charge the
  // first call with the component's lazy scratch allocation, which lands
  // inside `update` and outside the cut loop.
  const inst = {}
  mod.setParams(inst, CELLS)
  for (let r = 0; r < reps + 1; r++) {
    const warm = r === 0 // first pass is JIT warm-up, not counted
    for (const snap of snaps) {
      const p = makePuzzle(Object.fromEntries([...snap.keys()].map(c => [c, 0])), c => snap.get(c))
      globalThis.__cutMs = 0
      const t0 = performance.now()
      Array.from(mod.update(inst, p))
      const took = performance.now() - t0
      if (warm) continue
      totalMs += took
      cutMs += globalThis.__cutMs
      calls++
    }
  }
  // A component that was not put through `instrument` never touches the
  // counter and would read as a 0% share. Fail loud instead.
  if (cutMs === 0) throw new Error('cut-profile: no cut time recorded — was the component instrumented?')
  return { totalMs, cutMs, calls, share: cutMs / totalMs }
}

function main (which, want, reps, seed) {
  installGlobals(0, 9)
  const here = dirname(fileURLToPath(import.meta.url))
  const grids = GRIDS(here)
  const mod = loadComponent(here, instrument)
  console.log('| fixture | snapshots | update calls | update ms | cut ms | cut share |')
  console.log('| --- | --- | --- | --- | --- | --- |')
  for (const name of which) {
    const snaps = snapshots(grids[name], want, seed)
    const { totalMs, cutMs, calls, share } = timeUpdate(mod, snaps, reps)
    console.log(
      `| \`${name}\` | ${snaps.length} | ${calls} | ${totalMs.toFixed(0)} | ${cutMs.toFixed(0)} | ` +
      `**${(share * 100).toFixed(0)}%** |`
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, want, reps, seed] = process.argv.slice(2)
  main(name ? [name] : ['gen_28g', 'gen_24g'], Number(want) || 60, Number(reps) || 5, Number(seed) || 12345)
}
