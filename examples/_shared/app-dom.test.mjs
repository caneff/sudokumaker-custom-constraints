// solveLogically against a stub page: the logic pass is finished only when the
// "Stop solving" button has gone for several samples in a row, however still
// the board is meanwhile (#881).
// Run: node examples/_shared/app-dom.test.mjs

import assert from 'assert'
import { solveLogically } from './app-dom.mjs'

// A page whose DOM answers the queries solveLogically makes. `stopAt(n)`
// says whether "Stop solving" shows at the n-th sample; the board is never read, as the stalled fillomino pass shows it is no signal.
function stubPage (stopAt) {
  let samples = 0
  let clock = 0
  const doc = {
    querySelectorAll (sel) {
      if (sel === 'svg') {
        return [{ getAttribute: () => 'Icon AutoStep', closest: () => ({ click () {} }) }]
      }
      if (sel === 'button') {
        samples++
        // The label gains " (Esc)" after a keypress in the real app.
        return stopAt(samples) ? [{ textContent: samples % 2 ? ' Stop solving ' : 'Stop solving (Esc)' }] : []
      }
      return []
    }
  }
  return {
    samples: () => samples,
    now: () => clock,
    evaluate: async (fn, arg) => { globalThis.document = doc; return fn(arg) },
    waitForTimeout: async ms => { clock += ms }
  }
}

// Stop solving shows for 40 samples (both labels): settling on a still board
// would return after 4 samples, mid-pass.
const stalled = stubPage(n => n <= 40)
await solveLogically(stalled, { now: stalled.now })
assert.strictEqual(stalled.samples(), 43)

// A flicker (gone for two samples, then back) is not the end of the pass.
const flicker = stubPage(n => n <= 10 || (n >= 13 && n <= 20))
await solveLogically(flicker, { now: flicker.now })
assert.strictEqual(flicker.samples(), 23)

// A pass still running at the timeout throws, never returns a time.
const endless = stubPage(() => true)
await assert.rejects(solveLogically(endless, { now: endless.now }), /did not settle within 300000ms/)

console.log('app-dom.test.mjs: all seams pass')
