// Behavior test for the independent OR-Tools Numbered Rooms verifier (verify.py).
// It asserts the values #21 asks for, not just that the script ran: the puzzle
// is UNIQUE under an independent model that agrees with the fixture; the rule is
// load-bearing (drop all clues and two completions remain); and every clue is
// individually redundant. The count literals below are the discovered facts for
// gen_9.json — a broken model or a changed fixture moves them and fails here.
//
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

check(/full puzzle: 1 solution\(s\) — UNIQUE/.test(out), 'full puzzle is unique under the independent model')
check(/agrees with the fixture solution/.test(out), 'independent model agrees with the fixture solution')
check(/dropping all 36 leaves 2 completions/.test(out), 'rule is load-bearing: all clues dropped leaves two completions')
check(/redundant clues: 36 of 36\b/.test(out), 'every clue is individually redundant')

if (failed) {
  console.log('--- verifier output ---')
  console.log(out)
  process.exit(1)
}
console.log('verify.test.mjs: independent OR-Tools model confirms uniqueness, a load-bearing rule, and full clue redundancy')
