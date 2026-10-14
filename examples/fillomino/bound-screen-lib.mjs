// The screen for a cheap-bound idea on FillominoComponent.js: each variant is
// the shipped component with one source patch applied at load, so a screened
// idea can never drift from the shipped rules and a rejected one leaves
// nothing in the tree but its patch here. `bound-screen.mjs` runs it over the
// 19 frozen timing fixtures.
//
// The numbers come from hunt-lib's propagate-and-branch search with the
// component as the propagator, not from the app's own solver: they rank
// ideas, and the live app (`just time`) has the last word on a ship.
//
// Variants:
//   incremental -- the open-cell count (#327). A digit d with a placed cell has
//     a region of d cells holding at most every placed d, so it needs at least
//     d - placed(d) open cells, and regions of different digits are disjoint,
//     so the needs add. A sum over the open cells left has no fill: a dead
//     branch, killed the way the island rules kill one, by emptying a placed
//     cell. A relaxation of GLOSSARY's budget rule, matched per board rather
//     than per island.

import { execFileSync } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'
import { makeIo, patchSource } from '../_shared/harness-lib.mjs'
import { score } from './hunt-lib.mjs'

const NAMES = ['setParams', 'update', 'validate']

const SETUP_ANCHOR = '  instance.others = null\n}'
const UPDATE_ANCHOR = 'function * update (instance, puzzle) {\n'

// One loop over the cells diffs each cell's placed digit against the row the
// last call saw and moves the running counts by the difference. The solver
// sends no change events and no backtrack signal, so a diff against a snapshot
// is the only way a count follows the board both up and down. A digit never
// exceeds the cell count, which sizes `placedBy`.
const INCREMENTAL_SETUP = `  instance.rowSeen = new Int16Array(cells.length)
  instance.placedBy = new Int16Array(cells.length + 1)
  instance.openLeft = cells.length
  instance.others = null
}`
const INCREMENTAL_CHECK = `function * update (instance, puzzle) {
  {
    const { cells, rowSeen, placedBy } = instance
    for (let i = 0; i < cells.length; i++) {
      const d = puzzle.hasValue(cells[i]) ? puzzle.getValue(cells[i]) : 0
      if (d === rowSeen[i]) continue
      if (rowSeen[i] === 0) instance.openLeft--; else placedBy[rowSeen[i]]--
      if (d === 0) instance.openLeft++; else placedBy[d]++
      rowSeen[i] = d
    }
    let need = 0
    for (let d = helpers.digits.minDigit; d <= helpers.digits.maxDigit; d++) {
      if (placedBy[d] > 0 && placedBy[d] < d) need += d - placedBy[d]
    }
    if (need > instance.openLeft) {
      const i = rowSeen.findIndex(d => d !== 0)
      yield puzzle.removeCandidateFromCell(rowSeen[i], cells[i])
      return
    }
  }
`

export function loadVariants (here) {
  const { load } = makeIo(here)
  const file = 'FillominoComponent.js'
  return {
    baseline: load(file, NAMES),
    incremental: load(file, NAMES, src => patchSource(patchSource(src, SETUP_ANCHOR, INCREMENTAL_SETUP), UPDATE_ANCHOR, INCREMENTAL_CHECK))
  }
}

// The 19 frozen timing fixtures (#307), read through the example's own link
// reader. The rung25 links are one of three committed copies of the same
// boards; the givens are what the offline scorer needs.
export function fixtureBoards (here) {
  return readdirSync(here).filter(f => /^timing-fixture-.*-rung25\.txt$/.test(f)).sort().map(f => ({
    name: f.replace(/^timing-fixture-/, '').replace(/-rung25\.txt$/, ''),
    ...JSON.parse(execFileSync('uv', ['run', '--project', join(here, '..', '..'), join(here, 'hunt_link.py'), join(here, f)], { encoding: 'utf8' }))
  }))
}

// Best of `reps` whole solves. A run that solved nothing has no verdict, and
// `reps` below one is refused rather than run empty.
function measure (mod, board, reps) {
  let best = Infinity
  let result
  for (let r = 0; r < reps; r++) {
    const t0 = process.hrtime.bigint()
    result = score(mod, board)
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6)
  }
  return { ...result, ms: best }
}

const answer = r => JSON.stringify([r.verdict, r.grid])

// Every variant on every board. `bad` counts the variants that answered
// differently from `baseline` (or answered nothing): a screen is only worth
// reading when its variants agree with what ships.
export function runScreen (boards, variants, reps) {
  if (!Number.isInteger(reps) || reps < 1) throw new Error(`reps must be a positive integer, got ${reps}`)
  if (!variants.baseline) throw new Error('the variants need a baseline to compare against')
  const rows = []
  let bad = 0
  for (const board of boards) {
    const row = { name: board.name }
    for (const [name, mod] of Object.entries(variants)) row[name] = measure(mod, board, reps)
    for (const name of Object.keys(variants)) {
      if (row[name].verdict === undefined || answer(row[name]) !== answer(row.baseline)) bad++
    }
    rows.push(row)
  }
  return { rows, bad }
}
