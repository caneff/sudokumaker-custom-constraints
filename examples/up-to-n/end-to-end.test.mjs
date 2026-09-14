// End to end: Up to N (spec #366) through the app's own solver.
//
//   node examples/up-to-n/end-to-end.test.mjs
//
// Each case takes a committed link, as a setter would share it, and runs it
// through the real SudokuMaker solver bundle in Node (bundle-solve-lib.mjs,
// #429): the link's own main code reads the drawn markers, registers the
// component, and the app's search solves. Nothing here is mocked, so the
// marker contract, the component and the board data are checked together.
//
// Expected answers come from the board's gen JSON, which CP-SAT built and
// proved unique -- never from the JS rule.
//
// It witnesses the rule as a whole, not each half: the search still finds the
// one solution with `update` pruning nothing (validate alone refuses every
// wrong grid), and with `validate` always true (update's stop kills the
// branch). How much `update` prunes is update-strength.test.mjs's job; that
// it never prunes a true candidate is soundness-harness.mjs's.
//
// It runs the code embedded in the committed links, not the tree:
// build_link.test.py fails when a link's code drifts from main.js or the
// component, and `build_size.py --rebuild` refreshes it.
//
// The 4x4 and 6x6 boards run here, in well under a second each. The shipped
// 9x9 takes over a minute headless, so it stays with build_link.test.py's
// CP-SAT proof and the README's `just time` row.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { decodeLinkFile, solveDocument } from '../_shared/bundle-solve-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const BOARDS = [
  ['PUZZLE_LINK_4x4.txt', 'gen_4x4.json'],
  ['PUZZLE_LINK_6x6.txt', 'gen_6x6.json']
]

const load = (link, gen) => ({
  doc: decodeLinkFile(join(HERE, link)),
  board: JSON.parse(readFileSync(join(HERE, gen), 'utf8'))
})

const markers = doc =>
  doc.puzzle.constraints.find(c => c.definition?.name === 'Up to N').input.groups

// The recorded solution as the solver prints it: one digit per cell, row-major.
const solution = board => board.grid.flat().join('')

// A fresh copy to edit, so one case never leaks into the next.
const copy = doc => structuredClone(doc)

for (const [link, gen] of BOARDS) {
  const { doc, board } = load(link, gen)

  // The shared board has exactly one solution, the recorded one. The shown
  // clues are the only thing pinning it: this board has no givens.
  {
    // A no-ring board ships "custom" at its own size. The headless bundle
    // honours a "sudoku" header's size where the live editor forces 9x9
    // (docs/research/368-up-to-n-setup-throw.md), so a header regression
    // would still solve here; this pins the header itself.
    const { type, width, height } = doc.puzzle
    assert.deepStrictEqual({ type, width, height }, { type: 'custom', width: board.n, height: board.n }, link)
    assert.deepStrictEqual(board.givens, {}, `${link}: expected a board with no givens`)
    const { solutions } = await solveDocument(copy(doc))
    assert.deepStrictEqual(solutions, [solution(board)], link)
  }

  // Every marker drawn but none clued: each is ignored, and the board is a
  // plain sudoku with many solutions. The solver lists every solution with no
  // cap, so this runs on the 4x4 alone: a blank 4x4 has 288 grids, a blank
  // 6x6 about 28 million.
  if (board.n === 4) {
    const blank = copy(doc)
    for (const g of markers(blank)) g.value = ''
    const { solutions } = await solveDocument(blank)
    assert.ok(solutions.length > 1, `${link}: ${solutions.length} solutions with every marker empty`)
  }

  // The recorded solution entered in full is accepted with the true clues and
  // refused once one shown clue is off by one.
  {
    const entered = d => {
      d.puzzle.cells = board.grid.flat().map(value => ({ value }))
      return d
    }
    const { solutions } = await solveDocument(entered(copy(doc)))
    assert.deepStrictEqual(solutions, [solution(board)], `${link}: the true grid, entered`)

    const wrong = entered(copy(doc))
    const clued = markers(wrong).find(g => g.value !== '')
    clued.value = String(Number(clued.value) + 1)
    const rejected = await solveDocument(wrong).then(
      ({ solutions }) => solutions.length === 0,
      err => /rejected the initial grid/.test(err.message)
    )
    assert.ok(rejected, `${link}: the true grid passed a wrong clue`)
  }

  // A malformed marker is refused at setup with the marker contract's own
  // message, not solved as though it were absent or read as some other clue.
  // Each edit takes the document and its first marker, two cells [a, b] with
  // b one step inward from the border cell a.
  const inward = g => g.cells[1] - g.cells[0]
  for (const [what, edit, message] of [
    ['a three-cell marker', (d, g) => g.cells.push(g.cells[1] + inward(g)), /Up to N: .* must be exactly two cells/],
    ['a marker one step in from the end', (d, g) => { g.cells = g.cells.map(c => c + inward(g)) }, /Up to N: .* not at either end/],
    ['a second marker on the same end', (d, g) => markers(d).push({ ...g, value: '1' }), /Up to N: .* same line and end/],
    ['a non-numeric value', (d, g) => { g.value = 'x' }, /Up to N: .* not a positive integer/],
    // Digits stop one short of the board, every clue is cleared, and only the
    // marker at the top of the last column is clued: its target digit is one
    // the board cannot hold, and the refusal names that marker.
    ['a target digit past maxDigit', d => {
      const n = board.n
      d.puzzle.maxDigit = n - 1
      for (const m of markers(d)) m.value = ''
      markers(d).find(m => m.cells[0] === n - 1 && m.cells[1] === 2 * n - 1).value = '1'
    }, new RegExp(`Up to N: the marker at R1C${board.n} and R2C${board.n} aims at target digit ${board.n}, outside 1\\.\\.${board.n - 1}`)]
  ]) {
    const bad = copy(doc)
    edit(bad, markers(bad)[0])
    await assert.rejects(solveDocument(bad), message, `${link}: ${what}`)
  }
}

console.log('PASS')
