// Soundness fuzz for the two #233 prototype deductions. Soundness = neither one
// ever removes a cell's TRUE value, and the early reject never rejects a state a
// real solution can still complete.
//
//   node examples/hit-counts/proto-233/soundness-233.mjs
//
// C (side hit matching) needs a whole side at once, so it is fuzzed over real
// grids: each gen_*.json grid plus band/stack shuffles of it, which keep a grid
// valid while moving every hit. Every cell gets a random candidate set that
// still contains its true value, and the true clue values are derived from the
// grid, so the truth is always a completion of the state.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../../_shared/harness-lib.mjs'
import { frameGeometry } from '../../_shared/frame-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXAMPLE = join(HERE, '..')
const { load } = makeIo(HERE)
const { rnd } = makeRng()

installGlobals(0, 9)

const SIDE_FILES = [
  'SideHitMatchingComponent.js',
  'SideHitMatchingComponent.lean.js',
  'SideHitMatchingComponent.fast.js'
]
const sideMods = SIDE_FILES.map(f => ({ file: f, mod: load(f, ['setParams', 'update']) }))
const rejectMod = load('HitCountsComponent.earlyreject.js', ['setParams', 'update', 'validate', 'scan'])

// A random candidate set over lo..hi that always keeps `keep`.
function seed (lo, hi) {
  return (cell, keep) => {
    const r = rnd()
    if (r < 0.35) return [keep]
    const s = new Set([keep])
    if (r < 0.55) { for (let d = lo; d <= hi; d++) s.add(d) } else { for (let d = lo; d <= hi; d++) if (rnd() < 0.5) s.add(d) }
    return [...s]
  }
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] } return a }

// Band/stack shuffles keep a grid a valid sudoku. Digit relabelling would not be
// safe here: a hit compares a digit to a position, so relabelling changes the
// rule, not just the grid.
function reshuffle (grid, bh, bw) {
  const n = grid.length
  const rowOrder = []
  for (let b = 0; b < n; b += bh) rowOrder.push(shuffle(Array.from({ length: bh }, (_, k) => b + k)))
  const colOrder = []
  for (let b = 0; b < n; b += bw) colOrder.push(shuffle(Array.from({ length: bw }, (_, k) => b + k)))
  const rows = shuffle(rowOrder).flat()
  const cols = shuffle(colOrder).flat()
  return rows.map(r => cols.map(c => grid[r][c]))
}

// ---- C: the side hit matching over real grids ----
let cTests = 0
let cBad = 0
let cFired = 0
for (const file of ['gen_4x4.json', 'gen_6x6.json', 'gen_9x9.json']) {
  const gen = JSON.parse(readFileSync(join(EXAMPLE, file), 'utf8'))
  const { n, box: [bh, bw] } = gen
  const { interior, clueCell, lineCells, keys } = frameGeometry(n, [bh, bw])
  for (let iter = 0; iter < 3000; iter++) {
    const grid = iter === 0 ? gen.grid : reshuffle(gen.grid, bh, bw)
    const truth = {}
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth[interior(r, c)] = grid[r][c]
    for (const k of keys) {
      const side = k[0]; const i = +k.slice(1)
      const line = lineCells(side, i)
      let hits = 0
      for (let j = 0; j < n; j++) if (truth[line[j]] === j + 1) hits++
      truth[clueCell(side, i)] = hits
    }
    const lineSeed = seed(1, n)
    const clueSeed = seed(0, n)
    const clueCells = new Set(keys.map(k => clueCell(k[0], +k.slice(1))))
    const p = makePuzzle(truth, (c, v) => (clueCells.has(c) ? clueSeed : lineSeed)(c, v))
    const before = [...Object.keys(truth)].reduce((s, c) => s + p.getCandidates(+c).size, 0)
    for (const side of ['L', 'R', 'T', 'B']) {
      const clues = []
      const lines = []
      for (let i = 0; i < n; i++) { clues.push(clueCell(side, i)); lines.push(lineCells(side, i)) }
      for (const { file: modFile, mod } of sideMods) {
        const inst = {}
        mod.setParams(inst, clues, lines)
        const v = violates(mod, inst, p, truth)
        cTests++
        if (v) { cBad++; if (cBad <= 5) console.log('SIDE-MATCH violation', modFile, file, side, v) }
      }
    }
    const after = [...Object.keys(truth)].reduce((s, c) => s + p.getCandidates(+c).size, 0)
    if (after < before) cFired++
  }
}
console.log('side hit matching (' + SIDE_FILES.length + ' variants):', cTests, 'tests,', cBad, 'violations,', cFired, 'states pruned')

// ---- A: the early reject must never reject a completable state ----
// Random permutation lines with random candidate supersets keeping the truth, the
// clue pinned to the line's true hit count. validate must return true every time.
const CLUE = 100
const LINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const hits = perm => perm.reduce((k, x, i) => k + (x === i + 1 ? 1 : 0), 0)
const pool = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 1]]
for (let i = 0; i < 400; i++) pool.push(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]))

let aTests = 0
let aBad = 0
let aRejected = 0 // coverage: the reject fires on states that really are dead
for (let iter = 0; iter < 40000; iter++) {
  const perm = pool[iter % pool.length]
  const truth = { [CLUE]: hits(perm) }
  for (let i = 0; i < 9; i++) truth[i] = perm[i]
  const lineSeed = seed(1, 9)
  const p = makePuzzle(truth, (c, v) => (c === CLUE ? [v] : lineSeed(c, v))) // clue pinned to the truth
  const inst = {}
  rejectMod.setParams(inst, CLUE, LINE)
  aTests++
  if (!rejectMod.validate(inst, p)) { aBad++; if (aBad <= 5) console.log('REJECT rejected a live state, clue', truth[CLUE]) }
  // Same line, a clue value the state cannot reach: the reject must fire.
  const { forced, possible } = rejectMod.scan(p, LINE)
  const wrong = possible < 9 ? possible + 1 : forced - 1
  if (wrong >= 0 && wrong <= 9 && wrong !== 8) {
    const q = makePuzzle({ ...truth, [CLUE]: wrong }, (c, v) => (c === CLUE ? [v] : lineSeed(c, v)))
    const inst2 = {}
    rejectMod.setParams(inst2, CLUE, LINE)
    // q reseeds the line, so recheck against q's own window.
    const w = rejectMod.scan(q, LINE)
    if ((wrong < w.forced || wrong > w.possible) && !rejectMod.validate(inst2, q)) aRejected++
  }
}
console.log('early reject:', aTests, 'tests,', aBad, 'false rejects,', aRejected, 'true rejects fired')

// The early reject changes validate only; its update must still be sound. That is
// the shipped harness's job, and the file is a copy of the shipped update, so run
// the shipped harness's own check here on this copy.
let uTests = 0
let uBad = 0
for (let iter = 0; iter < 20000; iter++) {
  const perm = pool[iter % pool.length]
  const truth = { [CLUE]: hits(perm) }
  for (let i = 0; i < 9; i++) truth[i] = perm[i]
  const lineSeed = seed(1, 9)
  const clueSeed = seed(0, 9)
  const p = makePuzzle(truth, (c, v) => (c === CLUE ? clueSeed : lineSeed)(c, v))
  const inst = {}
  rejectMod.setParams(inst, CLUE, LINE)
  const v = violates(rejectMod, inst, p, truth)
  uTests++
  if (v) { uBad++; if (uBad <= 5) console.log('REJECT update violation', v) }
}
console.log('early reject update:', uTests, 'tests,', uBad, 'violations')

const ok = cBad === 0 && aBad === 0 && uBad === 0 && cFired > 0 && aRejected > 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
