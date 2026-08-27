// Regression golden for the skyscraper recovery/speed probe: asserts its stdout
// is BYTE-IDENTICAL to a fixed golden, per invocation. Covers the recovery path
// (gen_6) and the search path (gen_4 with a small node cap, so a capped original
// still returns fast). The node and solution counts are deterministic — MRV
// branching with a fixed tie-break — so a drift in the counts fails the test.
//
//   node examples/skyscraper/recovery-probe.test.mjs

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { runGoldenCases } from '../_shared/golden-runner.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBE = join(HERE, 'recovery-probe.mjs')

const cases = [
  { args: ['gen_6.json'], golden: 'gen_6.txt' },
  { args: ['gen_4.json', '--search', '--cap=2000'], golden: 'search_gen4.txt' }
]

const ok = runGoldenCases(PROBE, cases)
if (!ok) process.exit(1)
console.log('recovery-probe.test.mjs: all golden cases byte-identical')
