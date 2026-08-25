// Regression golden for the recovery probe: asserts its stdout is
// BYTE-IDENTICAL to a fixed golden, per invocation. Covers the report path
// (gen_6, gen_9) and the search path (gen_6, matching on and off) — gen_9's
// full --search takes minutes, too slow to golden directly, so gen_6 stands
// in for the search code path.
//
//   node examples/hit-counts/recovery-probe.test.mjs

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBE = join(HERE, 'recovery-probe.mjs')
const GOLDEN = join(HERE, '.golden')

const cases = [
  { args: ['gen_6.json'], golden: 'gen_6.txt' },
  { args: ['gen_9.json'], golden: 'gen_9.txt' },
  { args: ['gen_6.json', '--search', '--only=off'], golden: 'search_off.txt' },
  { args: ['gen_6.json', '--search', '--only=on'], golden: 'search_on.txt' }
]

// The search runs print a wall-clock time (ms) that is never identical
// between runs; mask it out before the byte-identical comparison so the
// golden asserts on what the extraction must preserve — node/solution
// counts, output shape — not on timing noise.
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
