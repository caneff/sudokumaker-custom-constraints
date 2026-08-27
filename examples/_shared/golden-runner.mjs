// Shared run-and-compare harness for a recovery probe's golden tests: run the
// probe once per case, mask out anything the golden must not pin down (wall-clock
// time by default), and byte-compare stdout against the stored `.golden/*.txt`
// next to the probe.
//
// Both recovery-probe.test.mjs files (Hit Counts, Skyscraper) call this; each
// supplies its own probe path and case list, since the args and golden files
// differ per example.

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'

// The search runs print a wall-clock time (ms) that is never identical between
// runs; mask it out before the byte-identical comparison so the golden asserts
// on what the probe must preserve — node/solution counts, output shape — not on
// timing noise.
const maskMs = s => s.replace(/\d+ms/g, 'Nms')

export function runGoldenCases (probePath, cases, { mask = maskMs } = {}) {
  const goldenDir = join(dirname(probePath), '.golden')
  let failed = false
  for (const { args, golden } of cases) {
    const expected = mask(readFileSync(join(goldenDir, golden), 'utf8'))
    const actual = mask(execFileSync('node', [probePath, ...args], { encoding: 'utf8' }))
    if (actual === expected) {
      console.log(`PASS: ${args.join(' ')}`)
    } else {
      failed = true
      console.log(`FAIL: ${args.join(' ')} — output drifted from ${golden}`)
      console.log('--- expected ---')
      console.log(expected)
      console.log('--- actual ---')
      console.log(actual)
    }
  }
  return !failed
}
