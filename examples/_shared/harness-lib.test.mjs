// Focused tests of the harness-lib seams in isolation. Run:
//   node examples/_shared/harness-lib.test.mjs

import assert from 'assert'
import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  DigitSet, TIES_FLAG, installGlobals, makeIo, makeLine, makePuzzle, makePuzzleApi, makeRng, makeSeeder,
  patchSource, shuffle, strengthSweep, total
} from './harness-lib.mjs'

const { rnd } = makeRng()

// ---- bare: any length, digits in range, repeats possible (forced by pigeonhole) ----
{
  const line = makeLine(rnd, 'bare', 20, 3)
  assert.strictEqual(line.length, 20)
  for (const d of line) assert.ok(d >= 1 && d <= 3, `digit ${d} out of range 1..3`)
  const distinct = new Set(line)
  assert.ok(distinct.size < line.length, '20 draws from 3 digits must repeat')
}

// ---- bare: can be shorter than the digit count ----
{
  const line = makeLine(rnd, 'bare', 2, 9)
  assert.strictEqual(line.length, 2)
}

// ---- house: n distinct digits, n < digitCount ----
{
  const line = makeLine(rnd, 'house', 5, 9)
  assert.strictEqual(line.length, 5)
  assert.strictEqual(new Set(line).size, 5, 'a house never repeats a digit')
  for (const d of line) assert.ok(d >= 1 && d <= 9, `digit ${d} out of range 1..9`)
}

// ---- fullHouse: a permutation of every digit 1..D exactly once ----
{
  const line = makeLine(rnd, 'fullHouse', 9, 9)
  assert.strictEqual(line.length, 9)
  assert.deepStrictEqual([...line].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9])
}

// ---- makePuzzleApi: getCellsCanHaveRepeats answers from the declared houses ----
// The app's answer (docs/puzzle-api.md): false exactly when one house holds
// every queried cell. Declared, never inferred from the digits: a house whose
// seeded digits repeat still answers false. And the clue cell is no cell of
// the line's house, so a component that passes it into the query gets "may
// repeat" back -- its gate shuts, and the harness case that needs it open
// fails.
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

// ---- makePuzzle serves the same API over its own fixed map ----
{
  const p = makePuzzle({ 0: 1, 1: 1, 100: 2 }, (c, v) => [v], { houses: [[0, 1]] })
  assert.strictEqual(p.getCellsCanHaveRepeats([0, 1]), false)
  assert.strictEqual(p.getCellsCanHaveRepeats([100, 0, 1]), true)
  assert.strictEqual(makePuzzle({ 0: 1 }, (c, v) => [v]).getCellsCanHaveRepeats([0]), true)
}

// ---- makeSeeder: every seed keeps the true value, inside the digits ----
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

// ---- shuffle and total ----
{
  const { rnd } = makeRng(3)
  const a = [1, 2, 3, 4, 5, 6, 7, 8]
  assert.strictEqual(shuffle(rnd, a), a, 'shuffles in place')
  assert.deepStrictEqual([...a].sort(), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.strictEqual(total(makePuzzle({ 0: 1, 1: 2 }, c => (c ? [1, 2, 3] : [1]))), 4)
}

// ---- strengthSweep: the never-weaker contract ----
// A version that prunes as hard as the reference passes; one that keeps a
// candidate the reference removed fails; so does a sweep whose states nearly
// all die, which compared nothing.
{
  const dropThree = {
    * update (inst, p) { for (const c of inst.cells) if (p.getCandidates(c).size > 1) yield p.removeCandidateFromCell(3, c) }
  }
  const idle = { * update () {} }
  const apply = (mod, p) => { Array.from(mod.update({ cells: [0, 1] }, p)) }
  const states = n => Array.from({ length: n }, () => new Map([[0, [1, 2, 3]], [1, [2, 3]]]))
  const r = strengthSweep('same strength', { cur: dropThree, ref: dropThree, apply, states: states(10) })
  assert.deepStrictEqual(r, { drawn: 10, compared: 10, weaker: 0 })
  assert.throws(() => strengthSweep('weaker', { cur: idle, ref: dropThree, apply, states: states(10) }), /weaker/)
  const killer = { * update (inst, p) { p.removeCandidateFromCell(2, 1); p.removeCandidateFromCell(3, 1) } }
  assert.throws(() => strengthSweep('dead', { cur: dropThree, ref: killer, apply, states: states(10) }), /compared/)
  // states each built around a solution: a single death is a version emptying
  // a cell the solution needs, and fails however many states compared
  const killsOne = {
    * update (inst, p) { if (p.getCandidates(1).size === 2 && ++killsOne.calls === 3) { p.removeCandidateFromCell(2, 1); p.removeCandidateFromCell(3, 1) } },
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

// ---- patchSource: an edit by an anchor that must be there ----
{
  const src = 'const ALLOW_TIES = false\nfunction f () { return ALLOW_TIES }\n'
  assert.strictEqual(patchSource(src, TIES_FLAG, 'const ALLOW_TIES = true'), src.replace('false', 'true'))
  assert.throws(() => patchSource('function f () {}', TIES_FLAG, 'x'), /ALLOW_TIES/)
  assert.throws(() => patchSource('a\na\n', 'a\n', 'b\n'), /not unique/)
}

// ---- makeIo().load with a patch: the patched source, under the file's name ----
// The name is what V8 coverage attributes the run to, so a patched load still
// counts toward the component's own file.
{
  const dir = mkdtempSync(join(tmpdir(), 'load-'))
  writeFileSync(join(dir, 'comp.js'), 'const FLAG = false\nfunction reading () { return FLAG }\nfunction where () { return new Error().stack }\n')
  const { load } = makeIo(dir)
  assert.strictEqual(load('comp.js', ['reading']).reading(), false)
  const patched = load('comp.js', ['reading', 'where'], s => s.replace('= false', '= true'))
  assert.strictEqual(patched.reading(), true)
  assert.match(patched.where(), /comp\.js/)
}

// ---- makeIo().loadSource: eval source a caller already holds and edited ----
// A harness runs one component twice with a flag at the top of the file
// flipped, which means evaluating edited source rather than a file on disk.
{
  const { loadSource } = makeIo(dirname(fileURLToPath(import.meta.url)))
  const src = 'const FLAG = false\nfunction reading () { return FLAG }'
  assert.strictEqual(loadSource(src, ['reading']).reading(), false)
  assert.strictEqual(loadSource(src.replace('= false', '= true'), ['reading']).reading(), true)
}

// ---- makePuzzle: getValue answers undefined on an unsolved cell ----
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

// ---- makePuzzle: the whole-grid calls a region-building component makes ----
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

  p.removeCandidateFromCells(2, [0, 1])
  assert.deepStrictEqual([...p.getCandidates(0)].sort(), [1, 3])
  assert.deepStrictEqual([...p.getCandidates(2)].sort(), [1, 2, 3])

  p.filterCandidatesInCells(DigitSet.from([3]), [2])
  assert.deepStrictEqual([...p.getCandidates(2)], [3])

  // stop says the branch has no solution; the mock records it where
  // fixpoint and the strength compare look for it.
  p.stop('no room')
  assert.strictEqual(p._stopped, 'no room')
}

// ---- installGlobals: the naming helper a component calls for a message ----
installGlobals(1, 9)
assert.strictEqual(typeof globalThis.helpers.naming.getCageName('region', [0, 1]), 'string')

// ---- makeIo().loadAt assembles an #include as of the commit ----
// `read` splices includes from the working tree; `loadAt` splices them from the
// tree at the commit, so a pinned component that carries a directive still
// loads as it shipped -- even after the included file has since changed.
{
  const repo = mkdtempSync(join(tmpdir(), 'loadat-'))
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  const commit = msg => git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-am', msg])
  mkdirSync(join(repo, 'ex'))
  mkdirSync(join(repo, '_shared'))
  writeFileSync(join(repo, 'ex', 'comp.js'), '// #include ../_shared/seg.js\nfunction f () { return seg() }\n')
  writeFileSync(join(repo, '_shared', 'seg.js'), 'function seg () { return 2 }\n')
  git(['init', '-q'])
  git(['add', '-A'])
  commit('init')
  const first = git(['rev-parse', 'HEAD']).trim()
  writeFileSync(join(repo, '_shared', 'seg.js'), 'function seg () { return 3 }\n')
  commit('change seg')
  writeFileSync(join(repo, '_shared', 'seg.js'), 'function seg () { return 4 }\n') // uncommitted
  const { loadAt, load } = makeIo(join(repo, 'ex'))
  assert.strictEqual(loadAt(first, 'comp.js', ['f']).f(), 2, 'the include is read as of the commit')
  assert.strictEqual(loadAt('HEAD', 'comp.js', ['f']).f(), 3, 'not from the working tree')
  assert.strictEqual(load('comp.js', ['f']).f(), 4, 'while `load` reads the working tree')
  // an include the commit does not carry stops the load
  writeFileSync(join(repo, 'ex', 'bad.js'), '// #include nope.js\n')
  git(['add', '-A'])
  commit('bad')
  assert.throws(() => loadAt('HEAD', 'bad.js', ['f']), /nope\.js/)
  // a dotted base directory (house-gac loads through `ex/../_shared`) still works
  assert.strictEqual(makeIo(join(repo, 'ex', '..', '_shared')).loadAt(first, 'seg.js', ['seg']).seg(), 2)
}

// ---- the change builders take a DigitSet or a raw bitmask, and nothing else ----
// Why either is fine, and why an array is not: see `maskOf` in harness-lib.mjs.
{
  const p = makePuzzle({ 0: 1, 1: 1 }, () => [1, 2, 3])

  p.removeCandidatesFromCell(1 << 2, 0)
  assert.deepStrictEqual([...p.getCandidates(0)].sort(), [1, 3], 'a raw mask removes its digits')
  p.removeCandidatesFromCell(DigitSet.from([3]), 0)
  assert.deepStrictEqual([...p.getCandidates(0)], [1], 'a DigitSet still works')

  for (const bad of [[2], '4', undefined, null, 1.5, {}]) {
    assert.throws(() => p.removeCandidatesFromCell(bad, 1), /removeCandidatesFromCell/,
      `removeCandidatesFromCell must refuse ${JSON.stringify(bad) ?? String(bad)}`)
  }
  assert.deepStrictEqual([...p.getCandidates(1)].sort(), [1, 2, 3], 'a refused call changes nothing')
}

// ---- a complement mask is a mask: the app ANDs it, so the mock takes it ----
// `~used` is the natural raw form of "keep everything but these", and it is
// negative. Refusing it would make the mock stricter than the app it stands in
// for, and send an author back to allocating a set.
{
  const p = makePuzzle({ 0: 1 }, () => [1, 2, 3])
  p.filterCandidatesInCell(~(1 << 2), 0)
  assert.deepStrictEqual([...p.getCandidates(0)].sort(), [1, 3], 'keep everything but digit 2')
  p.removeCandidatesFromCell(~(1 << 1), 0)
  assert.deepStrictEqual([...p.getCandidates(0)], [1], 'drop everything but digit 1')
}

// ---- every plural and singular form follows the one rule ----
// Mask first, cells second, the bundle's argument order.
{
  const p = makePuzzle({ 0: 1, 1: 1, 2: 1, 3: 1 }, () => [1, 2, 3])

  p.removeCandidatesFromCells((1 << 2) | (1 << 3), [0, 1])
  assert.deepStrictEqual([...p.getCandidates(0)], [1], 'a raw mask clears both digits')
  assert.deepStrictEqual([...p.getCandidates(1)], [1])
  assert.deepStrictEqual([...p.getCandidates(2)].sort(), [1, 2, 3], 'an unlisted cell is untouched')
  p.removeCandidatesFromCells(DigitSet.from([1]), [2])
  assert.deepStrictEqual([...p.getCandidates(2)].sort(), [2, 3], 'and a DigitSet, as every caller passes today')

  p.filterCandidatesInCell(DigitSet.from([2, 3]), 3)
  assert.deepStrictEqual([...p.getCandidates(3)].sort(), [2, 3], 'the filter keeps only its digits')
  // A filter that removes nothing leaves the cell whole (the app answers such
  // a call with UnchangedResult): the mask covers both candidates and a digit
  // the cell never had.
  p.filterCandidatesInCell((1 << 2) | (1 << 3) | (1 << 5), 3)
  assert.deepStrictEqual([...p.getCandidates(3)].sort(), [2, 3], 'a filter that removes nothing is a no-op')
  p.filterCandidatesInCells(1 << 3, [2, 3])
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

console.log('harness-lib.test.mjs: all seams pass')

// ---- DigitSet: a set reads as its mask, as the app's SmallNumberSet does ----
// `new SudokuDigitSet(someSet)` coerces its argument through `+`, so without
// `valueOf` it is NaN and the copy is empty (#563).
{
  const copy = new DigitSet(DigitSet.from([1, 2, 3]))
  assert.deepStrictEqual([...copy], [1, 2, 3])
  assert.strictEqual(+DigitSet.from([1, 2, 3]), 0b1110)
}

// ---- DigitSet: every member agrees with a JS Set on the same digits ----
// The oracle is Set arithmetic, not mask arithmetic, so a flipped `&`/`|` or a
// dropped `~` in the mock turns a row red (#563).
{
  const A = [1, 2, 3, 5]
  const B = [3, 5, 8]
  const mk = ds => DigitSet.from(ds)
  const sorted = s => [...s].sort((x, y) => x - y)
  const inter = A.filter(d => B.includes(d))
  const cases = [
    ['union', sorted(new Set([...A, ...B])), s => s.union(mk(B))],
    ['intersect', inter, s => s.intersect(mk(B))],
    ['xor', [1, 2, 8], s => s.xor(mk(B))],
    ['subtract', [1, 2], s => s.subtract(mk(B))],
    ['add', [1, 2, 3, 5, 9], s => { s.add(9); return s }],
    ['delete', [1, 2, 5], s => { s.delete(3); return s }],
    ['clear', [], s => { s.clear(); return s }],
    ['getUnion', sorted(new Set([...A, ...B])), () => DigitSet.getUnion([mk(A), mk(B)])],
    ['getIntersection', inter, () => DigitSet.getIntersection([mk(A), mk(B)])]
  ]
  for (const [name, want, run] of cases) {
    assert.deepStrictEqual([...run(mk(A))], want, name)
  }
  assert.ok(mk([2, 3]).isSubsetOf(mk(A)) && !mk(B).isSubsetOf(mk(A)))
  assert.ok(mk(A).isSupersetOf(mk([2, 3])) && !mk(A).isSupersetOf(mk(B)))
  assert.ok(mk([1, 2]).isDisjointFrom(mk([8])) && !mk(A).isDisjointFrom(mk(B)))
  assert.ok(mk(A).intersects(mk(B)) && !mk([1]).intersects(mk([2])))
  assert.ok(mk(A).equals(mk([5, 3, 2, 1])) && !mk(A).equals(mk(B)))
  assert.strictEqual(mk(A).size, 4)
  assert.strictEqual(mk(A).getSmallestNumber(), 1)
  assert.strictEqual(mk(A).getLargestNumber(), 5)
  assert.strictEqual(mk(A).getSmallestDigit(), 1)
  assert.strictEqual(mk(A).getLargestDigit(), 5)
  // An empty set has no smallest or largest, as in the bundle.
  assert.strictEqual(mk([]).getSmallestNumber(), undefined)
  assert.strictEqual(mk([]).getLargestDigit(), undefined)
  // Intersecting nothing keeps every digit up to bit 30.
  assert.strictEqual(+DigitSet.getIntersection([]), 2147483647)
}
