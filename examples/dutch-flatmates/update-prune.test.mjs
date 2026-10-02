// Targeted cases for DutchFlatmatesComponent.update: what a caller sees come
// out of a given candidate state. Each column is a full house, so it holds one
// 5, one 1 and one 9; a 5 needs the 1 directly above it or the 9 directly below
// it. `update` keeps only the 5, 1 and 9 positions some consistent triple still
// supports, and stops the branch when no triple does.
//
//   node examples/dutch-flatmates/update-prune.test.mjs
//
// Soundness (never remove a true value) lives in soundness-harness.mjs and
// strength in update-strength.test.mjs. The skip-unchanged cache is witnessed
// here only through what `update` removes from states a caller hands it.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const N = 9
installGlobals(1, N)
const mod = load('DutchFlatmatesComponent.js', ['setParams', 'update', 'validate'])
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const at = (row, col) => row * N + col

// A full-candidate board; `edit(cand)` narrows cells before the call.
function board (edit = () => {}) {
  const cand = new Map(CELLS.map(c => [c, new Set(ALL)]))
  edit(cand)
  const p = makePuzzle(Object.fromEntries(CELLS.map(c => [c, 0])), c => [...cand.get(c)])
  const inst = { cells: CELLS }
  mod.setParams(inst, CELLS)
  return { p, inst }
}
const run = ({ p, inst }) => { Array.from(mod.update(inst, p)); return p }
const has = (p, row, col, d) => p._cand.get(at(row, col)).has(d)
// Candidates of every digit but 1, 5 and 9, which `update` has no business touching.
const others = p => JSON.stringify(CELLS.map(c => [...p._cand.get(c)].filter(d => ![1, 5, 9].includes(d))))

// Column 0: a 5 at row 3 has no 1 above (row 2 lacks 1) and no 9 below (row 4
// lacks 9), so it is pruned; the 5 at row 6 has a 1 candidate above at row 5.
{
  const b = board(cand => {
    for (let r = 0; r < N; r++) if (r !== 3 && r !== 6) cand.get(at(r, 0)).delete(5)
    cand.get(at(2, 0)).delete(1)
    cand.get(at(4, 0)).delete(9)
  })
  const before = others(b.p)
  run(b)
  assert.ok(!has(b.p, 3, 0, 5), 'the unsupported 5 at row 3 survived')
  assert.ok(has(b.p, 6, 0, 5), 'the supported 5 at row 6 was removed')
  assert.strictEqual(others(b.p), before, 'a digit other than 1, 5, 9 changed')
  console.log('column with an unsupported 5: pruned, supported 5 kept')
}

// A top-row 5 needs the 9 below it: row 1 has no 9 candidate, so the 5 at row 0
// goes while the 5 at row 4 (1 above at row 3) stays.
{
  const b = board(cand => {
    for (let r = 0; r < N; r++) if (r !== 0 && r !== 4) cand.get(at(r, 2)).delete(5)
    cand.get(at(1, 2)).delete(9)
  })
  run(b)
  assert.ok(!has(b.p, 0, 2, 5), 'a top-row 5 with no 9 below survived')
  assert.ok(has(b.p, 4, 2, 5), 'the supported 5 at row 4 was removed')
  console.log('top-row 5 with no 9 below: pruned')
}

// A bottom-row 5 needs the 1 above it: row 7 has no 1 candidate.
{
  const b = board(cand => {
    for (let r = 0; r < N; r++) if (r !== 8 && r !== 4) cand.get(at(r, 5)).delete(5)
    cand.get(at(7, 5)).delete(1)
  })
  run(b)
  assert.ok(!has(b.p, 8, 5, 5), 'a bottom-row 5 with no 1 above survived')
  assert.ok(has(b.p, 4, 5, 5), 'the supported 5 at row 4 was removed')
  console.log('bottom-row 5 with no 1 above: pruned')
}

// 1 and 9 prune too: with the 5 pinned at row 4, its flatmate is the 1 at row 3
// or the 9 at row 5, and a 1 and a 9 cannot both be missing from those rows, so
// a 1 elsewhere survives only while a 9 at row 5 can pair with it.
{
  const b = board(cand => {
    for (let r = 0; r < N; r++) if (r !== 4) cand.get(at(r, 1)).delete(5)
    cand.get(at(4, 1)).clear()
    cand.get(at(4, 1)).add(5)
    cand.get(at(5, 1)).delete(9) // no 9 below the 5, so the 1 must sit at row 3
  })
  run(b)
  for (let r = 0; r < N; r++) {
    assert.strictEqual(has(b.p, r, 1, 1), r === 3, `1 at row ${r} should ${r === 3 ? 'stay' : 'go'}`)
  }
  console.log('a pinned 5 with no 9 below pins its 1 above')
}

// A fully open board has every position supported: nothing is removed.
{
  const b = board()
  run(b)
  assert.ok(CELLS.every(c => b.p._cand.get(c).size === N), 'an open board lost a candidate')
  assert.strictEqual(b.p._stopped, null)
  console.log('open board: nothing removed')
}

// No cell of a column can take a 5: no triple exists, so the branch is stopped.
{
  const b = board(cand => { for (let r = 0; r < N; r++) cand.get(at(r, 7)).delete(5) })
  run(b)
  assert.notStrictEqual(b.p._stopped, null, 'a column with no possible 5 did not stop')
  b.p._stopped = null // a second call on the same dead state must stop again
  run(b)
  assert.notStrictEqual(b.p._stopped, null, 'a repeat call on a dead column did not stop again')
  console.log('column with no 5 anywhere: stopped')
}

// Repeat calls: a second call on the pruned state removes nothing more, and the
// same removal comes back after a caller restores the candidates (a backtrack),
// so nothing a caller sees depends on what an earlier call did.
{
  const b = board(cand => {
    for (let r = 0; r < N; r++) if (r !== 3 && r !== 6) cand.get(at(r, 0)).delete(5)
    cand.get(at(2, 0)).delete(1)
    cand.get(at(4, 0)).delete(9)
  })
  run(b)
  const pruned = JSON.stringify(CELLS.map(c => [...b.p._cand.get(c)]))
  run(b)
  assert.strictEqual(JSON.stringify(CELLS.map(c => [...b.p._cand.get(c)])), pruned, 'a second call changed a pruned state')
  b.p._cand.get(at(3, 0)).add(5) // backtrack: the 5 is a candidate again
  run(b)
  assert.ok(!has(b.p, 3, 0, 5), 'the 5 restored by a backtrack was not pruned again')
  // A column that changed is still swept after an unchanged one was skipped:
  // column 4 starts as column 0 did, is pruned once, then only a 1 and a 9 move.
  const c = board(cand => {
    for (let r = 0; r < N; r++) if (r !== 3 && r !== 6) cand.get(at(r, 4)).delete(5)
    cand.get(at(2, 4)).delete(1)
    cand.get(at(4, 4)).delete(9)
  })
  run(c)
  assert.ok(!has(c.p, 3, 4, 5), 'the unsupported 5 survived the first call')
  // Backtrack restores that 5, and a 1 appears at row 2: the 5 at row 3 is now
  // supported by it, so only a fresh sweep of this column keeps it.
  c.p._cand.get(at(3, 4)).add(5)
  c.p._cand.get(at(2, 4)).add(1)
  run(c)
  assert.ok(has(c.p, 3, 4, 5), 'a column whose 1 changed was not re-read: the now-supported 5 was pruned')
  // The only flatmate left for a pinned 5 is removed, and nothing else moves: a
  // 9 alone, then a 1 alone. A column whose key ignored either digit would be
  // skipped here and miss the dead state.
  for (const [flatmate, row, label] of [[9, 4, '9'], [1, 2, '1']]) {
    const e = board(cand => {
      for (let r = 0; r < N; r++) if (r !== 3) cand.get(at(r, 6)).delete(5)
      if (flatmate === 9) cand.get(at(2, 6)).delete(1) // only the 9 below can flatmate it
      else cand.get(at(4, 6)).delete(9) // only the 1 above can flatmate it
    })
    run(e)
    assert.strictEqual(e.p._stopped, null, `the ${label} case was dead before the change`)
    assert.ok(has(e.p, row, 6, flatmate), `the ${label} flatmate was pruned though it is the only one`)
    e.p._cand.get(at(row, 6)).delete(flatmate)
    run(e)
    assert.notStrictEqual(e.p._stopped, null, `a column whose only change was losing a ${label} was not re-read`)
  }
  console.log('repeat calls: idempotent, re-prunes after a restore, sees a changed column')
}

console.log('PASS')
