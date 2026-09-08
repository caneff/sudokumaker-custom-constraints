// Soundness fuzz for the counting-identity update (#335). The static sweep in
// sweep9x9.mjs only checks the leading-digit table; the counting rule reads
// candidate sets, so it has to be fuzzed on partial STATES.
//
// Every state keeps each cell's true digit, so the true solution is always
// reachable: any removal of a true digit, and any stop(), is a violation.
//
//   node proto/soundness-counting.mjs [nGrids] [nClues]

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, randomCandidates } from '../examples/_shared/harness-lib.mjs'
import { randomGrids } from './random-grids.mjs'
import { ranks, windowList } from './quadrank-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng(9335)

const FILE = process.env.QR_COMPONENT || 'QuadRankComponent2.js'
const N = parseInt(process.argv[4] || '9', 10)
const BOX = N === 9 ? [3, 3] : [2, 3]
const nGrids = parseInt(process.argv[2] || '60', 10)
const nClues = parseInt(process.argv[3] || '13', 10)

installGlobals(1, N)
const mod = load(FILE, ['setParams', 'update', 'validate'])

const ALL = Array.from({ length: N * N }, (_, i) => i)
const grids = randomGrids(N, BOX, nGrids, 20260904)

let states = 0
let violations = 0
let removals = 0
const failures = []

for (const grid of grids) {
  const rk = ranks(grid)
  const wins = windowList(N, N)
  const truth = {}
  for (const c of ALL) truth[c] = grid[Math.floor(c / N)][c % N]

  for (let rep = 0; rep < 3; rep++) {
    // Pick the clues for this state.
    const chosen = []
    const pool = [...wins]
    for (let i = 0; i < nClues && pool.length; i++) {
      chosen.push(pool.splice((rnd() * pool.length) | 0, 1)[0])
    }
    const PIN = parseFloat(process.env.QR_PIN || '')
    const seed = c => {
      if (!Number.isNaN(PIN)) {
        if (rnd() < PIN) return [truth[c]]
        const s = new Set([truth[c]])
        for (let d = 1; d <= N; d++) if (rnd() < 0.5) s.add(d)
        return [...s]
      }
      return randomCandidates(rnd, 1, N, truth[c])
    }
    const p = makePuzzle(truth, seed)
    const before = [...p._cand.values()].reduce((n, s) => n + s.size, 0)

    // Every clue on the board, the shape a cross-clue component reads (#375).
    // A component that ignores the extra argument is unaffected.
    const clueList = chosen.map(w => [(w.r - 1) * N + (w.c - 1), rk.get(w.id)])

    const insts = chosen.map(w => {
      const tl = (w.r - 1) * N + (w.c - 1)
      const cells = [tl, tl + 1, tl + N, tl + N + 1]
      const inst = { name: `QR ${w.id}` }
      mod.setParams(inst, cells, rk.get(w.id), ALL, N, clueList)
      return inst
    })

    // Fixpoint over every clue at once, the way the app propagates.
    for (let pass = 0; pass < 20; pass++) {
      const total = () => [...p._cand.values()].reduce((n, s) => n + s.size, 0)
      const t0 = total()
      for (const inst of insts) {
        Array.from(mod.update(inst, p))
        if (p._stopped !== null) break
      }
      if (p._stopped !== null || total() === t0) break
    }
    states++
    removals += before - [...p._cand.values()].reduce((n, s) => n + s.size, 0)

    if (p._stopped !== null) {
      violations++
      if (failures.length < 3) failures.push({ why: 'stop', msg: p._stopped })
      continue
    }
    for (const c of ALL) {
      if (!p._cand.get(c).has(truth[c])) {
        violations++
        if (failures.length < 3) failures.push({ why: 'lost true digit', cell: c, digit: truth[c] })
        break
      }
    }
  }
}

console.log(`${FILE} @ ${N}x${N}: ${states} states, ${nClues} clues each`)
console.log(`violations: ${violations}`)
console.log(`candidates removed: ${removals} (${(removals / states).toFixed(1)} per state)`)
for (const f of failures) console.log('VIOLATION', JSON.stringify(f))
process.exit(violations === 0 ? 0 : 1)
