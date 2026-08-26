// Recovery probe for the hand-made Numbered Rooms puzzle. Runs the REAL
// components (the same main.js wiring SudokuMaker runs) over the puzzle's start
// state to a propagation fixpoint on top of a Régin-strength (GAC) all-different
// floor, reports what propagation recovers, then proves uniqueness with a DFS
// search. The engine lives in ../_shared/recovery-lib.mjs; this file supplies
// only the Numbered Rooms geometry, seeding, and leaf check.
//
// It also carves the givens: the hand-made puzzle ships 31 interior givens, but
// the components solve the whole interior by logic (no search) from far fewer.
// The probe drops givens to that minimum, writes the kept set to min_givens.json
// (build_link.py ships it, verify.py confirms it), and runs the rest on that
// carved puzzle.
//
//   node examples/numbered-rooms/recovery-probe.mjs
//
// The fixture (gen_9.json, from derive_fixture.py) is an 11x11 board: an
// interior 9x9 (cell index r*11 + c, r,c in 1..9) inside a one-cell frame that
// holds the 36 outside clue cells. All 36 clues are SHOWN — a Numbered Rooms
// puzzle is its outside clues; the SudokuMaker doc marks them given:false only
// because it treats a clue as a solver-filled display cell, but logically each
// is a shown constraint. Seeded from the solution, they are what lets the
// components pin the last interior cells and make the puzzle unique. (Seed them
// hidden instead and the interior has two completions: the clues are load-
// bearing, not decoration.)

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo } from '../_shared/harness-lib.mjs'
import {
  makeCandidateState, makeAllDifferentFloor, loadComponents,
  runToFixpoint, search, countLost, reportLine
} from '../_shared/recovery-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const gen = JSON.parse(readFileSync(join(HERE, 'gen_9.json'), 'utf8'))
const { n, W, groups, boxes, solution, givens } = gen

// The components read SudokuDigitSet.from and (through main.js) helpers.naming.
installGlobals(1, n)
globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

// ---- geometry ----
const interiorCells = []
for (let r = 1; r <= n; r++) for (let c = 1; c <= n; c++) interiorCells.push(r * W + c)
const clueCells = groups.map(g => g.cells[0])

const rows = []
for (let r = 1; r <= n; r++) rows.push(Array.from({ length: n }, (_, c) => r * W + (c + 1)))
const cols = []
for (let c = 1; c <= n; c++) cols.push(Array.from({ length: n }, (_, r) => (r + 1) * W + c))
const alldiffGroups = [...rows, ...cols, ...boxes]

// Two cells "see each other" when they share an all-different group, so a set
// of cells all see each other when every pair does. The pair component's
// distinct-line steps ask this of a whole line; a full row or column answers
// yes. The engine mock omits this method (Hit Counts never calls it), so add it.
const pairKey = (a, b) => (a < b ? a + ',' + b : b + ',' + a)
const seenPairs = new Set()
for (const g of alldiffGroups) {
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) seenPairs.add(pairKey(g[i], g[j]))
}
function getCellsSeeEachOther (cells) {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) if (!seenPairs.has(pairKey(cells[i], cells[j]))) return false
  }
  return true
}

// ---- candidate state ----
const RANGE = (lo, hi) => { const s = new Set(); for (let d = lo; d <= hi; d++) s.add(d); return s }
const state = makeCandidateState()
state.puzzle.getCellsSeeEachOther = getCellsSeeEachOther
function seed (givenSet) {
  state.cand = new Map()
  for (const i of interiorCells) state.cand.set(i, givenSet.has(i) ? new Set([solution[String(i)]]) : RANGE(1, n))
  for (const i of clueCells) state.cand.set(i, new Set([solution[String(i)]])) // clues are shown
}

// Truth map for the soundness backstop: the whole solution, interior + clues.
const truth = [...interiorCells, ...clueCells].map(i => [i, solution[String(i)]])

// ---- components via the real main.js wiring ----
const mainSrc = readFileSync(join(HERE, 'main.js'), 'utf8')
function buildComps () {
  return loadComponents({
    here: HERE,
    files: [
      { file: 'NumberedRoomsComponent.js', names: ['setParams', 'update', 'validate'], ctorName: 'NumberedRoomsComponent' },
      { file: 'NumberedRoomsPairComponent.js', names: ['setParams', 'update', 'validate'], ctorName: 'NumberedRoomsPairComponent' }
    ],
    mainSrc,
    input: { groups }
  })
}

// ---- the ORIGINAL wiring (ORIGINAL_*.js), modelled ----
// The shipped version was a wrapper (ORIGINAL_CustomIndexComponent.js) that did
// NOTHING while its clue cell was blank, and once the clue was pinned swapped in
// the built-in IndexComponent to run the forward "index the line" prune. No pair
// coupling, no line -> clue direction. This engine models neither replaceComponent
// nor the built-in, so, exactly as the Skyscraper probe does, we model the
// original line as OUR component gated to fire only when the clue is pinned: at
// that point our update runs the same forward index prune the built-in does. That
// GIVES the original every per-line deduction ours has for a KNOWN clue. Our
// version adds two things over that: the line -> clue direction that deduces a
// blank clue, and the pair index-sum coupling. NOTE: this fixture shows all 36
// clues, so no clue is ever blank and the gate is always open — the line -> clue
// direction is NOT exercised here. The only feature the comparison below actually
// isolates is the pair coupling. If the real built-in is weaker than our forward
// pass, the original is slower still, so this comparison is conservative.
const nrMod = makeIo(HERE).load('NumberedRoomsComponent.js', ['setParams', 'update', 'validate'])
const gatedLine = {
  setParams: nrMod.setParams,
  * update (inst, puzzle) {
    if (!puzzle.hasValue(inst.clue)) return // inert until the clue is pinned
    yield * nrMod.update(inst, puzzle) //     then the forward index prune (= built-in)
  },
  validate: nrMod.validate
}
function buildOriginal () {
  return groups.map(g => {
    const inst = { name: '' }
    gatedLine.setParams(inst, g.cells[0], g.cells.slice(1))
    inst.__mod = gatedLine
    return inst
  })
}

// A full assignment is a real solution only if every component instance's own
// validate accepts it (update prunes toward the rule but does not reject a
// completed instance on its own). This is the components' rule, not a re-model.
const makeValidLeaf = comps => () => comps.every(inst => inst.__mod.validate(inst, state.puzzle))

// A wiring-independent leaf check: the Numbered Rooms rule read straight off the
// geometry (line[k-1] === clue), so both wirings are scored by the same truth.
function geometricLeaf () {
  for (const g of groups) {
    const clue = g.cells[0]; const line = g.cells.slice(1)
    const k = state.puzzle.getValue(line[0])
    if (k < 1 || k > line.length) return false
    if (state.puzzle.getValue(line[k - 1]) !== state.puzzle.getValue(clue)) return false
  }
  return true
}

const floorGroup = makeAllDifferentFloor(state, { kind: 'regin', maxDigit: n })

// ---- carve the givens ----
// Do the components solve the whole interior by propagation alone (no search)
// from this given set?
function propSolves (givenSet) {
  seed(givenSet)
  runToFixpoint(state, buildComps(), alldiffGroups, floorGroup)
  return interiorCells.every(i => state.cand.get(i).size === 1)
}

// Drop each hand-made given while the components still solve by propagation
// alone. `kept` is then the fewest givens that keep the puzzle solvable by the
// intended logic — a minimal set (dropping one more forces a search), though
// which minimal set depends on the drop order. build_link.py ships exactly this
// set; verify.py confirms it is still uniquely solvable.
let kept = new Set(givens)
for (const i of givens) {
  const trial = new Set(kept); trial.delete(i)
  if (propSolves(trial)) kept = trial
}
writeFileSync(join(HERE, 'min_givens.json'), JSON.stringify({ kept: [...kept].sort((a, b) => a - b) }) + '\n')

// ---- report one mode ----
function report (label, useComps) {
  seed(kept)
  const start = state.total()
  const comps = useComps ? buildComps() : []
  const passes = runToFixpoint(state, comps, alldiffGroups, floorGroup)
  const cluesPinned = clueCells.filter(i => state.cand.get(i).size === 1).length
  const interiorSolved = interiorCells.filter(i => state.cand.get(i).size === 1).length
  const lost = countLost(state, truth)
  const removed = start - state.total()
  const extra = `clues ${cluesPinned}/${clueCells.length}, interior ${interiorSolved}/${interiorCells.length}, `
  console.log(reportLine(label, { extra, removed, passes, lost }))
  return { cluesPinned, interiorSolved, removed, lost }
}

console.log(`gen_9.json: n=${n}, ${clueCells.length} clues (all shown), ${givens.length} hand-made interior givens`)
console.log(`carve: components solve by logic (no search) with ${kept.size} of ${givens.length} givens -> wrote min_givens.json (${[...kept].sort((a, b) => a - b).join(', ')})`)
const floor = report('floor only ', false)
const comp = report('components ', true)
console.log(`  DELTA components over floor: clues +${comp.cluesPinned - floor.cluesPinned}, interior +${comp.interiorSolved - floor.interiorSolved}, removed +${comp.removed - floor.removed}`)

// ---- uniqueness search (ours, the shipped 3-given puzzle) ----
seed(kept)
const comps = buildComps()
runToFixpoint(state, comps, alldiffGroups, floorGroup)
const t = Date.now()
const res = search(state, {
  interior: interiorCells, // clues are shown givens; the search branches the interior
  comps,
  alldiffGroups,
  floorGroup,
  validLeaf: makeValidLeaf(comps)
})
const note = res.capped ? ' CAPPED' : (res.solutions === 1 ? '' : ` (solutions=${res.solutions}!)`)
console.log(`  uniqueness: ${res.nodes} search nodes, ${res.solutions} solution${res.solutions === 1 ? '' : 's'}, ${Date.now() - t}ms${note}`)

// ---- solve-speed: ours vs the original, same start state ----
// Both wire onto the PURE-CLUE puzzle — 36 clues shown, ZERO interior givens —
// and branch the interior; clues are shown givens, so the search never branches
// them. Zero givens is the honest stress test: with the 3 carved givens the
// components finish by propagation (0 nodes) and so does the original, so nothing
// separates them. Drop the givens and both must search, and here ours (with the
// pair coupling) explores ~6x fewer nodes.
//
// READ THIS BEFORE TRUSTING THE 6x. That number is specific to THIS hand-made
// puzzle, not a general property of the pair component. On random 9x9 boards the
// pair coupling wins about half the time and LOSES the other half: it adds
// per-node work, and with MRV branching the extra pruning does not reliably
// shrink the tree. Bigger boards do not help either — the GAC floor's per-node
// cost explodes and both wirings time out. So take this as one favorable data
// point, not proof ours searches faster. The general, board-independent wins are
// elsewhere: ours deduces a blank clue (the original cannot) and it is sound (the
// 405k-test soundness-harness.mjs). Speed is a bonus this puzzle happens to give.
const NODE_CAP = +((process.argv.find(a => a.startsWith('--cap=')) || '').split('=')[1]) || 200000
const noGivens = new Set()
function solveRun (build) {
  seed(noGivens)
  const c = build()
  runToFixpoint(state, c, alldiffGroups, floorGroup)
  const start = Date.now()
  const r = search(state, { interior: interiorCells, comps: c, alldiffGroups, floorGroup, validLeaf: geometricLeaf, nodeCap: NODE_CAP })
  return { ...r, ms: Date.now() - start }
}
const runs = { original: solveRun(buildOriginal), ours: solveRun(buildComps) }
for (const label of ['original', 'ours']) {
  const r = runs[label]
  const tag = r.capped ? ' CAPPED' : (r.solutions === 1 ? '' : ` (solutions=${r.solutions})`)
  console.log(`  0-given ${label.padEnd(8)}: ${r.nodes} search nodes, ${r.solutions} solution${r.solutions === 1 ? '' : 's'}, ${r.ms}ms${tag}`)
}
if (!runs.ours.capped && runs.ours.nodes > 0) {
  const ratio = (runs.original.nodes / runs.ours.nodes).toFixed(0)
  const atLeast = runs.original.capped ? '>' : ''
  console.log(`  ours explores ${atLeast}${ratio}x fewer nodes than the original${runs.original.capped ? ' (original never finished within the cap)' : ''}`)
}

if (floor.lost || comp.lost) { console.log('  FAIL: a true value was removed'); process.exit(1) }
