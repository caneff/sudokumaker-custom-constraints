import { join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, makeSeeder, columnsOf, shuffle, fixpoint, fuzzSoundness } from '../_shared/harness-lib.mjs'
import { runBackend } from '../_shared/backend-runner.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)
const { rnd } = makeRng(676)

installGlobals(1, 9)
const mod = load('DutchFlatmatesComponent.js', ['setParams', 'update', 'validate'])

const N = 9
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// The mock hands out ids in a scrambled order, so a main.js that trusted the
// id order instead of building by coordinates would register the wrong list.
const SRC = readFileSync(join(HERE, 'main.js'), 'utf8')
const SCRAMBLE = i => (i * 37) % (N * N) // 37 is coprime to 81: a permutation
const registered = []
const board = (width, height, idOf = (x, y) => SCRAMBLE(y * width + x)) => ({
  puzzle: { spec: { size: { width, height } }, addConstraintComponent: c => registered.push(c) },
  helpers: { cellIds: { getIdFromCoordsSafe: ({ x, y }) => idOf(x, y) } }
})
runBackend(SRC, board(N, N))
assert.strictEqual(registered.length, 1, 'expected one whole-grid component')
assert.strictEqual(registered[0].ctor, 'DutchFlatmatesComponent', 'wrong component registered')
assert.strictEqual(registered[0].args[0], 'Dutch Flatmates')
assert.deepStrictEqual(registered[0].args[1], CELLS.map(SCRAMBLE), 'cells are not row-major by coordinates')
assert.throws(() => runBackend(SRC, board(N, 8)), /needs a square board/, 'a rectangle did not throw')
assert.throws(() => runBackend(SRC, board(N, N, (x, y) => (x === 3 && y === 4 ? undefined : y * N + x))), /no cell at x=3, y=4/, 'a missing cell did not throw')
console.log('registration: one component over 81 cells, row-major by coordinates; bad boards throw')

const gen = JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8'))
const truth = {}
gen.grid.forEach((row, r) => [...row].forEach((ch, c) => { truth[r * N + c] = Number(ch) }))
const seeder = makeSeeder(rnd, ALL)

const COLUMNS = columnsOf(N)
const ITERS = 5000
for (const [label, houses] of [['dutch-flatmates', COLUMNS], ['dutch-flatmates (no houses)', []]]) {
  const r = fuzzSoundness(label, {
    iters: ITERS,
    draw: () => {
      const inst = { cells: CELLS }
      mod.setParams(inst, CELLS)
      return { truth, seed: seeder, houses, parts: [{ mod, inst }] }
    }
  })
  assert.strictEqual(r.failures, 0, `${label}: ${r.failures} failures`)
  assert.ok(r.fired > 0, `${label}: update never removed a candidate: the prune is dead`)
}

// Truth columns are drawn independently because the rule never looks across
// columns.
for (const { width, lo, hi } of [{ width: 6, lo: 1, hi: 9 }, { width: 8, lo: 1, hi: 8 }, { width: 9, lo: 2, hi: 10 }]) {
  installGlobals(lo, hi)
  const digits = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  const cells = Array.from({ length: width * width }, (_, i) => i)
  const columns = columnsOf(width)
  const flatmated = column => column.every((d, i) => d !== 5 || column[i - 1] === 1 || column[i + 1] === 9)
  const drawColumn = () => {
    for (;;) {
      const column = shuffle(rnd, [...digits]).slice(0, width)
      if (flatmated(column)) return column
    }
  }
  const label = `${width}x${width}, digits ${lo}-${hi}`
  const r = fuzzSoundness(label, {
    iters: 2000,
    draw: () => {
      const truthHere = {}
      for (let col = 0; col < width; col++) drawColumn().forEach((d, row) => { truthHere[row * width + col] = d })
      const inst = { cells }
      mod.setParams(inst, cells)
      return { truth: truthHere, seed: makeSeeder(rnd, digits), houses: columns, parts: [{ mod, inst }] }
    }
  })
  installGlobals(1, 9)
  assert.strictEqual(r.failures, 0, `${label}: ${r.failures} failures`)
  assert.ok(r.fired > 0, `${label}: update never removed a candidate`)
}

{
  const inst = { cells: CELLS }
  mod.setParams(inst, CELLS)
  const solved = makePuzzle(truth, (c, v) => [v], { houses: COLUMNS })
  assert.strictEqual(mod.validate(inst, solved), true, 'validate rejected the shipped solution')
  fixpoint(mod, inst, solved)
  assert.strictEqual(mod.validate(inst, solved), true, 'update broke the shipped solution')
}

console.log('PASS')
