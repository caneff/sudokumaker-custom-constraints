// The lines enumerated are BARE: any digits, repeats allowed. Every house and
// full-house fill is also a bare fill, and the component has no kind gate, so
// the bare enumeration covers all three line kinds (docs/line-contract.md).
// The digit count D stays below the board's so the enumeration stays
// exhaustive.

import { installGlobals, makeIo, makeRng, randomCandidates, fuzzSoundness, finishHarness } from '../_shared/harness-lib.mjs'
import { gridGeometry } from './grid-geometry.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)
const { rnd } = makeRng()

const mod = load('OutsideSudokuComponent.js', ['setParams', 'update', 'validate'])

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
  const seed = (c, v) => randomCandidates(rnd, 1, D, v)
  const states = []
  for (const truth of validTuples(geo.clue, line, w, D)) {
    for (let rep = 0; rep < 8; rep++) states.push(truth)
  }
  const r = fuzzSoundness(`outside-sudoku N=${N} m=${m} D=${D}`, {
    iters: states.length,
    draw: iter => {
      const inst = {}
      mod.setParams(inst, geo.clue, line, w)
      return {
        truth: states[iter],
        seed,
        parts: [{ mod, inst }],
        note: `truth ${JSON.stringify(states[iter])}`,
        inspect: p => Object.assign(p, geo.api)
      }
    }
  })
  tests += r.tests
  bad += r.failures
}
console.log('soundness:', tests, 'tests,', bad, 'violations')
finishHarness(bad === 0)
