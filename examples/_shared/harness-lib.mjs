// Shared scaffold for the fuzz harnesses. A soundness harness checks that a
// component never removes a cell's TRUE value; an update-strength test checks
// the other direction, that it never prunes LESS than a pinned earlier version.
// Each example supplies its own seeding and test cases; the parts every harness
// copies live here.
//
// A component reads two globals at update time: SudokuDigitSet.from(array) and
// helpers.digits.{minDigit,maxDigit}. Call installGlobals once before running.

import assert from 'assert'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { Script } from 'vm'
import { assembleSource, firstInclude } from './include.mjs'

// The app's DigitSet, as read from its bundle (docs/puzzle-api.md): a bitmask
// where bit d is digit d. The algebra methods MUTATE and return this.
export class DigitSet {
  constructor (mask = 0) { this.mask = +mask }
  static from (digits) { let m = 0; for (const d of digits) m |= 1 << d; return new this(m) }
  get size () { let n = 0; for (let m = this.mask; m; m &= m - 1) n++; return n }
  has (d) { return (this.mask & (1 << d)) !== 0 }
  // Copied from the bundle's SudokuDigitSet and its SmallNumberSet base
  // (bundle.claude.js:541-626): every member, each reading its argument through `valueOf` as the app does. A
  // member left out fails silently, not loudly -- `new SudokuDigitSet(set)`
  // without `valueOf` is an empty set (#563). `getUnion` returns a fresh set.
  add (n) { this.mask |= 1 << n }
  delete (n) { this.mask &= ~(1 << n) }
  clear () { this.mask = 0 }
  union (other) { this.mask |= other.valueOf(); return this }
  intersect (other) { this.mask &= other.valueOf(); return this }
  xor (other) { this.mask ^= other.valueOf(); return this }
  subtract (other) { this.mask &= ~other.valueOf(); return this }
  equals (other) { return this.mask === +other }
  isSubsetOf (other) { return (this.mask & other.valueOf()) === this.mask }
  isSupersetOf (other) { const m = other.valueOf(); return (this.mask & m) === m }
  isDisjointFrom (other) { return (this.mask & other.valueOf()) === 0 }
  intersects (other) { return (this.mask & other.valueOf()) !== 0 }
  valueOf () { return this.mask }
  getSmallestNumber () { if (this.mask !== 0) return 31 - Math.clz32(this.mask & -this.mask) }
  getLargestNumber () { if (this.mask !== 0) return 31 - Math.clz32(this.mask) }
  // The subclass SudokuDigitSet's two members (bundle.claude.js:619-626).
  getSmallestDigit () { return this.getSmallestNumber() }
  getLargestDigit () { return this.getLargestNumber() }
  static getUnion (sets) { const u = new this(); for (const s of sets) u.union(s); return u }
  static getIntersection (sets) { const i = new this(2147483647); for (const s of sets) i.intersect(s); return i }
  * [Symbol.iterator] () { for (let m = this.mask; m; m &= m - 1) yield 31 - Math.clz32(m & -m) }
}

// A cell's `R#C#` label as the app builds it on a 9-wide board. A harness line
// is cells 0..n-1 whatever the example's size, so on every size it names the
// line's cells R1C1..R1Cn: enough for a message to name the right cell.
const getCellName = cell => `R${Math.floor(cell / 9) + 1}C${(cell % 9) + 1}`

// Set the globals a component reads. minDigit/maxDigit differ per example
// (Hit Counts allows a 0 clue, Running Start does not). The naming helpers
// only build message strings, but they build them the way the app does: a
// cage is named after its SMALLEST cell id, not its first
// (docs/research/bundle-api-reference.md, `getCageName`), so a component that
// names the wrong cell reads wrong here too.
export function installGlobals (minDigit, maxDigit) {
  globalThis.SudokuDigitSet = DigitSet
  globalThis.helpers = {
    digits: { minDigit, maxDigit },
    naming: {
      getCageName: (name, cells) => `the ${name} at ${getCellName(Math.min(...cells))}`,
      getCellName
    }
  }
}

// Bind file reads to the example's own directory. `read` returns a file's text
// with its `// #include` directives spliced in (include.mjs), so a probe runs
// the same assembled paste target the link ships;
// `load` evals a component file and returns the named functions from it,
// after `patch(source)` when one is given -- the file keeps its own name
// either way, so V8 coverage (c8) still attributes the run to it;
// `loadSource` does the same for source a caller already holds, which is how a
// harness runs one component twice with a flag at the top of the file flipped;
// `loadAt` does the same for the file as it stood at a git commit, which is how
// a strength test holds a component to the floor it set.
export function makeIo (here) {
  const read = f => assembleSource(join(here, f))
  // vm.Script instead of eval so V8 coverage (c8) attributes the component's
  // execution to its own file, not to this harness.
  const evalNamed = (src, names, filename = 'loadSource.js') =>
    new Script('(function(){' + src + '\n return {' + names.join(',') + '};})()', { filename }).runInThisContext()
  const load = (file, names, patch = src => src) => evalNamed(patch(read(file)), names, join(here, file))
  const git = args => execFileSync('git', args, { cwd: here, encoding: 'utf8' })
  const loadAt = (commit, file, names) => {
    const src = git(['show', `${commit}:${git(['rev-parse', '--show-prefix']).trim()}${file}`])
    // `read` assembles includes; this reader holds text from a commit and has
    // no directory to resolve one against. Refuse rather than eval the
    // directive as a comment and fail later with `frameLines is not defined`.
    const inc = firstInclude(src)
    if (inc !== null) {
      throw new Error(`loadAt cannot resolve an #include at a commit: ${file}@${commit} carries ${JSON.stringify(inc.trim())}`)
    }
    return evalNamed(src, names, `${join(here, file)}@${commit}`)
  }
  return { read, load, loadAt, loadSource: evalNamed }
}

// Edit component source at an anchor that has to be there exactly once: a
// string, or a RegExp. The app pastes each file as its own segment, so a flag
// is a source edit, not a parameter, and a harness makes the same edit. An
// anchor that moved would otherwise patch nothing, silently, and the harness
// would test the component against itself.
export function patchSource (src, anchor, replacement) {
  const hits = typeof anchor === 'string'
    ? src.split(anchor).length - 1
    : (src.match(new RegExp(anchor.source, anchor.flags.replace('g', '') + 'g')) || []).length
  if (hits === 0) throw new Error(`patchSource: no ${anchor} in the source`)
  if (hits > 1) throw new Error(`patchSource: ${anchor} is not unique in the source`)
  return src.replace(anchor, replacement)
}

// The tie flag a line component carries at the top of its file
// (docs/line-contract.md); patch it to run the component under either reading.
export const TIES_FLAG = /^const ALLOW_TIES = (?:true|false)$/m

// A random candidate set over lo..hi: pinned, the full range, or a random
// subset. With `keep` given, that digit is in every set, so the state still
// allows a known solution — a component whose rules only bite on consistent
// states needs that. Pinned cells are what makes a rule fire, so the mix of
// pinned and open cells matters more than the exact rates.
export function randomCandidates (rnd, lo, hi, keep = null) {
  const draw = () => lo + ((rnd() * (hi - lo + 1)) | 0)
  const r = rnd()
  if (r < 0.35) return [keep === null ? draw() : keep]
  const s = new Set(keep === null ? [] : [keep])
  if (r < 0.55) { for (let d = lo; d <= hi; d++) s.add(d) } else { for (let d = lo; d <= hi; d++) if (rnd() < 0.5) s.add(d) }
  if (s.size === 0) s.add(draw())
  return [...s]
}

// A seed function for makePuzzle over `digits`: each call draws a mode --
// 'pin' (the true value alone), 'full' (every digit), or 'subset' (the true
// value plus each digit at even odds) -- uniformly from `modes`. The even
// three-way mix is the distribution the examples' soundness pools were tuned
// on; repeat a mode in `modes` to weight it.
export function makeSeeder (rnd, digits, modes = ['pin', 'full', 'subset']) {
  return (c, v) => {
    const mode = modes[(rnd() * modes.length) | 0]
    if (mode === 'pin') return [v]
    if (mode === 'full') return [...digits]
    const s = new Set([v])
    for (const d of digits) if (rnd() < 0.5) s.add(d)
    return [...s]
  }
}

// Fisher-Yates, in place, off the harness's own RNG.
export function shuffle (rnd, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// The candidates left on a mock puzzle, summed over its cells.
export const total = p => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }

// Run one starting state (cell -> candidate array) through two versions of a
// component and report the candidates `cur` keeps that `ref` removed — the
// cells where `cur` prunes less. `apply` sets a version's params and runs it.
// Returns null for a dead state (some cell emptied by either side): that state
// has no solution, so "weaker" means nothing there. `opts` is passed to
// `makePuzzle`: a gated component only prunes on a state whose declared houses
// open its gate, so compare it on one (docs/line-contract.md). `params` is
// handed to `apply` as its third argument.
export function compareStrength (cur, ref, apply, start, opts = {}, params) {
  const cells = {}; for (const c of start.keys()) cells[c] = 0
  const seed = c => start.get(c)
  const pCur = makePuzzle(cells, seed, opts); apply(cur, pCur, params)
  const pRef = makePuzzle(cells, seed, opts); apply(ref, pRef, params)
  // A stop() is the same dead-state signal as an emptied cell (older pinned
  // versions empty a cell where current code stops).
  if (pCur._stopped !== null || pRef._stopped !== null) return null
  if ([...pCur._cand.values(), ...pRef._cand.values()].some(s => s.size === 0)) return null
  const weaker = []
  for (const c of start.keys()) {
    for (const d of pCur._cand.get(c)) if (!pRef._cand.get(c).has(d)) weaker.push({ cell: c, digit: d })
  }
  return weaker
}

// The share of drawn states a strength sweep must get to compare. A state
// either version empties has no solution, so it compares nothing; a sweep
// whose states mostly die has proved little, whatever its weaker count.
const MIN_COMPARED = 0.25

// The never-weaker contract (docs/example-layout.md, update-strength): over
// every state in `states` -- an iterable, or a generator function to call --
// `cur` keeps no candidate `ref` removed. A state is a
// start map (cell -> candidate array), or `{ start, params }` when `apply`
// needs something per state. Logs one summary line under `label`, throws on a
// weaker cell or on too few states compared, and returns the counts.
//
// `solvable`: every state is built around a real solution, so none may die --
// a death is a version emptying a cell the solution needs, and the sweep
// throws on the first, not at MIN_COMPARED.
export function strengthSweep (label, { cur, ref, apply, states, opts = {}, solvable = false }) {
  let drawn = 0
  let compared = 0
  let weaker = 0
  for (const state of (typeof states === 'function' ? states() : states)) {
    const { start, params } = state instanceof Map ? { start: state } : state
    drawn++
    const w = compareStrength(cur, ref, apply, start, opts, params)
    if (w === null) continue
    compared++
    weaker += w.length
    if (w.length > 0 && weaker <= 5) console.log(label, 'weaker at', w[0], 'start', [...start])
  }
  console.log(`${label}:`, compared, 'of', drawn, 'states compared,', weaker, 'weaker cells')
  if (solvable) assert.strictEqual(compared, drawn, `${label}: ${drawn - compared} states built around a solution died`)
  assert.ok(compared >= drawn * MIN_COMPARED, `${label}: ${compared} of ${drawn} states compared; the rest died`)
  assert.strictEqual(weaker, 0, `${label}: ${weaker} weaker cells`)
  return { drawn, compared, weaker }
}

// Deterministic RNG. `rnd` returns a float in [0,1); `pick` chooses from an array.
export function makeRng (seed = 12345) {
  let rng = seed
  const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff }
  const pick = arr => arr[(rnd() * arr.length) | 0]
  return { rnd, pick }
}

// A line of digits for a soundness fuzz pool, per docs/line-contract.md's
// three line kinds. The example's own clue function derives the truth clue
// from the returned digits; this only builds the line.
//   bare     — `n` random digits from 1..D, any length, may repeat.
//   house    — `n` distinct digits from 1..D, in random order (`n` must be <= D).
//   fullHouse — every digit 1..D exactly once, in random order (`n` is unused).
export function makeLine (rnd, kind, n, D) {
  const all = []; for (let d = 1; d <= D; d++) all.push(d)
  if (kind === 'fullHouse') return shuffle(rnd, all)
  if (kind === 'house') {
    if (n >= D) throw new RangeError(`a house needs n < D (n=${n}, D=${D})`)
    return shuffle(rnd, all).slice(0, n)
  }
  if (kind === 'bare') {
    const line = []; for (let i = 0; i < n; i++) line.push(1 + ((rnd() * D) | 0))
    return line
  }
  throw new RangeError(`unknown line kind: ${kind}`)
}

// The digit argument of a change builder, as a bitmask. The app stores it raw
// and only ever uses it under `&` (docs/research/bundle-api-reference.md, the
// six change builders), so a DigitSet and a plain integer both work there --
// a negative one included, since `~used` is how "everything but these" is
// written without allocating a set. An array does not work: its `valueOf` is
// not a number, so the `&` gives 0 and the change silently removes nothing
// (a rule went dead that way). That is the hazard this check exists to catch.
function maskOf (s, caller) {
  if (s instanceof DigitSet) return s.mask
  if (Number.isInteger(s)) return s
  throw new TypeError(`${caller} wants a DigitSet or a bitmask integer, got ${typeof s}`)
}

// The puzzle API a component calls, over cell -> Set<digit> read live through
// `getSet`, so it serves a fixed map (makePuzzle) and a map a search reassigns
// wholesale (recovery-lib's makeCandidateState) alike.
//
// `houses` are the cell groups the board declares all-different. They answer
// `getCellsCanHaveRepeats` for a query of distinct cells, the only kind a line
// component makes: false exactly when one house holds every one of them. The
// app's own answer is pairwise -- every two cells see each other -- and true
// for a list that repeats a cell id (docs/research/bundle-api-reference.md);
// a query that needs either difference needs more than this mock. Declared, never inferred from the
// digits seeded, so a test cannot pass by accident (docs/line-contract.md) --
// and a clue cell is in no house with its line, so a component that passes it
// into the query reads "may repeat" and stands its gate down. No houses: every
// line is bare.
export function makePuzzleApi (getSet, { houses = [] } = {}) {
  const houseSets = houses.map(h => new Set(h))
  // The mask arithmetic every change builder below shares: drop the masked
  // digits from a cell, or keep only them. Iterating a copy leaves the live
  // set free to shrink underneath.
  const dropMask = (m, c) => { const set = getSet(c); for (const d of [...set]) if (m & (1 << d)) set.delete(d) }
  const keepMask = (m, c) => { const set = getSet(c); for (const d of [...set]) if (!(m & (1 << d))) set.delete(d) }
  return {
    hasValue: c => getSet(c).size === 1,
    // The solved digit, undefined while the cell is open (docs/puzzle-api.md).
    getValue: c => (getSet(c).size === 1 ? [...getSet(c)][0] : undefined),
    // A fresh DigitSet per call, as in the app -- mutating it is safe.
    getCandidates: c => DigitSet.from(getSet(c)),
    getCandidatesBitMask: c => { let m = 0; for (const d of getSet(c)) m |= 1 << d; return m },
    getCellsAreFilled: cs => cs.every(c => getSet(c).size === 1),
    getCellsCanHaveRepeats: cs => !houseSets.some(h => cs.every(c => h.has(c))),
    removeCandidateFromCell: (d, c) => { getSet(c).delete(d) },
    removeCandidatesFromCell: (s, c) => dropMask(maskOf(s, 'removeCandidatesFromCell'), c),
    removeCandidatesFromCells: (s, cs) => { const m = maskOf(s, 'removeCandidatesFromCells'); for (const c of cs) dropMask(m, c) },
    removeCandidateFromCells: (d, cs) => { for (const c of cs) getSet(c).delete(d) },
    filterCandidatesInCell: (s, c) => keepMask(maskOf(s, 'filterCandidatesInCell'), c),
    filterCandidatesInCells: (s, cs) => { const m = maskOf(s, 'filterCandidatesInCells'); for (const c of cs) keepMask(m, c) }
  }
}

// A mock puzzle over a truth map (cell -> true value). Each cell starts with a
// candidate set that always contains its true value. `seed(cell, value)` returns
// the starting candidate array; `houses` is makePuzzleApi's.
export function makePuzzle (truth, seed, { houses = [] } = {}) {
  const cand = new Map()
  for (const [c, v] of Object.entries(truth)) cand.set(+c, new Set(seed(+c, v)))
  const p = {
    ...makePuzzleApi(c => cand.get(c), { houses }),
    _cand: cand,
    _stopped: null,
    // The app's stop() aborts the branch as a contradiction. Recording at call
    // time is enough here: every component yields the stop it just built.
    stop: (message = '', cells = []) => { p._stopped = message || 'stopped'; return { message, cells } },
    // The whole-grid calls a region-building component makes. Neighbours come
    // from the square the cells form, row-major, the way the app numbers a
    // custom board.
    getCellsOrthogonallyAdjacentToCell: c => {
      const n = cand.size
      const side = Math.round(Math.sqrt(n))
      if (side * side !== n) throw new RangeError('orthogonal neighbours need a square board')
      const out = []
      if (c % side > 0) out.push(c - 1)
      if (c % side < side - 1) out.push(c + 1)
      if (c >= side) out.push(c - side)
      if (c + side < n) out.push(c + side)
      return out
    }
  }
  return p
}

// The houses a harness line declares for one of docs/line-contract.md's three
// kinds: none for a bare line, the line itself for a house or a full house.
export const housesOf = (kind, cells) => (kind === 'bare' ? [] : [cells])

// Run a component's update until a pass removes nothing, at most MAX_PASSES
// times.
const MAX_PASSES = 20
export function fixpoint (mod, inst, p) {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = total(p)
    Array.from(mod.update(inst, p)) // drain
    if (p._stopped !== null) break // the branch was declared dead; stop propagating
    if (total(p) === before) break
  }
}

// Run to a fixpoint, then report a cell that lost its true value or went
// empty. Returns null when the true values all survive. A stop() is a
// violation outright: it kills the whole branch, and every harness state
// still contains the true solution, so no branch here is ever dead.
export function violates (mod, inst, p, truth) {
  fixpoint(mod, inst, p)
  if (p._stopped !== null) return { stopped: p._stopped }
  for (const [c, v] of Object.entries(truth)) {
    if (!p._cand.get(+c).has(v)) return { cell: +c, lost: v }
    if (p._cand.get(+c).size === 0) return { cell: +c, empty: true }
  }
  return null
}
