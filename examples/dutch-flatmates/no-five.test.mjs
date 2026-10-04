import { join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)
const N = 9
installGlobals(1, N)
const mod = load('NoFiveComponent.js', ['setParams', 'initialize', 'validate', 'getAffectedCells'])
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const CELLS = Array.from({ length: N * N }, (_, i) => i)

const gen = JSON.parse(readFileSync(join(HERE, 'gen_0g.json'), 'utf8'))
const truth = Object.fromEntries(gen.grid.flatMap((row, r) => [...row].map((ch, c) => [r * N + c, Number(ch)])))
const circles = gen.circles

{
  const p = makePuzzle(Object.fromEntries(CELLS.map(c => [c, 0])), () => ALL)
  const inst = { cells: circles }
  mod.setParams(inst, circles)
  assert.deepStrictEqual(mod.getAffectedCells(circles), circles)
  Array.from(mod.initialize(inst, p))
  for (const c of CELLS) {
    const expected = circles.includes(c) ? ALL.filter(d => d !== 5) : ALL
    assert.deepStrictEqual([...p._cand.get(c)], expected, `cell ${c} candidates are wrong`)
  }
  console.log('initialize: 5 removed from the 28 circle cells only')
}

{
  const inst = { cells: circles }
  mod.setParams(inst, circles)
  const solved = makePuzzle(truth, (c, v) => [v])
  assert.strictEqual(mod.validate(inst, solved), true, 'validate rejected the recorded solution')
  Array.from(mod.initialize(inst, solved))
  for (const c of CELLS) assert.deepStrictEqual([...solved._cand.get(c)], [truth[c]], `initialize removed the true value at cell ${c}`)
  const five = makePuzzle(truth, (c, v) => [c === circles[0] ? 5 : v])
  assert.strictEqual(mod.validate(inst, five), false, 'validate accepted a 5 in a circle')
  const fiveOff = makePuzzle(truth, (c, v) => [c === CELLS.find(x => !circles.includes(x)) ? 5 : v])
  assert.strictEqual(mod.validate(inst, fiveOff), true, 'validate refused a 5 outside the circles')
  console.log('validate: a 5 in a circle fails, elsewhere passes; the solution keeps every true value')
}

console.log('PASS')
