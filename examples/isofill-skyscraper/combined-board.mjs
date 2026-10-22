// The shipped board as this example's harnesses run it: main-global.js run
// against a mock puzzle of the board's size, so the components are the ones the
// link registers with the arguments it hands them, and the truth read off
// gen.json, so the clues are the ones build_size.py's `visible` recorded. A
// caller may hand in another gen (a rectangle) in the same shape.

import { join } from 'path'
import { readFileSync } from 'fs'
import { runBackend } from '../_shared/backend-runner.mjs'

// `read` is makeIo's: main-global.js with its #include spliced in.
export function combinedBoard (here, read, gen = JSON.parse(readFileSync(join(here, 'gen.json'), 'utf8'))) {
  const rows = gen.grid.length
  const cols = gen.grid[0].length
  // the digit count: the width unless gen.json names another, as a rectangle does
  const n = gen.digits ?? cols
  const W = cols + 2
  const H = rows + 2
  const at = (r, c) => c + r * W

  const registered = []
  const puzzle = {
    spec: { size: { width: W, height: H } },
    getCellAt: (a, b) => a + b * W,
    addConstraintComponent: comp => registered.push(comp)
  }
  runBackend(read('main-global.js'), { puzzle, helpers: { naming: { getCellName: String } } })

  const truth = {}
  gen.grid.forEach((row, r) => row.forEach((d, c) => { truth[at(r + 1, c + 1)] = d }))
  // The ring cell of each gen.json clue key ("L0", "T8"), as framebuild's
  // `ring_cell` places it.
  const ringCell = { L: i => at(i + 1, 0), R: i => at(i + 1, W - 1), T: i => at(0, i + 1), B: i => at(H - 1, i + 1) }
  for (const [key, v] of Object.entries(gen.clue)) truth[ringCell[key[0]](Number(key.slice(1)))] = v

  // One `{ mod, inst }` per registered component, `mods` keyed by constructor
  // name: the parts a fixpoint runs.
  const parts = mods => registered.map(c => {
    const mod = mods[c.ctor]
    if (!mod) throw new Error(`no module for registered ${c.ctor}`)
    const inst = {}
    mod.setParams(inst, ...c.args.slice(1))
    return { mod, inst }
  })
  return { n, W, H, truth, registered, parts }
}
