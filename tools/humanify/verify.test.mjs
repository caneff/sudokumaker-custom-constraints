// verify.mjs accepts a rename that keeps scoping and refuses one that changes
// what a name resolves to. Fixture pairs only, never the bundle.
//
//   node tools/humanify/verify.test.mjs

import assert from 'assert'
import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const verify = join(dirname(fileURLToPath(import.meta.url)), 'verify.mjs')
const dir = mkdtempSync(join(tmpdir(), 'verify-test-'))
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

let n = 0
function run (src, out) {
  const a = join(dir, `src-${n}.js`); const b = join(dir, `out-${n++}.js`)
  writeFileSync(a, src); writeFileSync(b, out)
  const r = spawnSync('node', [verify, a, b], { encoding: 'utf8' })
  return { status: r.status, out: r.stdout + r.stderr }
}

const SRC = 'const total = 1\nfunction add (x) { return x + total }\nexport { add }\n'

// A rename that keeps every binding's scope passes.
let r = run(SRC, 'const a = 1\nfunction add (c) { return c + a }\nexport { add }\n')
assert.strictEqual(r.status, 0, 'a scope-preserving rename passes: ' + r.out)
assert.match(r.out, /AST skeleton equal: true/)
assert.match(r.out, /per-binding reference-count mismatches: 0/)

// A rename that makes the parameter shadow the outer binding changes what the
// body's names resolve to: same skeleton, different reference counts.
r = run(SRC, 'const a = 1\nfunction add (a) { return a + a }\nexport { add }\n')
assert.strictEqual(r.status, 1, 'a rename that changes a binding\'s resolution must be refused')
assert.match(r.out, /AST skeleton equal: true/, 'the shadowing fixture has the same skeleton, so the scope check is what refuses it')
assert.doesNotMatch(r.out, /per-binding reference-count mismatches: 0/, 'the refusal comes from the reference-count check')

// A change beyond names is refused by the skeleton check.
r = run(SRC, 'const a = 1\nfunction add (c) { return c - a }\nexport { add }\n')
assert.strictEqual(r.status, 1, 'an operator change must be refused')
assert.match(r.out, /AST skeleton equal: false/)

console.log('verify skeleton and scope check: ok')
