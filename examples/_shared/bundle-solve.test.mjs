// Tests for bundle-solve.mjs's message-building and the real-solver seam.
// Run: node examples/_shared/bundle-solve.test.mjs
//
// The two seams under test (#429): `buildStartMessage`, a pure mapping from a
// decoded puzzle document to the worker's `start` message, and
// `solveDocument`, which loads the renamed solver bundle
// (docs/research/humanify-pedagogy/bundle.claude.js) and runs it for real.

import assert from 'assert'
import { buildStartMessage, solveDocument } from './bundle-solve-lib.mjs'

// ---- buildStartMessage: spec, grid, constraints, strategy ----
{
  const doc = {
    puzzle: {
      type: 'custom',
      width: 2,
      height: 2,
      cells: [{ given: true, value: 1 }, {}, {}, { given: true, value: 2 }],
      constraints: [{ type: 1, regions: [0, 0, 0, 0] }]
    }
  }
  const msg = buildStartMessage(doc)
  assert.strictEqual(msg.type, 'start')
  assert.deepStrictEqual(msg.spec, { size: { width: 2, height: 2 }, minDigit: 1, maxDigit: 2, digitCount: 2, type: 'custom' })
  // two words per cell: value then candidate mask; 4294967295 is "unset"
  assert.deepStrictEqual(msg.grid, [1, 0, 4294967295, 0, 4294967295, 0, 2, 0])
  assert.deepStrictEqual(msg.constraints, [{ config: { type: 1, regions: [0, 0, 0, 0] } }])
  assert.ok(Array.isArray(msg.strategy.stepTypes) && msg.strategy.stepTypes.length > 0)
  assert.strictEqual(msg.strategy.useRandomness, false)
  assert.strictEqual(msg.verbose, false)
}

// ---- buildStartMessage: declared minDigit/maxDigit pass through unchanged ----
{
  const doc = {
    puzzle: {
      type: 'custom',
      width: 11,
      height: 11,
      minDigit: 1,
      maxDigit: 9,
      cells: Array(121).fill({}),
      constraints: []
    }
  }
  const msg = buildStartMessage(doc)
  assert.strictEqual(msg.spec.minDigit, 1)
  assert.strictEqual(msg.spec.maxDigit, 9)
}

console.log('bundle-solve-lib: buildStartMessage ok')

// ---- solveDocument: the 406 GAC-demo without-GAC link has exactly one
// solution, matching CP-SAT (docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt,
// solved independently in this ticket's build, see the commit body) ----
{
  const CPSAT_SOLUTION = '265783149387149562941562783594627831726831495138495627413956278872314956659278314'
  const { decodeLinkFile } = await import('./bundle-solve-lib.mjs')
  const doc = decodeLinkFile(new URL('../../docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt', import.meta.url).pathname)
  const { solutions, ms } = await solveDocument(doc)
  assert.strictEqual(solutions.length, 1)
  assert.strictEqual(solutions[0], CPSAT_SOLUTION)
  assert.ok(typeof ms === 'number' && ms >= 0)
}
console.log('bundle-solve-lib: solveDocument unique-solution ok')

// A plain 4x4 sudoku (2x2 boxes) whose rows and columns are declared by the
// same "Rows & Columns" backend the shipped boards use
// (docs/research/406-gac-demo/tools/rowcol9-main.js, DifferentDigitsComponent
// per row/column since a bare custom doc has no built-in ones).
const ROWCOL_BACKEND = `
function postprocessJSON (json, input, helpers) {
  function getRowsAndColumns () {
    return [
      ['row ', helpers.geometry.getAllRows()],
      ['column ', helpers.geometry.getAllColumns()]
    ].flatMap(([type, lines]) =>
      [...lines].map((line, i) => ({ name: \`\${type}\${i + 1}\`, cells: line.map(c => c | 0) }))
    )
  }
  const components = getRowsAndColumns().map(({ name, cells }) => new DifferentDigitsComponent(name, cells))
  for (const component of components) puzzle.addConstraintComponent(component)
}
postprocessJSON(undefined, undefined, helpers)
`

function rowsAndColumnsConstraint () {
  return {
    type: 1000,
    input: {},
    style: {},
    definition: { name: 'Rows & Columns', input: [], backend: { type: 'code', code: ROWCOL_BACKEND }, components: [] }
  }
}

function boxRegionsConstraint (boxSize, width, height) {
  const regions = []
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      regions.push(Math.floor(r / boxSize) * (width / boxSize) + Math.floor(c / boxSize))
    }
  }
  return { type: 1, regions }
}

// ---- solveDocument: exactly two solutions ----
// A solved 4x4 grid with four cells blanked so that swapping two digit pairs
// across the top two boxes both still satisfy every row, column and box --
// found by brute-force CP-SAT search over which pairs to blank (recorded in
// the commit body), not re-derived here.
{
  const solved = [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1]
  ]
  const blanked = new Set(['0,0', '0,1', '2,0', '2,1'])
  const cells = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      cells.push(blanked.has(`${r},${c}`) ? {} : { given: true, value: solved[r][c] })
    }
  }
  const doc = {
    puzzle: {
      type: 'custom',
      width: 4,
      height: 4,
      cells,
      constraints: [boxRegionsConstraint(2, 4, 4), rowsAndColumnsConstraint()]
    }
  }
  const { solutions } = await solveDocument(doc)
  assert.strictEqual(solutions.length, 2)
  assert.notStrictEqual(solutions[0], solutions[1])
}
console.log('bundle-solve-lib: solveDocument two-solutions ok')

// ---- solveDocument: a custom component's update runs, and its throw makes
// the run throw. The bundle itself only logs a component's thrown error
// (logConstraintError, bundle.claude.js:9911) and carries on -- wrong for a
// batch scorer, so solveDocument makes console.error throw for the run
// (see its comment). ----
{
  const THROWING_MAIN = `
puzzle.addConstraintComponent(new ThrowingComponent('boom', [0]))
`
  const THROWING_COMPONENT = `
function* update (instance, puzzle) {
  throw new Error('deliberate test failure')
}
`
  const doc = {
    puzzle: {
      type: 'custom',
      width: 2,
      height: 2,
      cells: [{}, {}, {}, {}],
      constraints: [
        {
          type: 1000,
          input: {},
          style: {},
          definition: {
            name: 'Throws',
            input: [],
            backend: { type: 'code', code: THROWING_MAIN },
            components: [{ name: 'ThrowingComponent', code: THROWING_COMPONENT }]
          }
        }
      ]
    }
  }
  await assert.rejects(() => solveDocument(doc), /deliberate test failure/)
}
console.log('bundle-solve-lib: solveDocument throwing-component ok')
