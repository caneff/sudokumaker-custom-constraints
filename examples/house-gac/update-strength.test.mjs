// Strength check for the shared HouseGacComponent, as this example uses it:
// on the full 9-cell houses a plain 9x9 has. Soundness lives in
// soundness-harness.mjs; this checks the other direction -- that the current
// component never prunes LESS than the commit that introduced it (#422).
//
//   node examples/house-gac/update-strength.test.mjs
//
// This is the shared component's own file, not one owned by this example, so
// the floor is pinned at the commit that shipped it, the same way every other
// example pins its own component's floor at the commit that adds its
// update-strength test (docs/example-layout.md).

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, shuffle, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// The component lives in `_shared`, not owned by this example, so `loadAt`
// (which resolves a commit path off `git rev-parse --show-prefix` of its own
// `here`) is rooted at `_shared` itself rather than passed a `../` path --
// git does not normalize the dotted path `loadAt` would otherwise build.
const { load, loadAt } = makeIo(join(HERE, '..', '_shared'))

const N = 9
installGlobals(1, N) // the component reads helpers.digits at load time

const REF_COMMIT = '3279a3d'
const NAMES = ['setParams', 'update']
const cur = load('HouseGacComponent.js', NAMES)
const ref = loadAt(REF_COMMIT, 'HouseGacComponent.js', NAMES)

const { rnd } = makeRng(422)

const CELLS = Array.from({ length: N }, (_, i) => i)
// The app's constructor stores the cells as instance.cells before setParams.
const apply = (mod, p) => {
  const inst = { cells: CELLS }
  mod.setParams(inst, CELLS)
  fixpoint(mod, inst, p)
}

const REPS = 6000
strengthSweep('house-gac', {
  solvable: true,
  cur,
  ref,
  apply,
  opts: { houses: [CELLS] },
  * states () {
    for (let rep = 0; rep < REPS; rep++) {
      const perm = shuffle(rnd, Array.from({ length: N }, (_, i) => i + 1))
      const start = new Map()
      for (const c of CELLS) start.set(c, randomCandidates(rnd, 1, N, perm[c]))
      yield start
    }
  }
})
console.log('PASS')
