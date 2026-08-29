// Throwaway prototype for #233: rank two hit-counts deductions by mock search
// nodes on gen_9x9.json. Not shipped. Wirings:
//   shipped — the committed main.js (per line + pair + side sum); the #224 baseline
//   A       — shipped plus the #13 early reject over the full [forced, possible]
//   C       — shipped plus the side-hit matching (one instance per side)
//   A+C     — both
//   C'      — C with the leaner component: no clue-candidate filtering, and a
//             signature check that skips the solve when the assignment's own
//             inputs have not moved
//   C'-pair — C' with HitCountsPairComponent dropped from the wiring
//   D       — the joint row + pair DP (#246), one component per line-pair, in
//             place of the per-line components and the pair
//   C'+D    — D stacked on C'
//
//   node examples/hit-counts/proto-233.mjs [gen_9x9.json] [--only=C] [--cap=N]
//
// A is a `validate` change in the app, and the shared DFS calls validate only at
// a leaf, so the mock models it as a propagator that empties the clue cell on the
// same contradiction — the state then fails the engine's own dead() test, which
// is what a validate reject does to a node.
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo } from '../_shared/harness-lib.mjs'
import { makeCandidateState, makeAllDifferentFloor, loadComponents, runToFixpoint, search } from '../_shared/recovery-lib.mjs'
import { frameGeometry } from '../_shared/frame-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'gen_9x9.json'
const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
const { n, box: [bh, bw], grid, clue, active } = gen
const activeSet = new Set(active)
const givens = gen.givens || {}

installGlobals(0, n)
globalThis.helpers.naming = { getCellsDescription: () => '', getCellName: () => '' }

const { interior, clueCell, lineCells, keys, groups, alldiffGroups } = frameGeometry(n, [bh, bw])
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

const { read, load } = makeIo(HERE)
const mainSrc = read('main.js')
function buildShipped () {
  return loadComponents({
    here: HERE,
    mainSrc,
    input: { groups },
    files: [
      { file: 'HitCountsComponent.js', names: ['setParams', 'update', 'initialize'], ctorName: 'HitCountsComponent' },
      { file: 'SideSumComponent.js', names: ['setParams', 'update'], ctorName: 'SideSumComponent' },
      { file: 'HitCountsPairComponent.js', names: ['setParams', 'update'], ctorName: 'HitCountsPairComponent' }
    ]
  })
}

// ---- C: the side-hit matching, one instance per side ----
const sideMod = load('proto-233/SideHitMatchingComponent.js', ['setParams', 'update', 'initialize'])
const fastMod = load('proto-233/SideHitMatchingComponent.fast.js', ['setParams', 'update', 'initialize'])
function sideInstances (mod) {
  const out = []
  for (const side of ['L', 'R', 'T', 'B']) {
    const clues = []
    const lines = []
    for (let i = 0; i < n; i++) { clues.push(clueCell(side, i)); lines.push(lineCells(side, i)) }
    const inst = { name: `side hit matching ${side}` }
    mod.setParams(inst, clues, lines)
    inst.__mod = mod
    out.push(inst)
  }
  return out
}

// ---- D: the joint row + pair DP, one instance per line-pair (#246) ----
const jointMod = load('proto-233/HitCountsJointComponent.js', ['setParams', 'update', 'initialize'])
function jointInstances () {
  const out = []
  for (const [sa, sb] of [['L', 'R'], ['T', 'B']]) {
    for (let i = 0; i < n; i++) {
      const inst = { name: `hit counts joint ${sa}${i}` }
      jointMod.setParams(inst, clueCell(sa, i), clueCell(sb, i), lineCells(sa, i))
      inst.__mod = jointMod
      out.push(inst)
    }
  }
  return out
}

// The side sums, the one shipped component D and C' between them do not cover.
const sideSums = () => buildShipped().filter(c => c.target !== undefined)

// ---- A: the #13 early reject, as a propagator (see the header) ----
const hcScan = load('HitCountsComponent.js', ['scan']).scan
function earlyReject () {
  for (const g of groups) {
    const clueId = g.cells[0]
    const set = st.cand.get(clueId)
    if (set.size !== 1) continue
    const k = [...set][0]
    const { forced, possible } = hcScan(st.puzzle, g.cells.slice(1))
    if (k < forced || k > possible) { set.clear(); return }
  }
}

const floorGroup = makeAllDifferentFloor(st, { kind: 'regin', maxDigit: n })
const INT = []
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) INT.push(interior(r, c))

// A full interior is a solution only when every line's hit count equals its clue.
function validLeaf () {
  for (const g of groups) {
    const clueId = g.cells[0]
    const line = g.cells.slice(1)
    if (st.cand.get(clueId).size !== 1) return false
    const clueV = [...st.cand.get(clueId)][0]
    let h = 0
    for (let i = 0; i < line.length; i++) if ([...st.cand.get(line[i])][0] === i + 1) h++
    if (h !== clueV) return false
  }
  return true
}

const truth = []
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth.push([interior(r, c), grid[r][c]])
for (const k of keys) { const side = k[0]; const i = +k.slice(1); truth.push([clueCell(side, i), clue[k]]) }

const NODE_CAP = +((process.argv.find(a => a.startsWith('--cap=')) || '').split('=')[1]) || 200000
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]

const VARIANTS = [
  ['shipped', () => buildShipped(), null],
  ['A', () => buildShipped(), earlyReject],
  ['C', () => [...buildShipped(), ...sideInstances(sideMod)], null],
  ['A+C', () => [...buildShipped(), ...sideInstances(sideMod)], earlyReject],
  ["C'", () => [...buildShipped(), ...sideInstances(fastMod)], null],
  // The pair instances are the ones that took a second clue cell.
  ["C'-pair", () => [...buildShipped().filter(c => c.clueB === undefined), ...sideInstances(fastMod)], null],
  // D replaces the per-line components and the pair for every line it covers.
  ['D', () => [...sideSums(), ...jointInstances()], null],
  ["C'+D", () => [...sideSums(), ...jointInstances(), ...sideInstances(fastMod)], null]
]

console.log(`${file}: n=${n}, ${active.length}/${keys.length} clues shown, ${Object.keys(givens).length} interior givens, cap ${NODE_CAP}`)
for (const [label, build, extra] of VARIANTS) {
  if (only && only !== label) continue
  freshState()
  const comps = build()
  const t0 = performance.now()
  const passes = runToFixpoint(st, comps, alldiffGroups, floorGroup, { init: true, extra })
  const lost = truth.filter(([c, v]) => !st.cand.get(c).has(v)).length
  const rootCands = st.total()
  let rootSolved = 0
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (st.cand.get(interior(r, c)).size === 1) rootSolved++
  const r = search(st, { interior: INT, comps, alldiffGroups, floorGroup, extra, validLeaf, nodeCap: NODE_CAP })
  const secs = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`  ${label.padEnd(7)} root: ${rootCands} cands, ${rootSolved}/${n * n} interior solved, ${passes} passes${lost ? ` LOST x${lost}` : ''} | search: ${r.nodes} nodes, ${r.solutions} sol${r.capped ? ' CAPPED' : ''}, ${secs} s`)
}
