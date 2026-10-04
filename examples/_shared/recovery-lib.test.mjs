// Focused tests of the recovery engine seams in isolation, independent of any
// example's components. Run: node examples/_shared/recovery-lib.test.mjs

import assert from 'assert'
import { makeCandidateState, makeAllDifferentFloor, runToFixpoint, search, reportLine } from './recovery-lib.mjs'

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

// ---- the uniqueness search counts every solution, and says when it gave up ----
// A 2-cell all-different group over {1,2}, no components, every full
// assignment a valid leaf. `solve` runs the search on a fresh state.
function solve (cands, { validLeaf = () => true, nodeCap = 1000, maxDigit = 2 } = {}) {
  const state = makeCandidateState()
  cands.forEach((s, c) => state.cand.set(c, new Set(s)))
  const cells = cands.map((_, c) => c)
  const floor = makeAllDifferentFloor(state, { kind: 'regin', maxDigit })
  return search(state, { interior: cells, comps: [], alldiffGroups: [cells], floorGroup: floor, validLeaf, nodeCap })
}
{
  // (1,2) and (2,1) are both legal: two solutions.
  const two = solve([[1, 2], [1, 2]])
  assert.strictEqual(two.solutions, 2, `two legal assignments, got ${two.solutions}`)
  assert.strictEqual(two.capped, false)
  // Cell 1 pinned to {2}: only cell 0 = 1 survives the floor.
  const one = solve([[1, 2], [2]])
  assert.strictEqual(one.solutions, 1, `expected 1 solution, got ${one.solutions}`)
  assert.strictEqual(one.capped, false)
  // No matching at all: zero solutions, and not capped.
  const none = solve([[1], [1]])
  assert.strictEqual(none.solutions, 0, 'two cells pinned to the same digit have no solution')
  assert.strictEqual(none.capped, false)
  // A leaf the caller rejects is not counted.
  const rejected = solve([[1, 2], [1, 2]], { validLeaf: () => false })
  assert.strictEqual(rejected.solutions, 0, 'a leaf validLeaf rejects must not count')
  // A node cap too small to finish says so instead of reporting a final count.
  const capped = solve([[1, 2, 3], [1, 2, 3], [1, 2, 3]], { nodeCap: 1, maxDigit: 3 })
  assert.strictEqual(capped.capped, true, 'a search stopped by the node cap must report capped')
  assert.ok(capped.solutions < 6, 'a capped search has not finished counting the 6 solutions')
  const full = solve([[1, 2, 3], [1, 2, 3], [1, 2, 3]], { maxDigit: 3 })
  assert.deepStrictEqual([full.solutions, full.capped], [6, false], 'the uncapped search counts all 6 permutations')
}

// ---- runToFixpoint stops on the first pass that removes nothing ----
// A chain a={1}, b={1,2}, c={2,3} with the groups listed back to front. Pass 1
// can only fix b (via a); pass 2 fixes c (via b); pass 3 changes nothing and
// stops. So it must run past the first pass, settle to the chain's
// consequences, and report the pass that removed nothing.
{
  const state = makeCandidateState()
  state.cand.set(0, new Set([1]))
  state.cand.set(1, new Set([1, 2]))
  state.cand.set(2, new Set([2, 3]))
  const floor = makeAllDifferentFloor(state, { kind: 'regin', maxDigit: 3 })
  const passes = runToFixpoint(state, [], [[1, 2], [0, 1]], floor, { init: false })
  assert.deepStrictEqual([0, 1, 2].map(c => [...state.cand.get(c)]), [[1], [2], [3]], 'the chain is not propagated to its fixpoint')
  assert.strictEqual(passes, 3, 'two passes that remove something, then one that removes nothing')
  // Already at the fixpoint: one pass that removes nothing, and it stops there.
  assert.strictEqual(runToFixpoint(state, [], [[1, 2], [0, 1]], floor, { init: false }), 1)
}

// ---- reportLine prints settled / NEVER SETTLED, not a pass count ----
// The pass count is order-dependent noise (issue #301); the line states only
// whether the fixpoint settled.
{
  const settled = reportLine('label', { removed: 3, passes: 4, lost: 0 })
  assert.strictEqual(settled, '  label: removed 3 cands, settled')
  const neverSettled = reportLine('label', { removed: 3, passes: -1, lost: 0 })
  assert.strictEqual(neverSettled, '  label: removed 3 cands, NEVER SETTLED')
  // the marker sits between `removed N cands` and the TRUE-VALUE LOST
  // suffix, after the caller's extra prefix
  const full = reportLine('label', { extra: 'hidden 1/2, ', removed: 3, passes: -1, lost: 2 })
  assert.strictEqual(full, '  label: hidden 1/2, removed 3 cands, NEVER SETTLED, TRUE-VALUE LOST x2')
}

console.log('recovery-lib.test.mjs: all seams pass')

// ---- the mock puzzle's bitmask read mirrors the app: bit d = digit d ----
{
  const state = makeCandidateState()
  state.cand.set(0, new Set([1, 3, 9]))
  assert.strictEqual(state.puzzle.getCandidatesBitMask(0), (1 << 1) | (1 << 3) | (1 << 9))
}
