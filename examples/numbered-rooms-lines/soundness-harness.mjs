// Soundness fuzz for NumberedRoomsLinesComponent, both modes. distinct=false:
// truths may repeat digits along the line (a diagonal, a bent path), so the
// two distinct-only prunes must stay off. distinct=true: truths are distinct,
// same as the Numbered Rooms harness. Soundness = update never removes a
// cell's TRUE value.
//
//   node examples/numbered-rooms-lines/soundness-harness.mjs

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd, pick } = makeRng()

const mod = load('NumberedRoomsLinesComponent.js', ['setParams', 'update'])

// Every valid tuple: line in {1..D}^m, k = line[0] in 1..m, clue = line[k-1].
// Cell ids: 0 = clue, 1..m = line. With distinct, only distinct lines are truths.
function * validTuples (m, D, distinct) {
  const line = new Array(m).fill(1)
  while (true) {
    const k = line[0]
    if (k >= 1 && k <= m && (!distinct || new Set(line).size === m)) {
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

let ok = true
for (const distinct of [false, true]) {
  let tests = 0
  let bad = 0
  for (const [m, D] of [[4, 5], [5, 5], [6, 6]]) {
    installGlobals(1, D)
    const seed = seeder(D)
    const line = Array.from({ length: m }, (_, i) => i + 1)
    for (const truth of validTuples(m, D, distinct)) {
      for (let rep = 0; rep < (distinct ? 8 : 3); rep++) {
        const p = makePuzzle(truth, seed)
        const inst = {}
        mod.setParams(inst, 0, line, distinct)
        const v = violates(mod, inst, p, truth)
        tests++
        if (v) { bad++; if (bad <= 5) console.log('violation', v, 'truth', truth, `m=${m} D=${D} distinct=${distinct}`) }
      }
    }
  }
  console.log(`soundness distinct=${distinct}:`, tests, 'tests,', bad, 'violations')
  ok = ok && bad === 0
}

// The distinct-only prunes must be OFF when distinct=false: a repeating line
// [2,2,1,1] with clue 2 (k=2 -> line[1]=2) must survive with target 2 kept.
installGlobals(1, 4)
const p = makePuzzle({ 0: 2, 1: 2, 2: 2, 3: 1, 4: 1 }, (c, v) => c === 0 || c === 1 ? [v] : [1, 2, 3, 4])
const inst = {}
mod.setParams(inst, 0, [1, 2, 3, 4], false)
const v = violates(mod, inst, p, { 0: 2, 1: 2, 2: 2, 3: 1, 4: 1 })
console.log('repeat line keeps target=k:', v ? 'FAIL ' + v : 'ok')
ok = ok && !v

console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
