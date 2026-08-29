// Shared recovery engine: run the REAL components (the same main.js wiring
// SudokuMaker runs) over a start state to a propagation fixpoint, on top of a
// Régin-strength (GAC) all-different floor, then prove uniqueness with a DFS
// search. Each example (Hit Counts, Numbered Rooms, ...) supplies its own
// geometry, component files, extra propagator, and leaf check; the engine
// pieces that do not vary per example live here.
//
// The candidate state is a REASSIGNABLE map (state.cand), not a fixed one —
// the DFS search clones it before a guess and restores it on backtrack. This
// is a different shape from the fixed-map makePuzzle in harness-lib.mjs,
// which is why the two files stay separate.

import { makeIo } from './harness-lib.mjs'

// A candidate-state mock over a reassignable map (cell -> Set<value>).
// `state.cand` is meant to be reassigned wholesale (fresh seed, or restored
// from a clone on backtrack) — every accessor below reads it live off
// `state`, so a reassignment is visible everywhere without re-wiring.
export function makeCandidateState () {
  const state = {
    cand: new Map(),
    total () { let s = 0; for (const set of state.cand.values()) s += set.size; return s },
    anyEmpty () { for (const set of state.cand.values()) if (set.size === 0) return true; return false },
    clone () { const m = new Map(); for (const [k, v] of state.cand) m.set(k, new Set(v)); return m },
    puzzle: {
      hasValue: c => state.cand.get(c).size === 1,
      getValue: c => [...state.cand.get(c)][0],
      getCandidates: c => state.cand.get(c),
      getCandidatesBitMask: c => { let m = 0; for (const d of state.cand.get(c)) m |= 1 << d; return m },
      getCellsAreFilled: cs => cs.every(c => state.cand.get(c).size === 1),
      removeCandidateFromCell: (d, c) => { state.cand.get(c).delete(d) },
      removeCandidatesFromCell: (s, c) => { const set = state.cand.get(c); for (const d of s) set.delete(d) }
    }
  }
  return state
}

// Kuhn augmenting-path matching between `cells` and the values `getCand`
// offers each one. For a group of size <= 9 the brute per-edge recheck below
// (in makeAllDifferentFloor) is GAC by definition and plenty fast.
export function maxMatch (cells, getCand) {
  const byVal = new Map()
  function aug (cell, seen) {
    for (const v of getCand(cell)) {
      if (seen.has(v)) continue
      seen.add(v)
      if (!byVal.has(v) || aug(byVal.get(v), seen)) { byVal.set(v, cell); return true }
    }
    return false
  }
  let m = 0
  for (const cell of cells) if (aug(cell, new Set())) m++
  return m
}

// Build an all-different floor over `state`: a function that prunes one
// group's candidates. `kind: 'regin'` (default) is the GAC floor — a value
// stays for a cell only if some perfect matching of the group assigns it
// there. `kind: 'singles'` is the weaker naked/hidden-singles floor, useful
// as a bracket to show how much a stronger deduction earns over a weak
// all-different. `maxDigit` bounds the value range the singles floor scans.
export function makeAllDifferentFloor (state, { kind = 'regin', maxDigit } = {}) {
  function gacGroup (cells) {
    const base = c => state.cand.get(c)
    if (maxMatch(cells, base) !== cells.length) return // dead state: leave it
    for (const cell of cells) {
      for (const v of [...state.cand.get(cell)]) {
        const getCand = c => (c === cell ? new Set([v]) : state.cand.get(c))
        if (maxMatch(cells, getCand) !== cells.length) state.cand.get(cell).delete(v)
      }
    }
  }
  function singlesGroup (cells) {
    for (const cell of cells) {
      if (state.cand.get(cell).size !== 1) continue
      const v = [...state.cand.get(cell)][0]
      for (const other of cells) if (other !== cell) state.cand.get(other).delete(v)
    }
    for (let v = 1; v <= maxDigit; v++) {
      const homes = cells.filter(c => state.cand.get(c).has(v))
      if (homes.length === 1 && state.cand.get(homes[0]).size > 1) state.cand.set(homes[0], new Set([v]))
    }
  }
  return kind === 'singles' ? singlesGroup : gacGroup
}

// Load a list of component files plus main.js and run them exactly as
// SudokuMaker does, returning the built instances.
//   files: [{ file, names, ctorName }, ...] — `names` are the exports read
//     off the component file (setParams/update/initialize/...), `ctorName`
//     is the constructor name main.js expects in scope (e.g.
//     'HitCountsComponent').
//   mainSrc: the text of main.js.
//   input: the object main.js reads as `input` (its groups/geometry). Empty
//     for main-global.js, which builds its own frame instead of reading it.
//   builtins: in-memory modules for the built-in components main.js constructs
//     but that ship with SudokuMaker, not as example files — each is
//     { ctorName, mod } where mod supplies setParams/update (e.g.
//     ExactDigitCountComponent). They join the file-backed ctors in scope.
//   frame: { W, idx }, from frame-geometry.mjs's frameGeometry() — when
//     given, the registrar also answers getCellAt(r, c) = idx(r, c) and
//     spec.size.width = W, the two calls main-global.js's own frame-building
//     makes, so a probe can run that code instead of handing it a pre-built
//     `groups` list.
export function loadComponents ({ here, files, mainSrc, input, builtins = [], frame = null }) {
  const { load } = makeIo(here)
  const makeCtor = mod => function (name, ...args) {
    const inst = { name }
    mod.setParams(inst, ...args)
    inst.__mod = mod
    return inst
  }
  const comps = []
  const frameMethods = frame ? { getCellAt: frame.idx, spec: { size: { width: frame.W } } } : {}
  const registrar = { addConstraintComponent: inst => comps.push(inst), ...frameMethods }
  const fromFiles = files.map(f => ({ ctorName: f.ctorName, mod: load(f.file, f.names) }))
  const ctors = [...fromFiles, ...builtins]
  const run = new Function('input', 'helpers', 'puzzle', ...ctors.map(c => c.ctorName), mainSrc) // eslint-disable-line no-new-func
  run(input, globalThis.helpers, registrar, ...ctors.map(c => makeCtor(c.mod)))
  return comps
}

// One propagation pass is: every component's update, then the all-different
// floor over every group, then an optional extra propagator (an
// example-specific candidate deduction layered on top, e.g. a matching
// bound). Repeats to a fixpoint (no candidate removed this pass) or
// `maxPasses`. Returns the pass count it took, or -1 if it never settled.
export function runToFixpoint (state, comps, alldiffGroups, floorGroup, { init = true, extra = null, maxPasses = 500 } = {}) {
  if (init) for (const inst of comps) if (inst.__mod.initialize) Array.from(inst.__mod.initialize(inst, state.puzzle)) // n-1 prune
  for (let pass = 0; pass < maxPasses; pass++) {
    const before = state.total()
    for (const inst of comps) Array.from(inst.__mod.update(inst, state.puzzle)) // apply
    for (const g of alldiffGroups) floorGroup(g)
    if (extra) extra()
    if (state.total() === before) return pass + 1
  }
  return -1
}

// A state is dead if a cell is empty OR some all-different group has no
// perfect matching (its cells cannot take distinct values). The GAC floor
// leaves an infeasible group untouched rather than emptying a cell, so a
// caller doing search must test matchability itself.
export function dead (state, alldiffGroups) {
  if (state.anyEmpty()) return true
  for (const g of alldiffGroups) if (maxMatch(g, c => state.cand.get(c)) !== g.length) return true
  return false
}

// DFS uniqueness search: MRV branching (fewest candidates first, values
// ascending), running the fixpoint after every guess and backtracking on a
// dead state. `interior` is the cell list to branch over; `validLeaf` is the
// caller's model-specific check that a full assignment is a real solution
// (the components prune toward this but do not reject a completed instance
// on their own). Returns {nodes, solutions, capped} — capped means the
// NODE_CAP was hit before the search finished. `stopAtFirst` returns as soon as
// one solution is found (solutions caps at 1, capped stays false): use it to ask
// "can this wiring solve the puzzle at all" rather than "is it unique" — the
// difference between finding a solution and proving no others exist.
export function search (state, { interior, comps, alldiffGroups, floorGroup, extra = null, validLeaf, nodeCap = 3_000_000, stopAtFirst = false }) {
  let nodes = 0
  let solutions = 0
  let capped = false
  let done = false
  function pickMRV () {
    let best = null; let bs = Infinity
    for (const c of interior) { const s = state.cand.get(c).size; if (s > 1 && s < bs) { bs = s; best = c } }
    return best
  }
  function dfs () {
    if (done || capped || nodes > nodeCap) { if (!done) capped = true; return }
    const cell = pickMRV()
    if (cell === null) { if (validLeaf()) { solutions++; if (stopAtFirst) done = true } return }
    for (const v of [...state.cand.get(cell)].sort((a, b) => a - b)) {
      nodes++
      const saved = state.clone()
      state.cand.set(cell, new Set([v]))
      runToFixpoint(state, comps, alldiffGroups, floorGroup, { init: false, extra })
      if (!dead(state, alldiffGroups)) dfs()
      state.cand = saved
      if (capped || done) return
    }
  }
  if (!dead(state, alldiffGroups)) dfs()
  return { nodes, solutions, capped }
}

// Soundness backstop: count cells whose true value did not survive.
// `truthPairs` is an iterable of [cell, trueValue]. Zero means every true
// value is still a candidate everywhere it needs to be.
export function countLost (state, truthPairs) {
  let lost = 0
  for (const [cell, v] of truthPairs) if (!state.cand.get(cell).has(v)) lost++
  return lost
}

// Format one recovery-report line. `extra` is a caller-formatted prefix
// (e.g. "hidden 4/11, interior 0/36, ") for measures specific to the example;
// removed/passes/lost are the generic measures every recovery run has.
export function reportLine (label, { extra = '', removed, passes, lost }) {
  return `  ${label}: ${extra}removed ${removed} cands, ${passes} passes${lost ? `, TRUE-VALUE LOST x${lost}` : ''}`
}
