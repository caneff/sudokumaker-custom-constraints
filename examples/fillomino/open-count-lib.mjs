// The open-cell-count screen's library (#327). The variant is not a second
// component file: it is the shipped FillominoComponent.js with a room check
// patched in at load, so the screen can never drift from the shipped rules and
// a rejected idea leaves nothing in the tree but the screen itself.
//
// The check. A digit d with at least one placed cell has a region of d cells
// somewhere, and that region holds at most every placed d, so it needs at least
// d - placed(d) open cells. Regions of different digits are disjoint, so the
// needs add. When the sum is more than the open cells left, no fill exists --
// a dead branch, killed the way the island rules kill one: empty a placed cell.

import { execFileSync } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'
import { makeIo, patchSource } from '../_shared/harness-lib.mjs'

const NAMES = ['setParams', 'update', 'validate']

// `placedRow[i]` is the digit cell i holds, 0 while it is open.
export function roomShort (placedRow) {
  const placed = new Map()
  let open = 0
  for (const d of placedRow) {
    if (d === 0) open++
    else placed.set(d, (placed.get(d) || 0) + 1)
  }
  let need = 0
  for (const [d, p] of placed) need += Math.max(0, d - p)
  return need > open
}

const SETUP_ANCHOR = '  instance.others = null\n}'
const UPDATE_ANCHOR = 'function * update (instance, puzzle) {\n'

// One loop over the cells that diffs each cell's placed digit against the row
// the last call saw and moves the running counts by the difference. The
// solver sends no change events and no backtrack signal, so a diff against a
// snapshot is the only way a count survives both directions.
const INCREMENTAL_SETUP = `  instance.rowSeen = new Int16Array(cells.length)
  instance.placedBy = new Int16Array(64)
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

// The same check with no snapshot: the scan already visits every placed cell,
// so its islands carry the per-digit counts for free.
const RECOUNT_CHECK = `function * update (instance, puzzle) {
  {
    const { cells } = instance
    const islands = scan(instance, puzzle)
    const placedBy = {}
    let placed = 0
    for (const { digit, size } of islands) { placedBy[digit] = (placedBy[digit] || 0) + size; placed += size }
    let need = 0
    for (const d of Object.keys(placedBy)) if (placedBy[d] < d) need += d - placedBy[d]
    if (need > cells.length - placed) {
      yield puzzle.removeCandidateFromCell(islands[0].digit, cells[islands[0].seed])
      return
    }
  }
`

export function loadVariants (here) {
  const { load } = makeIo(here)
  const file = 'FillominoComponent.js'
  return {
    baseline: load(file, NAMES),
    incremental: load(file, NAMES, src => patchSource(patchSource(src, SETUP_ANCHOR, INCREMENTAL_SETUP), UPDATE_ANCHOR, INCREMENTAL_CHECK)),
    recount: load(file, NAMES, src => patchSource(src, UPDATE_ANCHOR, RECOUNT_CHECK))
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
