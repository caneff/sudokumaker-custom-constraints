// #384: climb down from HARD_328_g1 by adding clues, scoring each rung with
// qr-metric under the shipped component. Prints one JSON line per candidate.
//
// Args ride on env, not argv: qr-metric.mjs runs its own CLI branch when
// argv[2] is set, which would score the base board on every import.
//
//   QR_COMPONENT=QuadRankComponent5.js QR_NODE_CAP=60000 QR_BASE=proto/HARD_328_g1.json \
//     QR_COUNTS=17,18,19,20 QR_SAMPLES=4 node proto/ladder384.mjs > out.jsonl

import { readFileSync, appendFileSync } from 'fs'
import { ranks } from './quadrank-lib.mjs'
import { measure } from './qr-metric.mjs'

const base = JSON.parse(readFileSync(process.env.QR_BASE, 'utf8'))
const counts = process.env.QR_COUNTS.split(',').map(Number)
const samples = parseInt(process.env.QR_SAMPLES || '4', 10)
const progress = process.env.QR_PROGRESS || 'PROGRESS_384.md'

const N = base.grid.length
const rank = ranks(base.grid)
const clued = new Set(base.clues.map(([r, c]) => `${r},${c}`))
const free = []
for (let r = 0; r < N - 1; r++) {
  for (let c = 0; c < N - 1; c++) if (!clued.has(`${r},${c}`)) free.push([r, c])
}

// Deterministic per (count, sample) so a rerun reproduces the same boards.
let seed = 12345
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff

for (const count of counts) {
  for (let s = 0; s < samples; s++) {
    const pool = [...free]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const extra = pool.slice(0, count - base.clues.length)
      .map(([r, c]) => [r, c, rank.get(`R${r + 1}C${c + 1}`)])
    const p = { grid: base.grid, clues: [...base.clues, ...extra], givens: [] }
    const t0 = Date.now()
    const m = measure(p)
    const row = { count, sample: s, nodes: m.nodes, capped: m.capped, solutions: m.solutions, lost: m.lost, solvedByLogic: m.solvedByLogic, secs: (Date.now() - t0) / 1000, extra }
    console.log(JSON.stringify(row))
    appendFileSync(progress, `- ${count} clues, sample ${s}: ${m.nodes} nodes${m.capped ? ' CAPPED' : ''}, ${m.solutions} sol, lost ${m.lost}, ${row.secs}s\n`)
  }
}
