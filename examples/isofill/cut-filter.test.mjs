// The cut filter may only ever remove *work*, never a removal: over states
// drawn around a real solution, the filtered component and the same component
// with its filter verdict ignored must yield the identical removal sequence.
// The unfiltered side is the shipped source with the verdict line deleted: the
// filter still runs, but every cell re-walks.

import { join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeRng, makePuzzle, fixpoint, patchSource, randomCandidates } from '../_shared/harness-lib.mjs'
import { loadComponent } from './cut-profile.mjs'

const HERE = import.meta.dirname
const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)

const SKIP = '  if (skip[x]) return false // the filter cleared this cell: no cut\n'
const WALKED = '  let cut = reachSize(instance, placed, depth, allowed, size).size < size\n'

function unfiltered (src) {
  return patchSource(src, SKIP, '')
}

function counted (src) {
  src = patchSource(src, SKIP, '  globalThis.__skipped += skip[x] ? 1 : 0\n' + SKIP)
  return patchSource(src, WALKED, '  globalThis.__walked++\n' + WALKED)
}

installGlobals(0, 9)

let threw = false
try { unfiltered('function * update (instance, puzzle) {}') } catch { threw = true }
assert.ok(threw, 'a missing anchor must throw, not silently compare a component with itself')

const filtered = loadComponent(HERE, counted)
const plain = loadComponent(HERE, unfiltered)

function removals (mod, start) {
  const cells = {}
  for (const c of CELLS) cells[c] = 0
  const p = makePuzzle(cells, c => start.get(c))
  const log = []
  const rec = {
    ...p,
    removeCandidateFromCell: (d, c) => { log.push(`${d}@${c}`); p.removeCandidateFromCell(d, c) },
    removeCandidatesFromCell: (s, c) => { log.push(`[${[...s].sort((a, b) => a - b).join('')}]@${c}`); p.removeCandidatesFromCell(s, c) }
  }
  const inst = {}
  mod.setParams(inst, CELLS)
  fixpoint(mod, inst, rec)
  return log.join('|')
}

// `bent` has L-shaped regions; the hard fixtures are where cut does the most
// work.
const rows = {}
for (const c of CELLS) rows[c] = Math.floor(c / N)

const bent = {}
for (const c of CELLS) {
  const r = Math.floor(c / N)
  const x = c % N
  const band = Math.floor(r / 2)
  bent[c] = ((r % 2 === 0) ? x <= 5 : x <= 3) ? 2 * band : 2 * band + 1
}

const gridOf = name => {
  const out = {}
  JSON.parse(readFileSync(join(HERE, `${name}.json`), 'utf8')).grid
    .forEach((row, r) => [...row].forEach((ch, x) => { out[r * N + x] = Number(ch) }))
  return out
}

const { rnd } = makeRng(2580)
const REPS = 500

globalThis.__skipped = 0
globalThis.__walked = 0
let states = 0
let differ = 0
for (const [name, truth] of [['rows', rows], ['bent', bent], ['shipped', gridOf('gen')], ['hard28', gridOf('gen_28g')], ['hard25', gridOf('gen_25g')], ['hard26', gridOf('gen_26g')]]) {
  let fixtureDiffer = 0
  for (let rep = 0; rep < REPS; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(rnd, 0, 9, truth[c]))
    states++
    if (removals(filtered, start) !== removals(plain, start)) fixtureDiffer++
  }
  console.log('isofill cut filter', name, 'fixture:', REPS, 'states,', fixtureDiffer, 'differing')
  differ += fixtureDiffer
}
console.log('isofill cut filter:', states, 'states,', differ, 'differing;',
  globalThis.__skipped, 'cells cleared,', globalThis.__walked, 'cells re-walked')

assert.strictEqual(differ, 0, 'the filter must not change one removal')
// A filter that never clears a cell would pass the differential and buy
// nothing; a filter that cleared every cell would leave the re-walk dead.
assert.ok(globalThis.__skipped > 0, 'the filter must clear cells')
assert.ok(globalThis.__walked > 0, 'the re-walk must stay for the cells the filter does not clear')
console.log('PASS')
