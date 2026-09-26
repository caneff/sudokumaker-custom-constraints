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

// ---- A forced hit is one keep-only change ----
// Pinning a cell to its target is `filterCandidatesInCell(1 << target, cell)`:
// one change, no candidate list to read and filter first. The state is the
// side the update-strength test pins (update-strength.test.mjs, "side hit
// matching"): the side forces the whole diagonal, and line 0's own clue
// forces its first cell.
{
  installGlobals(0, 4)
  const side = load('SideHitMatchingComponent.js', ['setParams', 'update'])
  const line = load('HitCountsComponent.js', ['setParams', 'update'])
  const CLUES = [400, 401, 402, 403]
  const cell = (r, c) => r * 4 + c
  const LINES = [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => cell(r, c)))
  const CANDS = [
    [[1, 2, 3, 4], [1, 3, 4], [1, 2, 4], [1, 2, 3]],
    [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 4], [1, 2, 3]],
    [[2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3]],
    [[2, 3, 4], [1, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]]
  ]
  const truth = {}
  for (const c of CLUES) truth[c] = 1
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) truth[cell(r, c)] = r === c ? c + 1 : CANDS[r][c][0]
  const seed = c => (CLUES.includes(c) ? [1] : CANDS[Math.floor(c / 4)][c % 4])
  const houses = [...LINES, ...[0, 1, 2, 3].map(c => LINES.map(l => l[c]))]
  // Record every removal builder a component calls, then let it apply.
  const spied = () => {
    const p = makePuzzle(truth, seed, { houses })
    const calls = []
    for (const name of ['filterCandidatesInCell', 'removeCandidatesFromCell', 'removeCandidateFromCell']) {
      const real = p[name]
      p[name] = (digits, c) => { calls.push([name, +digits, c]); return real(digits, c) }
    }
    return { p, calls }
  }
  const pins = calls => calls.filter(([name]) => name === 'filterCandidatesInCell')
  const onDiagonal = (calls, i) => calls.filter(([, , c]) => c === cell(i, i))

  const s = spied()
  const is = { cells: [...CLUES, ...LINES.flat()] }
  side.setParams(is, CLUES, LINES)
  Array.from(side.update(is, s.p))
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(onDiagonal(s.calls, i), [['filterCandidatesInCell', 1 << (i + 1), cell(i, i)]],
      `the side pins line ${i} at position ${i} with one keep-only change`)
  }
  assert.equal(pins(s.calls).length, 4, 'the side yields exactly the four pins as keep-only changes')

  const l = spied()
  const il = { cells: [CLUES[0], ...LINES[0]] }
  line.setParams(il, CLUES[0], LINES[0])
  Array.from(line.update(il, l.p))
  assert.deepEqual(onDiagonal(l.calls, 0), [['filterCandidatesInCell', 1 << 1, cell(0, 0)]],
    'the per-line rule pins its one possible hit with one keep-only change')
  console.log('hit-counts forced hits: one filterCandidatesInCell per pinned cell, side and per-line')

  // ---- A side that stops holding 1..n at a position leaves no memo ----
  // The side's memo is the hash of the state its last sweep left. A call that
  // finds some position missing a digit exits before any sweep; a memo left
  // standing there names a state this call never read.
  const m = spied()
  const im = { cells: [...CLUES, ...LINES.flat()] }
  side.setParams(im, CLUES, LINES)
  Array.from(side.update(im, m.p))
  assert.notEqual(im.sig, null, 'a sweep leaves its memo')
  for (const l of LINES) m.p._cand.get(l[3]).delete(4) // position 3 no longer holds a 4
  Array.from(side.update(im, m.p))
  assert.equal(im.sig, null, 'the null-side exit clears the memo')
  console.log('hit-counts side matching: the null-side exit clears the memo')
}

// ---- validate reads the cell list the app already built ----
// The app stores `getAffectedCells`'s result as `instance.cells` before
// `setParams` runs (docs/research/bundle-api-reference.md, the custom
// component wrapper), and calls `validate` on every search node. Rebuilding
// the same array there is an allocation per node.
{
  installGlobals(0, 4)
  const CLUES = [400, 401, 402, 403]
  const LINES = [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => r * 4 + c))
  const truth = {}
  for (const c of CLUES) truth[c] = 1
  for (const l of LINES) l.forEach((c, j) => { truth[c] = j + 1 })
  const cases = [
    ['HitCountsComponent.js', [CLUES[0], LINES[0]]],
    ['HitCountsJointComponent.js', [CLUES[0], CLUES[1], LINES[0]]],
    ['SideHitMatchingComponent.js', [CLUES, LINES]]
  ]
  for (const [file, args] of cases) {
    const mod = load(file, ['getAffectedCells', 'setParams', 'validate'])
    const p = makePuzzle(truth, (c, v) => [v])
    const asked = []
    const real = p.getCellsAreFilled
    p.getCellsAreFilled = cs => { asked.push(cs); return real(cs) }
    const inst = { cells: mod.getAffectedCells(...args) }
    mod.setParams(inst, ...args)
    mod.validate(inst, p)
    assert.ok(asked.length > 0 && asked.every(cs => cs === inst.cells), `${file}: validate passes instance.cells itself`)
  }
  console.log('hit-counts validate: all three pass instance.cells to getCellsAreFilled')
}

console.log('PASS')
