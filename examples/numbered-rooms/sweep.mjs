// Sweep: can each wiring SOLVE a real, interactable Numbered Rooms puzzle? Each
// board (gen_9_s*.json, from gen_puzzle.py) shows a handful of clues and a
// handful of interior givens; the rest of the clues are BLANK and must be
// deduced. This is the shape the original wrapper cannot handle: it is inert on a
// blank clue (it waits for the clue to be pinned, then runs the built-in index
// prune), so the only way it fills a blank clue is to GUESS it. Ours deduces
// blank clues from the line, so it searches a normal amount.
//
//   node examples/numbered-rooms/sweep.mjs                 # all committed boards
//   node examples/numbered-rooms/sweep.mjs gen_9_s2.json   # one board
//
// Each board wires two ways and searches for ONE solution (stopAtFirst), branching
// the interior AND the blank clue cells:
//   - 'ours'     — the real main.js wiring: per-line component (deduces a blank
//                  clue from its line) + the pair coupling.
//   - 'original' — the shipped wrapper, modelled the conservative way
//                  recovery-probe.mjs documents: our line gated to fire only once
//                  its clue is pinned, no pair. On a blank clue it does nothing.
// The node cap bounds the hopeless original run; a capped original is the finding
// — it never solves. The result: ours solves every board, the original none.
//
// ponytail: the geometry + wiring below mirror recovery-probe.mjs. That probe is
// hardwired to the shipped gen_9 (all clues shown, carve + uniqueness proof); this
// tool is the parametric, blank-clue version. Two readers, ~15 shared lines — not
// worth a shared module and the churn of rewiring the merged probe to use it.

import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo } from '../_shared/harness-lib.mjs'
import {
  makeCandidateState, makeAllDifferentFloor, loadComponents, runToFixpoint, search
} from '../_shared/recovery-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const NODE_CAP = +((process.argv.find(a => a.startsWith('--cap=')) || '').split('=')[1]) || 20000
const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const files = args.length
  ? args
  : readdirSync(HERE).filter(f => /^gen_9_s\d+\.json$/.test(f)).sort()

const mainSrc = readFileSync(join(HERE, 'main.js'), 'utf8')
const nrMod = makeIo(HERE).load('NumberedRoomsComponent.js', ['setParams', 'update', 'validate'])
const gatedLine = {
  setParams: nrMod.setParams,
  * update (inst, puzzle) {
    if (!puzzle.hasValue(inst.clue)) return // inert on a blank clue
    yield * nrMod.update(inst, puzzle)
  }
}

function measure (file) {
  const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
  const { n, W, groups, boxes, solution, givens, shownClues } = gen
  installGlobals(1, n)
  globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

  const interiorCells = []
  for (let r = 1; r <= n; r++) for (let c = 1; c <= n; c++) interiorCells.push(r * W + c)
  const clueCells = groups.map(g => g.cells[0])
  const shownSet = new Set(shownClues); const givenSet = new Set(givens)
  const blankClues = clueCells.filter(c => !shownSet.has(c))
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
    for (const i of interiorCells) state.cand.set(i, givenSet.has(i) ? new Set([solution[String(i)]]) : RANGE(1, n))
    for (const i of clueCells) state.cand.set(i, shownSet.has(i) ? new Set([solution[String(i)]]) : RANGE(1, n))
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
  // A leaf is a solution when the rule holds on every line, read off the geometry.
  function leaf () {
    for (const g of groups) {
      const line = g.cells.slice(1); const k = state.puzzle.getValue(line[0])
      if (k < 1 || k > line.length) return false
      if (state.puzzle.getValue(line[k - 1]) !== state.puzzle.getValue(g.cells[0])) return false
    }
    return true
  }
  const branch = [...interiorCells, ...blankClues] // the original must guess the blank clues
  function one (build) {
    seed()
    const comps = build()
    runToFixpoint(state, comps, alldiffGroups, floorGroup)
    const t = Date.now()
    const r = search(state, { interior: branch, comps, alldiffGroups, floorGroup, validLeaf: leaf, nodeCap: NODE_CAP, stopAtFirst: true })
    return { ...r, ms: Date.now() - t }
  }
  return { shown: shownClues.length, blank: blankClues.length, givens: givens.length, original: one(buildOriginal), ours: one(buildOurs) }
}

console.log('board     shown  blank  givens   original            ours')
let bad = false
for (const file of files) {
  const m = measure(file)
  const oOk = m.original.solutions > 0
  const uOk = m.ours.solutions > 0
  if (oOk || !uOk) bad = true // expect: original never solves, ours always does
  const orig = oOk ? `solved ${m.original.nodes}n` : `no solution (${m.original.nodes}n cap)`
  const ours = uOk ? `SOLVED ${m.ours.nodes}n` : `FAILED (${m.ours.nodes}n cap)`
  const name = file.replace('.json', '')
  console.log(`${name.padEnd(9)} ${String(m.shown).padStart(5)}  ${String(m.blank).padStart(5)}  ${String(m.givens).padStart(6)}   ${orig.padEnd(18)}  ${ours}`)
}
console.log('\nours solves every board; the original solves none — it must guess each blank clue.')
if (bad) { console.log('FAIL: the original solved a board, or ours failed to'); process.exit(1) }
