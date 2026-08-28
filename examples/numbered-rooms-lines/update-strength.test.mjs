// Strength checks for NumberedRoomsLinesComponent.update. Soundness (never
// remove a true value) lives in soundness-harness.mjs; this file checks the
// other direction — that a rewrite does not quietly prune LESS than before.
//
//   node examples/numbered-rooms-lines/update-strength.test.mjs
//
// 1. The `distinct` gate, both ways. With the line proved to be one house the
//    clue≠index rule bites; on a line that may repeat a digit it must stay
//    off. A rewrite that drops the rule, or that runs it ungated, fails here.
// 2. Never-weaker fuzz, in both modes: on fuzzed states the current update
//    must leave a subset of what the pinned reference commit's update left,
//    cell for cell.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load, loadAt } = makeIo(HERE)

// The floor: the component as it stands at the commit that pins this test.
const REF_COMMIT = '56e707a'
const NAMES = ['setParams', 'update']
const FILE = 'NumberedRoomsLinesComponent.js'
const cur = load(FILE, NAMES)
const ref = loadAt(REF_COMMIT, FILE, NAMES)

// Cell 0 is the clue; cells 1..m are the line, nearest the clue first.
const CLUE = 0
const lineCells = m => Array.from({ length: m }, (_, i) => i + 1)

// ---- 1. the distinct gate: index pinned to 2, every other cell open
for (const [distinct, wantClue] of [[true, [1, 3, 4]], [false, [1, 2, 3, 4]]]) {
  installGlobals(1, 4)
  const p = makePuzzle({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, c => c === 1 ? [2] : [1, 2, 3, 4])
  const inst = {}
  cur.setParams(inst, CLUE, lineCells(4), distinct)
  fixpoint(cur, inst, p)
  assert.deepStrictEqual([...p._cand.get(CLUE)].sort(), wantClue,
    `distinct=${distinct}: the clue≠index rule must be ${distinct ? 'on' : 'off'}`)
}

// ---- 2. never weaker than the pinned reference, in both modes
//
// States are drawn around a real valid tuple — a line whose first digit is a
// live index and whose indexed cell matches the clue — so every state has a
// solution and neither version may empty a cell. A state drawn with no
// solution would die and compare nothing.
const { rnd } = makeRng(4242)

function validTuple (m, D, distinct) {
  const line = []
  if (distinct) {
    const pool = Array.from({ length: D }, (_, i) => i + 1)
    for (let i = D - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]] }
    line.push(...pool.slice(0, m))
    // the first digit is the 1-based index, so it must land on the line
    if (line[0] > m) {
      const i = line.findIndex(d => d <= m)
      if (i < 0) return null
      ;[line[0], line[i]] = [line[i], line[0]]
    }
  } else {
    line.push(1 + ((rnd() * m) | 0))
    for (let i = 1; i < m; i++) line.push(1 + ((rnd() * D) | 0))
  }
  return { clue: line[line[0] - 1], line }
}

const REPS = 8000
for (const distinct of [false, true]) {
  let states = 0
  let drawn = 0
  let weaker = 0
  for (const [m, D] of [[4, 6], [5, 5], [6, 6]]) {
    installGlobals(1, D)
    const line = lineCells(m)
    const apply = (mod, p) => { const inst = {}; mod.setParams(inst, CLUE, line, distinct); fixpoint(mod, inst, p) }
    for (let rep = 0; rep < REPS; rep++) {
      const truth = validTuple(m, D, distinct)
      if (truth === null) continue
      drawn++
      const start = new Map([[CLUE, randomCandidates(rnd, 1, D, truth.clue)]])
      for (let i = 0; i < m; i++) start.set(line[i], randomCandidates(rnd, 1, D, truth.line[i]))
      const w = compareStrength(cur, ref, apply, start)
      if (w === null) continue
      states++
      weaker += w.length
      if (w.length > 0 && weaker <= 5) console.log('weaker at', w[0], 'start', [...start])
    }
  }
  console.log(`never-weaker distinct=${distinct}:`, states, 'states,', weaker, 'weaker cells')
  assert.strictEqual(states, drawn, 'a state built around a valid tuple must never die')
  assert.strictEqual(weaker, 0)
}
console.log('PASS')
