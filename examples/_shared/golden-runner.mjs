// Shared run-and-compare harness for a recovery probe's golden tests: run the
// probe once per case and byte-compare stdout against the stored
// `.golden/*.txt` next to the probe.
//
// Both recovery-probe.test.mjs files (Hit Counts, Skyscraper) call this; each
// supplies its own probe path and case list, since the args and golden files
// differ per example.

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'

export function runGoldenCases (probePath, cases) {
  const goldenDir = join(dirname(probePath), '.golden')
  let failed = false
  for (const { args, golden } of cases) {
    const expected = readFileSync(join(goldenDir, golden), 'utf8')
    const actual = execFileSync('node', [probePath, ...args], { encoding: 'utf8' })
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
