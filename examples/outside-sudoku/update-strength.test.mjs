// Strength checks for OutsideSudokuComponent.update. Soundness (never remove a
// true value) lives in soundness-harness.mjs; this file checks the other
// direction — that the component never prunes LESS than the three documented
// deductions.
//
//   node examples/outside-sudoku/update-strength.test.mjs

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle, makeRng, randomCandidates, fixpoint } from '../_shared/harness-lib.mjs'
import { gridGeometry } from './grid-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const mod = load('OutsideSudokuComponent.js', ['setParams', 'update', 'validate'])

// One clue and one line on a 9x9 grid with 3x3 boxes: window = 3 cells.
const g = gridGeometry(9, 3, 3)

// `cands` maps cell id -> candidate array. Returns the state after update runs
// to a fixpoint, as cell id -> sorted candidate array.
function run (line, cands) {
  const p = makePuzzle(Object.fromEntries([...cands.keys()].map(c => [c, 0])), c => cands.get(c))
  Object.assign(p, g.api)
  const inst = {}
  mod.setParams(inst, g.clue, line)
  fixpoint(mod, inst, p)
  return new Map([...p._cand].map(([c, s]) => [c, [...s].sort((a, b) => a - b)]))
}

installGlobals(1, 9)

// ---- 1. the clue keeps only digits a window cell can still hold
{
  const line = g.rowLine(0, 0, 9)
  const cands = new Map([[g.clue, [1, 2, 3, 4, 5, 6, 7, 8, 9]]])
  // window (line[0..2]) can hold only 1, 2, 3; 9 lives outside the window
  for (const [i, c] of line.entries()) cands.set(c, i < 3 ? [1, 2, 3] : [9])
  const after = run(line, cands)
  assert.deepStrictEqual(after.get(g.clue), [1, 2, 3], 'clue must keep only window digits')
}

// ---- 2. the window is the box's extent, even when the line starts mid-box
// The line runs columns 1..8 of row 0, so its first box holds only two of its
// cells — but the window is still three cells, the box's extent along a row.
// Digit 3 lives in the third cell alone: a window cut short at the box edge
// would drop it from the clue.
{
  const line = g.rowLine(0, 1, 8)
  const cands = new Map([[g.clue, [1, 2, 3, 4, 5, 6, 7, 8, 9]]])
  for (const [i, c] of line.entries()) cands.set(c, i < 2 ? [1, 2] : i === 2 ? [3] : [9])
  const after = run(line, cands)
  assert.deepStrictEqual(after.get(g.clue), [1, 2, 3], 'window is 3 cells from line[0], not 2')
}

// ---- 3. clue solved, one window cell left that admits it: that cell is it
{
  const line = g.rowLine(0, 0, 9)
  const cands = new Map([[g.clue, [4]]])
  for (const [i, c] of line.entries()) cands.set(c, i === 1 ? [4, 7, 8] : [1, 2, 3])
  const after = run(line, cands)
  assert.deepStrictEqual(after.get(line[1]), [4], 'the only window cell that admits the clue is pinned')
}

// ---- 4. clue solved, no window cell admits it: the branch is dead
{
  const line = g.rowLine(0, 0, 9)
  const cands = new Map([[g.clue, [4]]])
  for (const [i, c] of line.entries()) cands.set(c, i < 3 ? [1, 2, 3] : [4])
  const after = run(line, cands)
  assert.deepStrictEqual(after.get(g.clue), [], 'a clue no window cell can hold empties')
}

// ---- 5. never weaker than the three documented deductions
// The floor is a naive reference written straight off the spec: plain digit
// arrays, no bitmasks, and the window length handed to it by the case instead
// of read off the board. On every random state the component must leave a
// subset of what the reference leaves, cell for cell — a refactor that loses a
// deduction, or that sizes the window wrong, shows up here.
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
let states = 0
let weaker = 0
for (const [N, bh, bw] of [[9, 3, 3], [6, 2, 3], [4, 2, 2]]) {
  installGlobals(1, N)
  const geo = gridGeometry(N, bh, bw)
  for (let rep = 0; rep < 4000; rep++) {
    // a row or a column line, starting anywhere, of any length that fits
    const down = rnd() < 0.5
    const from = (rnd() * N) | 0
    const len = 1 + ((rnd() * (N - from)) | 0)
    const i = (rnd() * N) | 0
    const line = down ? geo.columnLine(i, from, len) : geo.rowLine(i, from, len)
    const w = Math.min(down ? bh : bw, len)
    const start = new Map([[geo.clue, randomCandidates(rnd, 1, N)]])
    for (const c of line) start.set(c, randomCandidates(rnd, 1, N))

    const runOne = version => {
      const truth = Object.fromEntries([...start.keys()].map(c => [c, 0]))
      const p = makePuzzle(truth, c => start.get(c))
      Object.assign(p, geo.api)
      const inst = {}
      // The extra `w` is the reference's; the component ignores it and reads
      // the window off the geometry, which is the point of the comparison.
      version.setParams(inst, geo.clue, line, w)
      fixpoint(version, inst, p)
      return p
    }
    const pNew = runOne(mod)
    const pRef = runOne(reference)
    // A dead state (some cell emptied by either side) has no solution, so
    // "weaker" means nothing there; skip it.
    if ([...pNew._cand.values(), ...pRef._cand.values()].some(s => s.size === 0)) continue
    states++
    for (const c of start.keys()) {
      for (const d of pNew._cand.get(c)) {
        if (!pRef._cand.get(c).has(d)) {
          weaker++
          if (weaker <= 5) console.log('weaker at cell', c, 'digit', d, 'line', line, 'w', w)
        }
      }
    }
  }
}
console.log('never-weaker:', states, 'states,', weaker, 'weaker cells')
assert.ok(states > 6000, 'the dead-state filter must leave most states to compare')
assert.strictEqual(weaker, 0)

console.log('PASS')
