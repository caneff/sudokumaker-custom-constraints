// The visit-stamp helper: the marks array's type is checked where it is
// allocated, and `bumpStamp` wraps at the element type's cap without testing the
// type again (#736).
//
//   node examples/_shared/stamp.test.mjs

import { join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'

const SRC = readFileSync(join(import.meta.dirname, 'stamp.js'), 'utf8')
// The app runs the file as a bare script spliced into a component, so load it
// the same way: a function body that hands back what it declares.
const { bumpStamp, newStampMarks } = new Function(`${SRC}\n;return { bumpStamp, newStampMarks }`)() // eslint-disable-line no-new-func

// A wrong array type fails at allocation, loudly, before any update runs.
for (const Wrong of [Int16Array, Uint8Array, Float64Array, Array]) {
  assert.throws(() => newStampMarks(Wrong, 4), /Int32Array or a Uint32Array/, `${Wrong.name} was accepted`)
}

// Each right type wraps at its own cap: clear the array, restart at 1.
for (const [Type, cap] of [[Int32Array, 0x7FFFFFFF], [Uint32Array, 0xFFFFFFFF]]) {
  const marks = newStampMarks(Type, 3)
  assert.ok(marks instanceof Type)
  assert.strictEqual(marks.length, 3)
  marks.fill(5)
  assert.strictEqual(bumpStamp(marks, cap - 1), cap, `${Type.name}: the cap itself is still a valid stamp`)
  assert.deepStrictEqual([...marks], [5, 5, 5], `${Type.name}: no clear before the cap`)
  assert.strictEqual(bumpStamp(marks, cap), 1, `${Type.name}: wraps to 1 at the cap`)
  assert.deepStrictEqual([...marks], [0, 0, 0], `${Type.name}: the wrap clears the marks`)
  assert.strictEqual(bumpStamp(marks, 0), 1)
}

// The wrap guard itself holds no throw and no type test.
const body = SRC.slice(SRC.indexOf('function bumpStamp'), SRC.indexOf('// The marks array'))
assert.ok(body.includes('function bumpStamp') && !/throw|instanceof/.test(body), 'bumpStamp tests or throws on the type per call')
console.log('PASS')
