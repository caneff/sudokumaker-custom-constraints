// One end-to-end test for spec #897: the Node test harnesses and the mock
// puzzle after the 2026-11-06 audit sweep (slices #912-#915).
//
// Driven here on the real tree, in the order the spec states its decisions:
//
//   1. backend-runner is the one board mock and backend evaluator (ARCH-2):
//      no hand-built registrar is left in examples/, no other
//      `new Function` takes a `puzzle`, and a backend run through it reads
//      the board column first;
//   2. the mock puzzle answers for its own outcome (ARCH-6): no file outside
//      harness-lib and recovery-lib reads its stop, and a stop, an emptied
//      cell and a reset each read back the way a harness asks;
//   3. the harness-lib tests can fail (TEST-2, TEST-5): its all-seams-pass
//      log is its last statement, and no DigitSet block is left after it;
//   4. the duplicated fixtures have one home each (DUP-2, DUP-5): isofill's
//      boards live in fixture.mjs alone, and the hit-counts exclusion and
//      permutation fuzzes draw their full house through one function.
//
// WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
//   - the app: no shipped component and no link changed, so nothing here
//     reaches sudokumaker.app or its solve time (`just time`).
//   - the spec's testing decision is held by the suites that already own it,
//     not re-run here: every soundness harness at zero violations (the
//     soundness fuzz in `just check-full`) and the skyscraper and hit-counts
//     recovery-probe goldens byte-identical (their recovery-probe tests).
//   - docs/research/: examples/ code never loads research records
//     (check_research_loads.py), so the research scripts are not scanned
//     here; check_backend.mjs was moved onto runBackend by hand.
//   - the outcome-assert slice (#915's TEST-8, TEST-11, TEST-14): each
//     tightened test's mutation is recorded on its PR and the spec review.
//
// Run: node examples/_shared/spec_897_closing.test.mjs

import assert from 'assert'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { mockBoard, runBackend } from './backend-runner.mjs'
import { makePuzzle } from './harness-lib.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const scripts = dir => readdirSync(join(ROOT, dir), { recursive: true })
  .filter(f => /\.m?js$/.test(f) && !f.split('/').some(s => s === 'node_modules' || s.startsWith('.')))
  .map(f => join(dir, f))
const CODE = scripts('examples')
  .filter(f => !f.includes('/vendor/') && !f.endsWith('spec_897_closing.test.mjs'))
const text = f => readFileSync(join(ROOT, f), 'utf8')
const where = (pattern, except) => CODE.filter(f => !except.includes(f) && pattern.test(text(f)))

// 1. backend-runner is the one board mock and backend evaluator.
{
  const RUNNER = 'examples/_shared/backend-runner.mjs'
  assert.deepStrictEqual(where(/addConstraintComponent\s*:/, [RUNNER]), [], 'a hand-built registrar outside backend-runner')
  assert.deepStrictEqual(where(/new Function\([^)]*'puzzle'/, [RUNNER]), [], 'a backend evaluator outside backend-runner')
  const board = mockBoard({ width: 4, height: 2 })
  runBackend('puzzle.addConstraintComponent(new CellComponent(puzzle.getCellAt(3, 1)))', { puzzle: board })
  assert.deepStrictEqual(board.registered.map(c => c.args), [[7]], 'getCellAt(col, row) on a 4-wide board')
}

// 2. the mock puzzle answers for its own outcome.
{
  const LIBS = ['examples/_shared/harness-lib.mjs', 'examples/_shared/recovery-lib.mjs']
  assert.deepStrictEqual(where(/\._stopped\b/, LIBS), [], 'a read of the mock\'s private stop')
  const p = makePuzzle({ 0: 1, 1: 2 }, () => [1, 2])
  assert.deepStrictEqual([p.isDead(), p.stopMessage(), p.total()], [false, null, 4])
  p.stop('clash')
  assert.deepStrictEqual([p.isDead(), p.stopMessage()], [true, 'clash'])
  p.reset()
  assert.strictEqual(p.isDead(), false, 'reset clears the stop')
  p._cand.get(1).clear()
  assert.deepStrictEqual([p.isDead(), p.stopMessage()], [true, null], 'an emptied cell is dead with no stop')
}

// 3. the harness-lib tests can fail: nothing runs after the closing log.
{
  const lines = text('examples/_shared/harness-lib.test.mjs').trimEnd().split('\n')
  assert.match(lines.at(-1), /^console\.log\('harness-lib\.test\.mjs: all seams pass'\)$/, 'the log is the last line')
}

// 4. the duplicated fixtures have one home each.
{
  const isofill = where(/\bconst (bent|bentWide|rowsTall)\b/, []).filter(f => f.startsWith('examples/isofill/'))
  assert.deepStrictEqual(isofill, ['examples/isofill/fixture.mjs'], 'isofill boards defined outside fixture.mjs')
  const harness = text('examples/hit-counts/soundness-harness.mjs')
  assert.strictEqual(harness.match(/const drawFullHouseLine =/g).length, 1, 'one full-house draw in the hit-counts harness')
  assert.strictEqual(harness.match(/drawFullHouseLine\(/g).length, 2, 'both fuzzes call it')
}

console.log(`spec_897_closing.test.mjs: ${CODE.length} scripts scanned, all four decisions hold`)
