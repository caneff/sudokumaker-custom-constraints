// End to end: Up to N (spec #366, rule corrected by #589) through the app's
// own solver.
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
// proved unique, and from spec #589's own literals -- never from the JS rule.
//
// #589's rule: reading inward, the clue is the sum of the digits strictly
// before the first target digit N; N is never added. A clue runs 0 (N first)
// to TOTAL - N (N last), TOTAL = n(n+1)/2, and the two ends of one line sum to
// TOTAL - N. The cases below pin, on all four committed boards: the rules
// text's rule and worked example, the shown clues against the recorded ones,
// every marker's corrected value accepted and its old up-to-and-including
// value refused, a typed 0 read as a clue, and the range's top end.
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
// What a green run does not cover:
// - The search on either 9x9. The 4x4 and 6x6 solve here in well under a
//   second each; the shipped 9x9 takes over a minute headless, so its
//   uniqueness stays with build_link.test.py's CP-SAT proof and the README's
//   `just time` rows. The 9x9 boards run here only with the grid entered,
//   which checks each clue without a search.
// - The live editor at sudokumaker.app: how the rules text and the clue
//   labels render on a board, and the typed-marker path a setter uses (a 0
//   typed into a marker). This bundle reads the document, not the page.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { decodeLinkFile, solveDocument } from '../_shared/bundle-solve-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const BOARDS = [
  ['PUZZLE_LINK_4x4.txt', 'gen_4x4.json'],
  ['PUZZLE_LINK_6x6.txt', 'gen_6x6.json'],
  ['PUZZLE_LINK_9x9.txt', 'gen_9x9.json'],
  ['PUZZLE_LINK.txt', 'gen.json']
]

// The worked example #589 ruled for each size, as the rules text must carry it.
const WORKED = {
  4: 'a clue of 4 at the left end of row 2 is true of the row 3124, since 3 + 1 = 4.',
  6: 'a clue of 11 at the left end of row 2 is true of the row 416253, since 4 + 1 + 6 = 11.',
  9: 'a clue of 12 at the left end of row 5 is true of the row 921564738, since 9 + 2 + 1 = 12.'
}

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

// A marker's gen JSON key (L/R per row, T/B per column, 0-based) and its
// target digit, read off its border cell: cells[0] is the border.
function where (g, n) {
  const [a, b] = g.cells
  const x = a % n
  const y = (a / n) | 0
  if (Math.abs(a - b) === 1) return { key: `${x === 0 ? 'L' : 'R'}${y}`, target: y + 1 }
  return { key: `${y === 0 ? 'T' : 'B'}${x}`, target: x + 1 }
}

// The document with the recorded grid entered in full.
const entered = (d, board) => {
  d.puzzle.cells = board.grid.flat().map(value => ({ value }))
  return d
}

// A document the solver refuses: the entered grid rejected, or setup refusing
// a marker.
const refused = d => solveDocument(d).then(
  ({ solutions }) => solutions.length === 0,
  err => /rejected the initial grid|Up to N: /.test(err.message)
)

for (const [link, gen] of BOARDS) {
  const { doc, board } = load(link, gen)
  const n = board.n
  const TOTAL = (n * (n + 1)) / 2

  // The rules text states the corrected rule and #589's worked example for
  // this size.
  assert.match(doc.puzzle.comment, /the digits before the first N sum to the clue; N itself is not added\./, link)
  assert.ok(doc.puzzle.comment.includes(WORKED[n]), `${link}: rules text lacks the ${n}x${n} worked example`)

  // The labels drawn are the recorded clues: the markers carrying a value are
  // the recorded shown set, each showing its recorded value.
  {
    const shown = Object.fromEntries(markers(doc).filter(g => g.value !== '').map(g => [where(g, n).key, Number(g.value)]))
    const recorded = Object.fromEntries(board.active.map(k => [k, board.clue[k]]))
    assert.deepStrictEqual(shown, recorded, `${link}: shown clues`)
  }

  // The recorded clues keep #589's identity: the two ends of a line sum to
  // TOTAL - N, so the far end says nothing the near end does not.
  for (let i = 0; i < n; i++) {
    for (const [near, far] of [['L', 'R'], ['T', 'B']]) {
      assert.strictEqual(board.clue[near + i] + board.clue[far + i], TOTAL - (i + 1), `${link}: ${near}${i} + ${far}${i}`)
    }
  }

  // Every marker clued with its recorded value at once, 4n clues, the true
  // grid entered: all accepted, including each 0 (N first) and each
  // TOTAL - N (N last). Each one alone at its old up-to-and-including value,
  // N higher, is refused.
  {
    const all = entered(copy(doc), board)
    for (const g of markers(all)) g.value = String(board.clue[where(g, n).key])
    const got = await solveDocument(all).then(r => r.solutions, err => err.message)
    assert.deepStrictEqual(got, [solution(board)], `${link}: every marker clued`)
    // A 0 at one end is TOTAL - N at the other, by the identity above, so
    // this covers both ends of the range.
    assert.ok(Object.values(board.clue).includes(0), `${link}: no marker with N first`)

    for (let i = 0; i < 4 * n; i++) {
      const old = entered(copy(doc), board)
      const m = markers(old)[i]
      const { key, target } = where(m, n)
      m.value = String(board.clue[key] + target)
      assert.ok(await refused(old), `${link}: ${key} passed its old-rule value`)
    }
  }

  // A typed 0 is a clue, not a blank: on a marker whose N is not first it
  // refuses the true grid.
  {
    const d = entered(copy(doc), board)
    const g = markers(d).find(g => board.clue[where(g, n).key] > 0)
    g.value = '0'
    assert.ok(await refused(d), `${link}: a 0 read as no clue`)
  }

  // The clue range tops out at TOTAL - N: one more is refused at setup.
  {
    const d = copy(doc)
    const g = markers(d)[0]
    const top = TOTAL - where(g, n).target
    g.value = String(top + 1)
    await assert.rejects(solveDocument(d), new RegExp(`Up to N: .* above ${top}`), `${link}: above the range`)
  }

  // The search runs on the 4x4 and 6x6 only: see the header.
  if (n === 9) continue

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
    ['a non-numeric value', (d, g) => { g.value = 'x' }, /Up to N: .* not a whole number/],
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
