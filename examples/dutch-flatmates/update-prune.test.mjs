import assert from 'assert'
import { columnsOf, installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)
const N = 9
installGlobals(1, N)
const mod = load('DutchFlatmatesComponent.js', ['setParams', 'update', 'validate'])
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const at = (row, col) => row * N + col

const COLUMNS = columnsOf(N)

function board (edit = () => {}, houses = COLUMNS) {
  const cand = new Map(CELLS.map(c => [c, new Set(ALL)]))
  edit(cand)
  const p = makePuzzle(Object.fromEntries(CELLS.map(c => [c, 0])), c => [...cand.get(c)], { houses })
  const inst = { cells: CELLS }
  mod.setParams(inst, CELLS)
  return { p, inst }
}
const run = ({ p, inst }) => { Array.from(mod.update(inst, p)); return p }
const has = (p, row, col, d) => p._cand.get(at(row, col)).has(d)
const others = p => JSON.stringify(CELLS.map(c => [...p._cand.get(c)].filter(d => ![1, 5, 9].includes(d))))

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

{
  const b = board(cand => {
    for (let r = 0; r < N; r++) if (r !== 4) cand.get(at(r, 1)).delete(5)
    cand.get(at(4, 1)).clear()
    cand.get(at(4, 1)).add(5)
    cand.get(at(5, 1)).delete(9)
  })
  run(b)
  for (let r = 0; r < N; r++) {
    assert.strictEqual(has(b.p, r, 1, 1), r === 3, `1 at row ${r} should ${r === 3 ? 'stay' : 'go'}`)
  }
  console.log('a pinned 5 with no 9 below pins its 1 above')
}

{
  const b = board()
  run(b)
  assert.ok(CELLS.every(c => b.p._cand.get(c).size === N), 'an open board lost a candidate')
  assert.strictEqual(b.p._stopped, null)
  console.log('open board: nothing removed')
}

{
  const b = board(cand => { for (let r = 0; r < N; r++) cand.get(at(r, 7)).delete(5) })
  run(b)
  assert.notStrictEqual(b.p._stopped, null, 'a column with no possible 5 did not stop')
  b.p._stopped = null
  run(b)
  assert.notStrictEqual(b.p._stopped, null, 'a repeat call on a dead column did not stop again')
  console.log('column with no 5 anywhere: stopped')
}

{
  const none = []
  const pinned = cand => {
    for (let r = 0; r < N; r++) if (r !== 4) cand.get(at(r, 1)).delete(5)
    cand.get(at(5, 1)).delete(9)
  }
  const house = board(pinned)
  run(house)
  const open = board(pinned, none)
  run(open)
  for (let r = 0; r < N; r++) {
    assert.strictEqual(has(house.p, r, 1, 1), r === 3, `house: 1 at row ${r} should ${r === 3 ? 'stay' : 'go'}`)
    assert.ok(has(open.p, r, 1, 1), `repeat column: the 1 at row ${r} was pruned by the house rule`)
  }
  const lone = board(cand => {
    cand.get(at(2, 0)).delete(1)
    cand.get(at(4, 0)).delete(9)
  }, none)
  run(lone)
  assert.ok(!has(lone.p, 3, 0, 5), 'repeat column: the 5 with no flatmate survived')
  assert.ok(has(lone.p, 6, 0, 5), 'repeat column: a 5 with a 1 above was removed')
  assert.ok(has(lone.p, 3, 0, 1) && has(lone.p, 3, 0, 9), 'repeat column: the per-cell rule touched a 1 or 9')
  const noFive = board(cand => { for (let r = 0; r < N; r++) cand.get(at(r, 7)).delete(5) }, none)
  run(noFive)
  assert.strictEqual(noFive.p._stopped, null, 'a column that can repeat was stopped for holding no 5')
  console.log('repeat column: not pruned by the house rule, still loses an unflatmated 5, never stopped for lacking a 5')
}

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
  b.p._cand.get(at(3, 0)).add(5)
  run(b)
  assert.ok(!has(b.p, 3, 0, 5), 'the 5 restored by a backtrack was not pruned again')
  // A column whose cache key ignored the 1s or the 9s would be skipped here
  // and miss the dead state.
  for (const [flatmate, row, label] of [[9, 4, '9'], [1, 2, '1']]) {
    const e = board(cand => {
      for (let r = 0; r < N; r++) if (r !== 3) cand.get(at(r, 6)).delete(5)
      if (flatmate === 9) cand.get(at(2, 6)).delete(1)
      else cand.get(at(4, 6)).delete(9)
    })
    run(e)
    assert.strictEqual(e.p._stopped, null, `the ${label} case was dead before the change`)
    assert.ok(has(e.p, row, 6, flatmate), `the ${label} flatmate was pruned though it is the only one`)
    e.p._cand.get(at(row, 6)).delete(flatmate)
    run(e)
    assert.notStrictEqual(e.p._stopped, null, `a column whose only change was losing a ${label} was not re-read`)
  }
  console.log('repeat calls: idempotent, re-prunes after a restore, sees a column whose only change is a 1 or a 9')
}

// Each case declares every column all-different, so only the digits and the
// column length tell the cases apart.
{
  function small (width, lo, hi, edit) {
    installGlobals(lo, hi)
    const cells = Array.from({ length: width * width }, (_, i) => i)
    const digits = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
    const cand = new Map(cells.map(c => [c, new Set(digits)]))
    edit(cand, (row, col) => row * width + col)
    const p = makePuzzle(Object.fromEntries(cells.map(c => [c, 0])), c => [...cand.get(c)], { houses: columnsOf(width) })
    const inst = { cells }
    mod.setParams(inst, cells)
    Array.from(mod.update(inst, p))
    installGlobals(1, N)
    return p
  }

  // Column 0's only 1 and only 9 share row 2, above its only 5: the column
  // reasoning would find no partner and stop the branch, though the 5 has a
  // possible 1 directly above it.
  {
    const p = small(6, 1, 9, (cand, at6) => {
      for (let r = 0; r < 6; r++) {
        if (r !== 2) { cand.get(at6(r, 0)).delete(1); cand.get(at6(r, 0)).delete(9) }
        if (r !== 3) cand.get(at6(r, 0)).delete(5)
      }
      for (let r = 0; r < 6; r++) {
        if (r !== 3) cand.get(at6(r, 1)).delete(5)
      }
      cand.get(at6(2, 1)).delete(1)
      cand.get(at6(4, 1)).delete(9)
    })
    assert.strictEqual(p._stopped, null, 'a 6x6 board with digits 1-9 got the column reasoning and was stopped')
    assert.ok(p._cand.get(3 * 6 + 0).has(5), 'the 5 with a possible 1 above it was removed on a 6x6 board')
    assert.ok(!p._cand.get(3 * 6 + 1).has(5), 'the per-cell rule did not remove an unflatmated 5 on a 6x6 board')
    console.log('6x6 board, digits 1-9: per-cell rule only, no column reasoning')
  }

  {
    const p = small(8, 1, 8, (cand, at8) => {
      for (let r = 0; r < 8; r++) if (r !== 3) cand.get(at8(r, 0)).delete(5)
      cand.get(at8(2, 0)).delete(1)
    })
    assert.strictEqual(p._stopped, null, 'a board without a 9 got the column reasoning and was stopped')
    assert.ok(!p._cand.get(3 * 8 + 0).has(5), 'the per-cell rule did not remove an unflatmated 5 on a board without a 9')
    console.log('8x8 board, digits 1-8: no 9, per-cell rule only')
  }

  {
    const p = small(9, 2, 10, (cand, at9) => {
      for (let r = 0; r < 9; r++) if (r !== 3 && r !== 6) cand.get(at9(r, 0)).delete(5)
      cand.get(at9(4, 0)).delete(9)
    })
    assert.strictEqual(p._stopped, null, 'a board without a 1 got the column reasoning and was stopped')
    assert.ok(!p._cand.get(3 * 9 + 0).has(5), 'the 5 with no 9 below and no 1 anywhere was kept')
    assert.ok(p._cand.get(6 * 9 + 0).has(5), 'the 5 with a 9 below it was removed')
    console.log('9x9 board, digits 2-10: no 1, per-cell rule only')
  }
}

console.log('PASS')
