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
import { installGlobals } from '../_shared/harness-lib.mjs'
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
const givenSet = new Set(givens)

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

// A full assignment is a real solution only if every component instance's own
// validate accepts it (update prunes toward the rule but does not reject a
// completed instance on its own). This is the components' rule, not a re-model.
const makeValidLeaf = comps => () => comps.every(inst => inst.__mod.validate(inst, state.puzzle))

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

// ---- uniqueness search ----
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

if (floor.lost || comp.lost) { console.log('  FAIL: a true value was removed'); process.exit(1) }
