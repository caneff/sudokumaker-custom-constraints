// Soundness fuzz for the Dutch Flatmates component: `update` never removes a
// cell's TRUE value, on random partial boards consistent with the shipped
// solution. It also asserts the prune is not dead code: some states lose
// candidates.
//
//   node examples/dutch-flatmates/soundness-harness.mjs
//
// It also runs main.js against a mock board: one component over all 81 cells,
// row-major, and a refusal of a board that is not a square or has a missing
// cell.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, makeSeeder, shuffle, violates, total, fixpoint } from '../_shared/harness-lib.mjs'
import { runBackend } from '../_shared/backend-runner.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng(676)

installGlobals(1, 9)
const mod = load('DutchFlatmatesComponent.js', ['setParams', 'update', 'validate'])

const N = 9
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// ---- registration: main.js on a mock board --------------------------------
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

// ---- soundness: states around the shipped solution ------------------------
const gen = JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8'))
const truth = {}
gen.grid.forEach((row, r) => [...row].forEach((ch, c) => { truth[r * N + c] = Number(ch) }))
const seeder = makeSeeder(rnd, ALL)

// Once with the columns declared houses (the shipped board), once with none
// (every column can repeat, so only the per-cell rule runs).
const COLUMNS = Array.from({ length: N }, (_, col) => Array.from({ length: N }, (_, row) => row * N + col))
const ITERS = 5000
for (const [label, houses] of [['dutch-flatmates', COLUMNS], ['dutch-flatmates (no houses)', []]]) {
  let bad = 0
  let changed = 0
  for (let i = 0; i < ITERS; i++) {
    const start = makePuzzle(truth, seeder, { houses })
    const before = total(start)
    const inst = { cells: CELLS }
    mod.setParams(inst, CELLS)
    if (violates(mod, inst, start, truth) !== null) bad++
    if (total(start) !== before) changed++
  }
  console.log(`${label.padEnd(28)}`, ITERS, 'tests,', bad, 'violations,', changed, 'states pruned')
  assert.strictEqual(bad, 0, `${label}: ${bad} violations`)
  assert.ok(changed > 0, `${label}: update never removed a candidate: the prune is dead`)
}

// ---- soundness on boards whose columns are not a plain sudoku's (#693) -----
// A board narrower than its digit list (6x6, digits 1-9), a full set of digits
// with no 9 (8x8, digits 1-8) and one with no 1 (9x9, digits 2-10). Every column
// is declared all-different. Each truth column is a random draw of distinct
// digits in which every 5 has a 1 above it or a 9 below it; the columns are
// independent because the rule never looks across them.
for (const { width, lo, hi } of [{ width: 6, lo: 1, hi: 9 }, { width: 8, lo: 1, hi: 8 }, { width: 9, lo: 2, hi: 10 }]) {
  installGlobals(lo, hi)
  const digits = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  const cells = Array.from({ length: width * width }, (_, i) => i)
  const columns = Array.from({ length: width }, (_, col) => Array.from({ length: width }, (_, row) => row * width + col))
  const flatmated = column => column.every((d, i) => d !== 5 || column[i - 1] === 1 || column[i + 1] === 9)
  const drawColumn = () => {
    for (;;) {
      const column = shuffle(rnd, [...digits]).slice(0, width)
      if (flatmated(column)) return column
    }
  }
  const label = `${width}x${width}, digits ${lo}-${hi}`
  let bad = 0
  let changed = 0
  for (let i = 0; i < 2000; i++) {
    const truthHere = {}
    for (let col = 0; col < width; col++) drawColumn().forEach((d, row) => { truthHere[row * width + col] = d })
    const start = makePuzzle(truthHere, makeSeeder(rnd, digits), { houses: columns })
    const before = total(start)
    const inst = { cells }
    mod.setParams(inst, cells)
    if (violates(mod, inst, start, truthHere) !== null) bad++
    if (total(start) !== before) changed++
  }
  installGlobals(1, 9)
  console.log(`${label.padEnd(28)}`, 2000, 'tests,', bad, 'violations,', changed, 'states pruned')
  assert.strictEqual(bad, 0, `${label}: ${bad} violations`)
  assert.ok(changed > 0, `${label}: update never removed a candidate`)
}

// ---- validate agrees with the truth on the solved grid --------------------
{
  const inst = { cells: CELLS }
  mod.setParams(inst, CELLS)
  const solved = makePuzzle(truth, (c, v) => [v], { houses: COLUMNS })
  assert.strictEqual(mod.validate(inst, solved), true, 'validate rejected the shipped solution')
  fixpoint(mod, inst, solved)
  assert.strictEqual(mod.validate(inst, solved), true, 'update broke the shipped solution')
}

console.log('PASS')
