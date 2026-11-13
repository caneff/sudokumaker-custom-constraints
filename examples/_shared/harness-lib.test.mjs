// Focused tests of the harness-lib seams in isolation. Run:
//   node examples/_shared/harness-lib.test.mjs

import assert from 'assert'
import { execFileSync } from 'child_process'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  DigitSet, TIES_FLAG, construct, installGlobals, makeIo, makeLine, makePuzzle, makePuzzleApi, makeRng, makeSeeder,
  columnsOf, fixpointAll, fuzzSoundness, makeWaker, patchSource, runUpdate, shuffle, strengthSweep
} from './harness-lib.mjs'

const { rnd } = makeRng()

// bare: any length, digits in range, repeats possible (forced by pigeonhole)
{
  const line = makeLine(rnd, 'bare', 20, 3)
  assert.strictEqual(line.length, 20)
  for (const d of line) assert.ok(d >= 1 && d <= 3, `digit ${d} out of range 1..3`)
  const distinct = new Set(line)
  assert.ok(distinct.size < line.length, '20 draws from 3 digits must repeat')
}

// bare: can be shorter than the digit count
{
  const line = makeLine(rnd, 'bare', 2, 9)
  assert.strictEqual(line.length, 2)
}

// house: n distinct digits, n < digitCount
{
  const line = makeLine(rnd, 'house', 5, 9)
  assert.strictEqual(line.length, 5)
  assert.strictEqual(new Set(line).size, 5, 'a house never repeats a digit')
  for (const d of line) assert.ok(d >= 1 && d <= 9, `digit ${d} out of range 1..9`)
}

// fullHouse: a permutation of every digit 1..D exactly once
{
  const line = makeLine(rnd, 'fullHouse', 9, 9)
  assert.strictEqual(line.length, 9)
  assert.deepStrictEqual([...line].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9])
}

// makePuzzleApi: getCellsCanHaveRepeats answers from the declared houses
// The mock's answer: false exactly when one house holds every queried cell
// (the app's is pairwise; see `makePuzzleApi`). Declared, never inferred from
// the digits: a house whose seeded digits repeat still answers false. And the
// clue cell is no cell of the line's house, so a component that passes it into
// the query gets "may repeat" back -- its gate shuts, and the harness case
// that needs it open fails.
{
  const cand = new Map([[0, new Set([1])], [1, new Set([1])], [2, new Set([2])], [100, new Set([3])]])
  const api = makePuzzleApi(c => cand.get(c), { houses: [[0, 1, 2]] })
  assert.strictEqual(api.getCellsCanHaveRepeats([0, 1]), false, 'a house repeats nothing, whatever it holds')
  assert.strictEqual(api.getCellsCanHaveRepeats([0, 1, 2]), false)
  assert.strictEqual(api.getCellsCanHaveRepeats([100, 0, 1, 2]), true, 'the clue cell is in no house with the line')
  assert.strictEqual(makePuzzleApi(c => cand.get(c)).getCellsCanHaveRepeats([0, 1]), true, 'no houses: every line is bare')
  // it reads the set live, so a reassigned map is seen at once
  cand.set(2, new Set([2, 3]))
  assert.strictEqual(api.hasValue(2), false)
  assert.deepStrictEqual([...api.getCandidates(2)], [2, 3])
}

// makePuzzle serves the same API over its own fixed map
{
  const p = makePuzzle({ 0: 1, 1: 1, 100: 2 }, (c, v) => [v], { houses: [[0, 1]] })
  assert.strictEqual(p.getCellsCanHaveRepeats([0, 1]), false)
  assert.strictEqual(p.getCellsCanHaveRepeats([100, 0, 1]), true)
  assert.strictEqual(makePuzzle({ 0: 1 }, (c, v) => [v]).getCellsCanHaveRepeats([0]), true)
}

// makeSeeder: every seed keeps the true value, inside the digits
// Pinned, full, and subset each land about a third of the time -- the mix the
// examples tuned their soundness pools on. The bounds are loose on purpose:
// they catch a mode that never fires, not a tuning drift.
{
  const { rnd } = makeRng(7)
  const digits = [1, 2, 3, 4, 5, 6]
  const seed = makeSeeder(rnd, digits)
  const counts = { pin: 0, full: 0, subset: 0 }
  const DRAWS = 6000
  for (let i = 0; i < DRAWS; i++) {
    const v = digits[i % digits.length]
    const s = seed(i, v)
    assert.ok(s.includes(v), 'a seed keeps the true value')
    assert.ok(s.every(d => digits.includes(d)), 'a seed stays inside the digits')
    assert.strictEqual(new Set(s).size, s.length, 'a seed repeats no digit')
    if (s.length === 1) counts.pin++
    else if (s.length === digits.length) counts.full++
    else counts.subset++
  }
  // a subset can come out full or pinned by chance, so full and pin run high
  for (const [mode, n] of Object.entries(counts)) {
    assert.ok(n > DRAWS * 0.25 && n < DRAWS * 0.45, `${mode} drawn ${n} of ${DRAWS}`)
  }
  // modes narrow the mix: no full draw at all
  const noFull = makeSeeder(rnd, digits, ['pin', 'subset', 'subset'])
  let pins = 0
  for (let i = 0; i < DRAWS; i++) if (noFull(i, 3).length === 1) pins++
  assert.ok(pins > DRAWS * 0.28 && pins < DRAWS * 0.4, `pin drawn ${pins} of ${DRAWS} with full dropped`)
}

// shuffle: in place, same elements, and the seeded permutation itself
// The recorded order differs from the input, so a no-op shuffle goes red; it
// would otherwise shrink every fuzz seeded through makeLine 'fullHouse' to the
// identity permutation.
{
  const { rnd } = makeRng(3)
  const a = [1, 2, 3, 4, 5, 6, 7, 8]
  assert.strictEqual(shuffle(rnd, a), a, 'shuffles in place')
  assert.deepStrictEqual([...a].sort(), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepStrictEqual(a, [4, 3, 1, 7, 6, 8, 2, 5], 'the seed-3 permutation')
}

// total: the candidate count of a puzzle
assert.strictEqual(makePuzzle({ 0: 1, 1: 2 }, c => (c ? [1, 2, 3] : [1])).total(), 4)

// strengthSweep: the never-weaker contract
// A version that prunes as hard as the reference passes; one that keeps a
// candidate the reference removed fails; so does a sweep whose states nearly
// all die, which compared nothing.
{
  const dropThree = {
    * update (inst, p) { for (const c of inst.cells) if (p.getCandidates(c).size > 1) yield p.removeCandidateFromCell(3, c) }
  }
  const idle = { * update () {} }
  const apply = (mod, p) => runUpdate(mod, { cells: [0, 1] }, p)
  const states = n => Array.from({ length: n }, () => new Map([[0, [1, 2, 3]], [1, [2, 3]]]))
  const r = strengthSweep('same strength', { cur: dropThree, ref: dropThree, apply, states: states(10) })
  assert.deepStrictEqual(r, { drawn: 10, compared: 10, weaker: 0 })
  assert.throws(() => strengthSweep('weaker', { cur: idle, ref: dropThree, apply, states: states(10) }), /weaker/)
  const killer = { * update (inst, p) { yield p.removeCandidateFromCell(2, 1); yield p.removeCandidateFromCell(3, 1) } }
  assert.throws(() => strengthSweep('dead', { cur: dropThree, ref: killer, apply, states: states(10) }), /compared/)
  // states each built around a solution: a single death is a version emptying
  // a cell the solution needs, and fails however many states compared
  const killsOne = {
    * update (inst, p) { if (p.getCandidates(1).size === 2 && ++killsOne.calls === 3) { yield p.removeCandidateFromCell(2, 1); yield p.removeCandidateFromCell(3, 1) } },
    calls: 0
  }
  assert.throws(() => strengthSweep('solvable', { cur: dropThree, ref: killsOne, apply, states: states(10), solvable: true }), /died/)
  // per-state params reach apply
  const seen = []
  strengthSweep('params', {
    cur: idle,
    ref: idle,
    apply: (mod, p, params) => { seen.push(params) },
    states: [{ start: new Map([[0, [1]]]), params: 'a' }]
  })
  assert.deepStrictEqual(seen, ['a', 'a'])
}

// patchSource: an edit by an anchor that must be there
{
  const src = 'const ALLOW_TIES = false\nfunction f () { return ALLOW_TIES }\n'
  assert.strictEqual(patchSource(src, TIES_FLAG, 'const ALLOW_TIES = true'), src.replace('false', 'true'))
  assert.throws(() => patchSource('function f () {}', TIES_FLAG, 'x'), /ALLOW_TIES/)
  assert.throws(() => patchSource('a\na\n', 'a\n', 'b\n'), /not unique/)
}

// makeIo().load with a patch: the patched source, under the file's name
// A patched load keeps the file's name, which is what V8 coverage attributes
// the run to, so it still counts toward the component's own file.
{
  const dir = mkdtempSync(join(tmpdir(), 'load-'))
  writeFileSync(join(dir, 'comp.js'), 'const FLAG = false\nfunction reading () { return FLAG }\nfunction where () { return new Error().stack }\n')
  const { load } = makeIo(dir)
  assert.strictEqual(load('comp.js', ['reading']).reading(), false)
  const patched = load('comp.js', ['reading', 'where'], s => s.replace('= false', '= true'))
  assert.strictEqual(patched.reading(), true)
  assert.match(patched.where(), /comp\.js/)
}

// makeIo().load returns every lifecycle function the file defines
// A caller names only its extra helpers: a lifecycle function it forgot to
// name is still loaded, so a harness never runs a component without the
// `validate` its file defines. A file that defines none (a shared helper)
// loads with only the names asked for.
{
  const dir = mkdtempSync(join(tmpdir(), 'load-'))
  writeFileSync(join(dir, 'comp.js'), [
    'function getAffectedCells (cells) { return cells }',
    'function setParams (inst, cells) { inst.n = cells.length }',
    'function * initialize () {}',
    'function * update () {}',
    'function validate () { return true }',
    'function helper () { return 7 }'
  ].join('\n'))
  writeFileSync(join(dir, 'partial.js'), 'function setParams () {}\nfunction * update () {}\n')
  writeFileSync(join(dir, 'plain.js'), 'function helper () { return 7 }\n')
  const { load, loadSource } = makeIo(dir)
  const LIFECYCLE = ['getAffectedCells', 'setParams', 'initialize', 'update', 'validate']
  const full = load('comp.js')
  for (const n of LIFECYCLE) assert.strictEqual(typeof full[n], 'function', `load returns ${n} unasked`)
  assert.strictEqual(full.helper, undefined, 'an extra helper comes only when named')
  assert.strictEqual(load('comp.js', ['helper']).helper(), 7)
  assert.deepStrictEqual(Object.keys(load('partial.js')).sort(), ['setParams', 'update'],
    'a lifecycle function the file does not define is left out, not undefined')
  assert.deepStrictEqual(Object.keys(load('plain.js', ['helper'])), ['helper'])
  assert.deepStrictEqual(Object.keys(loadSource('function validate () { return 1 }', [])), ['validate'],
    'loadSource reads the lifecycle functions the same way')
}

// construct builds an instance as the app's constructor does
// docs/research/bundle-api-reference.md, compileCustomComponentClass:
// `instance.cells` is getAffectedCells's result, set before setParams runs;
// a file with no getAffectedCells takes the first argument as its cells.
{
  const seen = []
  const mod = {
    getAffectedCells: (a, b) => [...a, ...b],
    setParams (inst, a, b) { seen.push(inst.cells); inst.args = [a, b] }
  }
  const inst = construct(mod, 'clue', [1, 2], [3])
  assert.strictEqual(inst.name, 'clue')
  assert.deepStrictEqual(inst.cells, [1, 2, 3])
  assert.strictEqual(seen[0], inst.cells, 'setParams already sees instance.cells')
  assert.deepStrictEqual(inst.args, [[1, 2], [3]])
  const bare = construct({ setParams () {} }, 'bare', [4, 5], 'x')
  assert.deepStrictEqual(bare.cells, [4, 5], 'no getAffectedCells: the first argument is the cells')
  assert.deepStrictEqual(construct({}, 'empty', [6]).cells, [6], 'no setParams: a no-op, as the app defaults it')
}

// makeIo().loadSource: eval source a caller already holds and edited
// A harness runs one component twice with a flag at the top of the file
// flipped, which means evaluating edited source rather than a file on disk.
{
  const { loadSource } = makeIo(import.meta.dirname)
  const src = 'const FLAG = false\nfunction reading () { return FLAG }'
  assert.strictEqual(loadSource(src, ['reading']).reading(), false)
  assert.strictEqual(loadSource(src.replace('= false', '= true'), ['reading']).reading(), true)
}

// makePuzzle: getValue answers undefined on an unsolved cell
// docs/puzzle-api.md: getValue is the SOLVED digit, undefined if not solved.
// A component that floods `getValue(cell) === digit` without a hasValue guard
// reads a mock that hands back the first candidate as a board full of placed
// cells, and passes in Node while doing something else in the app.
{
  const p = makePuzzle({ 0: 1, 1: 2 }, (c, v) => (c === 0 ? [v] : [1, 2, 3]))
  assert.strictEqual(p.hasValue(0), true)
  assert.strictEqual(p.getValue(0), 1)
  assert.strictEqual(p.hasValue(1), false)
  assert.strictEqual(p.getValue(1), undefined)
}

// makePuzzle: the whole-grid calls a region-building component makes
// A vendored baseline reads the grid through the app's own names rather than
// index arithmetic, so the mock answers them: orthogonal neighbours on the
// square the cells form, the two multi-cell change calls, and stop.
{
  const truth = {}
  for (let c = 0; c < 9; c++) truth[c] = 1
  const p = makePuzzle(truth, () => [1, 2, 3])

  // 3x3, row-major: the centre has four neighbours, a corner two.
  assert.deepStrictEqual(p.getCellsOrthogonallyAdjacentToCell(4).sort(), [1, 3, 5, 7])
  assert.deepStrictEqual(p.getCellsOrthogonallyAdjacentToCell(0).sort(), [1, 3])
  assert.deepStrictEqual(p.getCellsOrthogonallyAdjacentToCell(8).sort(), [5, 7])

  // A board that is not square names its row length; without it the mock
  // refuses rather than guess.
  const six = makePuzzle({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, () => [1], { width: 3 })
  assert.deepStrictEqual(six.getCellsOrthogonallyAdjacentToCell(4).sort(), [1, 3, 5])
  assert.deepStrictEqual(six.getCellsOrthogonallyAdjacentToCell(2).sort(), [1, 5])
  assert.throws(() => makePuzzle({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, () => [1]).getCellsOrthogonallyAdjacentToCell(0), /square board/)

  p.applyChange(p.removeCandidateFromCells(2, [0, 1]))
  assert.deepStrictEqual([...p.getCandidates(0)].sort(), [1, 3])
  assert.deepStrictEqual([...p.getCandidates(2)].sort(), [1, 2, 3])

  p.applyChange(p.filterCandidatesInCells(DigitSet.from([3]), [2]))
  assert.deepStrictEqual([...p.getCandidates(2)], [3])

  // stop says the branch has no solution; the mock records it where
  // fixpoint and the strength compare look for it.
  p.applyChange(p.stop('no room'))
  assert.strictEqual(p.stopMessage(), 'no room')
}

// The mock's outcome: isDead, stopMessage, reset, total
{
  const p = makePuzzle({ 0: 1, 1: 2 }, () => [1, 2, 3])
  assert.strictEqual(p.isDead(), false, 'an open state is alive')
  assert.strictEqual(p.stopMessage(), null, 'nothing stopped yet')
  assert.strictEqual(p.total(), 6)
  // A stop with no message still reads as stopped.
  p.applyChange(p.stop())
  assert.strictEqual(p.isDead(), true, 'a stop kills the branch')
  assert.strictEqual(p.stopMessage(), 'stopped')
  p.reset()
  assert.strictEqual(p.isDead(), false, 'reset clears the stop')
  assert.strictEqual(p.stopMessage(), null)
  // An emptied cell is the other dead state; reset does not refill it.
  p.applyChange(p.removeCandidatesFromCell(DigitSet.from([1, 2, 3]), 1))
  assert.strictEqual(p.isDead(), true, 'an emptied cell kills the branch')
  assert.strictEqual(p.stopMessage(), null, 'an emptied cell is not a stop')
  assert.strictEqual(p.total(), 3)
  p.reset()
  assert.strictEqual(p.isDead(), true, 'reset clears only the stop')
}

// installGlobals: the naming helper a component calls for a message
installGlobals(1, 9)
// A cage is named after its SMALLEST cell, whatever order the cells come in.
assert.strictEqual(globalThis.helpers.naming.getCageName('region', [10, 1, 5]), 'the region at R1C2')
assert.strictEqual(globalThis.helpers.naming.getCellName(10), 'R2C2')

// A change builder takes a DigitSet or a raw bitmask, and nothing else. Why
// either is fine, and why an array is not: see `maskOf` in harness-lib.mjs.
{
  const p = makePuzzle({ 0: 1, 1: 1 }, () => [1, 2, 3])

  p.applyChange(p.removeCandidatesFromCell(1 << 2, 0))
  assert.deepStrictEqual([...p.getCandidates(0)].sort(), [1, 3], 'a raw mask removes its digits')
  p.applyChange(p.removeCandidatesFromCell(DigitSet.from([3]), 0))
  assert.deepStrictEqual([...p.getCandidates(0)], [1], 'a DigitSet still works')

  for (const bad of [[2], '4', undefined, null, 1.5, {}]) {
    assert.throws(() => p.removeCandidatesFromCell(bad, 1), /removeCandidatesFromCell/,
      `removeCandidatesFromCell must refuse ${JSON.stringify(bad) ?? String(bad)}`)
  }
  assert.deepStrictEqual([...p.getCandidates(1)].sort(), [1, 2, 3], 'a refused call changes nothing')
}

// a complement mask is a mask: the app ANDs it, so the mock takes it
// `~used` is the natural raw form of "keep everything but these", and it is
// negative. Refusing it would make the mock stricter than the app it stands in
// for, and send an author back to allocating a set.
{
  const p = makePuzzle({ 0: 1 }, () => [1, 2, 3])
  p.applyChange(p.filterCandidatesInCell(~(1 << 2), 0))
  assert.deepStrictEqual([...p.getCandidates(0)].sort(), [1, 3], 'keep everything but digit 2')
  p.applyChange(p.removeCandidatesFromCell(~(1 << 1), 0))
  assert.deepStrictEqual([...p.getCandidates(0)], [1], 'drop everything but digit 1')
}

// every plural and singular form follows the one rule
// Mask first, cells second, the bundle's argument order.
{
  const p = makePuzzle({ 0: 1, 1: 1, 2: 1, 3: 1 }, () => [1, 2, 3])

  p.applyChange(p.removeCandidatesFromCells((1 << 2) | (1 << 3), [0, 1]))
  assert.deepStrictEqual([...p.getCandidates(0)], [1], 'a raw mask clears both digits')
  assert.deepStrictEqual([...p.getCandidates(1)], [1])
  assert.deepStrictEqual([...p.getCandidates(2)].sort(), [1, 2, 3], 'an unlisted cell is untouched')
  p.applyChange(p.removeCandidatesFromCells(DigitSet.from([1]), [2]))
  assert.deepStrictEqual([...p.getCandidates(2)].sort(), [2, 3], 'and a DigitSet, as every caller passes today')

  p.applyChange(p.filterCandidatesInCell(DigitSet.from([2, 3]), 3))
  assert.deepStrictEqual([...p.getCandidates(3)].sort(), [2, 3], 'the filter keeps only its digits')
  // A filter that removes nothing leaves the cell whole (the app answers such
  // a call with UnchangedResult): the mask covers both candidates and a digit
  // the cell never had.
  p.applyChange(p.filterCandidatesInCell((1 << 2) | (1 << 3) | (1 << 5), 3))
  assert.deepStrictEqual([...p.getCandidates(3)].sort(), [2, 3], 'a filter that removes nothing is a no-op')
  p.applyChange(p.filterCandidatesInCells(1 << 3, [2, 3]))
  assert.deepStrictEqual([...p.getCandidates(2)], [3], 'the plural filter takes a raw mask too')
  assert.deepStrictEqual([...p.getCandidates(3)], [3])

  for (const bad of [[2], '4', undefined, null, 1.5, {}]) {
    const why = `must refuse ${JSON.stringify(bad) ?? String(bad)}`
    assert.throws(() => p.removeCandidatesFromCells(bad, [0]), /removeCandidatesFromCells/, `removeCandidatesFromCells ${why}`)
    assert.throws(() => p.filterCandidatesInCell(bad, 0), /filterCandidatesInCell/, `filterCandidatesInCell ${why}`)
    assert.throws(() => p.filterCandidatesInCells(bad, [0]), /filterCandidatesInCells/, `filterCandidatesInCells ${why}`)
  }
  assert.deepStrictEqual([...p.getCandidates(0)], [1], 'a refused call changes nothing')
}

// columnsOf: each column's cells top to bottom, row-major ids on a square board.
assert.deepStrictEqual(columnsOf(3), [[0, 3, 6], [1, 4, 7], [2, 5, 8]])
assert.strictEqual(columnsOf(9).length, 9)
assert.deepStrictEqual(columnsOf(9)[8], [8, 17, 26, 35, 44, 53, 62, 71, 80])

// fuzzSoundness: the runner fails on an unsound component, and on a validate that rejects the truth
// A planted component over three cells holding 1..3. `update` is a generator
// like the app's; each variant breaks exactly one thing, so a run that fails
// fails for that reason alone.
{
  const { rnd } = makeRng(3)
  const seed = makeSeeder(rnd, [1, 2, 3])
  const quiet = []
  const run = (mod, extra = {}) => fuzzSoundness('planted', {
    iters: 50,
    log: (...a) => quiet.push(a.join(' ')),
    draw: () => ({ truth: { 0: 1, 1: 2, 2: 3 }, seed, parts: [{ mod, inst: {} }], note: 'line 123', ...extra })
  })
  const sound = { * update () {}, validate: (inst, p) => p.getValue(0) === 1 }
  const clean = run(sound)
  assert.strictEqual(clean.ok, true, 'a sound component with a true validate passes')
  assert.strictEqual(clean.tests, 50)
  assert.strictEqual(clean.violations, 0)
  assert.strictEqual(clean.validateRejects, 0)

  // Unsound: update drops the true value of cell 0 whenever it has company.
  const unsound = { * update (inst, p) { if (p.getCandidates(0).size > 1) yield p.removeCandidateFromCell(1, 0) }, validate: () => true }
  quiet.length = 0
  const bad = run(unsound)
  assert.strictEqual(bad.ok, false, 'a component that removes the truth fails the run')
  assert.ok(bad.violations > 0 && bad.fired > 0)
  assert.ok(quiet.filter(l => l.startsWith('planted violation')).length === 5, 'only the first five violations are logged')
  assert.ok(quiet.some(l => l.includes('line 123')), 'a violation names its state')
  assert.ok(quiet.some(l => l.startsWith('planted:') && l.includes('violations')), 'a summary line is logged')

  // A stop() is a violation: the states all still allow the truth.
  const stopper = { * update (inst, p) { yield p.stop('dead') }, validate: () => true }
  assert.strictEqual(run(stopper).ok, false, 'a component that stops the branch fails the run')

  // validate rejecting the true solution fails the run, though update is sound.
  const rejecting = { * update () {}, validate: () => false }
  const rej = run(rejecting)
  assert.strictEqual(rej.violations, 0, 'update is sound here')
  assert.strictEqual(rej.validateRejects, 50)
  assert.strictEqual(rej.ok, false, 'a validate that rejects the truth fails the run')

  // A part whose component file defines validate but whose module lacks it
  // is refused: a missed load would otherwise read as a validate that passed.
  const dir = mkdtempSync(join(tmpdir(), 'fuzz-'))
  writeFileSync(join(dir, 'comp.js'), 'function * update () {}\nfunction validate () { return true }\n')
  const loaded = makeIo(dir).load('comp.js')
  assert.strictEqual(run(loaded).ok, true, 'the loaded module, validate included, runs')
  const { validate: _dropped, ...missed } = loaded
  assert.throws(() => run(missed), /comp\.js defines validate/, 'a module missing its file\'s validate is refused')
  // A wrapper built field by field carries no DEFINES record; the loaded
  // function it reuses still names the file, so a dropped validate is refused,
  // and only an explicit `validate: undefined` opts out.
  const wrapper = { update: loaded.update }
  assert.throws(() => run(wrapper), /comp\.js defines validate/, 'a wrapper that drops its file\'s validate is refused')
  assert.strictEqual(run({ update: loaded.update, validate: undefined }).ok, true, 'an explicit opt-out runs')

  // inspect sees each seeded puzzle BEFORE the components run: this update
  // prunes every cell to its truth, so a state seen after it totals exactly 3.
  const pruner = { * update (inst, p) { for (const [c, v] of [[0, 1], [1, 2], [2, 3]]) yield p.filterCandidatesInCell(1 << v, c) } }
  const seen0 = []
  run(pruner, { inspect: p => seen0.push(p.total()) })
  assert.strictEqual(seen0.length, 50)
  assert.ok(seen0.every(n => n >= 3) && Math.max(...seen0) > 3, 'inspect reads the seeded state, not the pruned one')

  // failures is the two counts the harnesses gate on, summed.
  assert.strictEqual(rej.failures, 50)
  assert.strictEqual(bad.failures, bad.violations + bad.validateRejects)

  // A part with no validate is not judged on one.
  assert.strictEqual(run({ * update () {} }).ok, true)
  // validate sees a fully filled puzzle on the declared houses.
  let seen = null
  run({ * update () {}, validate: (inst, p) => { seen = [p.getCellsAreFilled([0, 1, 2]), p.getCellsCanHaveRepeats([0, 1, 2])]; return true } }, { houses: [[0, 1, 2]] })
  assert.deepStrictEqual(seen, [true, false])
}

// fixpointAll: several components run until none removes anything
{
  const mk = () => makePuzzle({ 0: 1, 1: 2 }, () => [1, 2, 3])
  // b only prunes once a has run: a needs a second pass of b to finish the job.
  const a = { * update (inst, p) { yield p.removeCandidateFromCell(3, 0) } }
  const b = { * update (inst, p) { if (!p.getCandidates(0).has(3)) yield p.removeCandidateFromCell(3, 1) } }
  const p = mk()
  fixpointAll([{ mod: b, inst: {} }, { mod: a, inst: {} }], p)
  assert.deepStrictEqual([...p._cand.get(1)], [1, 2], 'order does not matter: the pass repeats until nothing is removed')
  // One meaning of stopped: any component's stop() ends propagation for all.
  const q = mk()
  let laterRan = false
  const stops = { * update (inst, p) { yield p.stop('dead') } }
  const later = { * update () { laterRan = true } }
  fixpointAll([{ mod: stops, inst: {} }, { mod: later, inst: {} }], q)
  assert.strictEqual(q.stopMessage(), 'dead')
  assert.strictEqual(laterRan, false, 'a stopped branch propagates no further, mid-pass included')
  // A component that never settles: it removes one candidate per pass from a
  // board with more removals to make than the pass cap allows. Reaching the
  // cap is a failure to report, never a silent pass.
  const truth = Object.fromEntries(Array.from({ length: 40 }, (_, c) => [c, 1]))
  const slow = makePuzzle(truth, () => [1, 2])
  const drip = { * update (inst, p) { const c = [...p._cand.keys()].find(c => p._cand.get(c).has(2)); if (c !== undefined) yield p.removeCandidateFromCell(2, c) } }
  assert.throws(() => fixpointAll([{ mod: drip, inst: {} }], slow), /never settled/)
}

// makeWaker: update runs only when a watched cell changed since the last call
{
  const p = makePuzzle({ 0: 1, 1: 2, 2: 3 }, () => [1, 2, 3])
  let calls = 0
  // The load pass prunes a watched cell, so what the waker has seen must be the
  // state after update ran, or its own prune wakes it again.
  const mod = { * update () { calls++; if (calls === 1) p._cand.get(0).delete(2) } }
  const { wake, settle } = makeWaker(mod, {}, p, [0, 1])
  wake()
  assert.strictEqual(calls, 1, 'the first wake is the load pass')
  wake()
  assert.strictEqual(calls, 1, 'no watched cell changed: asleep')
  p._cand.get(2).delete(3)
  wake()
  assert.strictEqual(calls, 1, 'a cell nobody watches changed: still asleep')
  p._cand.get(1).delete(3)
  wake()
  assert.strictEqual(calls, 2, 'a watched cell lost a candidate: woken')
  // A backtrack restores candidates without waking anyone; settle takes that
  // state as already seen.
  p._cand.get(1).add(3)
  settle()
  wake()
  assert.strictEqual(calls, 2, 'settled on the restored state: asleep')
  p._cand.get(0).delete(3)
  wake()
  assert.strictEqual(calls, 3, 'a change after the restore wakes it')
}

// runUpdate: a change counts only when update yields it, as in the app
// The app's runPass applies each yielded change before it resumes the
// generator, and ends the drain on the first change that fails. A change a
// component builds and never yields does nothing there, so it fails here.
{
  const p = makePuzzle({ 0: 1, 1: 2 }, () => [1, 2, 3])
  const built = p.removeCandidateFromCell(3, 0)
  assert.deepStrictEqual([...p._cand.get(0)].sort(), [1, 2, 3], 'building a change edits nothing')
  p.applyChange(built)
  assert.deepStrictEqual([...p._cand.get(0)].sort(), [1, 2], 'applying it does')

  // Each yielded change is applied before update resumes.
  const q = makePuzzle({ 0: 1, 1: 2 }, () => [1, 2, 3])
  let sawAfterYield = null
  const reader = {
    * update (inst, p) {
      yield p.removeCandidateFromCell(3, 0)
      sawAfterYield = [...p.getCandidates(0)].sort()
    }
  }
  runUpdate(reader, {}, q)
  assert.deepStrictEqual(sawAfterYield, [1, 2], 'the yielded change is applied before update resumes')

  // A failed change (an emptied cell) ends the drain.
  const r = makePuzzle({ 0: 1, 1: 2 }, () => [1, 2])
  let resumed = false
  const emptier = { * update (inst, p) { yield p.removeCandidatesFromCell(DigitSet.from([1, 2]), 0); resumed = true; yield p.removeCandidateFromCell(1, 1) } }
  runUpdate(emptier, {}, r)
  assert.strictEqual(resumed, false, 'an emptied cell ends the drain')
  assert.deepStrictEqual([...r._cand.get(1)].sort(), [1, 2])

  // A hand-built Change of a type the builders never make is refused: the app
  // skips a type outside its enum, so it would prune nothing there.
  assert.throws(() => runUpdate({ * update () { yield { type: 'RemoveCandidate', value: 2, cells: [0] } } }, {}, makePuzzle({ 0: 1 }, () => [1, 2])),
    /unknown Change type "RemoveCandidate"/, 'a hand-built Change of an unknown type is refused')

  // A stop counts when it is yielded, not when it is built.
  const s = makePuzzle({ 0: 1 }, () => [1, 2])
  s.stop('built only')
  assert.strictEqual(s.stopMessage(), null, 'a stop built and not yielded stops nothing')
  runUpdate({ * update (inst, p) { yield p.stop('dead') } }, {}, s)
  assert.strictEqual(s.stopMessage(), 'dead')

  // The planted component: builds a removal and never yields it.
  const forgets = { * update (inst, p) { if (p.getCandidates(0).size > 1) p.removeCandidateFromCell(3, 0) }, validate: () => true }
  const NEVER_YIELDED = /built 1 change it never yielded/
  assert.throws(() => runUpdate(forgets, {}, makePuzzle({ 0: 1 }, () => [1, 2, 3])), NEVER_YIELDED)
  const { rnd } = makeRng(3)
  assert.throws(() => fuzzSoundness('forgets', {
    iters: 20,
    log: () => {},
    draw: () => ({ truth: { 0: 1, 1: 2 }, seed: makeSeeder(rnd, [1, 2, 3]), parts: [{ mod: forgets, inst: {} }] })
  }), NEVER_YIELDED, 'fuzzSoundness goes red on a change built and never yielded')
  const states = Array.from({ length: 10 }, () => new Map([[0, [1, 2, 3]], [1, [2, 3]]]))
  const apply = (mod, p) => runUpdate(mod, {}, p)
  const idle = { * update () {} }
  assert.throws(() => strengthSweep('forgets', { cur: forgets, ref: idle, apply, states }), NEVER_YIELDED,
    'strengthSweep goes red on a change built and never yielded')
  const waker = makeWaker(forgets, {}, makePuzzle({ 0: 1 }, () => [1, 2, 3]), [0])
  assert.throws(() => waker.wake(), NEVER_YIELDED, 'makeWaker goes red on a change built and never yielded')
}

// finishHarness: the exit status is the verdict
{
  const run = ok => execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { finishHarness } from ${JSON.stringify(new URL('./harness-lib.mjs', import.meta.url).href)}; finishHarness(${ok})`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  assert.strictEqual(run(true).trim(), 'PASS')
  assert.throws(() => run(false), e => e.status === 1 && e.stdout.trim() === 'FAIL')
}

console.log('harness-lib.test.mjs: all seams pass')
