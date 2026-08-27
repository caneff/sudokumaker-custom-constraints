// Focused tests of the recovery engine seams in isolation, independent of any
// example's components. Run: node examples/_shared/recovery-lib.test.mjs

import assert from 'assert'
import { makeCandidateState, makeAllDifferentFloor, runToFixpoint, search } from './recovery-lib.mjs'

// ---- the GAC floor prunes a group to only values some perfect matching allows ----
// A 3-cell all-different group with values 1..3: cell 0 is pinned to 1, cell
// 1 ranges over {1,2}, cell 2 over {1,2,3}. Only one perfect matching exists
// (cell0=1, cell1=2, cell2=3), so the GAC floor must collapse the group to
// exactly that assignment — removing 1 from cell 1 (it is taken) and 1 and 2
// from cell 2 (both taken elsewhere in the only matching).
{
  const state = makeCandidateState()
  state.cand.set(0, new Set([1]))
  state.cand.set(1, new Set([1, 2]))
  state.cand.set(2, new Set([1, 2, 3]))
  const floor = makeAllDifferentFloor(state, { kind: 'regin', maxDigit: 3 })
  floor([0, 1, 2])
  assert.deepStrictEqual([...state.cand.get(0)], [1])
  assert.deepStrictEqual([...state.cand.get(1)], [2], 'cell 1 loses the taken value 1')
  assert.deepStrictEqual([...state.cand.get(2)], [3], 'cell 2 loses the taken values 1 and 2')
}

// ---- the GAC floor leaves a feasible group untouched beyond dead values ----
{
  const state = makeCandidateState()
  state.cand.set(0, new Set([1, 2]))
  state.cand.set(1, new Set([1, 2]))
  const floor = makeAllDifferentFloor(state, { kind: 'regin', maxDigit: 2 })
  floor([0, 1])
  assert.deepStrictEqual([...state.cand.get(0)].sort(), [1, 2])
  assert.deepStrictEqual([...state.cand.get(1)].sort(), [1, 2])
}

// ---- the uniqueness search finds exactly one solution on a tiny fixture ----
// A 2-cell all-different group, no components, no extra propagator, every
// full assignment counts as a valid leaf. The only two assignments (1,2) and
// (2,1) both satisfy all-different, so search should report exactly one
// solution PER assignment it reaches — but here the two branches under MRV
// are cell 0 = 1 then cell 1 = 2, and cell 0 = 2 then cell 1 = 1: both legal,
// so this fixture is deliberately built with a value that only one branch
// can complete: cell 1's candidates are restricted to {2}, so only cell 0=1
// survives the floor.
{
  const state = makeCandidateState()
  state.cand.set(0, new Set([1, 2]))
  state.cand.set(1, new Set([2]))
  const floor = makeAllDifferentFloor(state, { kind: 'regin', maxDigit: 2 })
  const alldiffGroups = [[0, 1]]
  const result = search(state, {
    interior: [0, 1],
    comps: [],
    alldiffGroups,
    floorGroup: floor,
    validLeaf: () => true,
    nodeCap: 1000
  })
  assert.strictEqual(result.solutions, 1, `expected 1 solution, got ${result.solutions}`)
  assert.strictEqual(result.capped, false)
}

// ---- runToFixpoint stops when no candidate is removed ----
{
  const state = makeCandidateState()
  state.cand.set(0, new Set([1, 2]))
  const floor = makeAllDifferentFloor(state, { kind: 'regin', maxDigit: 2 })
  const passes = runToFixpoint(state, [], [[0]], floor, { init: false })
  assert.strictEqual(passes, 1, 'a single group of one cell settles in one pass')
}

console.log('recovery-lib.test.mjs: all seams pass')

// ---- the mock puzzle's bitmask read mirrors the app: bit d = digit d ----
{
  const state = makeCandidateState()
  state.cand.set(0, new Set([1, 3, 9]))
  assert.strictEqual(state.puzzle.getCandidatesBitMask(0), (1 << 1) | (1 << 3) | (1 << 9))
}
