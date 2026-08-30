// Regression golden for the recovery probe: asserts its stdout is
// BYTE-IDENTICAL to a fixed golden, per invocation. Covers the report path
// (gen_6, gen_9) and the search path (gen_6 with the matching on and off,
// gen_9 with it off). The gen_9 search is the board the joint component was
// built for, so a pruning regression there fails this test; it runs about a
// minute, the slowest case here.
//
//   node examples/hit-counts/recovery-probe.test.mjs

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { runGoldenCases } from '../_shared/golden-runner.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBE = join(HERE, 'recovery-probe.mjs')

const cases = [
  { args: ['gen_6x6.json'], golden: 'gen_6x6.txt' },
  { args: ['gen_9x9.json'], golden: 'gen_9x9.txt' },
  { args: ['gen_6x6.json', '--search', '--only=off'], golden: 'search_off.txt' },
  { args: ['gen_6x6.json', '--search', '--only=on'], golden: 'search_on.txt' },
  { args: ['gen_9x9.json', '--search', '--only=off'], golden: 'search_9x9_off.txt' }
]

const ok = runGoldenCases(PROBE, cases)
if (!ok) process.exit(1)
console.log('recovery-probe.test.mjs: all golden cases byte-identical')
