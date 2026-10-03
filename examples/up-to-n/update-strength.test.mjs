// Strength check for UpToNComponent.update. Soundness (never remove a true
// value) lives in soundness-harness.mjs; this file checks the other direction:
// that a rewrite does not quietly prune LESS than the floor.
//
//   node examples/up-to-n/update-strength.test.mjs
//
// On random states the current update must leave a subset of what the floor
// left, cell for cell.
//
// The floor is a frozen copy, `.golden/UpToNComponent.floor.js`, not a
// `REF_COMMIT` read with `loadAt` as the siblings do. The component and its
// floor land in one squash-merged pull request, and a squash rewrites every
// commit on the branch: a sha pinned there names a commit main never holds, so
// `git show` would fail on main. Raising the floor means replacing that copy in
// the same commit as the stronger component.

import assert from 'assert'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, fixpoint, housesOf, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'
import { upToN } from './fixture.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)

const NAMES = ['setParams', 'update']
const cur = load('UpToNComponent.js', NAMES)
const ref = load('.golden/UpToNComponent.floor.js', NAMES)

const { rnd } = makeRng(3680)
const REPS = 5000

// States are drawn around a real line so few of them die: a line of the kind
// declared, a target it holds, the clue that line gives, and every cell's
// candidates keeping its digit. Both kinds run, because the line-kind gate
// decides how far the N prune reaches.
for (const D of [4, 6, 9]) {
  installGlobals(1, D)
  const LINE = Array.from({ length: D }, (_, i) => i)
  for (const kind of ['fullHouse', 'bare']) {
    strengthSweep(`up-to-n ${kind} ${D}`, {
      solvable: true,
      cur,
      ref,
      apply: (mod, p, { target, clue }) => {
        const inst = {}
        mod.setParams(inst, LINE, target, clue)
        fixpoint(mod, inst, p)
      },
      opts: { houses: housesOf(kind, LINE) },
      * states () {
        for (let rep = 0; rep < REPS; rep++) {
          const digits = makeLine(rnd, kind, D, D)
          const target = digits[(rnd() * D) | 0]
          const clue = upToN(digits, target)
          const start = new Map()
          for (const c of LINE) start.set(c, randomCandidates(rnd, 1, D, digits[c]))
          yield { start, params: { target, clue } }
        }
      }
    })
  }
}

// ---- Worked states: the prefix-cell prune (#369) ----
//
// A cell before every feasible position of N keeps only the digits some
// feasible position admits within its sum bounds. Worked by hand on a bare
// 4-cell line over 1..4, every cell open.
function settle (target, clue, opts) {
  installGlobals(1, 4)
  const LINE = [0, 1, 2, 3]
  const p = makePuzzle({ 0: 1, 1: 1, 2: 1, 3: 1 }, () => [1, 2, 3, 4], opts)
  const inst = {}
  cur.setParams(inst, LINE, target, clue)
  fixpoint(cur, inst, p)
  return LINE.map(c => [...p._cand.get(c)].sort())
}

// N = 4, clue 1. The first 4 can only be the second cell (4 first reads 0,
// and three cells before it read at least 1 + 1 + 1 = 3), so the first cell
// is 1.
assert.deepStrictEqual(settle(4, 1)[0], [1])

// N = 3, clue 3. The first 3 sits second (d = 3 is itself N, so not there),
// third (two cells summing 3: {1, 2}) or fourth (1 + 1 + 1). So the first two
// cells hold 1 or 2 and nothing else.
{
  const [c0, c1] = settle(3, 3)
  assert.deepStrictEqual(c0, [1, 2])
  assert.deepStrictEqual(c1, [1, 2])
}

// N = 2, clue 0: the target is first, since any digit before it reads at
// least 1. On a house the first 2 is the only 2, so 2 leaves every other cell
// (the house's hidden single then places it in the first; this component only
// removes). On a bare line a later cell may hold a second 2, so nothing is
// removed. Each claim is about the removed digit alone: a stronger update may
// prune more.
{
  const house = settle(2, 0, { houses: [[0, 1, 2, 3]] })
  assert.ok(house[0].includes(2), 'the first cell keeps the 2')
  for (const c of [1, 2, 3]) assert.ok(!house[c].includes(2), `a house's first 2 is the only one: cell ${c}`)
}

// ---- Worked states: the prefix as a set of distinct digits (#465) ----
//
// On a house the cells before the first N hold distinct digits, so they are a
// set summing to the clue. N = 4, clue 2: a first 4 in the second cell needs
// a one-digit set {2}; in the third cell it needs two distinct digits summing
// to 2, and there are none (1 + 1 repeats). So the first 4 sits second, the
// first cell is 2, and 4 leaves the last two cells.
{
  const house = settle(4, 2, { houses: [[0, 1, 2, 3]] })
  assert.deepStrictEqual(house[0], [2])
  assert.ok(house[1].includes(4), 'the first 4 sits second')
  for (const c of [2, 3]) assert.ok(!house[c].includes(4), `4 leaves cell ${c}`)
}

// N = 4, clue 3: sets {3} (first 4 second) and {1, 2} (first 4 third); three
// distinct digits sum to at least 6. So the first 4 sits second or third, and
// 4 leaves the first and last cells.
{
  const house = settle(4, 3, { houses: [[0, 1, 2, 3]] })
  for (const c of [1, 2]) assert.ok(house[c].includes(4), `the first 4 may sit at cell ${c}`)
  for (const c of [0, 3]) assert.ok(!house[c].includes(4), `4 leaves cell ${c}`)
}
console.log('PASS')
