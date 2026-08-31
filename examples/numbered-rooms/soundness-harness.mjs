// Soundness fuzz for NumberedRoomsComponent. Soundness = update never removes
// a cell's TRUE value. A removed true value is the silent bug that makes a real
// puzzle unsolvable.
//
//   node examples/numbered-rooms/soundness-harness.mjs
//
// The component gates two rules on the line being a house, so every kind in
// docs/line-contract.md gets its own fuzz: a bare line (a drawn path, digits
// may repeat), a house, and a full house. The mock answers
// getCellsCanHaveRepeats from the declared kind, never from the digits, so a
// run cannot pass by inferring a kind the app would not give it.
//
// A fourth run puts the board on minDigit 0: an index of 0 is out of range, and
// 0 is an ordinary digit everywhere else on the line.
//
// A closing strength block proves the point of the component: with the clue
// still unsolved it already prunes. The wrapper it replaced did nothing until
// the clue collapsed, so its removal count here would be zero.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, randomCandidates, violates, fixpoint } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng()

const mod = load('NumberedRoomsComponent.js', ['setParams', 'update'])

// Cell 0 is the clue; cells 1..m are the line, nearest the clue first.
const CLUE = 0
const ITERS = 20000
const lineCells = m => Array.from({ length: m }, (_, i) => i + 1)

// The truth a line of digits carries: the indexer line[0] is a 1-based index k
// and the clue is the digit at line[k - 1].
function truthOf (line) {
  const truth = { [CLUE]: line[line[0] - 1] }
  for (let i = 0; i < line.length; i++) truth[i + 1] = line[i]
  return truth
}

// A drawn line is a truth only when its indexer points at one of its own
// cells. `swapIndexerIntoRange` keeps a house's distinct digits distinct while
// moving an in-range digit to the front; null means the draw has none.
function inRange (line) {
  return line[0] >= 1 && line[0] <= line.length
}

function swapIndexerIntoRange (line) {
  if (inRange(line)) return line
  const i = line.findIndex(d => d >= 1 && d <= line.length)
  if (i < 0) return null
  ;[line[0], line[i]] = [line[i], line[0]]
  return line
}

// The three kinds over 1..D, from the shared builder.
function drawLine (kind, m, D) {
  return swapIndexerIntoRange(makeLine(rnd, kind, m, D))
}

// The same, over 0..D, for the minDigit 0 board: makeLine draws from 1..D
// only, and the run exists to put a real 0 on the line.
function drawZeroLine (kind, m, D) {
  if (kind === 'bare') {
    const line = []
    for (let i = 0; i < m; i++) line.push((rnd() * (D + 1)) | 0)
    line[0] = 1 + ((rnd() * m) | 0)
    return line
  }
  const pool = []
  for (let d = 0; d <= D; d++) pool.push(d)
  for (let i = pool.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]] }
  return swapIndexerIntoRange(pool.slice(0, m))
}

function fuzz (label, kind, minDigit, sizes, draw) {
  let tests = 0
  let bad = 0
  for (const [m, D] of sizes) {
    installGlobals(minDigit, D)
    for (let iter = 0; iter < ITERS; iter++) {
      const line = draw(kind, m, D)
      if (line === null) continue
      const truth = truthOf(line)
      const p = makePuzzle(truth, (c, v) => randomCandidates(rnd, minDigit, D, v), { kind, digitCount: D })
      const inst = {}
      mod.setParams(inst, CLUE, lineCells(line.length))
      const v = violates(mod, inst, p, truth)
      tests++
      if (v) { bad++; if (bad <= 5) console.log('violation', v, 'line', line, `m=${line.length} D=${D}`) }
    }
  }
  console.log(`soundness ${label}:`, tests, 'tests,', bad, 'violations')
  return bad
}

let bad = 0
// A house needs m < D; a full house is a permutation of 1..D, so m = D.
bad += fuzz('bare', 'bare', 1, [[3, 4], [4, 6], [6, 6]], drawLine)
bad += fuzz('house', 'house', 1, [[3, 5], [4, 6], [5, 6]], drawLine)
bad += fuzz('full house', 'fullHouse', 1, [[4, 4], [5, 5], [6, 6]], drawLine)
bad += fuzz('minDigit 0, bare', 'bare', 0, [[4, 6], [6, 6]], drawZeroLine)
bad += fuzz('minDigit 0, house', 'house', 0, [[4, 6], [5, 6]], drawZeroLine)

// ---- Strength: it prunes with the clue unsolved ----
// m=4, D=4, one house. line[0] pinned to 2 => the index is 2 => the clue is
// line[1], pinned to 3. The clue starts full {1,2,3,4} and must come out {3}.
installGlobals(1, 4)
const p = makePuzzle({ 0: 3, 1: 2, 2: 3, 3: 1, 4: 4 }, (c, v) => {
  if (c === 1) return [2] // index forced to 2
  if (c === 2) return [3] // target (line[1]) forced to 3
  return [1, 2, 3, 4]
}, { kind: 'house', digitCount: 4 })
const inst = {}
mod.setParams(inst, CLUE, lineCells(4))
let removals = 0; for (const s of p._cand.values()) removals += s.size
fixpoint(mod, inst, p)
for (const s of p._cand.values()) removals -= s.size
const clueCands = [...p._cand.get(CLUE)]
const strong = removals > 0 && clueCands.length === 1 && clueCands[0] === 3
console.log('strength: clue pruned to', clueCands, `(was {1,2,3,4}), ${removals} removals with clue unsolved`)

const ok = bad === 0 && strong
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
