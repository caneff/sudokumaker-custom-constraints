// Cut's share of `update` wall time, measured on states the app's search
// really reaches. Cut walks the grid once or twice per open cell of every
// digit; every other rule walks it once per digit.
//
//   node examples/isofill/cut-profile.mjs            # both hard fixtures
//   node examples/isofill/cut-profile.mjs gen_28g 200 5 777   # board, snapshots, reps, seed
//
// Two things the number includes, both small and both in cut's favour: one
// `performance.now()` pair per digit per call, and the removals cut yields
// inside its own loop (the consumer here drains them at once).

import { fileURLToPath } from 'url'
import { join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, makePuzzle, patchSource } from '../_shared/harness-lib.mjs'

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = Array.from({ length: N }, (_, d) => d)
// The cut loop's two ends, matched in the component's source; if either
// moves, `instrument` throws rather than time the wrong span.
const CUT_START = '  const depth = size - placed.length\n'
const CUT_END = '  if (held.length) yield puzzle.removeCandidatesFromCells(others, held)\n'

export function instrument (src) {
  src = patchSource(src, CUT_START, '  const _cutT0 = performance.now()\n' + CUT_START)
  return patchSource(src, CUT_END, CUT_END + '  globalThis.__cutMs += performance.now() - _cutT0\n')
}

// The shared loader attributes the run to IsofillComponent.js, so c8 counts it.
export function loadComponent (here, transform = s => s) {
  return makeIo(here).load('IsofillComponent.js', ['setParams', 'update'], transform)
}

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

function branch (rnd, cand) {
  const open = CELLS.filter(c => cand.get(c).length > 1)
  if (open.length === 0) return false
  const c = open[(rnd() * open.length) | 0]
  const ds = cand.get(c)
  cand.set(c, [ds[(rnd() * ds.length) | 0]])
  return true
}

export function snapshots (fx, want, seed = 12345) {
  const mod = loadComponent(fx.here)
  const { rnd } = makeRng(seed)
  const root = new Map()
  for (const c of CELLS) root.set(c, fx.given.has(c) ? [fx.truth[c]] : ALL.slice())
  const trail = []
  const reset = () => { const s = structuredClone(root); branch(rnd, s); return s }
  let cand = structuredClone(root)
  const out = []
  while (out.length < want) {
    out.push(structuredClone(cand))
    const next = propagate(mod, fx, cand)
    if (next === null) {
      cand = trail.length ? trail.pop() : structuredClone(root)
      if (!branch(rnd, cand)) cand = reset()
      continue
    }
    const settled = CELLS.every(c => next.get(c).length === cand.get(c).length)
    cand = next
    if (!settled) continue
    trail.push(structuredClone(cand))
    if (!branch(rnd, cand)) cand = reset()
  }
  return out
}

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
    const warm = r === 0
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
  if (cutMs === 0) throw new Error('cut-profile: no cut time recorded — was the component instrumented?')
  return { totalMs, cutMs, calls, share: cutMs / totalMs }
}

function main (which, want, reps, seed) {
  installGlobals(0, 9)
  const here = import.meta.dirname
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
