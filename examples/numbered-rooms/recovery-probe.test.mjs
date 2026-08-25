// Behavior test for the Numbered Rooms recovery probe. There is no golden here
// (unlike Hit Counts) — the probe is new, so the test asserts the facts the
// ticket cares about: the carve cuts the 31 hand-made givens to 3 the components
// solve by logic; from those 3 the components solve the whole interior (81/81)
// by propagation; the DFS proves the puzzle UNIQUE (exactly one solution, not
// capped); and no component removes a true value (zero true-value loss).
//
//   node examples/numbered-rooms/recovery-probe.test.mjs

import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBE = join(HERE, 'recovery-probe.mjs')

// execFileSync throws on a non-zero exit, so a soundness failure (the probe
// exits 1 when a true value is lost) already fails the test loudly.
const out = execFileSync('node', [PROBE], { encoding: 'utf8' })

let failed = false
const check = (ok, msg) => { if (!ok) { failed = true; console.log(`FAIL: ${msg}`) } else console.log(`PASS: ${msg}`) }

check(/carve: components solve by logic \(no search\) with 3 of 31 givens/.test(out), 'carve cuts 31 givens to 3')
check(/components : clues 36\/36, interior 81\/81/.test(out), 'components solve the whole interior from the 3 givens')
check(/\b1 solution\b/.test(out), 'DFS reports exactly one solution')
check(!/\bsolutions=/.test(out), 'no extra-solution warning (solutions=N)')
check(!/CAPPED/.test(out), 'search finished under the node cap (not capped)')
check(!/TRUE-VALUE LOST/.test(out), 'no true value removed by any component')

if (failed) {
  console.log('--- probe output ---')
  console.log(out)
  process.exit(1)
}
console.log('recovery-probe.test.mjs: unique solution, zero true-value loss')
