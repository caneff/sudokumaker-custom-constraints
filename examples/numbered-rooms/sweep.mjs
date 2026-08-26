// Sweep: run ours vs the original wrapper over several random Numbered Rooms
// boards and print the node counts side by side. This is the evidence behind the
// caveat in recovery-probe.mjs — the 6x on the hand-made puzzle is NOT a general
// win. Across the gen_9_s*.json boards (from gen_size.py) ours wins on some and
// LOSES on others: the pair coupling adds per-node work, and under MRV branching
// the extra pruning does not reliably shrink the search tree.
//
//   node examples/numbered-rooms/sweep.mjs                 # all committed boards
//   node examples/numbered-rooms/sweep.mjs gen_9_s2.json   # one board
//
// Each board wires two ways on the pure-clue puzzle (all clues shown, zero
// givens) and branches the interior: 'ours' is the real main.js wiring (per-line
// component + pair coupling); 'original' is the shipped wrapper, modelled the
// conservative way recovery-probe.mjs documents (our line gated to fire only once
// its clue is pinned, no pair). Both must reach the SAME solution count on every
// board — that agreement is the soundness cross-check the test asserts. The node
// gap between them is the point being measured, and it swings both ways.
//
// ponytail: the geometry + wiring below mirror recovery-probe.mjs. That probe is
// hardwired to gen_9 (it also carves givens and proves uniqueness); this tool is
// the parametric, many-board version. Two readers, ~15 shared lines — not worth a
// shared module and the churn of rewiring the merged probe to use it.

import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo } from '../_shared/harness-lib.mjs'
import {
  makeCandidateState, makeAllDifferentFloor, loadComponents, runToFixpoint, search
} from '../_shared/recovery-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const NODE_CAP = +((process.argv.find(a => a.startsWith('--cap=')) || '').split('=')[1]) || 300000
const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const files = args.length
  ? args
  : readdirSync(HERE).filter(f => /^gen_9_s\d+\.json$/.test(f)).sort()

const mainSrc = readFileSync(join(HERE, 'main.js'), 'utf8')
const nrMod = makeIo(HERE).load('NumberedRoomsComponent.js', ['setParams', 'update', 'validate'])
const gatedLine = {
  setParams: nrMod.setParams,
  * update (inst, puzzle) {
    if (!puzzle.hasValue(inst.clue)) return
    yield * nrMod.update(inst, puzzle)
  }
}

function run (file) {
  const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
  const { n, W, groups, boxes, solution } = gen
  installGlobals(1, n)
  globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

  const interiorCells = []
  for (let r = 1; r <= n; r++) for (let c = 1; c <= n; c++) interiorCells.push(r * W + c)
  const clueCells = groups.map(g => g.cells[0])
  const rows = []
  for (let r = 1; r <= n; r++) rows.push(Array.from({ length: n }, (_, c) => r * W + (c + 1)))
  const cols = []
  for (let c = 1; c <= n; c++) cols.push(Array.from({ length: n }, (_, r) => (r + 1) * W + c))
  const alldiffGroups = [...rows, ...cols, ...boxes]

  const pairKey = (a, b) => (a < b ? a + ',' + b : b + ',' + a)
  const seenPairs = new Set()
  for (const g of alldiffGroups) {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) seenPairs.add(pairKey(g[i], g[j]))
  }
  const RANGE = (lo, hi) => { const s = new Set(); for (let d = lo; d <= hi; d++) s.add(d); return s }
  const state = makeCandidateState()
  state.puzzle.getCellsSeeEachOther = cells => {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) if (!seenPairs.has(pairKey(cells[i], cells[j]))) return false
    }
    return true
  }
  function seed () {
    state.cand = new Map()
    for (const i of interiorCells) state.cand.set(i, RANGE(1, n)) // zero givens
    for (const i of clueCells) state.cand.set(i, new Set([solution[String(i)]])) // clues shown
  }
  const floorGroup = makeAllDifferentFloor(state, { kind: 'regin', maxDigit: n })
  const buildOurs = () => loadComponents({
    here: HERE,
    mainSrc,
    input: { groups },
    files: [
      { file: 'NumberedRoomsComponent.js', names: ['setParams', 'update', 'validate'], ctorName: 'NumberedRoomsComponent' },
      { file: 'NumberedRoomsPairComponent.js', names: ['setParams', 'update', 'validate'], ctorName: 'NumberedRoomsPairComponent' }
    ]
  })
  const buildOriginal = () => groups.map(g => {
    const inst = { name: '' }
    gatedLine.setParams(inst, g.cells[0], g.cells.slice(1))
    inst.__mod = gatedLine
    return inst
  })
  // A leaf is a real solution when the rule holds on every line, read off the
  // geometry — the same truth for both wirings.
  function leaf () {
    for (const g of groups) {
      const line = g.cells.slice(1); const k = state.puzzle.getValue(line[0])
      if (k < 1 || k > line.length) return false
      if (state.puzzle.getValue(line[k - 1]) !== state.puzzle.getValue(g.cells[0])) return false
    }
    return true
  }
  function one (build) {
    seed()
    const comps = build()
    runToFixpoint(state, comps, alldiffGroups, floorGroup)
    const t = Date.now()
    const r = search(state, { interior: interiorCells, comps, alldiffGroups, floorGroup, validLeaf: leaf, nodeCap: NODE_CAP })
    return { ...r, ms: Date.now() - t }
  }
  return { original: one(buildOriginal), ours: one(buildOurs) }
}

console.log('board            original      ours    winner')
let oursWins = 0; let oursLoses = 0; let bad = false
for (const file of files) {
  const { original, ours } = run(file)
  const capped = original.capped || ours.capped
  const disagree = original.solutions !== ours.solutions
  if (capped || disagree) bad = true
  let winner
  if (ours.nodes < original.nodes) { winner = 'ours'; oursWins++ } else if (ours.nodes > original.nodes) { winner = 'original'; oursLoses++ } else winner = 'tie'
  const flag = disagree ? ` DISAGREE (${original.solutions} vs ${ours.solutions})` : (capped ? ' CAPPED' : '')
  const name = file.replace('.json', '')
  console.log(`${name.padEnd(14)} ${String(original.nodes).padStart(8)}  ${String(ours.nodes).padStart(8)}    ${winner}${flag}`)
}
console.log(`\nours wins ${oursWins}/${files.length}, loses ${oursLoses}/${files.length} — the node gap is board-specific, not a fixed win.`)
if (bad) { console.log('FAIL: a run capped or the two wirings disagreed on solution count'); process.exit(1) }
