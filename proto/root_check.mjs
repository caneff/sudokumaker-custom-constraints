// Run a component over a puzzle's ROOT state (givens pinned, rest open) and
// report whether the true solution survives. Debugging aid for #335.
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makePuzzle } from '../examples/_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const file = process.env.QR_COMPONENT || 'QuadRankComponent2.js'
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const N = p.grid.length
installGlobals(1, N)
const mod = load(file, ['setParams', 'update', 'validate'])
const ALL = [...Array(N * N).keys()]
const truth = {}
for (const k of ALL) truth[k] = p.grid[(k / N) | 0][k % N]
const given = new Set(p.givens.map(([r, c]) => r * N + c))
const seed = c => (given.has(c) ? [truth[c]] : [...Array(N).keys()].map(d => d + 1))
const pz = makePuzzle(truth, seed)
const insts = p.clues.map(([r, c, rank]) => {
  const tl = r * N + c
  const i = { name: `QR R${r + 1}C${c + 1}` }
  mod.setParams(i, [tl, tl + 1, tl + N, tl + N + 1], rank, ALL, N)
  return i
})
const total = () => [...pz._cand.values()].reduce((n, s) => n + s.size, 0)
for (let pass = 0; pass < 30; pass++) {
  const t0 = total()
  for (const i of insts) { Array.from(mod.update(i, pz)); if (pz._stopped !== null) break }
  if (pz._stopped !== null || total() === t0) break
}
const lost = ALL.filter(k => !pz._cand.get(k).has(truth[k]))
console.log(`${file}: stopped=${pz._stopped}  lost true digits at cells [${lost.join(',')}]  candidates left ${total()}`)
