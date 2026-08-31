// Strength checks for NumberedRoomsComponent.update. Soundness (never remove a
// true value) lives in soundness-harness.mjs; this file checks the other
// direction — that a rewrite does not quietly prune LESS than before.
//
//   node examples/numbered-rooms/update-strength.test.mjs
//
// 1. The index rules, on both kinds of line. The clue≠index rule needs a house
//    and must stand down on a bare line; the k=1 self-reference and the
//    1-based range rule hold on any line. A rewrite that drops a rule, or that
//    runs a house rule ungated, fails here.
// 2. Never-weaker fuzz against one pinned floor per kind: on a house the
//    component the frame board shipped, on a bare line the drawn-line
//    component that was folded into this one (#238). This is the old-vs-new
//    comparison OPTIMIZATION_LOG.md asks of every rewrite — the k=1 ordering
//    trap is invisible to the soundness harness.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { execFileSync } from 'child_process'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
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

// Cell 0 is the clue; cells 1..m are the line, nearest the clue first. The
// pre-merge drawn-line component reads a `distinct` flag as its fourth
// setParams argument; the current one reads the kind off the puzzle and
// ignores it.
const CLUE = 0
const lineCells = m => Array.from({ length: m }, (_, i) => i + 1)
const applyOn = (kind, line) => (mod, p) => {
  const inst = {}
  mod.setParams(inst, CLUE, line, kind === 'house')
  fixpoint(mod, inst, p)
}

// ---- 1. the index rules ----
// The clue≠index rule: index pinned to 2, every other cell open. On a house the
// target and the indexer are two cells of one house, so the clue cannot be 2.
// On a bare line they may both hold 2.
for (const [kind, wantClue] of [['house', [1, 3, 4]], ['bare', [1, 2, 3, 4]]]) {
  installGlobals(1, 4)
  const p = makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, c => (c === 1 ? [2] : [1, 2, 3, 4]), { kind, digitCount: 4 })
  const inst = {}
  cur.setParams(inst, CLUE, lineCells(4))
  fixpoint(cur, inst, p)
  assert.deepStrictEqual([...p._cand.get(CLUE)].sort(), wantClue,
    `${kind}: the clue≠index rule must be ${kind === 'house' ? 'on' : 'off'}`)
}

// k = 1 keeps the self-reference on any line: the target IS the indexer, which
// holds 1, so the clue is 1.
for (const kind of ['house', 'bare']) {
  installGlobals(1, 4)
  const p = makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, c => (c === 1 ? [1] : [1, 2, 3, 4]), { kind, digitCount: 4 })
  const inst = {}
  cur.setParams(inst, CLUE, lineCells(4))
  fixpoint(cur, inst, p)
  assert.deepStrictEqual([...p._cand.get(CLUE)], [1], `${kind}: k=1 forces the clue to 1`)
}

// The index is 1-based over the line's own cells: on a three-cell line, 0 and
// every digit past 3 is out of range and leaves the indexer.
for (const kind of ['house', 'bare']) {
  installGlobals(0, 5)
  const p = makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0 }, () => [0, 1, 2, 3, 4, 5], { kind, digitCount: 5 })
  const inst = {}
  cur.setParams(inst, CLUE, lineCells(3))
  fixpoint(cur, inst, p)
  assert.deepStrictEqual([...p._cand.get(1)].sort(), [1, 2, 3], `${kind}: only 1..3 index a three-cell line`)
}

// ---- 2. never weaker than the pinned floor, on each kind ----
//
// States are drawn around a real valid line — one whose first digit is a live
// index — so every state has a solution and neither version may empty a cell.
// A state drawn with no solution would die and compare nothing.
const { rnd } = makeRng(4242)
const REPS = 8000

for (const [kind, sizes] of [['bare', [[4, 6], [5, 5], [6, 6]]], ['house', [[4, 6], [5, 6], [3, 5]]]]) {
  const ref = floor(kind)
  let states = 0
  let drawn = 0
  let weaker = 0
  for (const [m, D] of sizes) {
    installGlobals(1, D)
    const line = lineCells(m)
    const apply = applyOn(kind, line)
    for (let rep = 0; rep < REPS; rep++) {
      const digits = makeLine(rnd, kind, m, D)
      if (digits[0] < 1 || digits[0] > m) {
        // a draw whose indexer points off the line is no truth; for a house,
        // moving an in-range digit to the front keeps the digits distinct
        const i = digits.findIndex(d => d >= 1 && d <= m)
        if (i < 0) continue
        ;[digits[0], digits[i]] = [digits[i], digits[0]]
      }
      drawn++
      const start = new Map([[CLUE, randomCandidates(rnd, 1, D, digits[digits[0] - 1])]])
      for (let i = 0; i < m; i++) start.set(line[i], randomCandidates(rnd, 1, D, digits[i]))
      const w = compareStrength(cur, ref, apply, start, { kind, digitCount: D })
      if (w === null) continue
      states++
      weaker += w.length
      if (w.length > 0 && weaker <= 5) console.log('weaker at', w[0], 'start', [...start])
    }
  }
  console.log(`never-weaker ${kind}:`, states, 'states,', weaker, 'weaker cells')
  assert.strictEqual(states, drawn, 'a state built around a valid line must never die')
  assert.strictEqual(weaker, 0)
}
console.log('PASS')
