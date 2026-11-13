// One end-to-end test for spec #951: the soundness harness's mock puzzle
// behaves like the app (slices #955-#958).
//
// Driven here on the real tree, in the order the spec states its decisions:
//
//   1. the mock applies a Change only when it is yielded (#955): a planted
//      component that builds a removal and never yields it goes red in
//      fuzzSoundness and in strengthSweep, while the same component yielding
//      it passes both;
//   2. a fuzz cannot skip validate (#956): a module that lost the validate its
//      file defines is refused by fuzzSoundness, and a planted validate that
//      rejects the truth goes red in the isofill-skyscraper combined fuzz,
//      built the way the shipped link registers its components;
//   3. the fuzz fails loudly at its pass cap (#958): a component that never
//      settles makes fixpointAll throw;
//   4. the migration is complete (#955, #958): no examples/**/*.mjs reads
//      `__mod` or drains `update` by hand with Array.from.
//
// WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
//   - the app: solve time (`just time`), how a link renders and solves in
//     sudokumaker.app, and anything a browser probe checks rather than a Node
//     or Python test asserts. This spec changed no shipped component and no
//     link, so nothing here reaches the app.
//   - the spec's regression net is held by the suites that already own it,
//     not re-run here: every soundness harness at zero violations (the
//     soundness fuzz in `just check-full`), each example's
//     update-strength.test.mjs, and the skyscraper and hit-counts
//     recovery-probe goldens byte-identical (their recovery-probe tests).
//   - #957's construct() migration of each harness is checked only through
//     those harnesses' own counts; this file does not count hand-built
//     instances, since a deliberately malformed one is allowed.
//   - docs/research/: its scripts are not scanned for `__mod` or hand drains.
//
// Run: node examples/_shared/spec_951_closing.test.mjs

import assert from 'assert'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import {
  installGlobals, makeIo, makeRng, makeSeeder, construct, patchSource,
  runUpdate, fixpointAll, fuzzSoundness, strengthSweep, makePuzzle
} from './harness-lib.mjs'
import { combinedBoard } from '../isofill-skyscraper/combined-board.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const SELF = 'examples/_shared/spec_951_closing.test.mjs'
const NEVER_YIELDED = /never yielded/

// 1. a removal counts only when it is yielded.
{
  installGlobals(1, 3)
  // Removes 3 from its first cell, which never holds the truth there (1):
  // sound, so the only way to go red is the unyielded Change.
  const yielding = { update: function * (inst, p) { yield p.removeCandidateFromCell(3, inst.cells[0]) } }
  const building = { update: function * (inst, p) { p.removeCandidateFromCell(3, inst.cells[0]) } }
  const truth = { 0: 1, 1: 2, 2: 3 }
  const fuzz = mod => fuzzSoundness('spec-951 planted', {
    iters: 3,
    log: () => {},
    draw: () => ({ truth, seed: () => [1, 2, 3], parts: [{ mod, inst: construct(mod, 'planted', [0, 1, 2]) }] })
  })
  assert.strictEqual(fuzz(yielding).ok, true, 'the yielding control passes fuzzSoundness')
  assert.throws(() => fuzz(building), NEVER_YIELDED, 'fuzzSoundness: a built, unyielded removal')

  const sweep = cur => strengthSweep('spec-951 planted', {
    cur,
    ref: yielding,
    apply: (mod, p) => runUpdate(mod, construct(mod, 'planted', [0, 1, 2]), p),
    states: [new Map([[0, [1, 3]], [1, [1, 2, 3]], [2, [1, 2, 3]]])]
  })
  assert.strictEqual(sweep(yielding).weaker, 0, 'the yielding control passes strengthSweep')
  assert.throws(() => sweep(building), NEVER_YIELDED, 'strengthSweep: a built, unyielded removal')
}

// 2. a fuzz cannot skip validate, on the shipped isofill-skyscraper board.
{
  const HERE = join(ROOT, 'examples', 'isofill-skyscraper')
  const { read, load } = makeIo(HERE)
  const { n, truth, parts } = combinedBoard(HERE, read)
  installGlobals(1, n)
  const FILES = ['IsofillComponent', 'SkyscraperOneSidedComponent']
  const MODS = Object.fromEntries(FILES.map(c => [c, load(`${c}.js`)]))
  const seeder = makeSeeder(makeRng(951).rnd, Array.from({ length: n }, (_, i) => i + 1))
  const fuzz = mods => fuzzSoundness('spec-951 combined', {
    iters: 3,
    log: () => {},
    draw: () => ({ truth, seed: seeder, parts: parts(mods) })
  })
  const shipped = fuzz(MODS)
  assert.strictEqual(shipped.failures, 0, 'the shipped combined board fuzzes clean')

  for (const ctor of FILES) {
    // validate dropped from a rest copy: the module still says its file defines one.
    const { validate, ...lost } = MODS[ctor]
    assert.strictEqual(typeof validate, 'function', `${ctor}.js defines validate`)
    assert.throws(() => fuzz({ ...MODS, [ctor]: lost }), /defines validate, but the module fuzzSoundness was handed lacks it/,
      `${ctor}: a module missing its file's validate is refused`)

    const rejecting = load(`${ctor}.js`, [], src => patchSource(src, 'function validate (instance, puzzle) {\n',
      'function validate (instance, puzzle) {\n  return false\n'))
    const planted = fuzz({ ...MODS, [ctor]: rejecting })
    assert.ok(planted.validateRejects > 0, `${ctor}: a validate that rejects the truth went unasked in the combined fuzz`)
    assert.strictEqual(planted.ok, false, `${ctor}: the combined fuzz stays green on a rejecting validate`)
  }
}

// 3. fixpointAll throws at its pass cap.
{
  installGlobals(1, 9)
  // Removes one candidate per pass, so a pass always changes something.
  const drip = {
    update: function * (inst, p) {
      const top = Math.max(...p._cand.get(0))
      if (p._cand.get(0).size > 1) yield p.removeCandidateFromCell(top, 0)
    }
  }
  const settles = makePuzzle({ 0: 1 }, () => [1, 2, 3])
  fixpointAll([{ mod: drip, inst: {} }], settles)
  assert.deepStrictEqual([...settles._cand.get(0)], [1], 'a component that settles within the cap returns quietly')
  const slow = makePuzzle({ 0: 1 }, () => Array.from({ length: 30 }, (_, i) => i + 1))
  assert.throws(() => fixpointAll([{ mod: drip, inst: {} }], slow), /never settled within \d+ passes/,
    'a component still pruning at the cap')
}

// 4. no example script still reads __mod or drains update by hand.
const SCRIPTS = readdirSync(join(ROOT, 'examples'), { recursive: true })
  .filter(f => f.endsWith('.mjs') && !f.split('/').some(s => s === 'node_modules' || s === 'vendor' || s.startsWith('.')))
  .map(f => join('examples', f))
  .filter(f => f !== SELF)
{
  const where = pattern => SCRIPTS.filter(f => pattern.test(readFileSync(join(ROOT, f), 'utf8')))
  assert.ok(SCRIPTS.length > 20, `only ${SCRIPTS.length} example scripts found: the scan read the wrong tree`)
  assert.deepStrictEqual(where(/__mod\b/), [], 'a script still reads inst.__mod')
  assert.deepStrictEqual(where(/Array\.from\(\s*(\w+\.)*update\(/), [], 'a hand-written Array.from(update(...)) drain')
}

console.log(`spec_951_closing.test.mjs: ${SCRIPTS.length} scripts scanned, all four decisions hold`)
