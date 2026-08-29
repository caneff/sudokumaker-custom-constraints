// Recovery probe: does the matching bound (issue #12) actually help SOLVE a real
// puzzle, or is it just tighter in the abstract?
//
//   node examples/hit-counts/recovery-probe.mjs            # gen_6x6.json
//   node examples/hit-counts/recovery-probe.mjs gen_9x9.json
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
// ../_shared/recovery-lib.mjs. This file keeps only the Hit Counts glue: the
// frame geometry, the gen-JSON seeding, the matching-bound extra propagator, and
// the hit-count leaf check.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo } from '../_shared/harness-lib.mjs'
import {
  makeCandidateState, makeAllDifferentFloor, loadComponents,
  runToFixpoint, search, countLost, reportLine
} from '../_shared/recovery-lib.mjs'
import { frameGeometry } from '../_shared/frame-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || 'gen_6x6.json'
const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
const { n, box: [bh, bw], grid, clue, active } = gen
const activeSet = new Set(active)
const givens = gen.givens || {}

installGlobals(0, n)
globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

// ---- geometry (mirrors build_size.py) ----
const { W, idx, interior, clueCell, keys, groups, alldiffGroups } = frameGeometry(n, [bh, bw])

// ---- the shared candidate state ----
const RANGE = (lo, hi) => { const s = new Set(); for (let d = lo; d <= hi; d++) s.add(d); return s }
const st = makeCandidateState()

function freshState () {
  st.cand = new Map()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const g = givens[`${r},${c}`]
      st.cand.set(interior(r, c), g != null ? new Set([g]) : RANGE(1, n))
    }
  }
  for (const k of keys) {
    const side = k[0]; const i = +k.slice(1)
    st.cand.set(clueCell(side, i), activeSet.has(k) ? new Set([clue[k]]) : RANGE(0, n))
  }
}

// ---- load the real components + the real main-global.js wiring ----
// main-global.js builds the frame itself (no groups input), so it needs the
// puzzle mock's getCellAt/spec.size.width -- `frame: { W, idx }` ties those
// to the same W/idx this probe already uses, so main-global.js's own
// frame-building produces the identical `groups` list computed above.
const { read } = makeIo(HERE)
const mainSrc = read('main-global.js')
function buildComps () {
  return loadComponents({
    here: HERE,
    mainSrc,
    input: {},
    frame: { W, idx },
    files: [
      { file: 'HitCountsComponent.js', names: ['setParams', 'update', 'initialize'], ctorName: 'HitCountsComponent' },
      { file: 'SideSumComponent.js', names: ['setParams', 'update'], ctorName: 'SideSumComponent' },
      { file: 'HitCountsPairComponent.js', names: ['setParams', 'update'], ctorName: 'HitCountsPairComponent' }
    ]
  })
}

// The candidate deduction under test: the Régin-style matching clue bound. A legal
// line is a perfect matching of positions to values (each from its candidates); a
// hit is the edge from position i to value i+1. matchingBounds returns the least
// and most hit edges over any such matching — a bound at least as tight as naive
// [forced, possible] — or null when no matching exists. matchingReverse applies it
// as an extra propagator: it tightens each unpinned clue to that range, exactly
// what a component-level matching bound would do, without touching the component.
function matchingBounds (line) {
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
function matchingReverse () {
  for (const g of groups) {
    const clueId = g.cells[0]
    if (st.cand.get(clueId).size === 1) continue // pinned: the component's !hasValue guard
    const mb = matchingBounds(g.cells.slice(1))
    if (!mb) continue
    for (const d of [...st.cand.get(clueId)]) if (d < mb.min || d > mb.max) st.cand.get(clueId).delete(d)
  }
}

// ---- Régin (GAC) all-different floor ----
const FLOOR = (process.argv.find(a => a.startsWith('--floor=')) || '--floor=regin').split('=')[1]
const floorGroup = makeAllDifferentFloor(st, { kind: FLOOR, maxDigit: n })

// ---- measure one run ----
const hiddenKeys = keys.filter(k => !activeSet.has(k))
// mode: 'floor' runs the all-different floor alone (no hit-counts components) —
// the baseline before any hit-counts deduction; 'off' adds the shipped components
// (naive clue bound); 'on' also applies the candidate matching bound.
function report (label, mode) {
  freshState()
  const start = st.total()
  const comps = mode === 'floor' ? [] : buildComps()
  const passes = runToFixpoint(st, comps, alldiffGroups, floorGroup, { init: true, extra: mode === 'on' ? matchingReverse : null })
  const hiddenRecovered = hiddenKeys.filter(k => {
    const side = k[0]; const i = +k.slice(1)
    return st.cand.get(clueCell(side, i)).size === 1
  }).length
  let interiorSolved = 0
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (st.cand.get(interior(r, c)).size === 1) interiorSolved++
  // soundness: every true value must survive
  const truth = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth.push([interior(r, c), grid[r][c]])
  for (const k of keys) { const side = k[0]; const i = +k.slice(1); truth.push([clueCell(side, i), clue[k]]) }
  const lost = countLost(st, truth)
  const removed = start - st.total()
  console.log(reportLine(label, { extra: `hidden ${hiddenRecovered}/${hiddenKeys.length}, interior ${interiorSolved}/${n * n}, `, removed, passes, lost }))
  return { hiddenRecovered, interiorSolved, removed, lost }
}

// Diagnostic: does the matching bound have any teeth on this puzzle? Count the
// lines where matchingBounds is strictly tighter than the naive scan — first on
// the raw start state, then after the floor alone reaches a fixpoint. Zero at both
// means the feature never fires here, so a zero recovery delta is expected, not a
// bug in the probe.
function tighterLines () {
  const { load } = makeIo(HERE)
  const hc = load('HitCountsComponent.js', ['scan'])
  let count = 0
  for (const g of groups) {
    const line = g.cells.slice(1)
    const naive = hc.scan(st.puzzle, line)
    const mb = matchingBounds(line)
    if (mb && (mb.min > naive.forced || mb.max < naive.possible)) count++
  }
  return count
}

// ---- search: does the matching cut backtracking? ----
// Root recovery is only half the story: during search, cells get pinned and the
// line domains turn partial — exactly where the matching bites. So run a full
// DFS that proves uniqueness (finds every solution, expecting one) and count the
// nodes explored, matching on vs off. Fewer nodes = the matching pruned dead
// branches earlier. Same MRV branching (fewest candidates first, values
// ascending) both runs, so the count reflects the puzzles the solver actually
// meets in search, not a synthetic state.
const INT = []
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) INT.push(interior(r, c))
// A full interior is a real solution only if every line's hit count equals its
// clue. update prunes toward this but does not reject a completed line on its own
// (it skips the reverse check once the clue is pinned), so the real solver leans
// on validate at the leaf; this is that leaf check, model-independent.
function validLeaf () {
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
function searchRun (mode) {
  freshState()
  const matching = mode === 'on'
  const comps = buildComps()
  const extra = matching ? matchingReverse : null
  runToFixpoint(st, comps, alldiffGroups, floorGroup, { init: true, extra })
  return search(st, { interior: INT, comps, alldiffGroups, floorGroup, extra, validLeaf })
}

console.log(`${file}: n=${n}, box ${bh}x${bw}, ${active.length}/${keys.length} clues shown, ${hiddenKeys.length} hidden, ${Object.keys(givens).length} interior givens (floor: ${FLOOR})`)

if (process.argv.includes('--search')) {
  // Only off vs on: the full constraint set has the one true solution, so the tree
  // is bounded. (A floor-only run has no clue constraints and countless solutions,
  // so it never terminates — it is not a meaningful search baseline.)
  // --only=on / --only=off runs a single mode (each is slow on n=9).
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]
  const modes = [['matching OFF', 'off'], ['matching ON ', 'on']].filter(([, m]) => !only || m === only)
  for (const [label, mode] of modes) {
    const r = searchRun(mode)
    const note = r.capped ? ' CAPPED' : (r.solutions === 1 ? '' : ` (solutions=${r.solutions}!)`)
    console.log(`  ${label}: ${r.nodes} search nodes, ${r.solutions} solution${r.solutions === 1 ? '' : 's'}${note}`)
  }
} else {
  freshState()
  const tightStart = tighterLines()
  for (let pass = 0; pass < 500; pass++) { const b = st.total(); for (const g of alldiffGroups) floorGroup(g); if (st.total() === b) break }
  const tightAfterFloor = tighterLines()
  console.log(`  matching tighter than naive: ${tightStart}/${keys.length} lines at start, ${tightAfterFloor}/${keys.length} after the ${FLOOR} floor`)
  const floor = report('floor only  ', 'floor')
  const off = report('matching OFF', 'off')
  const on = report('matching ON ', 'on')
  console.log(`  DELTA components over floor (off - floor): hidden +${off.hiddenRecovered - floor.hiddenRecovered}, interior +${off.interiorSolved - floor.interiorSolved}, removed +${off.removed - floor.removed}`)
  console.log(`  DELTA matching over naive  (on - off):    hidden +${on.hiddenRecovered - off.hiddenRecovered}, interior +${on.interiorSolved - off.interiorSolved}, removed +${on.removed - off.removed}`)
  if (on.lost || off.lost || floor.lost) { console.log('  FAIL: a true value was removed'); process.exit(1) }
}
