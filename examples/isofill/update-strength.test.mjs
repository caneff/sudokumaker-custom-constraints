// Strength check for IsofillComponent.update. Soundness (never remove a true
// value) lives in soundness-harness.mjs; this file checks the other direction —
// that a rewrite does not quietly prune LESS than before.
//
//   node examples/isofill/update-strength.test.mjs
//
// The rules read placed digits and walk regions, so a state drawn at random is
// contradictory and prunes nothing worth comparing. States are drawn around a
// real solution instead, the way soundness-harness.mjs draws them. Three
// fixtures: `rows` (row r holds digit r), `bent` (L-shaped regions), and the
// grid of gen.json, the shipped board.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load, loadAt } = makeIo(HERE)

// The floor: the component as it stands at the commit that pins this test.
const REF_COMMIT = 'db93523'
const NAMES = ['setParams', 'update']
const cur = load('IsofillComponent.js', NAMES)
const ref = loadAt(REF_COMMIT, 'IsofillComponent.js', NAMES)

const { rnd } = makeRng(9001)
const REPS = 500

installGlobals(0, 9)

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)

const rows = {}
for (const c of CELLS) rows[c] = Math.floor(c / N)

// Rows 2r,2r+1: digit 2r takes cols 0-5 of the top row and cols 0-3 of the
// bottom row; digit 2r+1 takes the rest. Ten cells each, both connected.
const bent = {}
for (const c of CELLS) {
  const r = Math.floor(c / N)
  const x = c % N
  const top = r % 2 === 0
  const band = Math.floor(r / 2)
  bent[c] = (top ? x <= 5 : x <= 3) ? 2 * band : 2 * band + 1
}

// shipped — the grid in gen.json, the board the example ships.
const shipped = {}
JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid
  .forEach((row, r) => [...row].forEach((ch, x) => { shipped[r * N + x] = Number(ch) }))

const apply = (mod, p) => {
  const inst = {}
  mod.setParams(inst, CELLS)
  fixpoint(mod, inst, p)
}

for (const [name, truth] of [['rows', rows], ['bent', bent], ['shipped', shipped]]) {
  strengthSweep(`isofill ${name} fixture`, {
    cur,
    ref,
    apply,
    * states () {
      for (let rep = 0; rep < REPS; rep++) {
        const start = new Map()
        for (const c of CELLS) start.set(c, randomCandidates(rnd, 0, 9, truth[c]))
        yield start
      }
    }
  })
}
console.log('PASS')
