// Soundness fuzz for OutsideSudokuComponent. Soundness = update never removes
// a cell's TRUE value. We enumerate every valid (clue, line) tuple for short
// lines, seed random partial candidate states that still allow the truth, run
// the component to a fixpoint, and check the truth survived. A removed true
// value is the silent bug that makes a real puzzle unsolvable.
//
//   node examples/outside-sudoku/soundness-harness.mjs
//
// The lines enumerated are BARE: any digits, repeats allowed. Every house and
// full-house fill is also a bare fill, and the component has no kind gate, so
// the bare enumeration covers all three line kinds (docs/line-contract.md).
//
// Each case pins its own board geometry, because the component sizes its
// window off the board: 3 along a row of a 9x9, 3 across and 2 down on a 6x6,
// 2 on a 4x4. The digit count is smaller than the board so the enumeration
// stays exhaustive; the component reads the board only for the window.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, randomCandidates, violates } from '../_shared/harness-lib.mjs'
import { gridGeometry } from './grid-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng()

const mod = load('OutsideSudokuComponent.js', ['setParams', 'update'])

// Every valid tuple for one line shape: the line ranges over {1..D}^m, and the
// clue over the distinct digits of the window — the rule says the clue appears
// there, and says nothing else.
function * validTuples (clue, line, w, D) {
  const values = new Array(line.length).fill(1)
  while (true) {
    for (const d of new Set(values.slice(0, w))) {
      const truth = { [clue]: d }
      for (let i = 0; i < line.length; i++) truth[line[i]] = values[i]
      yield truth
    }
    let i = line.length - 1
    while (i >= 0 && values[i] === D) { values[i] = 1; i-- }
    if (i < 0) break
    values[i]++
  }
}

// Board geometry, line direction, line length and digit count per case. The
// mid-box start (from: 1) checks a window that straddles a box boundary.
const CASES = [
  { N: 9, bh: 3, bw: 3, down: false, from: 0, m: 5, D: 4 },
  { N: 9, bh: 3, bw: 3, down: true, from: 1, m: 5, D: 4 },
  { N: 6, bh: 2, bw: 3, down: true, from: 0, m: 4, D: 5 },
  { N: 6, bh: 2, bw: 3, down: false, from: 0, m: 4, D: 5 },
  { N: 4, bh: 2, bw: 2, down: false, from: 0, m: 4, D: 4 },
  { N: 9, bh: 3, bw: 3, down: false, from: 7, m: 2, D: 5 }
]

let tests = 0
let bad = 0
for (const { N, bh, bw, down, from, m, D } of CASES) {
  installGlobals(1, D)
  const geo = gridGeometry(N, bh, bw)
  const line = down ? geo.columnLine(0, from, m) : geo.rowLine(0, from, m)
  const w = Math.min(down ? bh : bw, m)
  // pinned, full, or a random subset — always keeping the cell's true value
  const seed = (c, v) => randomCandidates(rnd, 1, D, v)
  for (const truth of validTuples(geo.clue, line, w, D)) {
    for (let rep = 0; rep < 8; rep++) {
      const p = makePuzzle(truth, seed)
      Object.assign(p, geo.api)
      const inst = {}
      mod.setParams(inst, geo.clue, line)
      const v = violates(mod, inst, p, truth)
      tests++
      if (v) { bad++; if (bad <= 5) console.log('violation', v, 'truth', truth, `N=${N} m=${m} D=${D}`) }
    }
  }
}
console.log('soundness:', tests, 'tests,', bad, 'violations')
console.log(bad === 0 ? 'PASS' : 'FAIL')
process.exit(bad === 0 ? 0 : 1)
