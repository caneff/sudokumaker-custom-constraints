// The one runnable check for cut-profile.mjs. The profiler patches the
// component's source by matching two anchor lines, so the way it breaks is
// silent: an edit to `IsofillComponent.js` moves an anchor, the patch no
// longer applies, and the share it reports is wrong rather than absent.
// These three assertions are what fails when that happens.
//
//   node examples/isofill/cut-profile.test.mjs

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makePuzzle } from '../_shared/harness-lib.mjs'
import { instrument, snapshots, loadComponent, timeUpdate, GRIDS } from './cut-profile.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
installGlobals(0, 9)

let ok = true
const check = (name, pass) => { console.log(`${name}: ${pass}`); ok = ok && pass }

// ---- The anchors are still there, and a source without them fails loud ----
let threw = false
try { instrument('function * update (instance, puzzle) {}') } catch { threw = true }
check('missing anchor throws', threw)

// ---- The patch does not change what the component removes ----
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

// ---- The accumulator is wired: cut runs, and its time is inside update's ----
const { totalMs, cutMs } = timeUpdate(timed, snaps, 1)
check('cut time is positive', cutMs > 0)
check('cut time is inside update time', cutMs <= totalMs)

// ---- An uninstrumented component reads as no cut time at all, and that
// fails loud rather than reporting a 0% share ----
let silent = false
try { timeUpdate(plain, snaps, 1) } catch { silent = true }
check('unpatched component fails loud', silent)

console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
