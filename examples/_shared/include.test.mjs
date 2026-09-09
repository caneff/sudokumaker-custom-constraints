// The Node half of the `// #include` directive: what it splices, what it
// refuses, and that it agrees with the Python half about both. Run:
//   node examples/_shared/include.test.mjs
//
// The agreement check is the load-bearing one. Two implementations ship this
// rule -- minify_js in minify.py builds the link, assembleSource here runs the
// same paste target under a probe -- and Node cannot call Python, so nothing
// but a test keeps the syntax they read identical (include.mjs's own comment
// says to keep it so).

import assert from 'assert'
import { execFileSync } from 'child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { assembleSource, firstInclude } from './include.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const fixtures = () => mkdtempSync(join(tmpdir(), 'include-'))

// ---- splices the named file, resolved against the INCLUDING file's dir ----
{
  const root = fixtures()
  mkdirSync(join(root, '_shared'))
  writeFileSync(join(root, '_shared', 'seg.js'), 'function f () { return 1 }\n')
  writeFileSync(join(root, 'main-global.js'), '// #include _shared/seg.js\nf()\n')
  assert.strictEqual(assembleSource(join(root, 'main-global.js')),
    'function f () { return 1 }\nf()\n')
}

// ---- refuses a directive naming a file that is not there ----
// Leaving it in would eval as a comment and fail much later, as a missing
// function.
{
  const root = fixtures()
  writeFileSync(join(root, 'main.js'), '// #include nope.js\n')
  assert.throws(() => assembleSource(join(root, 'main.js')), /nope\.js|ENOENT/)
}

// ---- refuses a cycle instead of recursing until the stack gives out ----
{
  const root = fixtures()
  writeFileSync(join(root, 'a.js'), '// #include b.js\n')
  writeFileSync(join(root, 'b.js'), '// #include a.js\n')
  assert.throws(() => assembleSource(join(root, 'a.js')), /cycle/)
}

// ---- refuses a directive with no path, and one naming two ----
// `// #include` alone is a half-written directive, not a comment to keep.
{
  const root = fixtures()
  writeFileSync(join(root, 'main.js'), '// #include\n')
  assert.throws(() => assembleSource(join(root, 'main.js')), /exactly one path/)
  writeFileSync(join(root, 'two.js'), '// #include a.js b.js\n')
  assert.throws(() => assembleSource(join(root, 'two.js')), /exactly one path/)
}

// ---- firstInclude reports the directive a non-splicing reader must refuse ----
assert.strictEqual(firstInclude('const x = 1\n// #include seg.js\n'), '// #include seg.js')
assert.strictEqual(firstInclude('const x = 1\n// an ordinary comment\n'), null)

// ---- both halves read the same directive out of the same fixture ----
// Python's answer is minified and Node's is not, so the comparison runs
// Python's strip over Node's assembled text: what is left has to be what
// Python got by splicing the file itself. A half that missed the directive, or
// resolved it against a different directory, disagrees here.
{
  const root = fixtures()
  mkdirSync(join(root, '_shared'))
  writeFileSync(join(root, '_shared', 'seg.js'),
    '// commentary the link does not carry\nfunction f () { return 1 }\n')
  writeFileSync(join(root, 'main-global.js'),
    '// #include _shared/seg.js\n\nf()  // called\n')
  const assembled = join(root, 'assembled.js')
  writeFileSync(assembled, assembleSource(join(root, 'main-global.js')))
  const agree = execFileSync('uv', ['run', join(HERE, 'include_agreement.py'),
    join(root, 'main-global.js'), assembled], { encoding: 'utf8' })
  assert.strictEqual(agree.trim(), 'agree', agree)
}

console.log('include.test.mjs: splice, three refusals, and both halves agree')
