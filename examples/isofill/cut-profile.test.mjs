// The profiler patches the component's source by matching two anchor lines,
// so the way it breaks is silent: an edit to `IsofillComponent.js` moves an
// anchor and the share it reports is wrong rather than absent.

import { installGlobals, makePuzzle } from '../_shared/harness-lib.mjs'
import { instrument, snapshots, loadComponent, timeUpdate, GRIDS } from './cut-profile.mjs'

const HERE = import.meta.dirname
installGlobals(0, 9)

let ok = true
const check = (name, pass) => { console.log(`${name}: ${pass}`); ok = ok && pass }

let threw = false
try { instrument('function * update (instance, puzzle) {}') } catch { threw = true }
check('missing anchor throws', threw)

const plain = loadComponent(HERE, s => s)
const timed = loadComponent(HERE, instrument)
const snaps = snapshots(GRIDS(HERE).gen_28g, 6)

const removalsOf = (mod, snap) => {
  const truth = {}
  for (const c of snap.keys()) truth[c] = snap.get(c)[0]
  const p = makePuzzle(truth, c => snap.get(c))
  const inst = {}
  mod.setParams(inst, [...snap.keys()])
  Array.from(mod.update(inst, p))
  return [...snap.keys()].map(c => [...p._cand.get(c)].sort((a, b) => a - b).join('')).join('|')
}
check('patched removals match plain', snaps.every(s => removalsOf(plain, s) === removalsOf(timed, s)))

// A cut counted twice still passes (the share is about a half here), so this
// is a range check, not a measure.
const { totalMs, cutMs } = timeUpdate(timed, snaps, 1)
check('cut time is within (0, update time)', cutMs > 0 && cutMs < totalMs)

let silent = false
try { timeUpdate(plain, snaps, 1) } catch { silent = true }
check('unpatched component fails loud', silent)

console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
