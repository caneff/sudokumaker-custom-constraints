// Recovery probe: does the matching bound (issue #12) actually help SOLVE a real
// puzzle, or is it just tighter in the abstract?
//
//   node examples/hit-counts/recovery-probe.mjs            # gen_6.json
//   node examples/hit-counts/recovery-probe.mjs gen_9.json
//
// It runs the ACTUAL components — the same main.js wiring SudokuMaker runs — over
// a generated puzzle's start state, to a propagation fixpoint. The one thing the
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

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || 'gen_6.json'
const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
const { n, box: [bh, bw], grid, clue, active } = gen
const activeSet = new Set(active)
const givens = gen.givens || {}

installGlobals(0, n)
globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

// ---- geometry (mirrors build_size.py) ----
const W = n + 2
const idx = (r, c) => r * W + c
const interior = (r, c) => idx(r + 1, c + 1)

function lineCells (side, i) {
  const cells = []
  if (side === 'L') for (let c = 0; c < n; c++) cells.push(interior(i, c))
  if (side === 'R') for (let c = n - 1; c >= 0; c--) cells.push(interior(i, c))
  if (side === 'T') for (let r = 0; r < n; r++) cells.push(interior(r, i))
  if (side === 'B') for (let r = n - 1; r >= 0; r--) cells.push(interior(r, i))
  return cells
}
function clueCell (side, i) {
  if (side === 'L') return idx(i + 1, 0)
  if (side === 'R') return idx(i + 1, W - 1)
  if (side === 'T') return idx(0, i + 1)
  return idx(W - 1, i + 1)
}

// Every clued line, keyed "L0".."B{n-1}", as { key, clue cell, line cells }.
const keys = []
for (let i = 0; i < n; i++) for (const s of ['L', 'R', 'T', 'B']) keys.push(s + i)
const groups = keys.map(k => {
  const side = k[0]; const i = +k.slice(1)
  return { key: k, cells: [clueCell(side, i), ...lineCells(side, i)] }
})

// ---- the shared candidate state ----
const RANGE = (lo, hi) => { const s = new Set(); for (let d = lo; d <= hi; d++) s.add(d); return s }
let cand      // reassigned per run

function freshState () {
  cand = new Map()
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const g = givens[`${r},${c}`]
    cand.set(interior(r, c), g != null ? new Set([g]) : RANGE(1, n))
  }
  for (const k of keys) {
    const side = k[0]; const i = +k.slice(1)
    cand.set(clueCell(side, i), activeSet.has(k) ? new Set([clue[k]]) : RANGE(0, n))
  }
}

const puzzle = {
  hasValue: c => cand.get(c).size === 1,
  getValue: c => [...cand.get(c)][0],
  getCandidates: c => cand.get(c),
  getCellsAreFilled: cs => cs.every(c => cand.get(c).size === 1),
  removeCandidateFromCell: (d, c) => { cand.get(c).delete(d) },
  removeCandidatesFromCell: (s, c) => { const set = cand.get(c); for (const d of s) set.delete(d) }
}

// ---- load the real components + the real main.js wiring ----
const read = f => readFileSync(join(HERE, f), 'utf8')
const loadSrc = (src, names) =>
  eval('(function(){' + src + '\n return {' + names.join(',') + '};})()')
const mainSrc = read('main.js')

function makeCtor (mod) {
  return function (name, ...args) {
    const inst = { name }
    mod.setParams(inst, ...args)
    inst.__mod = mod
    return inst
  }
}

// Build the component instances by running main.js exactly as SudokuMaker does.
// The shipped component uses the naive [forced, possible] clue bound; the matching
// is the CANDIDATE deduction this probe evaluates, applied as an extra propagator
// (matchingReverse) in the 'on' runs, never baked into the component.
function buildComps () {
  const hc = loadSrc(read('HitCountsComponent.js'), ['setParams', 'update', 'initialize'])
  const side = loadSrc(read('SideSumComponent.js'), ['setParams', 'update'])
  const pair = loadSrc(read('HitCountsPairComponent.js'), ['setParams', 'update'])
  const comps = []
  const registrar = { addConstraintComponent: inst => comps.push(inst) }
  const run = new Function('input', 'helpers', 'puzzle',
    'HitCountsComponent', 'SideSumComponent', 'HitCountsPairComponent', mainSrc)
  run({ groups }, globalThis.helpers, registrar,
    makeCtor(hc), makeCtor(side), makeCtor(pair))
  return comps
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
  const cands = line.map(cell => [...cand.get(cell)].filter(v => v >= 1 && v <= nn))
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
    if (cand.get(clueId).size === 1) continue          // pinned: the component's !hasValue guard
    const mb = matchingBounds(g.cells.slice(1))
    if (!mb) continue
    for (const d of [...cand.get(clueId)]) if (d < mb.min || d > mb.max) cand.get(clueId).delete(d)
  }
}

// ---- Régin (GAC) all-different floor ----
// A value stays for a cell only if some perfect matching of the group assigns it
// there. maxMatch is Kuhn augmenting; for a group of size k <= 9 the brute
// per-edge recheck is GAC by definition and plenty fast.
function maxMatch (cells, getCand) {
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
function gacGroup (cells) {
  const base = c => cand.get(c)
  if (maxMatch(cells, base) !== cells.length) return   // dead state: leave it
  for (const cell of cells) {
    for (const v of [...cand.get(cell)]) {
      const getCand = c => (c === cell ? new Set([v]) : cand.get(c))
      if (maxMatch(cells, getCand) !== cells.length) cand.get(cell).delete(v)
    }
  }
}
// The weaker floor: naked singles (a pinned cell clears its value from peers) and
// hidden singles (a value with one home in the group pins that cell). This is the
// bracket — if the matching helps over singles but not over Régin, its whole value
// sits in the gap between the two, i.e. only when the all-different is weak.
function singlesGroup (cells) {
  for (const cell of cells) {
    if (cand.get(cell).size !== 1) continue
    const v = [...cand.get(cell)][0]
    for (const other of cells) if (other !== cell) cand.get(other).delete(v)
  }
  for (let v = 1; v <= n; v++) {
    const homes = cells.filter(c => cand.get(c).has(v))
    if (homes.length === 1 && cand.get(homes[0]).size > 1) cand.set(homes[0], new Set([v]))
  }
}
const FLOOR = (process.argv.find(a => a.startsWith('--floor=')) || '--floor=regin').split('=')[1]
const floorGroup = FLOOR === 'singles' ? singlesGroup : gacGroup
const alldiffGroups = []
for (let r = 0; r < n; r++) alldiffGroups.push(Array.from({ length: n }, (_, c) => interior(r, c)))
for (let c = 0; c < n; c++) alldiffGroups.push(Array.from({ length: n }, (_, r) => interior(r, c)))
for (let br = 0; br < n; br += bh) for (let bc = 0; bc < n; bc += bw) {
  const cells = []
  for (let dr = 0; dr < bh; dr++) for (let dc = 0; dc < bw; dc++) cells.push(interior(br + dr, bc + dc))
  alldiffGroups.push(cells)
}

// ---- the fixpoint ----
const totalCands = () => { let s = 0; for (const set of cand.values()) s += set.size; return s }
function runToFixpoint (comps, init = true, matching = false) {
  if (init) for (const inst of comps) if (inst.__mod.initialize) for (const _ of inst.__mod.initialize(inst, puzzle)) { /* n-1 prune */ }
  for (let pass = 0; pass < 500; pass++) {
    const before = totalCands()
    for (const inst of comps) for (const _ of inst.__mod.update(inst, puzzle)) { /* apply */ }
    for (const g of alldiffGroups) floorGroup(g)
    if (matching) matchingReverse()
    if (totalCands() === before) return pass + 1
  }
  return -1
}

// ---- measure one run ----
const hiddenKeys = keys.filter(k => !activeSet.has(k))
// mode: 'floor' runs the all-different floor alone (no hit-counts components) —
// the baseline before any hit-counts deduction; 'off' adds the shipped components
// (naive clue bound); 'on' also applies the candidate matching bound.
function report (label, mode) {
  freshState()
  const start = totalCands()
  const comps = mode === 'floor' ? [] : buildComps()
  const passes = runToFixpoint(comps, true, mode === 'on')
  const hiddenRecovered = hiddenKeys.filter(k => {
    const side = k[0]; const i = +k.slice(1)
    return cand.get(clueCell(side, i)).size === 1
  }).length
  let interiorSolved = 0
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (cand.get(interior(r, c)).size === 1) interiorSolved++
  // soundness: every true value must survive
  let lost = 0
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!cand.get(interior(r, c)).has(grid[r][c])) lost++
  for (const k of keys) { const side = k[0]; const i = +k.slice(1); if (!cand.get(clueCell(side, i)).has(clue[k])) lost++ }
  const removed = start - totalCands()
  console.log(`  ${label}: hidden ${hiddenRecovered}/${hiddenKeys.length}, interior ${interiorSolved}/${n * n}, removed ${removed} cands, ${passes} passes${lost ? `, TRUE-VALUE LOST x${lost}` : ''}`)
  return { hiddenRecovered, interiorSolved, removed, lost }
}

// Diagnostic: does the matching bound have any teeth on this puzzle? Count the
// lines where matchingBounds is strictly tighter than the naive scan — first on
// the raw start state, then after the floor alone reaches a fixpoint. Zero at both
// means the feature never fires here, so a zero recovery delta is expected, not a
// bug in the probe.
function tighterLines () {
  const hc = loadSrc(read('HitCountsComponent.js'), ['scan'])
  let count = 0
  for (const g of groups) {
    const line = g.cells.slice(1)
    const naive = hc.scan(puzzle, line)
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
const cloneCand = () => { const m = new Map(); for (const [k, v] of cand) m.set(k, new Set(v)); return m }
const anyEmpty = () => { for (const s of cand.values()) if (s.size === 0) return true; return false }
// A state is dead if a cell is empty OR some all-different group has no perfect
// matching (its cells cannot take distinct values). The GAC floor leaves an
// infeasible group untouched rather than emptying a cell, so the search must test
// matchability itself — without this, non-all-different leaves slip through.
function dead () {
  if (anyEmpty()) return true
  for (const g of alldiffGroups) if (maxMatch(g, c => cand.get(c)) !== g.length) return true
  return false
}
// A full interior is a real solution only if every line's hit count equals its
// clue. update prunes toward this but does not reject a completed line on its own
// (it skips the reverse check once the clue is pinned), so the real solver leans
// on validate at the leaf; this is that leaf check, model-independent.
function validLeaf () {
  for (const g of groups) {
    const clueCellId = g.cells[0]
    const line = g.cells.slice(1)
    if (cand.get(clueCellId).size !== 1) return false
    const clueV = [...cand.get(clueCellId)][0]
    let h = 0
    for (let i = 0; i < line.length; i++) if ([...cand.get(line[i])][0] === i + 1) h++
    if (h !== clueV) return false
  }
  return true
}
function pickMRV () {
  let best = null; let bs = Infinity
  for (const c of INT) { const s = cand.get(c).size; if (s > 1 && s < bs) { bs = s; best = c } }
  return best
}
const NODE_CAP = 3_000_000
let nodes; let solutions; let capped
function dfs (comps, matching) {
  if (capped || nodes > NODE_CAP) { capped = true; return }
  const cell = pickMRV()
  if (cell === null) { if (validLeaf()) solutions++; return }
  for (const v of [...cand.get(cell)].sort((a, b) => a - b)) {
    nodes++
    const saved = cloneCand()
    cand.set(cell, new Set([v]))
    runToFixpoint(comps, false, matching)
    if (!dead()) dfs(comps, matching)
    cand = saved
    if (capped) return
  }
}
function searchRun (mode) {
  freshState()
  const matching = mode === 'on'
  const comps = buildComps()
  for (const inst of comps) if (inst.__mod.initialize) for (const _ of inst.__mod.initialize(inst, puzzle)) { /* n-1 prune */ }
  runToFixpoint(comps, false, matching)
  nodes = 0; solutions = 0; capped = false
  if (!dead()) dfs(comps, matching)
  return { nodes, solutions, capped }
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
    const t = Date.now()
    const r = searchRun(mode)
    const note = r.capped ? ' CAPPED' : (r.solutions === 1 ? '' : ` (solutions=${r.solutions}!)`)
    console.log(`  ${label}: ${r.nodes} search nodes, ${r.solutions} solution${r.solutions === 1 ? '' : 's'}, ${Date.now() - t}ms${note}`)
  }
} else {
  freshState()
  const tightStart = tighterLines()
  for (let pass = 0; pass < 500; pass++) { const b = totalCands(); for (const g of alldiffGroups) floorGroup(g); if (totalCands() === b) break }
  const tightAfterFloor = tighterLines()
  console.log(`  matching tighter than naive: ${tightStart}/${keys.length} lines at start, ${tightAfterFloor}/${keys.length} after the ${FLOOR} floor`)
  const floor = report('floor only  ', 'floor')
  const off = report('matching OFF', 'off')
  const on = report('matching ON ', 'on')
  console.log(`  DELTA components over floor (off - floor): hidden +${off.hiddenRecovered - floor.hiddenRecovered}, interior +${off.interiorSolved - floor.interiorSolved}, removed +${off.removed - floor.removed}`)
  console.log(`  DELTA matching over naive  (on - off):    hidden +${on.hiddenRecovered - off.hiddenRecovered}, interior +${on.interiorSolved - off.interiorSolved}, removed +${on.removed - off.removed}`)
  if (on.lost || off.lost || floor.lost) { console.log('  FAIL: a true value was removed'); process.exit(1) }
}
