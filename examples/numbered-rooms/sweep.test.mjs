// Behavior test for the Numbered Rooms sweep. It guards the real improvement: on
// an interactable puzzle (a handful of shown clues, a handful of givens, the rest
// of the clues blank), OURS solves and the ORIGINAL wrapper cannot — the wrapper
// is inert on a blank clue, so it must guess every one and never finishes.
//
// It runs a fast subset of the committed boards (the slower boards are left for
// the manual `node sweep.mjs`) under a modest node cap, and asserts every board
// shows ours SOLVED and the original with no solution. sweep.mjs itself exits
// non-zero if the original ever solves or ours ever fails, which execFileSync
// turns into a thrown error — so the shape of the win is enforced twice.
//
//   node examples/numbered-rooms/sweep.test.mjs

import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SWEEP = join(HERE, 'sweep.mjs')
const FAST = ['gen_9_s2.json', 'gen_9_s3.json', 'gen_9_s6.json']

// Throws on non-zero exit (original solved, or ours failed), already failing here.
const out = execFileSync('node', [SWEEP, ...FAST, '--cap=6000'], { encoding: 'utf8' })

let failed = false
const check = (ok, msg) => { if (!ok) { failed = true; console.log(`FAIL: ${msg}`) } else console.log(`PASS: ${msg}`) }

const rows = FAST.map(f => out.split('\n').find(l => l.startsWith(f.replace('.json', ' ')) || l.startsWith(f.replace('.json', ''))))
check(rows.every(Boolean), 'every board printed a row')
check(rows.every(r => r && /SOLVED \d+n/.test(r)), 'ours solves every board')
check(rows.every(r => r && /no solution/.test(r)), 'the original solves no board (it must guess the blank clues)')
check(!/original solved/.test(out) && !/FAILED/.test(out), 'no board where the original solved or ours failed')

if (failed) {
  console.log('--- sweep output ---')
  console.log(out)
  process.exit(1)
}
console.log('sweep.test.mjs: ours solves every interactable board, the original none')
