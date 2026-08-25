// Regression golden for the skyscraper recovery/speed probe: asserts its stdout
// is BYTE-IDENTICAL to a fixed golden, per invocation. Covers the recovery path
// (gen_6) and the search path (gen_4 with a small node cap, so a capped original
// still returns fast). The node and solution counts are deterministic — MRV
// branching with a fixed tie-break — so a drift in the counts fails the test.
//
//   node examples/skyscraper/recovery-probe.test.mjs

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBE = join(HERE, 'recovery-probe.mjs')
const GOLDEN = join(HERE, '.golden')

const cases = [
  { args: ['gen_6.json'], golden: 'gen_6.txt' },
  { args: ['gen_4.json', '--search', '--cap=2000'], golden: 'search_gen4.txt' }
]

// The search runs print a wall-clock time (ms) that never repeats between runs;
// mask it so the golden asserts on node/solution counts and output shape, not
// on timing noise.
const maskMs = s => s.replace(/\d+ms/g, 'Nms')

let failed = false
for (const { args, golden } of cases) {
  const expected = maskMs(readFileSync(join(GOLDEN, golden), 'utf8'))
  const actual = maskMs(execFileSync('node', [PROBE, ...args], { encoding: 'utf8' }))
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

if (failed) process.exit(1)
console.log('recovery-probe.test.mjs: all golden cases byte-identical')
