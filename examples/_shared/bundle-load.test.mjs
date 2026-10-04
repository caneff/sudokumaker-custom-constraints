// Tests for bundle-load.mjs (#660).
// Run: node examples/_shared/bundle-load.test.mjs

import assert from 'assert'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadBundle, BUNDLE_PATH } from './bundle-load.mjs'

const scratch = join(import.meta.dirname, '..', '..', '.scratch', 'bundle-load-test')
mkdirSync(scratch, { recursive: true })

// A named symbol comes back from the bundle's own scope.
{
  const b = loadBundle({ expose: ['LogicStepType', 'SolverState'] })
  assert.ok(Object.values(b.exposed.LogicStepType).includes('nakedSets'))
  assert.strictEqual(typeof b.exposed.SolverState, 'function')
  assert.strictEqual(typeof b.onmessage, 'function')
  assert.deepStrictEqual(b.drain(), [])
}

// An unknown symbol fails loud instead of coming back undefined.
assert.throws(() => loadBundle({ expose: ['noSuchBinding'] }), ReferenceError)

// A bundle whose bytes differ from the pinned SHA is refused.
{
  const changed = join(scratch, 'changed.js')
  writeFileSync(changed, readFileSync(BUNDLE_PATH, 'utf8').replace('\n', '\n// edited\n'))
  assert.throws(() => loadBundle({ bundlePath: changed }), /bundle changed/)
  const same = join(scratch, 'same.js')
  copyFileSync(BUNDLE_PATH, same)
  loadBundle({ bundlePath: same })
}

// The node counter counts SolverState.clone calls on this load only.
{
  const a = loadBundle({ countNodes: true })
  const b = loadBundle({ countNodes: true })
  assert.strictEqual(a.nodes(), 0)
  const SolverState = a.exposed.SolverState
  assert.strictEqual(typeof SolverState, 'function')
  const fake = Object.create(SolverState.prototype)
  assert.throws(() => SolverState.prototype.clone.call(fake)) // reaches the real clone
  assert.strictEqual(a.nodes(), 1)
  assert.strictEqual(b.nodes(), 0)
}

console.log('bundle-load: expose, unknown symbol, SHA refusal, node count ok')
