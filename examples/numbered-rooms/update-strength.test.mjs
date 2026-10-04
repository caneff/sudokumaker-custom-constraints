// The never-weaker fuzz is the old-vs-new comparison OPTIMIZATION_LOG.md asks
// of every rewrite: the k=1 ordering trap is invisible to the soundness harness.

import { execFileSync } from 'child_process'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, fixpoint, housesOf, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load, loadSource } = makeIo(HERE)
const NAMES = ['setParams', 'update']
const cur = load('NumberedRoomsComponent.js', NAMES)

// One floor per kind, each the component that owned that kind before the
// merge. The bare floor's file no longer exists in the tree, so both are read
// straight out of git history by path.
const FLOORS = {
  house: ['143b34d', 'examples/numbered-rooms/NumberedRoomsComponent.js'],
  bare: ['56e707a', 'examples/numbered-rooms-lines/NumberedRoomsLinesComponent.js']
}
const gitShow = (commit, path) =>
  execFileSync('git', ['show', `${commit}:${path}`], { cwd: HERE, encoding: 'utf8' })
const floor = kind => loadSource(gitShow(...FLOORS[kind]), NAMES)

// The pre-merge drawn-line floor reads a `distinct` flag as its fourth
// setParams argument; the current component reads the kind off the puzzle and
// ignores it.
const CLUE = 0
const lineCells = m => Array.from({ length: m }, (_, i) => i + 1)
const applyOn = (kind, line) => (mod, p) => {
  const inst = {}
  mod.setParams(inst, CLUE, line, kind === 'house')
  fixpoint(mod, inst, p)
}

for (const [kind, wantClue] of [['house', [1, 3, 4]], ['bare', [1, 2, 3, 4]]]) {
  installGlobals(1, 4)
  const p = makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, c => (c === 1 ? [2] : [1, 2, 3, 4]), { houses: housesOf(kind, lineCells(4)) })
  const inst = {}
  cur.setParams(inst, CLUE, lineCells(4))
  fixpoint(cur, inst, p)
  assert.deepStrictEqual([...p._cand.get(CLUE)].sort(), wantClue,
    `${kind}: the clue≠index rule must be ${kind === 'house' ? 'on' : 'off'}`)
}

for (const kind of ['house', 'bare']) {
  installGlobals(1, 4)
  const p = makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, c => (c === 1 ? [1] : [1, 2, 3, 4]), { houses: housesOf(kind, lineCells(4)) })
  const inst = {}
  cur.setParams(inst, CLUE, lineCells(4))
  fixpoint(cur, inst, p)
  assert.deepStrictEqual([...p._cand.get(CLUE)], [1], `${kind}: k=1 forces the clue to 1`)
}

for (const kind of ['house', 'bare']) {
  installGlobals(0, 5)
  const p = makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0 }, () => [0, 1, 2, 3, 4, 5], { houses: housesOf(kind, lineCells(3)) })
  const inst = {}
  cur.setParams(inst, CLUE, lineCells(3))
  fixpoint(cur, inst, p)
  assert.deepStrictEqual([...p._cand.get(1)].sort(), [1, 2, 3], `${kind}: only 1..3 index a three-cell line`)
}

// States are drawn around a real valid line, so every state has a solution:
// one with none would die and compare nothing.
const { rnd } = makeRng(4242)
const REPS = 8000

for (const [kind, sizes] of [['bare', [[4, 6], [5, 5], [6, 6]]], ['house', [[4, 6], [5, 6], [3, 5]]]]) {
  const ref = floor(kind)
  for (const [m, D] of sizes) {
    installGlobals(1, D)
    const line = lineCells(m)
    strengthSweep(`never-weaker ${kind} m=${m} D=${D}`, {
      solvable: true,
      cur,
      ref,
      apply: applyOn(kind, line),
      opts: { houses: housesOf(kind, line) },
      * states () {
        for (let rep = 0; rep < REPS; rep++) {
          const digits = makeLine(rnd, kind, m, D)
          if (digits[0] < 1 || digits[0] > m) {
            const i = digits.findIndex(d => d >= 1 && d <= m)
            if (i < 0) continue
            ;[digits[0], digits[i]] = [digits[i], digits[0]]
          }
          const start = new Map([[CLUE, randomCandidates(rnd, 1, D, digits[digits[0] - 1])]])
          for (let i = 0; i < m; i++) start.set(line[i], randomCandidates(rnd, 1, D, digits[i]))
          yield start
        }
      }
    })
  }
}
console.log('PASS')
