// What the Hall rule is worth INSIDE the app's own solver, where it keeps the
// candidate-set map registration a custom component can never have.
//
//   node docs/research/required-digits-gac/bundle-probe/hall-in-bundle-probe.mjs
//
// Load the reference bundle in Node WITHOUT touching it on disk, build the
// #541 sparse board's solver state directly from gen.json, and count what a
// full "find all solutions" search costs -- once with the app's own
// RequiredDigits rule, once with the Hall rule swapped onto its prototype.
//
// Run it from the repo root; paths are relative to it.
//
// Quarantine: the reference bundle is read verbatim and hash-checked; the
// only in-memory edit is the probe export line bugcheck.mjs already uses. The
// rule swap happens on the exported class at runtime, so nothing on disk ever
// holds a modified bundle, and nothing here can build or verify a real link.
import fs from 'fs'
import crypto from 'crypto'

const REFERENCE = 'docs/research/humanify-pedagogy/bundle.claude.js'
const REFERENCE_SHA = '312461e131246b041caf73b9c53258b940ecc002a85bef3bcf7b0d50bb437066'

const raw = fs.readFileSync(REFERENCE, 'utf8')
const sha = crypto.createHash('sha256').update(raw).digest('hex')
if (sha !== REFERENCE_SHA) throw new Error(`reference bundle changed (${sha}); re-read it before trusting this probe`)

const TAIL = '})();'
if (!raw.trimEnd().endsWith(TAIL)) throw new Error('unexpected bundle tail')
const EXPORTS = ['setPuzzleSpec', 'SolverState', 'Solver', 'HouseComponent', 'HouseType',
  'RequiredDigitsComponent', 'CustomLogicStepsGenerator', 'digitsInMask', 'toDigitMask',
  'filterCandidatesAtCellsChange', 'abortSolverChange', 'removeFirstValue', 'ValidResult', 'CustomPuzzleEnabledStepTypes', 'buildSolverStateFromPuzzle', 'PuzzleKind', 'applyInitialGridToState', 'EmptyValueSentinel']
const src = raw.trimEnd().slice(0, -TAIL.length) +
  `\n globalThis.__probe = { ${EXPORTS.join(', ')} };\n` + TAIL

globalThis.self = globalThis
globalThis.onmessage = null
globalThis.postMessage = () => {}
globalThis.addEventListener = () => {}
new Function(src)()
const P = globalThis.__probe
console.log('exports resolved:', Object.entries(P).filter(([, v]) => v === undefined).map(([k]) => k).join(',') || 'all')

//! The board is a plain 9x9 sudoku plus the required-digits groups, so the
//! houses come from the bundle's own SudokuRules handler rather than a
//! hand-rolled setRegions -- the same construction the worker uses.
const SPEC = { size: { width: 9, height: 9 }, minDigit: 1, maxDigit: 9, digitCount: 9, type: P.PuzzleKind.Sudoku }

const gen = JSON.parse(fs.readFileSync('docs/research/required-digits-gac/sparse/gen.json', 'utf8'))
const N = 9
//! gen.json stores (row, column) pairs, not (x, y) -- build_sparse_required_digits.py's own convention.
const cellId = (row, column) => row * N + column

// --- the Hall rule, written against the bundle's own component API ---
//! Shared across calls, as the landed component does. The walk must not
//! yield: a yield hands control back to the solver, which can run another
//! component's update and clobber these. So the walk collects its filters
//! and the generator yields them afterwards.
const cellsOf = new Int32Array(1 << 9)
const needOf = new Int32Array(1 << 9)
const digitsOf = new Int32Array(1 << 9)
const holders = new Int32Array(9)
const popcount = b => { let x = b - ((b >> 1) & 0x55555555); x = (x & 0x33333333) + ((x >> 2) & 0x33333333); x = (x + (x >> 4)) & 0x0f0f0f0f; return Math.imul(x, 0x01010101) >> 24 }

function * hallUpdate ({ cells }) {
  const cellIds = this.cellIds
  //! Distinct digits and their repeat counts, computed once per component
  //! rather than per call -- the class instance is stable for the solve.
  if (this.__hallDigits === undefined) {
    this.__hallDigits = [...new Set(this.values)]
    this.__hallWanted = this.__hallDigits.map(d => this.values.filter(v => v === d).length)
  }
  const digits = this.__hallDigits
  const wanted = this.__hallWanted
  for (let i = 0; i < digits.length; i++) {
    const digitBit = 1 << digits[i]
    let mask = 0
    for (let j = 0; j < cellIds.length; j++) if (cells[cellIds[j]].candidates & digitBit) mask |= 1 << j
    holders[i] = mask
  }
  const whole = (2 ** digits.length) - 1
  let abort
  const pending = []
  for (let s = 1; s <= whole; s++) {
    const low = s & -s
    const i = 31 - Math.clz32(low)
    const rest = s & (s - 1)
    cellsOf[s] = cellsOf[rest] | holders[i]
    needOf[s] = needOf[rest] + wanted[i]
    digitsOf[s] = digitsOf[rest] | (1 << digits[i])
    const have = popcount(cellsOf[s])
    if (have < needOf[s]) { abort = `unable to place the required digits in ${this.name}`; break }
    if (have === needOf[s]) {
      const tight = []
      for (let r = cellsOf[s]; r !== 0; r = r & (r - 1)) tight.push(cellIds[31 - Math.clz32(r & -r)])
      pending.push(P.filterCandidatesAtCellsChange(digitsOf[s], tight))
    }
  }
  if (abort !== undefined) { yield P.abortSolverChange(abort, cellIds); return }
  for (const change of pending) yield change
}

function buildState () {
  const state = P.buildSolverStateFromPuzzle({ spec: SPEC, constraints: [] })
  //! SudokuRules registers rows and columns only (bundle.claude.js:11066);
  //! the boxes are the app's default region layout, added here as the same
  //! HouseComponents that layout would produce.
  for (let box = 0; box < N; box++) {
    const boxCells = []
    for (let id = 0; id < N * N; id++) {
      if (Math.floor(Math.floor(id / N) / 3) * 3 + Math.floor((id % N) / 3) === box) boxCells.push(id)
    }
    state.addConstraintComponent(new P.HouseComponent(`box ${box + 1}`, boxCells, P.HouseType.Region))
  }
  for (const group of gen.groups) {
    state.addConstraintComponent(new P.RequiredDigitsComponent(group.name, group.values, group.cells.map(([row, column]) => cellId(row, column))))
  }
  //! The givens, in the shape applyInitialGridToState reads: value then
  //! candidate mask per cell, EmptyValueSentinel for an empty one. It also
  //! runs every component's initialize, as the worker's start path does.
  const grid = new Uint32Array(N * N * 2)
  const given = new Set(gen.givens.map(([row, column]) => cellId(row, column)))
  for (let id = 0; id < N * N; id++) {
    grid[id * 2] = given.has(id) ? gen.grid[Math.floor(id / N)][id % N] : P.EmptyValueSentinel
    grid[id * 2 + 1] = 0
  }
  const initResult = P.applyInitialGridToState(state, grid)
  if (!('changed' in initResult)) throw new Error(`initial grid rejected: ${initResult.message}`)
  return state
}

function solve (label) {
  let nodes = 0
  const clone = P.SolverState.prototype.clone
  P.SolverState.prototype.clone = function (...args) { nodes++; return clone.apply(this, args) }
  const state = buildState()
  const solver = new P.Solver(state)
  new P.CustomLogicStepsGenerator({ stepTypes: [...P.CustomPuzzleEnabledStepTypes], useRandomness: false }).setLogicSteps(solver)
  const t0 = process.hrtime.bigint()
  let solutions = 0
  const found = []
  for (const buffer of solver.findSolutions()) {
    solutions++
    found.push(Array.from({ length: N * N }, (u, id) => buffer[id * 2]))
    if (solutions > 1) break
  }
  globalThis.__found = found
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  P.SolverState.prototype.clone = clone
  console.log(`  ${label.padEnd(16)} solutions ${solutions}  nodes ${nodes}  ${ms.toFixed(0)}ms`)
  return { solutions, nodes, ms }
}

//! Check every solution the search returns against the board's own rules,
//! stated here independently of the component under test.
function violationsOf (values) {
  const bad = []
  for (let i = 0; i < N; i++) {
    const row = new Set(); const col = new Set()
    for (let j = 0; j < N; j++) { row.add(values[cellId(i, j)]); col.add(values[cellId(j, i)]) }
    if (row.size !== N) bad.push(`row ${i + 1}`)
    if (col.size !== N) bad.push(`column ${i + 1}`)
  }
  for (let b = 0; b < N; b++) {
    const box = new Set()
    for (let id = 0; id < N * N; id++) {
      if (Math.floor(Math.floor(id / N) / 3) * 3 + Math.floor((id % N) / 3) === b) box.add(values[id])
    }
    if (box.size !== N) bad.push(`box ${b + 1}`)
  }
  for (const group of gen.groups) {
    const present = new Set(group.cells.map(([r, c]) => values[cellId(r, c)]))
    const missing = group.values.filter(v => !present.has(v))
    if (missing.length > 0) bad.push(`${group.name} missing ${missing.join(',')}`)
  }
  for (const [r, c] of gen.givens) {
    if (values[cellId(r, c)] !== gen.grid[r][c]) bad.push(`given ${r},${c}`)
  }
  return bad
}

const builtinUpdate = P.RequiredDigitsComponent.prototype.update
function run (label) {
  const rows = []
  for (let rep = 0; rep < 3; rep++) {
    const r = solve(label)
    const bad = globalThis.__found.map(v => violationsOf(v)).flat()
    if (bad.length > 0) throw new Error(`${label}: returned a solution breaking ${bad.slice(0, 3).join('; ')}`)
    if (r.solutions !== 1) throw new Error(`${label}: ${r.solutions} solutions, expected the board's unique one`)
    rows.push(r)
  }
  const best = rows.reduce((a, b) => (a.ms <= b.ms ? a : b))
  console.log(`${label.padEnd(18)} BEST nodes ${best.nodes}  ${best.ms.toFixed(0)}ms`)
  return best
}

const builtin = run('built-in rule')
P.RequiredDigitsComponent.prototype.update = hallUpdate
const hall = run('Hall rule')
P.RequiredDigitsComponent.prototype.update = builtinUpdate

console.log(`\nnodes ${(hall.nodes / builtin.nodes).toFixed(2)}x, time ${(hall.ms / builtin.ms).toFixed(2)}x (Hall against the built-in, lower is better)`)
