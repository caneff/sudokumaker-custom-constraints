// Behavior test for the independent OR-Tools Numbered Rooms verifier (verify.py).
// It asserts the values that matter, not just that the script ran: the shipped
// puzzle (3 carved givens, all clues) is UNIQUE under a from-scratch model that
// agrees with the fixture; the clues are load-bearing (drop them and two
// completions remain); and the logical floor is one (clues alone are unique).
// The literals below are the facts for the carved puzzle — a broken model, a
// changed carve, or a changed fixture moves them and fails here.
//
//   node examples/numbered-rooms/recovery-probe.mjs   # writes min_givens.json
//   node examples/numbered-rooms/verify.test.mjs

import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const VERIFY = join(HERE, 'verify.py')

// verify.py exits 1 (and execFileSync throws) if the model is not unique,
// disagrees with the fixture, or turns out inert — a loud floor under the checks.
const out = execFileSync('uv', ['run', '--with', 'ortools', 'python3', VERIFY], { encoding: 'utf8' })

let failed = false
const check = (ok, msg) => { if (!ok) { failed = true; console.log(`FAIL: ${msg}`) } else console.log(`PASS: ${msg}`) }

check(/shipped puzzle: 3 interior givens/.test(out), 'shipped puzzle carries the 3 carved givens')
check(/1 solution\(s\) — UNIQUE/.test(out), 'shipped puzzle is unique under the independent model')
check(/agrees with the fixture solution/.test(out), 'independent model agrees with the fixture solution')
check(/clues load-bearing: .* -> 2 completions/.test(out), 'clues are load-bearing: dropping them leaves two completions')
check(/logical floor: clues alone \(0 givens\) -> 1 solution/.test(out), 'the clues alone are already logically unique')

if (failed) {
  console.log('--- verifier output ---')
  console.log(out)
  process.exit(1)
}
console.log('verify.test.mjs: independent OR-Tools model confirms the carved puzzle is unique, its clues load-bearing')
