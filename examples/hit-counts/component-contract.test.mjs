// The hit-counts components against the app's component contract
// (docs/research/bundle-api-reference.md): what each one lists for the solver
// to wake it on, what it builds for a removal, and what it hands the puzzle
// back. The seams are each component's `getAffectedCells`, `update` and
// `validate` on the harness mock.
//
//   node examples/hit-counts/component-contract.test.mjs
import assert from 'node:assert/strict'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installGlobals, makeIo, makeLine, makePuzzle, makeRng, randomCandidates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)

// ---- Side sum wakes on the lines its gate reads ----
// The app runs `update` only after a change to a cell `getAffectedCells`
// listed. The gate opens when the last perpendicular line loses its 0, which
// is a line cell's change, not a clue's: a component listing the clues alone
// sleeps through it and the side's bound waits for some later clue change.
{
  const sideSum = load('SideSumComponent.js', ['getAffectedCells', 'setParams', 'update'])
  const N = 9
  const SIDE = Array.from({ length: N }, (_, i) => 200 + i)
  const PERP = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => 1000 + i * N + j))
  installGlobals(0, 9)
  const truth = {}
  for (const c of SIDE) truth[c] = 1
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) truth[PERP[i][j]] = ((i + j) % N) + 1
  // Every clue but the first is pinned to 1, so the side's bound forces the
  // first to 1 too -- once the gate opens. One line still holds a 0.
  const start = c => (c === SIDE[0] ? [1, 5] : c === PERP[0][0] ? [0, truth[c]] : [truth[c]])
  const p = makePuzzle(truth, start, { houses: PERP })
  const affected = sideSum.getAffectedCells(SIDE, N, PERP)
  const inst = { cells: affected }
  sideSum.setParams(inst, SIDE, N, PERP)
  // A solver that wakes the component only when a listed cell has changed.
  const snapshot = () => affected.map(c => p.getCandidatesBitMask(c)).join()
  let seen = null
  const wake = () => {
    if (snapshot() === seen) return
    Array.from(sideSum.update(inst, p))
    seen = snapshot()
  }
  wake() // the load pass: the 0 is live on line 0, so the gate is shut
  assert.deepEqual([...p._cand.get(SIDE[0])], [1, 5], 'the gate is shut while line 0 holds a 0')
  p._cand.get(PERP[0][0]).delete(0) // line 0 becomes a house of 1..9: the gate opens
  wake()
  assert.deepEqual([...p._cand.get(SIDE[0])], [1], 'the line change that opens the gate wakes the side sum')
  console.log('hit-counts side sum: a line cell opening the gate wakes the component')
}

// ---- No component defines `initialize` ----
// The app wraps a custom `initialize` and then runs the base one, which runs
// `update` once (docs/research/bundle-api-reference.md, "*initialize"). A body
// that runs `update`, or any rule `update` already runs, does that work twice
// at load.
{
  const { read } = makeIo(HERE)
  const FILES = ['SideSumComponent.js', 'HitCountsJointComponent.js', 'SideHitMatchingComponent.js', 'HitCountsComponent.js']
  const defining = FILES.filter(f => /^function\s*\*\s*initialize\b/m.test(read(f)))
  assert.deepEqual(defining, [], 'the base initialize already runs update once')
  console.log('hit-counts initialize: none defined; the base runs update at load')
}

// ---- The joint component removes with raw masks ----
// The app's removal builders take a bitmask as readily as a DigitSet
// (docs/research/bundle-api-reference.md, "removeCandidatesFromCell"), so
// building a SudokuDigitSet per removal is an allocation nothing reads. With
// a SudokuDigitSet that throws, both sweeps must still remove from clue A,
// clue B and the line cells.
{
  const joint = load('HitCountsJointComponent.js', ['setParams', 'update'])
  const { rnd } = makeRng(452)
  installGlobals(0, 9)
  const real = globalThis.SudokuDigitSet
  globalThis.SudokuDigitSet = { from () { throw new Error('SudokuDigitSet built') } }
  const N = 5
  const A = 100
  const B = 101
  const cells = Array.from({ length: N }, (_, j) => j)
  const hits = line => line.filter((d, j) => d === j + 1).length
  try {
    for (const kind of ['fullHouse', 'bare']) {
      const removed = { A: 0, B: 0, line: 0 }
      for (let rep = 0; rep < 2000; rep++) {
        const line = makeLine(rnd, kind, N, N)
        const truth = { [A]: hits(line), [B]: hits(line.slice().reverse()) }
        line.forEach((d, j) => { truth[j] = d })
        // No n - 1 among the clue candidates, so the no-n-1 rule on the full
        // house removes nothing and every removal counted is the sweep's own.
        const seed = (c, v) => (c === A || c === B
          ? randomCandidates(rnd, 0, N, v).filter(d => d !== N - 1)
          : randomCandidates(rnd, 1, N, v))
        const p = makePuzzle(truth, seed, { houses: kind === 'bare' ? [] : [cells] })
        const size = c => p._cand.get(c).size
        const before = { A: size(A), B: size(B), line: cells.reduce((s, c) => s + size(c), 0) }
        const inst = { cells: [A, B, ...cells] }
        joint.setParams(inst, A, B, cells)
        Array.from(joint.update(inst, p))
        if (p._stopped !== null) continue
        removed.A += before.A - size(A)
        removed.B += before.B - size(B)
        removed.line += before.line - cells.reduce((s, c) => s + size(c), 0)
      }
      assert.ok(removed.A > 0 && removed.B > 0 && removed.line > 0, `${kind}: every removal site fired ${JSON.stringify(removed)}`)
      console.log(`hit-counts joint raw masks, ${kind}: removals ${JSON.stringify(removed)} with no SudokuDigitSet built`)
    }
  } finally {
    globalThis.SudokuDigitSet = real
  }
}

console.log('PASS')
