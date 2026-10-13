// Parity test: the mocks harness-lib.mjs exports against the real bundle types
// they stand in for. One script of operations runs on each mock and its real
// counterpart and the results must agree. A mock method that is missing or
// drifts fails here, not as a false component disagreement (#563: a DigitSet
// mock without `valueOf` made `new SudokuDigitSet(set)` NaN).
//
// Covered: DigitSet (real SudokuDigitSet), installGlobals' helpers.digits and
// helpers.naming (real createHelpers(spec).digits / .naming), and the read
// methods of makePuzzleApi (real SolverPuzzleView over a real SolverState).
// Skipped, with the reason:
//   - makePuzzleApi's removeCandidate(s)From* / filterCandidatesIn* writes: the
//     real view's writes return a change object to yield, the mock's edit the
//     candidates in place, so there is no like-for-like result to compare.
//   - makePuzzleApi's getCellsCanHaveRepeats: the real answer comes from the
//     board's regions, the mock's from the houses a test declares.
//   - makePuzzle's stop() and getCellsOrthogonallyAdjacentToCell: harness-only
//     conveniences (the real stop is a change; adjacency needs the geometry).
// Run: node examples/_shared/harness-parity.test.mjs

import assert from 'assert'
import { loadBundle } from './bundle-load.mjs'
import { DigitSet, installGlobals, makePuzzleApi } from './harness-lib.mjs'

const { exposed: bundle } = loadBundle({
  expose: ['createHelpers', 'SudokuDigitSet', 'setPuzzleSpec', 'SolverState', 'SolverPuzzleView']
})
const Real = bundle.SudokuDigitSet
const spec = { size: { width: 9, height: 9 }, minDigit: 1, maxDigit: 9, type: 'sudoku' }

// What an operation returns, in a form both classes share: a set becomes its
// mask, an iterator its array.
const plain = v => {
  if (v instanceof Real || v instanceof DigitSet) return { set: +v }
  if (v && typeof v[Symbol.iterator] === 'function' && typeof v !== 'string') return [...v]
  return v
}

// Every way a set is built: nothing, a mask, a set of its own class (the #563
// case), a set of the other class, and `from` over an array and over a set.
const constructions = {
  'new C()': C => new C(),
  'new C(mask)': C => new C(0b1010100),
  'new C(set)': C => new C(C.from([1, 4, 9])),
  'new C(other-set-class)': C => new C(C === Real ? DigitSet.from([2, 3]) : Real.from([2, 3])),
  'C.from(array)': C => C.from([3, 5, 7]),
  'C.from(set)': C => C.from(C === Real ? DigitSet.from([2, 6]) : Real.from([2, 6]))
}

// Each script step takes (a, b, C) — two fresh sets over the same class — and
// returns what to compare.
const first = [0, 1, 2, 5, 9]
const second = [2, 5, 7]
const ops = {
  size: (a) => a.size,
  has: (a) => [0, 1, 2, 3, 9].map(d => a.has(d)),
  valueOf: (a) => a.valueOf(),
  'unary +': (a) => +a,
  iterator: (a) => [...a],
  smallestNumber: (a) => a.getSmallestNumber(),
  largestNumber: (a) => a.getLargestNumber(),
  smallestDigit: (a) => a.getSmallestDigit(),
  largestDigit: (a) => a.getLargestDigit(),
  'smallest of empty': (a, b, C) => new C().getSmallestNumber(),
  'largest of empty': (a, b, C) => new C().getLargestNumber(),
  add: (a) => { a.add(3); return a },
  delete: (a) => { a.delete(2); return a },
  clear: (a) => { a.clear(); return a },
  union: (a, b) => a.union(b),
  intersect: (a, b) => a.intersect(b),
  xor: (a, b) => a.xor(b),
  subtract: (a, b) => a.subtract(b),
  'union returns this': (a, b) => a.union(b) === a,
  equals: (a, b) => [a.equals(b), a.equals(a), a.equals(new a.constructor(+a))],
  isSubsetOf: (a, b) => [a.isSubsetOf(b), b.isSubsetOf(a), new a.constructor(2).isSubsetOf(a)],
  isSupersetOf: (a, b) => [a.isSupersetOf(b), a.isSupersetOf(new a.constructor(2))],
  isDisjointFrom: (a, b) => [a.isDisjointFrom(b), a.isDisjointFrom(new a.constructor(1 << 8))],
  intersects: (a, b) => [a.intersects(b), a.intersects(new a.constructor(1 << 8))],
  'union with a mask': (a) => a.union(0b11000),
  'subtract a mask': (a) => a.subtract(0b110),
  getUnion: (a, b, C) => C.getUnion([a, b, C.from([8])]),
  'getUnion of none': (a, b, C) => C.getUnion([]),
  getIntersection: (a, b, C) => C.getIntersection([a, b]),
  'getIntersection of none': (a, b, C) => +C.getIntersection([]),
  'mutator reads an argument set': (a, b) => { a.union(new a.constructor(+b)); return a }
}

// Every method that takes another set, run with each kind of argument the app
// accepts: a set of the same class, a set of the other class, a raw mask.
const binary = ['union', 'intersect', 'xor', 'subtract', 'equals', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom', 'intersects']
const argKinds = {
  'same-class set': (C) => C.from(second),
  'other-class set': (C) => (C === Real ? DigitSet : Real).from(second),
  mask: () => 0b10100100,
  'own mask': (C) => +C.from(first),
  'superset mask': () => 0b1111111111,
  'empty mask': () => 0
}
for (const m of binary) {
  for (const [kind, arg] of Object.entries(argKinds)) {
    ops[`${m} with ${kind}`] = (a, b, C) => { const r = a[m](arg(C)); return r === a ? { set: +a } : r }
  }
}

for (const [label, make] of Object.entries(constructions)) {
  const mock = plain(make(DigitSet))
  const real = plain(make(Real))
  assert.deepStrictEqual(mock, real, `construction ${label}: mock ${JSON.stringify(mock)} vs real ${JSON.stringify(real)}`)
}

for (const [label, op] of Object.entries(ops)) {
  const run = C => plain(op(C.from(first), C.from(second), C))
  const mock = run(DigitSet)
  const real = run(Real)
  assert.deepStrictEqual(mock, real, `${label}: mock ${JSON.stringify(mock)} vs real ${JSON.stringify(real)}`)
}

// The mock must answer every public member the real class defines, so a method
// the script above does not name still cannot be silently missing.
{
  const members = C => Object.getOwnPropertyNames(C.prototype).filter(n => n !== 'constructor')
  const statics = C => Object.getOwnPropertyNames(C).filter(n => !['length', 'name', 'prototype'].includes(n))
  // Every class up the chain, so a base class the bundle adds is not skipped.
  const chain = []
  for (let C = Real; C && C !== Function.prototype; C = Object.getPrototypeOf(C)) chain.push(C)
  const realMembers = new Set(chain.flatMap(members))
  const realStatics = new Set(chain.flatMap(statics))
  const mockMembers = new Set(members(DigitSet))
  for (const m of realMembers) assert.ok(mockMembers.has(m), `DigitSet mock lacks member ${m}`)
  for (const s of realStatics) assert.ok(statics(DigitSet).includes(s), `DigitSet mock lacks static ${s}`)
  assert.strictEqual(typeof DigitSet.prototype[Symbol.iterator], 'function')
}

// The puzzle API's reads, on a real SolverPuzzleView over a real SolverState
// whose cells hold the same candidates as the mock's sets. `value` follows
// candidates the way the app keeps it: set exactly when one candidate is left.
{
  const states = [
    { 0: [1, 2, 3], 1: [5], 2: [1, 2, 3, 4, 5, 6, 7, 8, 9], 3: [9], 4: [4, 8] },
    { 0: [7], 1: [7], 2: [3, 4], 3: [1, 9], 4: [5] },
    { 0: [1, 2, 3, 4, 5, 6, 7, 8, 9], 1: [2], 2: [2, 6], 3: [8], 4: [3] }
  ]
  const pspec = { ...spec }
  bundle.setPuzzleSpec(pspec)
  for (const [i, sets] of states.entries()) {
    const cells = Object.keys(sets).map(Number)
    const state = bundle.SolverState.create()
    const live = new Map()
    for (const c of cells) {
      live.set(c, new Set(sets[c]))
      state.cells[c].candidates = +Real.from(sets[c])
      state.cells[c].value = sets[c].length === 1 ? sets[c][0] : undefined
    }
    const view = new bundle.SolverPuzzleView({}, pspec, state, bundle.createHelpers(pspec))
    const mock = makePuzzleApi(c => live.get(c))
    const reads = {
      hasValue: api => cells.map(c => api.hasValue(c)),
      getValue: api => cells.map(c => api.getValue(c)),
      getCandidates: api => cells.map(c => plain(api.getCandidates(c))),
      'getCandidates is fresh': api => cells.map(c => { const x = api.getCandidates(c); return x !== api.getCandidates(c) }),
      getCandidatesBitMask: api => cells.map(c => api.getCandidatesBitMask(c)),
      getCellsAreFilled: api => [api.getCellsAreFilled(cells), api.getCellsAreFilled([1, 3]), api.getCellsAreFilled([]), api.getCellsAreFilled([0, 1])]
    }
    for (const [label, read] of Object.entries(reads)) {
      assert.deepStrictEqual(read(mock), read(view), `puzzle API ${label}, state ${i}`)
    }
  }
}

// installGlobals: the globals a component reads at update time.
{
  const real = bundle.createHelpers(spec)
  installGlobals(spec.minDigit, spec.maxDigit)
  const h = globalThis.helpers
  assert.strictEqual(h.digits.minDigit, real.digits.minDigit)
  assert.strictEqual(h.digits.maxDigit, real.digits.maxDigit)
  for (const cell of [0, 8, 12, 40, 80]) {
    assert.strictEqual(h.naming.getCellName(cell), real.naming.getCellName(cell), `getCellName(${cell})`)
  }
  // A cage is named after its smallest cell id whatever the order.
  for (const cells of [[3, 1, 20], [20, 3, 1], [7], [10, 9]]) {
    assert.strictEqual(h.naming.getCageName('cage', cells), real.naming.getCageName('cage', cells), `getCageName(${cells})`)
  }
  assert.strictEqual(globalThis.SudokuDigitSet, DigitSet)
  assert.deepStrictEqual(plain(globalThis.SudokuDigitSet.from([1, 2])), plain(Real.from([1, 2])))
}

console.log('harness-parity: ok')
