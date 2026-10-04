import { join } from 'path'
import assert from 'assert'
import { runBackend } from '../_shared/backend-runner.mjs'
import { assembleSource } from '../_shared/include.mjs'

const HERE = import.meta.dirname
const SRC = assembleSource(join(HERE, 'main.js'))

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

const built = comp => {
  const [, line, target, clue] = comp.args
  return { ctor: comp.ctor, line, target, clue }
}

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

// 6 is the largest clue a 4x4 line aiming at 4 can carry: 1 + 2 + 3, the
// target last.
{
  const [c] = setup([{ cells: [id(3, 3), id(3, 2)], value: '6' }])
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [15, 11, 7, 3], target: 4, clue: 6
  })
}

// A typed 0 is a clue, not a blank: it registers a component like any other
// value.
{
  const [c] = setup([{ cells: [id(0, 2), id(1, 2)], value: '0' }])
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [8, 9, 10, 11], target: 3, clue: 0
  })
}

{
  const [c] = setup([{ cells: [id(3, 0), id(2, 0)], value: ' 5 ' }])
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [3, 2, 1, 0], target: 1, clue: 5
  })
}

// A board wider than it is tall: a row runs the width and a column the
// height, so reading one dimension for both walks off the board.
{
  const W = 5
  const H = 3
  const opts = { W, H, lo: 1, hi: 5 }
  const [row] = setup([{ cells: [id(4, 1, W), id(3, 1, W)], value: '4' }], opts)
  assert.deepStrictEqual(built(row).line, [9, 8, 7, 6, 5])
  const [col] = setup([{ cells: [id(2, 2, W), id(2, 1, W)], value: '4' }], opts)
  assert.deepStrictEqual(built(col).line, [12, 7, 2])
}

{
  assert.deepStrictEqual(setup([{ cells: [id(1, 0), id(1, 1)], value: '' }]), [])
  assert.deepStrictEqual(setup([{ cells: [id(1, 0), id(1, 1)] }]), [])
  const got = setup([
    { cells: [id(0, 0), id(0, 1)], value: '' },
    { cells: [id(0, 3), id(0, 2)], value: '6' }
  ])
  assert.deepStrictEqual(got.map(c => built(c).line), [[12, 8, 4, 0]])
}

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

function refuses (groups, pattern, opts) {
  assert.throws(() => setup(groups, opts), err => {
    assert.match(err.message, pattern)
    return true
  })
}

const names = /R1C2.*R1C3|R1C3.*R1C2/

refuses([{ cells: [id(1, 0)], value: '5' }], /R1C2/)
refuses([{ cells: [id(0, 0), id(1, 0), id(2, 0)], value: '5' }], /two cells/)
refuses([{ cells: [id(0, 0), id(1, 1)], value: '5' }], /R1C1.*R2C2/)
refuses([{ cells: [id(0, 0), id(2, 0)], value: '5' }], /adjacent/)
refuses([{ cells: [id(1, 0), id(2, 0)], value: '5' }], names)
refuses([{ cells: [id(0, 1), id(0, 2)], value: '5' }], /R2C1.*R3C1/)
refuses([{ cells: [id(0, 1), id(0, 0)], value: 'x' }], /R2C1.*R1C1.*not a whole number/)
refuses([{ cells: [id(0, 1), id(0, 0)], value: '-3' }], /R2C1.*R1C1.*not a whole number/)
refuses([{ cells: [id(0, 1), id(0, 0)], value: '2.5' }], /R2C1.*R1C1.*not a whole number/)
refuses([{ cells: [id(0, 1), id(0, 0)], value: '05' }], /R2C1.*R1C1.*not a whole number/)
refuses([{ cells: [id(3, 3), id(3, 2)], value: '7' }], /R4C4.*R3C4.*above 6/)
refuses([{ cells: [id(0, 0), id(0, 1)], value: '10' }], /R1C1.*R2C1.*above 9/)
// A board whose digits don't start at 1: TOTAL is (lo+hi)*(hi-lo+1)/2, not
// hi*(hi+1)/2 -- digits 2..5 give TOTAL 14, not 15. Column 3 aims at 3, so
// the max clue is 14 - 3 = 11.
{
  const opts4 = { W: 4, H: 4, lo: 2, hi: 5 }
  const [c] = setup([{ cells: [id(2, 0), id(2, 1)], value: '11' }], opts4)
  assert.deepStrictEqual(built(c), {
    ctor: 'UpToNComponent', line: [2, 6, 10, 14], target: 3, clue: 11
  })
  refuses([{ cells: [id(2, 0), id(2, 1)], value: '12' }], /above 11/, opts4)
}
refuses(
  [{ cells: [id(4, 0, 5), id(4, 1, 5)], value: '9' }],
  /target digit 5/,
  { W: 5, H: 5, lo: 1, hi: 4 }
)
refuses([
  { cells: [id(0, 0), id(0, 1)], value: '3' },
  { cells: [id(0, 1), id(0, 0)], value: '4' }
], /same line and end/)
refuses([
  { cells: [id(0, 0), id(0, 1)], value: '' },
  { cells: [id(0, 0), id(0, 1)], value: '4' }
], /same line and end/)
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
