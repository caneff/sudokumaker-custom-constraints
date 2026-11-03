// solveLogically against a stub page: the logic pass is finished only when the
// "Stop solving" button has gone for several samples in a row, however still
// the board is meanwhile (#881).
// Run: node examples/_shared/app-dom.test.mjs

import assert from 'assert'
import { solveLogically } from './app-dom.mjs'

// A page whose DOM answers the queries solveLogically makes. `stopAt(n)`
// says whether "Stop solving" shows at the n-th sample; the board text
// never changes, as in the stalled fillomino pass.
function stubPage (stopAt) {
  let samples = 0
  let clock = 0
  const doc = {
    querySelectorAll (sel) {
      if (sel === 'svg') {
        return [{ getAttribute: () => 'Icon AutoStep', closest: () => ({ click () {} }) }]
      }
      if (sel === 'svg text') return [{ textContent: '5' }]
      if (sel === 'button') {
        samples++
        return stopAt(samples) ? [{ textContent: ' Stop solving ' }] : []
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

// Stop solving shows for 40 samples with the board unchanged: a board-only
// settle returns after 4 samples, mid-pass.
const stalled = stubPage(n => n <= 40)
await solveLogically(stalled, { now: stalled.now })
assert.ok(stalled.samples() > 40, `settled mid-pass, after ${stalled.samples()} samples`)

// A flicker (gone for two samples, then back) is not the end of the pass.
const flicker = stubPage(n => n <= 10 || (n >= 13 && n <= 20))
await solveLogically(flicker, { now: flicker.now })
assert.ok(flicker.samples() > 20, `settled on a flicker, after ${flicker.samples()} samples`)

// A pass still running at the timeout throws, never returns a time.
const endless = stubPage(() => true)
await assert.rejects(solveLogically(endless, { now: endless.now, timeoutMs: 5000 }), /did not settle within 5000ms/)

console.log('app-dom.test.mjs: all seams pass')
