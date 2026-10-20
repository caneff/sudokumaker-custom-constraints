// Strength check for the combined backend: on this board, the components it
// registers must not prune LESS than their frozen floors do together.
//
// This example owns no component: IsofillComponent.js and
// SkyscraperOneSidedComponent.js are links to the files in examples/isofill
// and examples/skyscraper, and each example pins its own floor. This test runs
// the two floors side by side on the board main-global.js registers, so a
// rewrite of either one that weakens it here fails here too. States are drawn
// around the shipped solution, since a random state is nearly always
// contradictory and compares nothing.

import { installGlobals, makeIo, makeRng, fixpointAll, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'
import { combinedBoard } from './combined-board.mjs'

const HERE = import.meta.dirname
const { read, load } = makeIo(HERE)
const { rnd } = makeRng(8580)

installGlobals(1, 9)
const NAMES = ['setParams', 'update']
const cur = {
  IsofillComponent: load('IsofillComponent.js', NAMES),
  SkyscraperOneSidedComponent: load('SkyscraperOneSidedComponent.js', NAMES)
}
// The floors each component's own example pins (their update-strength tests).
const ref = {
  IsofillComponent: load('../isofill/.golden/IsofillComponent.db93523.js', NAMES),
  SkyscraperOneSidedComponent: load('../skyscraper/.golden/SkyscraperRunningCapComponent.c776ab7.js', NAMES)
}

const { n, truth, parts } = combinedBoard(HERE, read)
const REPS = 300

strengthSweep('isofill-skyscraper combined backend', {
  solvable: true,
  cur,
  ref,
  apply: (mods, p) => fixpointAll(parts(mods), p),
  * states () {
    for (let rep = 0; rep < REPS; rep++) {
      const start = new Map()
      for (const [id, v] of Object.entries(truth)) start.set(Number(id), randomCandidates(rnd, 1, n, v))
      yield start
    }
  }
})
console.log('PASS')
