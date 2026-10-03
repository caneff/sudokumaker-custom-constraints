// Strength check for DutchFlatmatesComponent.update. Soundness (never remove a
// true value) lives in soundness-harness.mjs; this file checks the other
// direction: that a rewrite does not quietly prune LESS than the floor. The
// floor is the per-column 1/5/9 prune, so a later deduction is held to at least
// that strength.
//
//   node examples/dutch-flatmates/update-strength.test.mjs
//
// On random states the current update must leave a subset of what the floor
// left, cell for cell.
//
// The floor is a frozen copy, `.golden/DutchFlatmatesComponent.floor.js`, not a
// `REF_COMMIT` read with `loadAt` as the siblings do. The component and its
// floor land in one squash-merged pull request, and a squash rewrites every
// commit on the branch: a sha pinned there names a commit main never holds, so
// `git show` would fail on main. Raising the floor means replacing that copy in
// the same commit as the stronger component.

import { join } from 'path'
import { readFileSync } from 'fs'
import { columnsOf, installGlobals, makeIo, makeRng, fixpoint, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)

const N = 9
installGlobals(1, N)

const NAMES = ['setParams', 'update']
const cur = load('DutchFlatmatesComponent.js', NAMES)
const ref = load('.golden/DutchFlatmatesComponent.floor.js', NAMES)

const { rnd } = makeRng(676)
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const gen = JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8'))
const truth = gen.grid.flatMap(row => [...row].map(Number))

// The floor prunes every column as a house, so compare on a board that declares
// each column one (compareStrength hands `opts` to the mock puzzle).
const COLUMNS = columnsOf(N)

const apply = (mod, p) => {
  const inst = { cells: CELLS }
  mod.setParams(inst, CELLS)
  fixpoint(mod, inst, p)
}

const REPS = 3000
strengthSweep('dutch-flatmates', {
  solvable: true,
  cur,
  ref,
  apply,
  opts: { houses: COLUMNS },
  * states () {
    for (let rep = 0; rep < REPS; rep++) {
      const start = new Map()
      for (const c of CELLS) start.set(c, randomCandidates(rnd, 1, N, truth[c]))
      yield start
    }
  }
})
console.log('PASS')
