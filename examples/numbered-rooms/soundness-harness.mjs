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

// ---- Pair component soundness ----
// Two clues on one line: left index a = line[0], O_L = line[a-1]; right index
// b = line[N-1], O_R = line[N-b]. Truths are permutations of 1..N (a distinct
// sudoku line), where the a+b===N+1 <=> O_L===O_R biconditional holds.
const pairMod = load('NumberedRoomsPairComponent.js', ['setParams', 'update'])

function* permutations (arr) {
  if (arr.length <= 1) { yield arr; return }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permutations(rest)) yield [arr[i], ...p]
  }
}

// Mock adds getCellsSeeEachOther, the distinctness signal the pair component
// guards its repeat-sensitive deductions on. `see` says whether the line is
// known distinct.
function makePairPuzzle (truth, seed, see = true) {
  const p = makePuzzle(truth, seed)
  p.getCellsSeeEachOther = () => see
  return p
}

let pairTests = 0
let pairBad = 0
for (const N of [4, 5, 6]) {
  installGlobals(1, N)
  const seed = seeder(N)
  const CL = 100
  const CR = 101
  const line = Array.from({ length: N }, (_, i) => i)   // cell ids 0..N-1
  for (const perm of permutations(Array.from({ length: N }, (_, i) => i + 1))) {
    const a = perm[0]
    const b = perm[N - 1]
    const truth = { [CL]: perm[a - 1], [CR]: perm[N - b] }
    for (let i = 0; i < N; i++) truth[i] = perm[i]
    for (let rep = 0; rep < 6; rep++) {
      const pp = makePairPuzzle(truth, seed)
      const inst = {}
      pairMod.setParams(inst, CL, CR, line)
      const v = violates(pairMod, inst, pp, truth)
      pairTests++
      if (v) { pairBad++; if (pairBad <= 5) console.log('pair violation', v, 'truth', truth, `N=${N}`) }
    }
  }
}
console.log('pair soundness:', pairTests, 'tests,', pairBad, 'violations')

// ---- Pair strength: equal clues fix the index sum, clue unsolved ----
// N=5, clues both pinned to 4 => a + b === 6. Left index a starts full {1..5};
// only values with 6-a still live in the right index survive. Pin b to 2 => a
// must be 4. This is the cross-clue prune the per-line component cannot do.
installGlobals(1, 5)
const line5 = [0, 1, 2, 3, 4]
const pp = makePairPuzzle({ 100: 4, 101: 4, 0: 4, 1: 0, 2: 0, 3: 0, 4: 2 }, (c, v) => {
  if (c === 100 || c === 101) return [4]            // both clues equal
  if (c === 4) return [2]                            // right index b = 2
  if (c === 0) return [1, 2, 3, 4, 5]                // left index a: full
  return [1, 2, 3, 4, 5]
})
const pinst = {}
pairMod.setParams(pinst, 100, 101, line5)
for (let pass = 0; pass < 20; pass++) {
  let before = 0; for (const s of pp._cand.values()) before += s.size
  for (const _ of pairMod.update(pinst, pp)) { /* drain */ }
  let after = 0; for (const s of pp._cand.values()) after += s.size
  if (after === before) break
}
const aCands = [...pp._cand.get(0)]
const pairStrong = aCands.length === 1 && aCands[0] === 4
console.log('pair strength: left index pruned to', aCands, '(equal clues => a+b=6, b=2 => a=4)')

// ---- Pair soundness on NON-distinct lines (guard must hold) ----
// When the line may repeat digits, getCellsSeeEachOther is false and the
// repeat-sensitive deductions must switch off. Enumerate every line in
// {1..N}^N (repeats allowed) that satisfies each clue's own index relation, and
// check the pair component removes no true value. Without the guard, a line like
// [2,_,_,2] with equal middle cells loses a true clue value here.
function* rowsWithRepeats (N) {
  const line = new Array(N).fill(1)
  while (true) {
    yield [...line]
    let i = N - 1
    while (i >= 0 && line[i] === N) { line[i] = 1; i-- }
    if (i < 0) break
    line[i]++
  }
}

let ndTests = 0
let ndBad = 0
for (const N of [4, 5]) {
  installGlobals(1, N)
  const seed = seeder(N)
  const CL = 100
  const CR = 101
  const line = Array.from({ length: N }, (_, i) => i)
  for (const row of rowsWithRepeats(N)) {
    const a = row[0]
    const b = row[N - 1]
    const truth = { [CL]: row[a - 1], [CR]: row[N - b] }
    for (let i = 0; i < N; i++) truth[i] = row[i]
    for (let rep = 0; rep < 4; rep++) {
      const p = makePairPuzzle(truth, seed, false)   // line NOT known distinct
      const inst = {}
      pairMod.setParams(inst, CL, CR, line)
      const v = violates(pairMod, inst, p, truth)
      ndTests++
      if (v) { ndBad++; if (ndBad <= 5) console.log('non-distinct violation', v, 'row', row, `N=${N}`) }
    }
  }
}
console.log('pair soundness (non-distinct, guard off):', ndTests, 'tests,', ndBad, 'violations')

const ok = bad === 0 && strong && pairBad === 0 && pairStrong && ndBad === 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
