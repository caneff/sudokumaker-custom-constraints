// The marker contract: what main.js accepts from the drawn groups, and what it
// refuses at setup (docs/component-contract.md; spec #366, "Marker contract").
//
//   node examples/up-to-n/marker-contract.test.mjs
//
// main.js runs under the shared backend runner with a mock `puzzle` the size of
// a real board. Each case hands it drawn groups in the shape the app ships --
// `{ cells, value }` -- and asserts either the components it registers, or
// that setup throws naming the offending group's cells.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import assert from 'assert'
import { runBackend } from '../_shared/backend-runner.mjs'
import { assembleSource } from '../_shared/include.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = assembleSource(join(HERE, 'main.js'))

// A W x H board, digits lo..hi. Cell id = x + y * W, the app's own layout.
function setup (groups, { W = 4, H = 4, lo = 1, hi = 4 } = {}) {
  const registered = []
  const puzzle = {
    spec: { size: { width: W, height: H } },
    addConstraintComponent: comp => registered.push(comp)
  }
  const helpers = {
    digits: { minDigit: lo, maxDigit: hi },
    naming: { getCellName: c => `R${Math.floor(c / W) + 1}C${(c % W) + 1}` }
  }
  runBackend(SRC, { puzzle, helpers, input: { groups } })
  return registered
}

const id = (x, y, W = 4) => x + y * W

// What a registered component was built with, in the order main.js passes it.
const built = comp => {
  const [, line, target, clue] = comp.args
  return { ctor: comp.ctor, line, target, clue }
}

// ---- Valid markers: one component per clued line, read from the border ----

// Top of column 2 (x = 1): the column read downward, target digit 2.
{
  const [c] = setup([{ cells: [id(1, 0), id(1, 1)], value: '7' }])
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [1, 5, 9, 13], target: 2, clue: 7
  })
}

// The same marker drawn inner cell first: the border cell still names the end.
{
  const [c] = setup([{ cells: [id(1, 1), id(1, 0)], value: '7' }])
  assert.deepStrictEqual(built(c).line, [1, 5, 9, 13])
}

// Bottom of column 4: read upward, target 4.
{
  const [c] = setup([{ cells: [id(3, 3), id(3, 2)], value: '10' }])
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [15, 11, 7, 3], target: 4, clue: 10
  })
}

// Left end of row 3 (y = 2): read rightward, target 3.
{
  const [c] = setup([{ cells: [id(0, 2), id(1, 2)], value: '3' }])
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [8, 9, 10, 11], target: 3, clue: 3
  })
}

// Right end of row 1: read leftward, target 1.
{
  const [c] = setup([{ cells: [id(3, 0), id(2, 0)], value: ' 5 ' }])
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [3, 2, 1, 0], target: 1, clue: 5
  })
}

// Every cell id handed to a component is a plain integer, however the group
// carried it (#276).
{
  // eslint-disable-next-line no-new-wrappers -- a boxed id is what the check is for
  const [c] = setup([{ cells: [new Number(id(0, 1)), new Number(id(1, 1))], value: '4' }])
  for (const cell of built(c).line) assert.strictEqual(typeof cell, 'number')
}

// ---- Empty value: the marker registers nothing ----

{
  assert.deepStrictEqual(setup([{ cells: [id(1, 0), id(1, 1)], value: '' }]), [])
  assert.deepStrictEqual(setup([{ cells: [id(1, 0), id(1, 1)] }]), [])
  // An empty marker beside a clued one leaves the clued one registered.
  const got = setup([
    { cells: [id(0, 0), id(0, 1)], value: '' },
    { cells: [id(0, 3), id(0, 2)], value: '6' }
  ])
  assert.deepStrictEqual(got.map(c => built(c).line), [[12, 8, 4, 0]])
}

// All 4n markers of a 4x4, every one clued: 16 components, no line twice.
{
  const groups = []
  for (let i = 0; i < 4; i++) {
    groups.push({ cells: [id(0, i), id(1, i)], value: '1' })
    groups.push({ cells: [id(3, i), id(2, i)], value: '1' })
    groups.push({ cells: [id(i, 0), id(i, 1)], value: '1' })
    groups.push({ cells: [id(i, 3), id(i, 2)], value: '1' })
  }
  const got = setup(groups)
  assert.strictEqual(got.length, 16)
  assert.strictEqual(new Set(got.map(c => built(c).line.join(','))).size, 16)
}

// ---- Refusals: setup throws, naming the group's cells ----

function refuses (groups, pattern, opts) {
  assert.throws(() => setup(groups, opts), err => {
    assert.match(err.message, pattern)
    return true
  })
}

// The message names the offending group by its cells.
const names = /R1C2.*R1C3|R1C3.*R1C2/

// Wrong cell count.
refuses([{ cells: [id(1, 0)], value: '5' }], /R1C2/)
refuses([{ cells: [id(0, 0), id(1, 0), id(2, 0)], value: '5' }], /two cells/)
// Not in one row or column.
refuses([{ cells: [id(0, 0), id(1, 1)], value: '5' }], /R1C1.*R2C2/)
// One row but not adjacent.
refuses([{ cells: [id(0, 0), id(2, 0)], value: '5' }], /adjacent/)
// Adjacent, but at neither end of the line.
refuses([{ cells: [id(1, 0), id(2, 0)], value: '5' }], names)
refuses([{ cells: [id(0, 1), id(0, 2)], value: '5' }], /R2C1.*R3C1/)
// A non-numeric, a zero, a negative and a fractional value.
refuses([{ cells: [id(0, 1), id(0, 0)], value: 'x' }], /positive integer/)
refuses([{ cells: [id(0, 1), id(0, 0)], value: '0' }], /positive integer/)
refuses([{ cells: [id(0, 1), id(0, 0)], value: '-3' }], /positive integer/)
refuses([{ cells: [id(0, 1), id(0, 0)], value: '2.5' }], /positive integer/)
// Target digit outside the digit range: column 5 on a board whose digits stop
// at 4.
refuses(
  [{ cells: [id(4, 0, 5), id(4, 1, 5)], value: '9' }],
  /target digit 5/,
  { W: 5, H: 5, lo: 1, hi: 4 }
)
// Two markers on one line and end -- even when one of them is empty.
refuses([
  { cells: [id(0, 0), id(0, 1)], value: '3' },
  { cells: [id(0, 1), id(0, 0)], value: '4' }
], /same line and end/)
refuses([
  { cells: [id(0, 0), id(0, 1)], value: '' },
  { cells: [id(0, 0), id(0, 1)], value: '4' }
], /same line and end/)
// A refusal registers nothing at all, so the constraint is never half set up.
{
  const registered = []
  const puzzle = { spec: { size: { width: 4, height: 4 } }, addConstraintComponent: c => registered.push(c) }
  const helpers = { digits: { minDigit: 1, maxDigit: 4 }, naming: { getCellName: c => String(c) } }
  assert.throws(() => runBackend(SRC, {
    puzzle,
    helpers,
    input: { groups: [{ cells: [id(0, 0), id(0, 1)], value: '3' }, { cells: [id(1, 1)], value: '3' }] }
  }))
  assert.deepStrictEqual(registered, [])
}

console.log('PASS')
