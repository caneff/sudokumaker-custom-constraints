// Offline difficulty metric for a quad-rank puzzle (#328).
//
// Runs the REAL QuadRankComponent over the puzzle's start state on top of a
// Regin-strength all-different floor, exactly as examples/*/recovery-probe.mjs
// do, and reports what propagation alone gets and what the DFS search costs
// after it. DFS nodes is the metric the search in qr_find.py climbs.
//
//   node proto/qr-metric.mjs one.json          # one puzzle, human-readable
//   node proto/qr-metric.mjs --server          # JSONL in, JSONL out
//
// A puzzle is {grid, clues: [[r, c, rank], ...], givens: [[r, c], ...]},
// 0-based, ranks from the oracle.

import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo } from '../examples/_shared/harness-lib.mjs'
import {
  makeCandidateState, makeAllDifferentFloor, runToFixpoint, search, countLost
} from '../examples/_shared/recovery-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const N = 9
const BOX = [3, 3]
const NODE_CAP = 200_000

installGlobals(1, N)
const { load } = makeIo(HERE)
const mod = load('QuadRankComponent.js', ['setParams', 'update', 'validate', 'getAffectedCells'])

const cell = (r, c) => r * N + c
const allCells = [...Array(N * N).keys()]

// Rows, columns, boxes: the houses the app enforces natively.
const houses = []
for (let i = 0; i < N; i++) {
  houses.push([...Array(N).keys()].map(j => cell(i, j)))
  houses.push([...Array(N).keys()].map(j => cell(j, i)))
}
for (let r0 = 0; r0 < N; r0 += BOX[0]) {
  for (let c0 = 0; c0 < N; c0 += BOX[1]) {
    const g = []
    for (let i = 0; i < BOX[0]; i++) for (let j = 0; j < BOX[1]; j++) g.push(cell(r0 + i, c0 + j))
    houses.push(g)
  }
}

const st = makeCandidateState({ houses })
const floorGroup = makeAllDifferentFloor(st, { maxDigit: N })

function instances (clues) {
  return clues.map(([r, c, rank]) => {
    const inst = { name: `QR_R${r + 1}C${c + 1}` }
    mod.setParams(inst, [cell(r, c), cell(r, c + 1), cell(r + 1, c), cell(r + 1, c + 1)], rank, allCells, N)
    inst.__mod = mod
    return inst
  })
}

function seed (grid, givens) {
  const given = new Set(givens.map(([r, c]) => cell(r, c)))
  st.cand = new Map()
  st.stopped = false
  for (const k of allCells) {
    const r = (k / N) | 0; const c = k % N
    st.cand.set(k, given.has(k) ? new Set([grid[r][c]]) : new Set([...Array(N).keys()].map(d => d + 1)))
  }
}

export function measure (p) {
  const comps = instances(p.clues)
  // `done` latches per instance, so every run needs fresh ones.
  for (const i of comps) delete i.done
  seed(p.grid, p.givens)
  const before = st.total()
  const passes = runToFixpoint(st, comps, houses, floorGroup)
  const truth = allCells.map(k => [k, p.grid[(k / N) | 0][k % N]])
  const lost = countLost(st, truth)
  const solvedByLogic = allCells.filter(k => st.cand.get(k).size === 1).length - p.givens.length
  const afterLogic = st.total()
  const validLeaf = () => comps.every(i => mod.validate(i, st.puzzle))
  const { nodes, solutions, capped } = search(st, {
    interior: allCells, comps, alldiffGroups: houses, floorGroup, validLeaf, nodeCap: NODE_CAP
  })
  return {
    nodes,
    solutions,
    capped,
    lost,
    solvedByLogic,
    removedByLogic: before - afterLogic,
    settled: passes !== -1
  }
}

if (process.argv[2] === '--server') {
  const rl = createInterface({ input: process.stdin })
  rl.on('line', line => {
    if (!line.trim()) return
    process.stdout.write(JSON.stringify(measure(JSON.parse(line))) + '\n')
  })
} else if (process.argv[2]) {
  const p = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const m = measure(p)
  console.log(`clues ${p.clues.length}  givens ${p.givens.length}`)
  console.log(`logic: ${m.removedByLogic} candidates removed, ${m.solvedByLogic} cells solved, ${m.settled ? 'settled' : 'NEVER SETTLED'}`)
  console.log(`search: ${m.nodes} nodes, ${m.solutions} solution(s)${m.capped ? ' [CAPPED]' : ''}`)
  console.log(`soundness: ${m.lost} true values lost`)
}
