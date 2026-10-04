import assert from 'assert'
import { installGlobals, makeIo, makePuzzle, makeRng, randomCandidates, fixpoint, strengthSweep } from '../_shared/harness-lib.mjs'
import { gridGeometry } from './grid-geometry.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)
const mod = load('OutsideSudokuComponent.js', ['getAffectedCells', 'setParams', 'update', 'validate'])

const g = gridGeometry(9, 3, 3)

function run (line, cands, w) {
  const p = makePuzzle(Object.fromEntries([...cands.keys()].map(c => [c, 0])), c => cands.get(c))
  Object.assign(p, g.api)
  const inst = {}
  mod.setParams(inst, g.clue, line, w)
  fixpoint(mod, inst, p)
  return new Map([...p._cand].map(([c, s]) => [c, [...s].sort((a, b) => a - b)]))
}

installGlobals(1, 9)

{
  const line = g.rowLine(0, 0, 9)
  const cands = new Map([[g.clue, [1, 2, 3, 4, 5, 6, 7, 8, 9]]])
  for (const [i, c] of line.entries()) cands.set(c, i < 3 ? [1, 2, 3] : [9])
  const after = run(line, cands, 3)
  assert.deepStrictEqual(after.get(g.clue), [1, 2, 3], 'clue must keep only window digits')
}

{
  const line = g.rowLine(0, 1, 8)
  const cands = new Map([[g.clue, [1, 2, 3, 4, 5, 6, 7, 8, 9]]])
  for (const [i, c] of line.entries()) cands.set(c, i < 2 ? [1, 2] : i === 2 ? [3] : [9])
  const after = run(line, cands, 3)
  assert.deepStrictEqual(after.get(g.clue), [1, 2, 3], 'window is 3 cells from line[0], not 2')
}

{
  const line = g.rowLine(0, 0, 9)
  const cands = new Map([[g.clue, [4]]])
  for (const [i, c] of line.entries()) cands.set(c, i === 1 ? [4, 7, 8] : [1, 2, 3])
  const after = run(line, cands, 3)
  assert.deepStrictEqual(after.get(line[1]), [4], 'the only window cell that admits the clue is pinned')
}

{
  const line = g.rowLine(0, 0, 9)
  const cands = new Map([[g.clue, [4]]])
  for (const [i, c] of line.entries()) cands.set(c, i < 3 ? [1, 2, 3] : [4])
  const after = run(line, cands, 3)
  assert.deepStrictEqual(after.get(g.clue), [], 'a clue no window cell can hold empties')
}

{
  const line = g.rowLine(0, 0, 9)
  assert.deepStrictEqual(mod.getAffectedCells(g.clue, line, 3), [g.clue, ...line.slice(0, 3)],
    'a line cell outside the window must not wake update')
  assert.deepStrictEqual(mod.getAffectedCells(g.clue, line, 9), [g.clue, ...line], 'a full window lists the whole line')
}

// Cells past the window stay open: a validate that waited on the whole line
// would return a vacuous true here.
{
  const line = g.rowLine(0, 0, 9)
  const state = (clueDigit, windowDigits) => {
    const cands = new Map([[g.clue, [clueDigit]]])
    for (const [i, c] of line.entries()) cands.set(c, i < 3 ? [windowDigits[i]] : [1, 2, 3, 4, 5, 6, 7, 8, 9])
    const p = makePuzzle(Object.fromEntries([...cands.keys()].map(c => [c, 0])), c => cands.get(c))
    Object.assign(p, g.api)
    const inst = {}
    mod.setParams(inst, g.clue, line, 3)
    return mod.validate(inst, p)
  }
  assert.strictEqual(state(9, [1, 2, 3]), false, 'a filled window without the clue digit is rejected')
  assert.strictEqual(state(2, [1, 2, 3]), true, 'a filled window holding the clue digit passes')
}

// The floor is a naive reference written straight off the spec, with plain
// digit arrays instead of bitmasks; the component must leave a subset of what
// it leaves, cell for cell.
const reference = {
  setParams (inst, clue, line, w) { Object.assign(inst, { clue, line, w }) },
  * update (inst, p) {
    const { clue, line, w } = inst
    const clueDigits = [...p.getCandidates(clue)]
    const window = line.slice(0, w).map(c => [...p.getCandidates(c)])
    const union = new Set(window.flat())
    const gone = clueDigits.filter(d => !union.has(d))
    if (gone.length) yield p.removeCandidatesFromCell(SudokuDigitSet.from(gone), clue)
    if (clueDigits.length !== 1) return
    const d = clueDigits[0]
    const holders = window.flatMap((s, i) => (s.includes(d) ? [i] : []))
    if (holders.length !== 1) return
    const cell = line[holders[0]]
    const rm = [...p.getCandidates(cell)].filter(x => x !== d)
    if (rm.length) yield p.removeCandidatesFromCell(SudokuDigitSet.from(rm), cell)
  }
}

const { rnd } = makeRng(4242)
for (const [N, bh, bw] of [[9, 3, 3], [6, 2, 3], [4, 2, 2]]) {
  installGlobals(1, N)
  const geo = gridGeometry(N, bh, bw)
  strengthSweep(`never-weaker ${N}x${N}`, {
    cur: mod,
    ref: reference,
    apply: (version, p, { line, w }) => {
      Object.assign(p, geo.api)
      const inst = {}
      version.setParams(inst, geo.clue, line, w)
      fixpoint(version, inst, p)
    },
    * states () {
      for (let rep = 0; rep < 4000; rep++) {
        const down = rnd() < 0.5
        const from = (rnd() * N) | 0
        const len = 1 + ((rnd() * (N - from)) | 0)
        const i = (rnd() * N) | 0
        const line = down ? geo.columnLine(i, from, len) : geo.rowLine(i, from, len)
        const w = Math.min(down ? bh : bw, len)
        const start = new Map([[geo.clue, randomCandidates(rnd, 1, N)]])
        for (const c of line) start.set(c, randomCandidates(rnd, 1, N))
        yield { start, params: { line, w } }
      }
    }
  })
}

console.log('PASS')
