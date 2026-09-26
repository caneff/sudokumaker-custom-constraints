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

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, fixpoint, housesOf, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
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
function upToN (digits, target) {
  let sum = 0
  for (const d of digits) {
    if (d === target) return sum
    sum += d
  }
  return null
}

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
function settle (target, clue) {
  installGlobals(1, 4)
  const LINE = [0, 1, 2, 3]
  const p = makePuzzle({ 0: 1, 1: 1, 2: 1, 3: 1 }, () => [1, 2, 3, 4])
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
// and the house's hidden single places it in the first. (On a bare line a
// later cell may hold a second 2, so nothing is removed.)
{
  installGlobals(1, 4)
  const LINE = [0, 1, 2, 3]
  const p = makePuzzle({ 0: 2, 1: 1, 2: 3, 3: 4 }, () => [1, 2, 3, 4], { houses: [LINE] })
  const inst = {}
  cur.setParams(inst, LINE, 2, 0)
  fixpoint(cur, inst, p)
  const cands = LINE.map(c => [...p._cand.get(c)].sort())
  assert.deepStrictEqual(cands, [[1, 2, 3, 4], [1, 3, 4], [1, 3, 4], [1, 3, 4]])
}
console.log('PASS')
