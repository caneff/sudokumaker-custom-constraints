// Recovery probe: does the matching bound (issue #12) actually help SOLVE a real
// puzzle, or is it just tighter in the abstract?
//
//   node examples/hit-counts/recovery-probe.mjs            # gen_6x6.json
//   node examples/hit-counts/recovery-probe.mjs gen.json
//
// It runs the ACTUAL components — the same main-global.js wiring SudokuMaker
// runs on the shipped (frame) board — over a generated puzzle's start state,
// to a propagation fixpoint. The one thing the
// real solver adds that these files do not is the built-in all-different, so we
// stand in a Régin-strength (GAC) all-different over every row, column, and box.
// That is the honest floor: the matching bound must earn its keep ON TOP of an
// all-different that already kills the gross matching-infeasible states.
//
// We run the fixpoint twice from the same start — matching bound ON, then OFF
// (matchingBounds patched to return null, so the reverse clue bound falls back to
// the naive [forced, possible]) — and diff what propagation alone recovers:
//   - hidden clues pinned (the number the issue is about);
//   - interior cells solved;
//   - candidates removed.
// A true value that does not survive either run is a probe (or soundness) bug and
// is reported.
//
// The engine pieces that do not vary per example (the all-different floor, the
// component loader, the fixpoint runner, the DFS uniqueness search) live in
// ../_shared/recovery-lib.mjs, and the frame-probe skeleton (seeding,
// report, argv, DELTA/exit) in ../_shared/frame-probe.mjs. This file keeps only
// the Hit Counts glue: the matching-bound extra propagator and the hit-count
// leaf check.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { makeFrameProbe } from '../_shared/frame-probe.mjs'
import { runToFixpoint } from '../_shared/recovery-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// The candidate deduction under test: the Régin-style matching clue bound. A legal
// line is a perfect matching of positions to values (each from its candidates); a
// hit is the edge from position i to value i+1. matchingBounds returns the least
// and most hit edges over any such matching — a bound at least as tight as naive
// [forced, possible] — or null when no matching exists. matchingReverse applies it
// as an extra propagator: it tightens each unpinned clue to that range, exactly
// what a component-level matching bound would do, without touching the component.
function matchingBounds (st, line) {
  const nn = line.length
  const cands = line.map(cell => [...st.cand.get(cell)].filter(v => v >= 1 && v <= nn))
  const SIZE = 1 << nn
  let curMin = new Array(SIZE).fill(Infinity)
  let curMax = new Array(SIZE).fill(-Infinity)
  curMin[0] = 0; curMax[0] = 0
  for (let i = 0; i < nn; i++) {
    const nextMin = new Array(SIZE).fill(Infinity)
    const nextMax = new Array(SIZE).fill(-Infinity)
    for (let mask = 0; mask < SIZE; mask++) {
      if (curMax[mask] === -Infinity) continue
      for (const v of cands[i]) {
        const bit = 1 << (v - 1)
        if (mask & bit) continue
        const nm = mask | bit
        const add = v === i + 1 ? 1 : 0
        nextMin[nm] = Math.min(nextMin[nm], curMin[mask] + add)
        nextMax[nm] = Math.max(nextMax[nm], curMax[mask] + add)
      }
    }
    curMin = nextMin; curMax = nextMax
  }
  const full = SIZE - 1
  return curMax[full] === -Infinity ? null : { min: curMin[full], max: curMax[full] }
}
function matchingReverse ({ st, groups }) {
  for (const g of groups) {
    const clueId = g.cells[0]
    if (st.cand.get(clueId).size === 1) continue // pinned: the component's !hasValue guard
    const mb = matchingBounds(st, g.cells.slice(1))
    if (!mb) continue
    for (const d of [...st.cand.get(clueId)]) if (d < mb.min || d > mb.max) st.cand.get(clueId).delete(d)
  }
}

// Diagnostic: does the matching bound have any teeth on this puzzle? Count the
// lines where matchingBounds is strictly tighter than the naive scan — first on
// the raw start state, then after the floor alone reaches a fixpoint. Zero at both
// means the feature never fires here, so a zero recovery delta is expected, not a
// bug in the probe.
// The naive bound the matching is compared against: a cell is a forced hit once
// it is pinned to its target digit, and a possible hit while that digit is still
// a candidate, so the hit count lies in [forced, possible].
function naiveBounds (st, line) {
  let forced = 0
  let possible = 0
  for (let i = 0; i < line.length; i++) {
    const cands = st.cand.get(line[i])
    if (!cands.has(i + 1)) continue
    possible++
    if (cands.size === 1) forced++
  }
  return { forced, possible }
}
function tighterLines ({ st, groups }) {
  let count = 0
  for (const g of groups) {
    const line = g.cells.slice(1)
    const naive = naiveBounds(st, line)
    const mb = matchingBounds(st, line)
    if (mb && (mb.min > naive.forced || mb.max < naive.possible)) count++
  }
  return count
}

// A full interior is a real solution only if every line's hit count equals its
// clue. update prunes toward this but does not reject a completed line on its own
// (it skips the reverse check once the clue is pinned), so the real solver leans
// on validate at the leaf; this is that leaf check, model-independent.
function validLeaf ({ st, groups }) {
  for (const g of groups) {
    const clueCellId = g.cells[0]
    const line = g.cells.slice(1)
    if (st.cand.get(clueCellId).size !== 1) return false
    const clueV = [...st.cand.get(clueCellId)][0]
    let h = 0
    for (let i = 0; i < line.length; i++) if ([...st.cand.get(line[i])][0] === i + 1) h++
    if (h !== clueV) return false
  }
  return true
}

makeFrameProbe({
  here: HERE,
  clueRange: n => [0, n],
  files: [
    { file: 'HitCountsJointComponent.js', names: ['setParams', 'update', 'initialize'], ctorName: 'HitCountsJointComponent' },
    { file: 'SideSumComponent.js', names: ['setParams', 'update'], ctorName: 'SideSumComponent' },
    { file: 'SideHitMatchingComponent.js', names: ['setParams', 'update', 'initialize'], ctorName: 'SideHitMatchingComponent' }
  ],
  blankWord: 'hidden',
  headerNote: ({ floorKind }) => ` (floor: ${floorKind})`,
  // 'floor' runs the all-different floor alone (no hit-counts components) — the
  // baseline before any hit-counts deduction; 'off' adds the shipped components
  // (naive clue bound); 'on' also applies the candidate matching bound. Search
  // runs only off vs on: a floor-only run has no clue constraints and countless
  // solutions, so it never terminates.
  modes: [
    { key: 'floor', label: 'floor only  ', build: () => [], search: false },
    { key: 'off', label: 'matching OFF' },
    { key: 'on', label: 'matching ON ', extra: matchingReverse }
  ],
  deltas: [
    ['components over floor (off - floor):', 'floor', 'off'],
    ['matching over naive  (on - off):   ', 'off', 'on']
  ],
  beforeReport: p => {
    const { st, keys, alldiffGroups, floorGroup, floorKind } = p
    const tightStart = tighterLines(p)
    runToFixpoint(st, [], alldiffGroups, floorGroup, { init: false })
    const tightAfterFloor = tighterLines(p)
    console.log(`  matching tighter than naive: ${tightStart}/${keys.length} lines at start, ${tightAfterFloor}/${keys.length} after the ${floorKind} floor`)
  },
  validLeaf
})
