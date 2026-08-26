// Behavior test for the Numbered Rooms sweep. It guards the point of the sweep:
// across random boards the ours-vs-original node gap swings BOTH ways, so ours is
// not a fixed search win. It runs a fast subset of the committed boards (the two
// slowest, s2 and s4, are left for the manual `node sweep.mjs`) and asserts:
//   - every board's two wirings agree on solution count and none capped (sweep.mjs
//     exits non-zero otherwise, which execFileSync turns into a thrown error);
//   - ours both WINS on some board and LOSES on another — the caveat's whole claim.
//
//   node examples/numbered-rooms/sweep.test.mjs

import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SWEEP = join(HERE, 'sweep.mjs')
const FAST = ['gen_9_s1.json', 'gen_9_s3.json', 'gen_9_s5.json', 'gen_9_s6.json', 'gen_9_s7.json', 'gen_9_s8.json']

// Throws on non-zero exit, so a capped run or a wirings-disagree already fails here.
const out = execFileSync('node', [SWEEP, ...FAST], { encoding: 'utf8' })

let failed = false
const check = (ok, msg) => { if (!ok) { failed = true; console.log(`FAIL: ${msg}`) } else console.log(`PASS: ${msg}`) }

const m = out.match(/ours wins (\d+)\/(\d+), loses (\d+)\/\d+/)
check(!!m, 'sweep printed a win/loss summary')
const wins = m ? +m[1] : 0
const loses = m ? +m[3] : 0
check(wins > 0, `ours wins on at least one board (${wins})`)
check(loses > 0, `ours loses on at least one board (${loses}) — the gap is not a fixed win`)

if (failed) {
  console.log('--- sweep output ---')
  console.log(out)
  process.exit(1)
}
console.log('sweep.test.mjs: ours both wins and loses across boards, wirings agree on every board')
