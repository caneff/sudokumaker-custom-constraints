// Soundness fuzz for NumberedRoomsComponent. Soundness = update never removes a
// cell's TRUE value. We enumerate every valid (clue, line) tuple for small line
// lengths, seed random partial candidate states that still allow the truth, run
// the component to a fixpoint, and check the truth survived. A removed true
// value is the silent bug that makes a real puzzle unsolvable.
//
//   node examples/numbered-rooms/soundness-harness.mjs
//
// A second block proves the point of the rewrite: in a state where the clue is
// NOT yet solved, the new component still prunes. The shipped wrapper did
// nothing until the clue collapsed, so this removal count would be zero for it.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng()

const mod = load('NumberedRoomsComponent.js', ['setParams', 'update'])

// Every valid tuple: line in {1..D}^m, index k = line[0] in 1..m, clue = line[k-1].
// Cell ids: 0 = clue, 1..m = line[0..m-1].
function* validTuples (m, D) {
  const line = new Array(m).fill(1)
  while (true) {
    const k = line[0]
    if (k >= 1 && k <= m) {
      const truth = { 0: line[k - 1] }
      for (let i = 0; i < m; i++) truth[i + 1] = line[i]
      yield truth
    }
    let i = m - 1
    while (i >= 0 && line[i] === D) { line[i] = 1; i-- }
    if (i < 0) break
    line[i]++
  }
}

function seeder (D) {
  return (c, v) => {
    const mode = pick(['pin', 'full', 'subset'])
    if (mode === 'pin') return [v]
    if (mode === 'full') return Array.from({ length: D }, (_, i) => i + 1)
    const s = new Set([v])
    for (let d = 1; d <= D; d++) if (rnd() < 0.5) s.add(d)
    return [...s]
  }
}

let tests = 0
let bad = 0
for (const [m, D] of [[4, 6], [5, 5], [6, 6]]) {
  installGlobals(1, D)
  const seed = seeder(D)
  const clue = 0
  const line = Array.from({ length: m }, (_, i) => i + 1)
  for (const truth of validTuples(m, D)) {
    for (let rep = 0; rep < 8; rep++) {
      const p = makePuzzle(truth, seed)
      const inst = {}
      mod.setParams(inst, clue, line)
      const v = violates(mod, inst, p, truth)
      tests++
      if (v) { bad++; if (bad <= 5) console.log('violation', v, 'truth', truth, `m=${m} D=${D}`) }
    }
  }
}
console.log('soundness:', tests, 'tests,', bad, 'violations')

// ---- Strength: it prunes with the clue unsolved ----
// m=4, D=4. line[0] pinned to 2 => index is 2 => clue === line[1]. line[1]
// pinned to 5? no, D=4: pin line[1] to 3, so clue must be 3. Clue starts full
// {1,2,3,4}; a correct component removes {1,2,4} from it while it is unsolved.
installGlobals(1, 4)
const p = makePuzzle({ 0: 3, 1: 2, 2: 3, 3: 1, 4: 4 }, (c, v) => {
  if (c === 1) return [2]          // index forced to 2
  if (c === 2) return [3]          // target (line[1]) forced to 3
  if (c === 0) return [1, 2, 3, 4] // clue unsolved
  return [1, 2, 3, 4]
})
const inst = {}
mod.setParams(inst, 0, [1, 2, 3, 4])
let removals = 0
for (let pass = 0; pass < 20; pass++) {
  let before = 0; for (const s of p._cand.values()) before += s.size
  for (const _ of mod.update(inst, p)) { /* drain */ }
  let after = 0; for (const s of p._cand.values()) after += s.size
  removals += before - after
  if (after === before) break
}
const clueCands = [...p._cand.get(0)]
const strong = removals > 0 && clueCands.length === 1 && clueCands[0] === 3
console.log('strength: clue pruned to', clueCands, `(was {1,2,3,4}), ${removals} removals with clue unsolved`)

const ok = bad === 0 && strong
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
