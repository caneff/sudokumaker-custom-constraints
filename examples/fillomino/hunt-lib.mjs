// Offline board hunting for fillomino (#317): score a clue set's hardness in
// Node instead of in the live app.
//
// The app judges a board in minutes; this scores one in milliseconds by
// running the SHIPPED component as the propagator inside a plain
// propagate-and-branch search. Hardness = search nodes, tie-broken by
// propagation passes. Offline scores RANK candidate boards; the app still
// has the last word on any board that ships (docs/real-app-timing.md).

import { installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'
import { seededShuffle } from '../_shared/app-strip-lib.mjs'

// The component, loaded the way the soundness harness loads it.
export function loadComponent (here) {
  const { load } = makeIo(here)
  return load('FillominoComponent.js', ['setParams', 'update', 'validate'])
}

const total = p => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }
const dead = p => { for (const s of p._cand.values()) if (s.size === 0) return true; return false }

// A fresh board state: every given pinned, every other cell open over 1..cap.
function newPuzzle (side, cap, givens) {
  const all = Array.from({ length: cap }, (_, i) => i + 1)
  const truth = {}
  for (let i = 0; i < side * side; i++) truth[i] = 0
  return makePuzzle(truth, i => (givens[i] === undefined ? all : [givens[i]]))
}

// Run update until a pass removes nothing. Bounded well above the component's
// own reach so the bound is a guard, not a policy.
const MAX_PASSES = 200

function propagate (mod, inst, p) {
  for (let passes = 1; passes <= MAX_PASSES; passes++) {
    const before = total(p)
    Array.from(mod.update(inst, p))
    if (dead(p)) return { passes, dead: true }
    if (total(p) === before) return { passes, dead: false }
  }
  return { passes: MAX_PASSES, dead: false }
}

const rowsOf = (p, side) =>
  Array.from({ length: side }, (_, r) =>
    Array.from({ length: side }, (_, c) => [...p._cand.get(r * side + c)][0]))

// Score a clue set. `verdict` is 'unique', 'multiple', 'none', or 'capped'
// when the node budget ran out -- capped is never read as a verdict, the same
// rule CP-SAT timeouts follow (generate.py).
export function score (mod, { side, cap, givens }, { nodeCap = 200000 } = {}) {
  installGlobals(1, cap)
  const inst = {}
  mod.setParams(inst, Array.from({ length: side * side }, (_, i) => i))
  const counts = { nodes: 0, passes: 0 }
  const found = []
  const p = newPuzzle(side, cap, givens)
  const capped = !search(mod, inst, p, side, counts, found, nodeCap)
  return {
    verdict: capped ? 'capped' : ['none', 'unique', 'multiple'][found.length],
    nodes: counts.nodes,
    passes: counts.passes,
    grid: found.length ? found[0] : null
  }
}

// Depth-first search over the open cells, smallest candidate set first.
// Returns false when the node budget ran out. Stops after two solutions:
// "more than one" is the whole question a uniqueness check asks.
function search (mod, inst, p, side, counts, found, nodeCap) {
  const { passes, dead: isDead } = propagate(mod, inst, p)
  counts.passes += passes
  if (isDead) return true
  let best = -1
  let bestSize = Infinity
  for (const [c, s] of p._cand) {
    if (s.size > 1 && s.size < bestSize) { best = c; bestSize = s.size }
  }
  if (best === -1) {
    if (mod.validate(inst, p)) found.push(rowsOf(p, side))
    return true
  }
  const snapshot = [...p._cand].map(([c, s]) => [c, [...s]])
  for (const d of [...p._cand.get(best)]) {
    if (counts.nodes >= nodeCap) return false
    counts.nodes++
    for (const [c, vals] of snapshot) p._cand.set(c, new Set(vals))
    p._cand.set(best, new Set([d]))
    if (!search(mod, inst, p, side, counts, found, nodeCap)) return false
    if (found.length >= 2) return true
  }
  return true
}

// The clue set as a cell-index -> digit map, the shape `score` reads.
export function givensOf (grid, clues) {
  const side = grid.length
  return Object.fromEntries(clues.map(([r, c]) => [r * side + c, grid[r][c]]))
}

// Greedy given-removal against the offline scorer, in the same order
// semantics app-strip.mjs uses in the live app: a seeded shuffle of the clue
// list, one pass, a removal kept only when the board still closes on the same
// grid. The invariant the app tool holds is held here -- what changes is the
// oracle, not the walk. Returns the surviving clues, sorted.
// `nodeCap` is deliberately lower than a scoring run's: a strip makes ~one
// trial per cell, and a trial that runs away costs more than the clue it
// might have removed. A 'capped' trial keeps the clue, so a low cap can only
// leave the board with more clues than it needed -- never fewer.
export function stripOffline (mod, { side, cap, grid }, seed, onTrial = () => {}, nodeCap = 20000) {
  const clues = seededShuffle(grid.flatMap((row, r) => row.map((_, c) => [r, c])), seed)
  let kept = clues
  for (const cell of clues) {
    const rest = kept.filter(p => p !== cell)
    const s = score(mod, { side, cap, givens: givensOf(grid, rest) }, { nodeCap })
    const ok = s.verdict === 'unique'
    onTrial({ cell, kept: ok, score: s })
    if (ok) kept = rest
  }
  return kept.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

// Hardness order: search nodes, tie-broken by propagation passes. Positive
// when `a` is the harder board.
export function harder (a, b) {
  return a.nodes - b.nodes || a.passes - b.passes
}

// The hill-climb's keep/drop rule, and the line that reproduces the mutation.
// A mutant replaces its seed only when it still has exactly one solution and
// outranks the seed; anything else -- more than one solution, none, or a spent
// node budget -- is dropped whatever it scored.
export function judgeMutant (seed, mutant) {
  const kept = mutant.score.verdict === 'unique' && harder(mutant.score, seed.score) > 0
  return {
    kept,
    record: {
      seed: seed.label,
      rngSeed: mutant.rngSeed,
      freed: mutant.freed,
      from: seed.score,
      to: mutant.score,
      kept
    }
  }
}

// Spearman's rank correlation, ties taking the average rank. Null when one
// side has no spread, where a correlation has no meaning. Used to report how
// the offline ranking lines up with the app's recorded cold times -- a
// reported number, never a gate.
export function spearman (xs, ys) {
  const rank = vs => {
    const order = vs.map((v, i) => i).sort((a, b) => vs[a] - vs[b])
    const r = new Array(vs.length)
    for (let i = 0; i < order.length;) {
      let j = i
      while (j + 1 < order.length && vs[order[j + 1]] === vs[order[i]]) j++
      const avg = (i + j) / 2 + 1
      for (let k = i; k <= j; k++) r[order[k]] = avg
      i = j + 1
    }
    return r
  }
  const rx = rank(xs)
  const ry = rank(ys)
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length
  const mx = mean(rx)
  const my = mean(ry)
  let cov = 0
  let sx = 0
  let sy = 0
  for (let i = 0; i < rx.length; i++) {
    cov += (rx[i] - mx) * (ry[i] - my)
    sx += (rx[i] - mx) ** 2
    sy += (ry[i] - my) ** 2
  }
  return sx === 0 || sy === 0 ? null : cov / Math.sqrt(sx * sy)
}
